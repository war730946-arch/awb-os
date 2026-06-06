require('dotenv').config();
process.env.DATABASE_URL = '';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const https = require('https');

const db = require('./src/database');
const { app, PORT } = require('./src/api/server');

process.env.NODE_OPTIONS = '--dns-result-order=verbatim';
process.env.QRSVG = 'true'; // signal bot to generate PNG QR

const RAILWAY_API = 'jubilant-hope-production-ccfa.up.railway.app';

function railwayRequest(method, pathname, token, body) {
  return new Promise((resolve) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const data = body ? JSON.stringify(body) : null;
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    const opts = { hostname: RAILWAY_API, path: pathname, method, headers, timeout: 15000 };
    const r = https.request(opts, (res) => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => resolve({ status: res.statusCode, body: b }));
    });
    r.on('error', e => resolve({ status: 0, error: e.message }));
    r.on('timeout', () => { r.destroy(); resolve({ status: 0, error: 'timeout' }); });
    if (data) r.write(data);
    r.end();
  });
}

async function railwayLogin() {
  const res = await railwayRequest('POST', '/api/auth/login', null, { email: 'admin@awb-os.com', password: 'Admin@123456' });
  if (res.status === 200) { const d = JSON.parse(res.body); return d.token; }
  return null;
}

async function syncToRailway(business) {
  try {
    const token = await railwayLogin();
    if (!token) return;
    const bizRes = await railwayRequest('GET', '/api/businesses', token);
    if (bizRes.status !== 200) return;
    const bizData = JSON.parse(bizRes.body);
    const remoteBiz = bizData.businesses[0];
    if (!remoteBiz) return;

    const update = {};
    if (business.whatsapp_qr && business.whatsapp_qr !== remoteBiz.whatsapp_qr) update.whatsapp_qr = business.whatsapp_qr;
    if (business.whatsapp_connected !== remoteBiz.whatsapp_connected) update.whatsapp_connected = business.whatsapp_connected;
    if (business.pairing_code && business.pairing_code !== remoteBiz.pairing_code) update.pairing_code = business.pairing_code;
    if (business.phone_number) update.phone_number = business.phone_number;

    if (Object.keys(update).length > 0) {
      await railwayRequest('PUT', '/api/businesses/' + remoteBiz.id, token, update);
      console.log('  → Synced to Railway:', Object.keys(update).join(', '));
    }
  } catch (e) {
    console.log('  Sync error:', e.message);
  }
}

async function main() {
  if (db.init) await db.init();

  let user = await db.getUserByEmail('admin@awb-os.com');
  if (!user) {
    const hash = crypto.createHash('sha256').update('Admin@123456').digest('hex');
    user = await db.createUser('admin@awb-os.com', hash, 'Admin');
  }
  const businesses = await db.getUserBusinesses(user.id);
  let business;
  if (businesses.length === 0) {
    business = await db.createBusiness({ user_id: user.id, name: 'My WhatsApp Business', type: 'retail', phone_number: '923281146929', description: 'AWB-OS Business', location: 'Main City' });
  } else {
    business = businesses[0];
  }

  const actualPort = PORT || 3456;
  app.listen(actualPort, () => {
    console.log(`\n╔══════════════════════════════════════╗`);
    console.log(`║     AWB-OS WhatsApp Bot             ║`);
    console.log(`║     AI-powered Business OS          ║`);
    console.log(`╠══════════════════════════════════════╣`);
    console.log(`║  🌐  API:      http://localhost:${actualPort}`);
    console.log(`║  🖼️  QR Img:   http://localhost:${actualPort}/qr.png`);
    console.log(`║  📱  Bot API:  http://localhost:${actualPort}/api`);
    console.log(`║  📡  Sync →    ${RAILWAY_API}`);
    console.log(`╚══════════════════════════════════════╝\n`);
  });

  // Start WhatsApp bot
  try {
    const bot = require('./src/whatsapp/bot');
    bot.startBot(business.id, business.phone_number || '923281146929');
    console.log('🤖 Starting WhatsApp bot...\n');
  } catch (e) {
    console.log('Bot module unavailable:', e.message);
  }

  // Watch local DB and sync changes to Railway every 5s
  let lastSyncedQr = '';
  let lastSyncedConnected = false;
  setInterval(async () => {
    try {
      const current = await db.getBusinessById(business.id);
      if (!current) return;
      business = current;

      const qrChanged = current.whatsapp_qr && current.whatsapp_qr !== lastSyncedQr;
      const connChanged = current.whatsapp_connected !== lastSyncedConnected;

      if (qrChanged || connChanged) {
        if (qrChanged) lastSyncedQr = current.whatsapp_qr;
        if (connChanged) lastSyncedConnected = current.whatsapp_connected;
        await syncToRailway(current);
      }

      if (current.whatsapp_qr && current.whatsapp_qr.length > 10) {
        try {
          const qrImage = require('qrcode');
          const pngPath = path.join(__dirname, 'wa-qr.png');
          await qrImage.toFile(pngPath, current.whatsapp_qr, { width: 500, margin: 2 });
        } catch (e) {}
      }
    } catch (e) {}
  }, 5000);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
