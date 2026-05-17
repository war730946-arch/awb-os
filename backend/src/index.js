require('dotenv').config();
const { app, PORT } = require('./api/server');
const db = require('./database');

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
      console.log('✅ Local database ready');
    } catch (err) {
      console.error('❌ Database init failed:', err.message);
      process.exit(1);
    }
  }

  app.listen(PORT, () => {
    console.log(`✅ API Server running on http://localhost:${PORT}`);
    console.log(`📡 Health check: http://localhost:${PORT}/api/health`);
  });
}

start();
