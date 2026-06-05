require('dotenv').config();
process.env.DATABASE_URL = '';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const db = require('./src/database');
const { app, PORT } = require('./src/api/server');

process.env.NODE_OPTIONS = '--dns-result-order=verbatim';

let business;

async function main() {
  console.log('\n=== AWB-OS Local Server + Bot ===\n');

  if (db.init) await db.init();
  console.log('Local database ready');

  let user;
  try { user = await db.getUserByEmail('admin@awb-os.com'); } catch (e) {}
  if (!user) {
    const hash = crypto.createHash('sha256').update('Admin@123456').digest('hex');
    user = await db.createUser('admin@awb-os.com', hash, 'Admin');
    console.log('Created admin: admin@awb-os.com / Admin@123456');
  } else {
    console.log('Admin user exists');
  }

  let businesses = await db.getUserBusinesses(user.id);
  if (businesses.length === 0) {
    business = await db.createBusiness({
      user_id: user.id, name: 'My Business', type: 'general',
      phone_number: '923281146929', description: 'A general business.',
      location: 'Main City'
    });
    console.log('Created business for 923281146929');
  } else {
    business = businesses[0];
    console.log('Business:', business.phone_number, business.id);
  }

  // Start API server
  app.listen(PORT, () => {
    console.log(`API Server: http://localhost:${PORT}`);
    console.log(`Health: http://localhost:${PORT}/api/health`);
    console.log(`Login: POST /api/auth/login with admin@awb-os.com / Admin@123456`);
  });

  // Start WhatsApp bot
  await startBot();
}

async function startBot() {
  let pairingAttempted = false;
  const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestWaWebVersion } = require('@whiskeysockets/baileys');
  const qrcodeTerminal = require('qrcode-terminal');
  const { saveMessage, upsertCustomer, getCustomerMessages, updateBusiness } = require('./src/database');
  const { generateResponse } = require('./src/ai/engine');

  const authDir = path.join(__dirname, `auth_info_${business.id}`);
  if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const { version } = await fetchLatestWaWebVersion().catch(() => ({ version: [2, 3000, 1023223821] }));

  const sock = makeWASocket({
    version, auth: state, printQRInTerminal: false,
    browser: ['AWB-OS', 'Chrome', '1.0.0'],
    syncFullHistory: false, markOnlineOnConnect: true,
    connectTimeoutMs: 30000, keepAliveIntervalMs: 25000
  });

  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      qrcodeTerminal.generate(qr, { small: true });
      console.log(`\nQR Code for ${business.phone_number}`);
      console.log(`Open WhatsApp > Linked Devices > Scan QR\n`);
      await updateBusiness(business.id, { whatsapp_qr: qr, whatsapp_connected: false });
      try { require('qrcode').toFile(path.join(__dirname, 'wa-qr.png'), qr, { width: 500, margin: 2 }); } catch (e) {}

      if (qr && !pairingAttempted) {
        pairingAttempted = true;
        try {
          const code = await sock.requestPairingCode(business.phone_number);
          console.log(`\n✦ PAIRING CODE: ${code} ✦`);
          console.log(`Enter in WhatsApp > Linked Devices > Link with Phone Number\n`);
        } catch (e) {
          console.log('Pairing code not available, use QR instead');
        }
      }
    }
    if (connection === 'open') {
      console.log(`\n✅ WhatsApp CONNECTED! Bot running.\n`);
      await updateBusiness(business.id, { whatsapp_connected: true, whatsapp_qr: '' });
    }
    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      const errMsg = lastDisconnect?.error?.message || '';
      console.log('Disconnected:', errMsg);
      await updateBusiness(business.id, { whatsapp_qr: '' });
      if (shouldReconnect) {
        if (errMsg === 'Connection Failure') {
          try { fs.unlinkSync(path.join(authDir, 'creds.json')); } catch (e) {}
        }
        console.log('Reconnecting in 3s...');
        setTimeout(startBot, 3000);
      }
    }
  });

  sock.ev.on('messages.upsert', async (msg) => {
    const message = msg.messages[0];
    if (!message.key || !message.message || message.key.fromMe) return;
    const userPhone = message.key.remoteJid?.replace('@s.whatsapp.net', '');
    if (!userPhone) return;
    const text = message.message.conversation || message.message.extendedTextMessage?.text || '';
    if (!text) return;
    console.log(`\n[${userPhone}] ${text}`);
    try {
      const customer = await upsertCustomer(business.id, userPhone, '');
      const history = await getCustomerMessages(business.id, userPhone, 10);
      let reply;
      try {
        const result = await generateResponse(business, text, history);
        reply = result.reply || result;
      } catch (e) {
        const templates = [
          'Thank you for your message! We will get back to you shortly.',
          'Thanks for reaching out! We are reviewing your query.',
          'We received your message. For immediate help, call us during business hours (9 AM - 6 PM).',
          'Thanks for contacting us! We will respond as soon as possible.',
          'Your message has been noted. Our team will attend to your inquiry shortly.'
        ];
        reply = templates[Math.floor(Math.random() * templates.length)];
      }
      await sock.sendMessage(message.key.remoteJid, { text: reply });
      await saveMessage(business.id, customer?.id || '', userPhone, text, reply, 'inquiry');
      console.log(`[Bot] ${reply}\n`);
    } catch (err) {
      console.error('Error:', err.message);
    }
  });

  console.log(`\n🤖 Bot starting for ${business.phone_number}`);
  console.log(`Auth: ${authDir}\n`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
