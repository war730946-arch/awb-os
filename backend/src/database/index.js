let db;

if (process.env.VERCEL || process.env.VERCEL_ENV || process.env.AWS_LAMBDA_FUNCTION_NAME) {
  db = require('./memory-db');
  try { db.init(); } catch (err) { console.error('Memory DB init error:', err); }
} else if (process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL) {
  console.log('Using Railway PostgreSQL database');
  try {
    db = require('./railway-pg');
    db.init().catch(err => console.error('Railway PG init error:', err));
  } catch (err) {
    console.error('Railway PG load failed, falling back to local DB:', err.message);
    db = require('./local-db');
    db.init().catch(err => console.error('DB init error:', err));
  }
} else if (process.env.SUPABASE_URL && process.env.SUPABASE_URL.startsWith('http')) {
  console.log('Using Supabase database');
  db = require('./queries');
} else {
  console.log('Using local SQLite database');
  try {
    db = require('./local-db');
    db.init().catch(err => console.error('DB init error:', err));
  } catch (err) {
    console.error('Local DB load failed, falling back to memory DB:', err.message);
    db = require('./memory-db');
    db.init();
  }
}

module.exports = db;
