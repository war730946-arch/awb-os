const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestWaWebVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const path = require('path');
const fs = require('fs');
const { getBusinessByPhone, saveMessage, upsertCustomer, isSubscriptionActive, checkCanRespond, getSubscription, getCustomerMessages, createLead } = require('../database');
const { generateResponse } = require('../ai/engine');
const { processVoice } = require('../voice/processor');

process.env.NODE_OPTIONS = '--dns-result-order=verbatim';

const activeBots = new Map();
const processedMessages = new Set();

async function startBot(businessId, phoneNumber) {
  if (activeBots.has(businessId)) {
    console.log(`Bot already running for business ${businessId}`);
    return activeBots.get(businessId);
  }

  const isCloud = !!(process.env.RAILWAY_PUBLIC_DOMAIN || process.env.VERCEL || process.env.RENDER_EXTERNAL_URL);
  const authDir = isCloud
    ? path.join('/tmp', `auth_info_${businessId}`)
    : path.join(__dirname, `../../auth_info_${businessId}`);

  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const hasSession = fs.existsSync(path.join(authDir, 'creds.json'));

  const { version } = await fetchLatestWaWebVersion().catch(() => ({ version: [2, 3000, 1023223821] }));

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    browser: ['AWB-OS', 'Chrome', '1.0.0'],
    syncFullHistory: false,
    markOnlineOnConnect: true,
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 15000,
    defaultQueryTimeoutMs: 60000
  });

  sock.ev.on('creds.update', saveCreds);

  let lastQr = '';
  let qrTimeout;

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr && qr !== lastQr) {
      lastQr = qr;
      qrcode.generate(qr, { small: true });
      const d = new Date();
      console.log(`\n[${d.toLocaleTimeString()}] 📱 QR for ${phoneNumber} (scan within 2 min)`);
      const { updateBusiness } = require('../database');
      await updateBusiness(businessId, { whatsapp_qr: qr, whatsapp_connected: false });

      try {
        const qrPng = require('qrcode');
        await qrPng.toFile(path.join(__dirname, '../../wa-qr.png'), qr, { width: 500, margin: 2 });
        console.log('  QR image saved: wa-qr.png');
      } catch (e) {}

      clearTimeout(qrTimeout);
      qrTimeout = setTimeout(async () => {
        const biz = await getBusinessByPhone(phoneNumber);
        if (biz && !biz.whatsapp_connected) {
          console.log('  QR expired (2 min). Waiting for external restart...');
          activeBots.delete(businessId);
          sock.end(new Error('QR timeout'));
          const { updateBusiness } = require('../database');
          await updateBusiness(businessId, { whatsapp_qr: '' });
        }
      }, 120000);
    }

    if (connection === 'open') {
      clearTimeout(qrTimeout);
      console.log(`\n✅ WhatsApp CONNECTED for ${phoneNumber}`);
      const { updateBusiness } = require('../database');
      await updateBusiness(businessId, {
        whatsapp_connected: true,
        phone_number: phoneNumber,
        whatsapp_qr: ''
      });

      const biz = await getBusinessByPhone(phoneNumber);
      if (biz && biz.pairing_code) {
        await updateBusiness(businessId, { pairing_code: '' });
      }
    }

    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      console.log(`❌ Closed ${phoneNumber}.`, lastDisconnect?.error?.message?.substring(0, 80) || '');

      if (code === DisconnectReason.loggedOut) {
        console.log('  → Logged out, removing session');
        activeBots.delete(businessId);
        try { fs.rmSync(authDir, { recursive: true }); } catch (e) {}
        const { updateBusiness } = require('../database');
        await updateBusiness(businessId, { whatsapp_connected: false, whatsapp_qr: '' });
        return;
      }

      if (hasSession && (code === DisconnectReason.connectionClosed || code === DisconnectReason.connectionLost)) {
        console.log('  → Session exists, reconnecting in 3s...');
        setTimeout(() => startBot(businessId, phoneNumber), 3000);
        return;
      }
    }
  });

  sock.ev.on('messages.upsert', async (msg) => {
    const message = msg.messages[0];
    if (!message.key || !message.message || message.key.fromMe) return;

    const msgId = message.key.id;
    if (processedMessages.has(msgId)) return;
    processedMessages.add(msgId);
    if (processedMessages.size > 1000) {
      const arr = [...processedMessages];
      processedMessages.clear();
      arr.slice(-500).forEach(id => processedMessages.add(id));
    }

    const userPhone = message.key.remoteJid?.replace('@s.whatsapp.net', '');
    if (!userPhone) return;

    const business = await getBusinessByPhone(phoneNumber);
    if (!business) return;

    const canRespond = await checkCanRespond(businessId, userPhone);
    if (!canRespond.allowed) {
      if (canRespond.reason === 'limit_reached') {
        await sock.sendMessage(message.key.remoteJid, {
          text: `⏳ *Free Limit Reached*\n\nYou have used your ${canRespond.max} free responses for today.\nTo continue, please upgrade the subscription.\n\nContact admin to upgrade.`
        });
      } else {
        await sock.sendMessage(message.key.remoteJid, {
          text: `⏳ *Trial Expired*\n\nAI assistant is paused.\nPlease renew subscription to continue.\nContact admin to upgrade.`
        });
      }
      return;
    }

    let userText = '';

    if (message.message.conversation) {
      userText = message.message.conversation;
    } else if (message.message.extendedTextMessage?.text) {
      userText = message.message.extendedTextMessage.text;
    } else if (message.message.imageMessage) {
      await sock.sendMessage(message.key.remoteJid, {
        text: `📸 I received your image. I can't view images, but feel free to describe it or ask me something!`
      });
      return;
    } else if (message.message.videoMessage) {
      return;
    } else if (message.message.audioMessage) {
      try {
        const buffer = await sock.downloadMediaMessage(message);
        const result = await processVoice(buffer);
        if (result.success) userText = result.text;
        else {
          if (result.error === 'Whisper not installed') {
            await sock.sendMessage(message.key.remoteJid, {
              text: '🎵 Voice transcription is not available. Please send a text message.'
            });
          }
          userText = '';
        }
      } catch (err) {
        console.error('Voice download error:', err);
      }
    }

    if (!userText.trim()) return;

    console.log(`\n💬 ${userPhone}: ${userText.substring(0, 100)}`);

    const customer = await upsertCustomer(businessId, userPhone, '');
    const history = await getCustomerMessages(businessId, userPhone, 10);

    try {
      const { reply, intent } = await generateResponse(business, userText, history);
      await sock.sendMessage(message.key.remoteJid, { text: reply });
      await saveMessage(businessId, userPhone, userText, reply, intent);
      console.log(`🤖 Reply: ${reply.substring(0, 100)}`);

      if (['booking', 'pricing'].includes(intent)) {
        await createLead(businessId, customer?.id, userPhone, customer?.name, intent);
      }
    } catch (err) {
      console.error('AI error:', err.message);
      await sock.sendMessage(message.key.remoteJid, {
        text: 'Thanks for your message! We will get back to you shortly.'
      });
    }
  });

  activeBots.set(businessId, sock);
  if (hasSession) console.log(`  → Session found for ${phoneNumber}, restoring...`);
  return sock;
}

async function requestPairing(businessId, phoneNumber) {
  if (activeBots.has(businessId)) {
    const sock = activeBots.get(businessId);
    try {
      const code = await sock.requestPairingCode(phoneNumber);
      console.log(`🔑 Pairing code for ${phoneNumber}: ${code}`);
      const { updateBusiness } = require('../database');
      await updateBusiness(businessId, { pairing_code: code });
      return { success: true, code };
    } catch (err) {
      console.error('Pairing code error:', err.message);
      return { success: false, error: err.message };
    }
  }
  return { success: false, error: 'Bot not active' };
}

async function stopBot(businessId) {
  const sock = activeBots.get(businessId);
  if (sock) {
    sock.end(new Error('Bot stopped by admin'));
    activeBots.delete(businessId);
    const { updateBusiness } = require('../database');
    await updateBusiness(businessId, { whatsapp_connected: false });
  }
}

async function sendMessage(businessId, remoteJid, text) {
  const sock = activeBots.get(businessId);
  if (!sock) throw new Error('Bot not active');
  await sock.sendMessage(remoteJid, { text });
}

function getBotStatus(businessId) {
  return activeBots.has(businessId);
}

module.exports = { startBot, stopBot, sendMessage, getBotStatus, requestPairing };
