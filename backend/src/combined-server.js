require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const db = require('./database');

// API routes
const authRoutes = require('./api/routes/auth');
const businessRoutes = require('./api/routes/businesses');
const messageRoutes = require('./api/routes/messages');
const subscriptionRoutes = require('./api/routes/subscriptions');

const app = express();
const PORT = process.env.PORT || 3456;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(morgan('dev'));

// ===== API ROUTES =====
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', system: 'AWB-OS', version: '1.0.0' });
});
app.use('/api/auth', authRoutes);
app.use('/api/businesses', businessRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/subscriptions', subscriptionRoutes);

// ===== SERVE FRONTEND BUILD =====
const frontendBuild = path.join(__dirname, '../../frontend/.next/standalone');
const frontendPublic = path.join(__dirname, '../../frontend/public');

// Serve static files from .next/static
app.use('/_next/static', express.static(path.join(__dirname, '../../frontend/.next/static')));

// Serve public files
app.use(express.static(frontendPublic));

// Serve frontend static pages from standalone
app.use(express.static(path.join(frontendBuild, 'frontend')));

// Serve the frontend server.js generated pages
const frontendServerDir = path.join(frontendBuild, 'frontend');
app.use(express.static(frontendServerDir));

// SPA fallback - serve rendered HTML files
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return;
  // Try serving the page as a file, then fallback to index
  const possiblePaths = [
    path.join(frontendServerDir, req.path, 'index.html'),
    path.join(frontendServerDir, req.path + '.html'),
    path.join(frontendServerDir, req.path, 'index.json'),
    path.join(frontendServerDir, 'index.html')
  ];
  for (const p of possiblePaths) {
    if (require('fs').existsSync(p)) {
      return res.sendFile(p);
    }
  }
  res.status(200).sendFile(path.join(frontendServerDir, 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ===== START =====
async function start() {
  console.log(`
╔═══════════════════════════════════════════╗
║     AWB-OS v1.0.0                        ║
║     AI WhatsApp Business OS              ║
║     SINGLE SERVER MODE                   ║
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
