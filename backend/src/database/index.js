let db;
const useLocal = process.env.NODE_ENV !== 'production' || !process.env.SUPABASE_URL;

if (useLocal) {
  console.log('📦 Using local SQLite database', process.env.NODE_ENV === 'production' ? '(fallback mode)' : '');
  db = require('./local-db');
  db.init().catch(err => console.error('DB init error:', err));
} else {
  console.log('☁️ Using Supabase database');
  db = require('./queries');
}

module.exports = db;
