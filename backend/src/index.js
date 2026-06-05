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

  try {
    const { startBot } = require('./whatsapp/bot');
    const user = await db.getUserByEmail('admin@awb-os.com');
    if (user) {
      const businesses = await db.getUserBusinesses(user.id);
      if (businesses.length > 0) {
        const biz = businesses[0];
        await startBot(biz.id, biz.phone_number);
        console.log('✅ WhatsApp bot started for', biz.phone_number);
      }
    }
  } catch (err) {
    console.log('ℹ️ WhatsApp bot not available:', err.message);
  }
}

start();
