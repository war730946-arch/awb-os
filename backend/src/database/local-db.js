const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

const DB_DIR = path.join(__dirname, '../../data');
const DB_PATH = path.join(DB_DIR, 'awb-os.db');

let db = null;

function getDB() {
  if (!db) throw new Error('Database not initialized. Call init() first.');
  return db;
}

async function init() {
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

  let buffer = null;
  if (fs.existsSync(DB_PATH)) {
    buffer = fs.readFileSync(DB_PATH);
  }

  const SQL = await initSqlJs();
  db = new SQL.Database(buffer);

  db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS businesses (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    type TEXT DEFAULT 'general',
    phone_number TEXT DEFAULT NULL,
    whatsapp_connected INTEGER DEFAULT 0,
    whatsapp_qr TEXT DEFAULT '',
    description TEXT DEFAULT '',
    location TEXT DEFAULT '',
    working_hours TEXT DEFAULT '9:00 AM - 6:00 PM',
    services TEXT DEFAULT '[]',
    faqs TEXT DEFAULT '[]',
    ai_active INTEGER DEFAULT 1,
    settings_json TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS ai_settings (
    id TEXT PRIMARY KEY,
    business_id TEXT UNIQUE NOT NULL REFERENCES businesses(id),
    personality TEXT DEFAULT 'professional',
    tone TEXT DEFAULT 'polite',
    language TEXT DEFAULT 'auto',
    custom_rules TEXT DEFAULT '',
    greeting_message TEXT DEFAULT 'Hello! How can I help you today?',
    response_length TEXT DEFAULT 'short',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES businesses(id),
    phone TEXT NOT NULL,
    name TEXT DEFAULT '',
    total_chats INTEGER DEFAULT 0,
    last_message_at TEXT DEFAULT (datetime('now')),
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(business_id, phone)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES businesses(id),
    customer_id TEXT REFERENCES customers(id),
    user_number TEXT NOT NULL,
    message TEXT NOT NULL,
    response TEXT DEFAULT '',
    intent TEXT DEFAULT 'inquiry',
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    business_id TEXT UNIQUE NOT NULL REFERENCES businesses(id),
    plan TEXT DEFAULT 'trial',
    status TEXT DEFAULT 'trial',
    trial_start_date TEXT DEFAULT (datetime('now')),
    trial_end_date TEXT DEFAULT (datetime('now', '+30 days')),
    current_period_start TEXT DEFAULT (datetime('now')),
    current_period_end TEXT DEFAULT (datetime('now', '+30 days')),
    stripe_customer_id TEXT DEFAULT '',
    stripe_subscription_id TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES businesses(id),
    customer_id TEXT REFERENCES customers(id),
    phone TEXT NOT NULL,
    name TEXT DEFAULT '',
    interest TEXT DEFAULT '',
    status TEXT DEFAULT 'new',
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  save();
  return db;
}

function save() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

// Helper: run & return array of objects
function query(sql, params = []) {
  const d = getDB();
  const stmt = d.prepare(sql);
  if (params.length) stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

// Helper: run & get single row or null
function queryOne(sql, params = []) {
  const rows = query(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

// Helper: execute insert/update/delete
function execute(sql, params = []) {
  const d = getDB();
  d.run(sql, params);
  save();
}

// Helper: generate UUID
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// ============ Business Queries ============

function getBusinessByPhone(phone) {
  const biz = queryOne('SELECT * FROM businesses WHERE phone_number = ?', [phone]);
  if (!biz) return null;
  const ai = queryOne('SELECT * FROM ai_settings WHERE business_id = ?', [biz.id]);
  return { ...biz, ai_settings: ai, services: safeJson(biz.services), faqs: safeJson(biz.faqs) };
}

function getBusinessById(id) {
  const biz = queryOne('SELECT * FROM businesses WHERE id = ?', [id]);
  if (!biz) return null;
  const ai = queryOne('SELECT * FROM ai_settings WHERE business_id = ?', [id]);
  const sub = queryOne('SELECT * FROM subscriptions WHERE business_id = ?', [id]);
  return { ...biz, ai_settings: ai, subscriptions: sub, services: safeJson(biz.services), faqs: safeJson(biz.faqs) };
}

function getUserBusinesses(userId) {
  const rows = query('SELECT * FROM businesses WHERE user_id = ? ORDER BY created_at DESC', [userId]);
  return rows.map(b => ({ ...b, services: safeJson(b.services), faqs: safeJson(b.faqs) }));
}

function createBusiness(data) {
  const id = uuid();
  execute(`INSERT INTO businesses (id, user_id, name, type, description, location, phone_number, working_hours, services, faqs)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, data.user_id, data.name, data.type || 'general', data.description || '',
     data.location || '', data.phone_number || '',
     data.working_hours || '9:00 AM - 6:00 PM',
     JSON.stringify(data.services || []), JSON.stringify(data.faqs || [])]);

  execute(`INSERT INTO ai_settings (id, business_id, personality, tone, language, custom_rules, greeting_message)
    VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [uuid(), id, data.personality || 'professional', data.tone || 'polite',
     data.language || 'auto', data.custom_rules || '',
     data.greeting_message || 'Hello! How can I help you today?']);

  execute(`INSERT INTO subscriptions (id, business_id) VALUES (?, ?)`, [uuid(), id]);

  return getBusinessById(id);
}

function updateBusiness(id, data) {
  const fields = [];
  const values = [];
  for (const [key, value] of Object.entries(data)) {
    if (['name', 'type', 'description', 'location', 'working_hours', 'phone_number',
         'whatsapp_connected', 'whatsapp_qr', 'ai_active'].includes(key)) {
      fields.push(`${key} = ?`);
      values.push(typeof value === 'boolean' ? (value ? 1 : 0) : value);
    }
    if (key === 'services') { fields.push('services = ?'); values.push(JSON.stringify(value)); }
    if (key === 'faqs') { fields.push('faqs = ?'); values.push(JSON.stringify(value)); }
  }
  if (fields.length === 0) return true;
  fields.push("updated_at = datetime('now')");
  values.push(id);
  execute(`UPDATE businesses SET ${fields.join(', ')} WHERE id = ?`, values);
  return true;
}

function deleteBusiness(id) {
  execute('DELETE FROM messages WHERE business_id = ?', [id]);
  execute('DELETE FROM customers WHERE business_id = ?', [id]);
  execute('DELETE FROM leads WHERE business_id = ?', [id]);
  execute('DELETE FROM ai_settings WHERE business_id = ?', [id]);
  execute('DELETE FROM subscriptions WHERE business_id = ?', [id]);
  execute('DELETE FROM businesses WHERE id = ?', [id]);
  return true;
}

// ============ Message Queries ============

function saveMessage(businessId, userNumber, message, response, intent) {
  const id = uuid();
  execute(`INSERT INTO messages (id, business_id, user_number, message, response, intent)
    VALUES (?, ?, ?, ?, ?, ?)`, [id, businessId, userNumber, message, response, intent || 'inquiry']);
  return queryOne('SELECT * FROM messages WHERE id = ?', [id]);
}

function getBusinessMessages(businessId, limit = 50) {
  return query('SELECT * FROM messages WHERE business_id = ? ORDER BY created_at DESC LIMIT ?',
    [businessId, limit]);
}

function getCustomerMessages(businessId, userNumber, limit = 20) {
  return query('SELECT * FROM messages WHERE business_id = ? AND user_number = ? ORDER BY created_at ASC LIMIT ?',
    [businessId, userNumber, limit]);
}

// ============ Customer Queries ============

function upsertCustomer(businessId, phone, name) {
  const existing = queryOne('SELECT * FROM customers WHERE business_id = ? AND phone = ?', [businessId, phone]);
  if (existing) {
    execute("UPDATE customers SET name = ?, last_message_at = datetime('now'), total_chats = total_chats + 1 WHERE id = ?",
      [name || existing.name, existing.id]);
    return queryOne('SELECT * FROM customers WHERE id = ?', [existing.id]);
  }
  const id = uuid();
  execute(`INSERT INTO customers (id, business_id, phone, name, total_chats, last_message_at)
    VALUES (?, ?, ?, ?, 1, datetime('now'))`, [id, businessId, phone, name || '']);
  return queryOne('SELECT * FROM customers WHERE id = ?', [id]);
}

function getBusinessCustomers(businessId) {
  return query('SELECT * FROM customers WHERE business_id = ? ORDER BY last_message_at DESC', [businessId]);
}

// ============ AI Settings ============

function getAiSettings(businessId) {
  return queryOne('SELECT * FROM ai_settings WHERE business_id = ?', [businessId]);
}

function updateAiSettings(businessId, settings) {
  const fields = [];
  const values = [];
  for (const [key, value] of Object.entries(settings)) {
    if (['personality', 'tone', 'language', 'custom_rules', 'greeting_message', 'response_length'].includes(key)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }
  if (fields.length === 0) return true;
  values.push(businessId);
  execute(`UPDATE ai_settings SET ${fields.join(', ')}, updated_at = datetime('now') WHERE business_id = ?`, values);
  return true;
}

// ============ Subscription ============

function getSubscription(businessId) {
  return queryOne('SELECT * FROM subscriptions WHERE business_id = ?', [businessId]);
}

function isSubscriptionActive(businessId) {
  const sub = getSubscription(businessId);
  if (!sub) return { active: false, plan: 'none', status: 'none' };
  const now = new Date();
  const trialEnd = new Date(sub.trial_end_date);
  const inTrial = trialEnd > now;

  if (sub.status === 'active') return { active: true, plan: sub.plan, status: 'active' };
  if (sub.status === 'trial' && inTrial) return { active: true, plan: 'trial', status: 'trial', daysLeft: Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24)) };
  
  if (sub.status === 'trial' && !inTrial) {
    execute("UPDATE subscriptions SET status = 'expired' WHERE business_id = ?", [businessId]);
    return { active: false, plan: 'trial', status: 'expired', limited: true, maxMessages: 3 };
  }
  
  return { active: false, plan: sub.plan, status: sub.status, limited: true, maxMessages: 3 };
}

function getMessageCount24h(businessId, userNumber) {
  const rows = query(`SELECT COUNT(*) as count FROM messages 
    WHERE business_id = ? AND user_number = ? 
    AND created_at >= datetime('now', '-24 hours')`, [businessId, userNumber]);
  return rows[0]?.count || 0;
}

function checkCanRespond(businessId, userNumber) {
  const subStatus = isSubscriptionActive(businessId);
  if (subStatus.active) return { allowed: true, reason: 'active' };
  if (subStatus.limited) {
    const count = getMessageCount24h(businessId, userNumber);
    if (count >= subStatus.maxMessages) {
      return { allowed: false, reason: 'limit_reached', max: subStatus.maxMessages };
    }
    return { allowed: true, reason: 'limited', remaining: subStatus.maxMessages - count };
  }
  return { allowed: false, reason: 'blocked' };
}

// ============ Lead ============

function createLead(businessId, customerId, phone, name, interest) {
  const id = uuid();
  execute(`INSERT INTO leads (id, business_id, customer_id, phone, name, interest, status)
    VALUES (?, ?, ?, ?, ?, ?, 'new')`, [id, businessId, customerId, phone, name || '', interest || '']);
  return queryOne('SELECT * FROM leads WHERE id = ?', [id]);
}

function getBusinessLeads(businessId) {
  return query('SELECT * FROM leads WHERE business_id = ? ORDER BY created_at DESC', [businessId]);
}

// ============ User ============

function getUserByEmail(email) {
  return queryOne('SELECT * FROM users WHERE email = ?', [email]);
}

function getUserById(id) {
  return queryOne('SELECT * FROM users WHERE id = ?', [id]);
}

function createUser(email, passwordHash, fullName) {
  const id = uuid();
  execute('INSERT INTO users (id, email, password_hash, full_name) VALUES (?, ?, ?, ?)',
    [id, email, passwordHash, fullName || '']);
  return { id, email, full_name: fullName || '' };
}

// ============ Helpers ============

function safeJson(str) {
  if (!str) return [];
  try { return typeof str === 'string' ? JSON.parse(str) : str; }
  catch (e) { return []; }
}

function close() {
  if (db) { save(); db.close(); db = null; }
}

module.exports = {
  init, close,
  getBusinessByPhone, getBusinessById, getUserBusinesses, createBusiness, updateBusiness, deleteBusiness,
  saveMessage, getBusinessMessages, getCustomerMessages,
  upsertCustomer, getBusinessCustomers,
  getAiSettings, updateAiSettings,
  getSubscription, isSubscriptionActive, checkCanRespond,
  createLead, getBusinessLeads,
  getUserByEmail, getUserById, createUser,
  execute
};
