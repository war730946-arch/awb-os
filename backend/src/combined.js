const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const db = require('./database');

// API routes
const authRoutes = require('./api/routes/auth');
const businessRoutes = require('./api/routes/businesses');
const messageRoutes = require('./api/routes/messages');
const subscriptionRoutes = require('./api/routes/subscriptions');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// API routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', system: 'AWB-OS', version: '1.0.0' });
});
app.use('/api/auth', authRoutes);
app.use('/api/businesses', businessRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/subscriptions', subscriptionRoutes);

// Serve frontend static files
const staticDir = path.join(__dirname, '../../frontend/out');
app.use(express.static(staticDir));

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return;
  res.sendFile(path.join(staticDir, 'index.html'));
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  console.log(`
╔═══════════════════════════════════════════╗
║     AWB-OS v1.0.0                        ║
║     AI WhatsApp Business OS              ║
║     Starting up...                       ║
╚═══════════════════════════════════════════╝
  `);

  if (db.init) {
    try {
      await db.init();
      console.log('✅ Database ready');
    } catch (err) {
      console.error('❌ Database init failed:', err.message);
      process.exit(1);
    }
  }

  app.listen(PORT, () => {
    console.log(`✅ AWB-OS running on http://localhost:${PORT}`);
    console.log(`📡 API: http://localhost:${PORT}/api/health`);
    console.log(`🌐 App: http://localhost:${PORT}`);
  });
}

start();
