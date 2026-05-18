let db;

if (process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME) {
  db = require('./memory-db');
  try { db.init(); } catch (err) { console.error('Memory DB init error:', err); }
} else if (process.env.SUPABASE_URL) {
  console.log('☁️ Using Supabase database');
  db = require('./queries');
} else {
  console.log('📦 Using local SQLite database');
  db = require('./local-db');
  db.init().catch(err => console.error('DB init error:', err));
}

module.exports = db;
