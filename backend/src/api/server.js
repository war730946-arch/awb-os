const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const http = require('http');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const businessRoutes = require('./routes/businesses');
const messageRoutes = require('./routes/messages');
const subscriptionRoutes = require('./routes/subscriptions');
const paymentRoutes = require('./routes/payments');
const { setupSocket } = require('./socket');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3456;

const corsOptions = {
  origin: [
    process.env.FRONTEND_URL,
    'http://localhost:3000',
    'http://localhost:3456',
    'https://frontend-nine-blue-20.vercel.app',
    'https://jubilant-hope-production-ccfa.up.railway.app'
  ].filter(Boolean),
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

const io = setupSocket(server, corsOptions);

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
    const users = await db.getUserByEmail('admin@awb-os.com');
    let biz = null;
    if (users) {
      const businesses = await db.getUserBusinesses(users.id);
      if (businesses.length > 0) biz = businesses[0];
    }
    const qr = biz?.whatsapp_qr || '';
    const connected = biz?.whatsapp_connected || false;
    const phone = biz?.phone_number || '923281146929';
    res.send(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AWB-OS | Admin</title><script>setInterval(()=>fetch('/api/health').then(r=>r.json()).then(d=>{let s=document.getElementById('status');s&&(s.textContent=d.status==='ok'?'Online':'Offline')}),10e3)</script><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,-apple-system,sans-serif;background:#f0f2f5;min-height:100vh}.top{background:#1a1a2e;color:#fff;padding:16px 24px;display:flex;justify-content:space-between;align-items:center}.top h1{font-size:20px}.top span{font-size:12px;color:#7c4dff}.container{max-width:800px;margin:24px auto;padding:0 16px}.card{background:#fff;border-radius:12px;padding:24px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,.1)}.card h2{font-size:16px;margin-bottom:12px;color:#333}.flex{display:flex;gap:12px;flex-wrap:wrap;align-items:center}.badge{padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600}.badge-green{background:#d4edda;color:#155724}.badge-red{background:#f8d7da;color:#721c24}.badge-blue{background:#d1ecf1;color:#0c5460}.qr-box{background:#fff;border:2px dashed #ddd;border-radius:12px;padding:16px;display:inline-block}.qr-box img{width:280px;height:280px}.code{font-size:32px;letter-spacing:8px;color:#7c4dff;font-family:monospace;font-weight:700}.input{width:100%;padding:10px 14px;border:1px solid #ddd;border-radius:8px;font-size:14px;margin-bottom:10px}.btn{padding:10px 20px;border-radius:8px;font-weight:600;font-size:14px;cursor:pointer;border:none}.btn-primary{background:#7c4dff;color:#fff}.btn-primary:hover{background:#6a3de6}.btn-secondary{background:#e9ecef;color:#333}.btn-danger{background:#dc3545;color:#fff}.text-center{text-align:center}.text-gray{color:#666;font-size:13px}.text-green{color:#00c853;font-weight:600}body{font-family:system-ui,-apple-system,sans-serif;background:#f0f2f5;margin:0}</style></head><body><div class="top"><h1>AWB-OS</h1><div><span id="status">Disconnected</span></div></div><div class="container"><div class="card"><h2>WhatsApp Bot</h2><div class="flex"><span class="badge ${connected ? 'badge-green' : 'badge-red'}">${connected ? 'Connected' : 'Not Connected'}</span><span class="badge badge-blue">${phone}</span></div>${qr ? `<div class="qr-box"><img src="/qr.png" alt="QR"></div>` : `<p class="text-gray">Bot starting up... QR will appear here automatically</p>`}</div></div></body></html>`);
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

module.exports = { app: server, PORT, io };
