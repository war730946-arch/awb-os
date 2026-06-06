const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const businessRoutes = require('./routes/businesses');
const messageRoutes = require('./routes/messages');
const subscriptionRoutes = require('./routes/subscriptions');
const paymentRoutes = require('./routes/payments');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(morgan('dev'));

app.get('/qr.png', async (req, res) => {
  try {
    const db = require('../database');
    const users = await db.getUserByEmail('admin@awb-os.com');
    if (!users) return res.status(404).end();
    const businesses = await db.getUserBusinesses(users.id);
    const biz = businesses[0];
    if (!biz || !biz.whatsapp_qr) return res.status(404).end();
    const qrImage = require('qrcode');
    const png = await qrImage.toBuffer(biz.whatsapp_qr, { width: 500, margin: 2, type: 'png' });
    res.set('Content-Type', 'image/png');
    res.send(png);
  } catch(e) { res.status(500).end(); }
});

app.get('/', async (req, res) => {
  try {
    const db = require('../database');
    const users = await db.getUserByEmail ? db.getUserByEmail('admin@awb-os.com') : null;
    let qr = '', connected = false, phone = '923281146929', businessId = '';
    if (users) {
      const businesses = await db.getUserBusinesses(users.id);
      if (businesses.length > 0) {
        const biz = businesses[0];
        qr = biz.whatsapp_qr || '';
        connected = biz.whatsapp_connected || false;
        phone = biz.phone_number || phone;
        businessId = biz.id;
      }
    }
    let pairingCode = '';
    if (businessId) {
      try { const activeBots = require('../whatsapp/bot'); const c = await activeBots.requestPairing(businessId, phone).catch(() => {}); if (c?.code) pairingCode = c.code; } catch(e) {}
    }
    res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AWB-OS Bot</title><script>setTimeout(()=>location.reload(),3000)</script><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,-apple-system,sans-serif;background:#0f0f0f;color:#fff;display:flex;justify-content:center;align-items:center;min-height:100vh;padding:20px}.card{background:#1a1a2e;border-radius:16px;padding:40px;max-width:500px;width:100%;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,.5)}.logo{font-size:48px;margin-bottom:8px}h1{font-size:22px;margin-bottom:4px;color:#fff}.sub{color:#888;font-size:14px;margin-bottom:24px}.status{display:inline-block;padding:6px 16px;border-radius:20px;font-size:13px;font-weight:600;margin-bottom:24px}.connected{background:#00c85320;color:#00c853;border:1px solid #00c853}.disconnected{background:#ff525220;color:#ff5252;border:1px solid #ff5252}.qr-box{background:#fff;border-radius:12px;padding:20px;display:inline-block;margin-bottom:20px}.qr-box img{width:260px;height:260px;image-rendering:pixelated}.pairing{background:#252540;border-radius:12px;padding:16px;margin-top:16px}.pairing h3{font-size:14px;color:#aaa;margin-bottom:8px}.pairing .code{font-size:28px;font-weight:700;letter-spacing:6px;color:#7c4dff;font-family:monospace}.phone{color:#666;font-size:13px;margin-top:12px}a{color:#7c4dff;text-decoration:none}.btn{display:inline-block;margin-top:20px;padding:12px 24px;background:#7c4dff;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px}hr{border:0;height:1px;background:#333;margin:20px 0}</style></head><body><div class="card"><div class="logo">📱</div><h1>AWB-OS WhatsApp Bot</h1><p class="sub">${phone}</p><div class="status ${connected?'connected':'disconnected'}">${connected?'✅ Connected':'⏳ Not Connected'}</div>${connected?'<div style="padding:30px 0"><div style="font-size:64px">✅</div><h2 style="color:#00c853">WhatsApp Connected!</h2></div>':''}${qr && !connected ? `<div class="qr-box"><img src="/qr.png" alt="QR Code"/></div>${pairingCode ? `<div class="pairing"><h3>Pairing Code</h3><div class="code">${pairingCode}</div></div>` : ''}<p class="phone">WhatsApp → Linked Devices → Scan QR or enter code</p>` : ''}${!connected && !qr ? '<p style="color:#888">Initializing...</p>' : ''}<a href="/" class="btn">↻ Refresh</a><hr><p style="color:#444;font-size:12px">AWB-OS v1.0</p></div></body></html>`);
  } catch(e) {
    res.send(`<!DOCTYPE html><html><body><h3>AWB-OS</h3><p>${e.message}</p></body></html>`);
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', system: 'AWB-OS', version: '1.0.0' });
});

app.use('/api/auth', authRoutes);
app.use('/api/businesses', businessRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/payments', paymentRoutes);

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = { app, PORT };
