const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestWaWebVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

const API_URL = process.env.API_URL || 'http://localhost:3001';
const AUTH_DIR = path.join(__dirname, 'auth_info');
const PHONE_FILE = path.join(__dirname, 'bot-phone.txt');

let botPhone = '';
if (fs.existsSync(PHONE_FILE)) botPhone = fs.readFileSync(PHONE_FILE, 'utf-8').trim();

async function getBusinessByPhone(phone) {
  try {
    const { data } = await axios.get(`${API_URL}/api/business/by-phone/${encodeURIComponent(phone)}`);
    return data;
  } catch (e) {
    if (e.response?.status === 404) return null;
    console.error('Error fetching business:', e.message);
    return null;
  }
}

async function handleIncomingMessage(businessId, userPhone, messageText) {
  try {
    const { data } = await axios.post(`${API_URL}/api/bot/incoming`, { businessId, userPhone, messageText });
    return data;
  } catch (e) {
    console.error('Error processing message:', e.message);
    return { reply: 'I am facing a technical issue. Please try again in a moment.', allowed: true };
  }
}

async function startBot() {
  if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

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
      console.log('\n=== SCAN QR CODE WITH WHATSAPP ===');
      console.log('Open WhatsApp > Linked Devices > Link a Device\n');
    }

    if (connection === 'open') {
      console.log('\n✅ WhatsApp Bot Connected!');
      const user = sock.user;
      if (user?.id) {
        botPhone = user.id.split(':')[0].replace('@s.whatsapp.net', '');
        fs.writeFileSync(PHONE_FILE, botPhone);
        console.log(`Bot Phone: ${botPhone}`);

        const business = await getBusinessByPhone(botPhone);
        if (business) {
          console.log(`Connected business: ${business.name}`);
          try {
            await axios.put(`${API_URL}/api/businesses/${business.id}`, {
              whatsapp_connected: true,
              whatsapp_qr: ''
            }, { headers: { Authorization: `Bearer ${process.env.API_TOKEN || ''}` } });
          } catch (e) { /* ignore auth errors on public endpoints */ }
        } else {
          console.log('No business found for this phone number.');
          console.log('Create a business first, and set its phone number to: ' + botPhone);
        }
      }
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log(`❌ Disconnected. Reconnect: ${shouldReconnect}`);
      if (shouldReconnect) {
        console.log('Reconnecting in 5 seconds...');
        setTimeout(startBot, 5000);
      }
    }
  });

  sock.ev.on('messages.upsert', async (msg) => {
    const message = msg.messages[0];
    if (!message.key || !message.message || message.key.fromMe) return;

    const userPhone = message.key.remoteJid?.replace('@s.whatsapp.net', '');
    if (!userPhone || !botPhone) return;

    const business = await getBusinessByPhone(botPhone);
    if (!business) return;

    let userText = '';
    if (message.message.conversation) {
      userText = message.message.conversation;
    } else if (message.message.extendedTextMessage?.text) {
      userText = message.message.extendedTextMessage.text;
    } else if (message.message.imageMessage) {
      await sock.sendMessage(message.key.remoteJid, { text: '📸 I received your image. Please describe it or ask me something!' });
      return;
    } else if (message.message.audioMessage) {
      await sock.sendMessage(message.key.remoteJid, { text: '⏳ Processing your voice message...' });
      return;
    } else {
      return;
    }

    if (!userText.trim()) return;

    const result = await handleIncomingMessage(business.id, userPhone, userText);

    if (result.reply) {
      await sock.sendMessage(message.key.remoteJid, { text: result.reply });
    }
  });

  sock.ev.on('messages.update', () => {});
}

startBot().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught:', err.message);
});
process.on('unhandledRejection', (err) => {
  console.error('Unhandled:', err.message);
});
