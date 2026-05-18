const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestWaWebVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const path = require('path');
const fs = require('fs');
const { getBusinessByPhone, saveMessage, upsertCustomer, isSubscriptionActive, checkCanRespond, getSubscription, createLead } = require('../database');
const { generateResponse } = require('../ai/engine');
const { processVoice } = require('../voice/processor');

process.env.NODE_OPTIONS = '--dns-result-order=verbatim';

const activeBots = new Map();

async function startBot(businessId, phoneNumber) {
  if (activeBots.has(businessId)) {
    console.log(`Bot already running for business ${businessId}`);
    return activeBots.get(businessId);
  }

  const isCloud = !!(process.env.RAILWAY_PUBLIC_DOMAIN || process.env.VERCEL || process.env.RENDER_EXTERNAL_URL);
  const authDir = isCloud
    ? path.join('/tmp', `auth_info_${businessId}`)
    : path.join(__dirname, `../../auth_info_${businessId}`);
  if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(authDir);

  const { version } = await fetchLatestWaWebVersion().catch(() => ({ version: [2, 3000, 1023223821] }));

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    browser: ['AWB-OS', 'Chrome', '1.0.0'],
    syncFullHistory: false,
    markOnlineOnConnect: true,
    connectTimeoutMs: 30000,
    keepAliveIntervalMs: 25000,
    generateHighQualityLink: true,
    linkPreviewImage: false,
    patch: true
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      qrcode.generate(qr, { small: true });
      console.log(`\n📱 QR Code for Business ${businessId} (${phoneNumber})`);
      console.log('Scan with WhatsApp to connect!\n');
      const { updateBusiness } = require('../database');
      await updateBusiness(businessId, { whatsapp_qr: qr, whatsapp_connected: false });
    }

    if (connection === 'open') {
      console.log(`✅ WhatsApp connected for ${phoneNumber}`);
      const { updateBusiness } = require('../database');
      await updateBusiness(businessId, {
        whatsapp_connected: true,
        phone_number: phoneNumber,
        whatsapp_qr: ''
      });
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      console.log(`❌ Connection closed for ${phoneNumber}. Reconnect: ${shouldReconnect}`, lastDisconnect?.error?.message || '');

      if (shouldReconnect) {
        console.log('🔄 Reconnecting in 5 seconds...');
        setTimeout(() => startBot(businessId, phoneNumber), 5000);
      } else {
        activeBots.delete(businessId);
        const { updateBusiness } = require('../database');
        await updateBusiness(businessId, { whatsapp_connected: false, whatsapp_qr: '' });
      }
    }
  });

  sock.ev.on('messages.upsert', async (msg) => {
    const message = msg.messages[0];
    if (!message.key || !message.message || message.key.fromMe) return;

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
    let isVoice = false;

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
      isVoice = true;
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

    const customer = await upsertCustomer(businessId, userPhone, '');
    const history = [];

    const { reply, intent } = await generateResponse(business, userText, history);

    await sock.sendMessage(message.key.remoteJid, { text: reply });

    await saveMessage(businessId, userPhone, userText, reply, intent);

    if (['booking', 'pricing'].includes(intent)) {
      await createLead(businessId, customer?.id, userPhone, customer?.name, intent);
    }
  });

  activeBots.set(businessId, sock);
  return sock;
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

module.exports = { startBot, stopBot, sendMessage, getBotStatus };
