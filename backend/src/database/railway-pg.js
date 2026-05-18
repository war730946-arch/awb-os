const { Pool } = require('pg');

let pool = null;

async function init() {
  const connectionString = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_PUBLIC_URL or DATABASE_URL must be set');
  }

  pool = new Pool({
    connectionString,
    ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false }
  });

  const tables = [
    `CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      full_name VARCHAR(255) DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS businesses (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      type VARCHAR(100) DEFAULT 'general',
      phone_number VARCHAR(50) UNIQUE,
      whatsapp_connected BOOLEAN DEFAULT FALSE,
      whatsapp_qr TEXT DEFAULT '',
      description TEXT DEFAULT '',
      location TEXT DEFAULT '',
      working_hours TEXT DEFAULT '9:00 AM - 6:00 PM',
      services JSONB DEFAULT '[]',
      faqs JSONB DEFAULT '[]',
      ai_active BOOLEAN DEFAULT TRUE,
      settings_json JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS ai_settings (
      id UUID PRIMARY KEY,
      business_id UUID UNIQUE NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      personality TEXT DEFAULT 'professional',
      tone TEXT DEFAULT 'polite',
      language VARCHAR(50) DEFAULT 'auto',
      custom_rules TEXT DEFAULT '',
      greeting_message TEXT DEFAULT 'Hello! How can I help you today?',
      response_length VARCHAR(20) DEFAULT 'short',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS customers (
      id UUID PRIMARY KEY,
      business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      phone VARCHAR(50) NOT NULL,
      name VARCHAR(255) DEFAULT '',
      total_chats INT DEFAULT 0,
      last_message_at TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(business_id, phone)
    )`,
    `CREATE TABLE IF NOT EXISTS messages (
      id UUID PRIMARY KEY,
      business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
      user_number VARCHAR(50) NOT NULL,
      message TEXT NOT NULL,
      response TEXT DEFAULT '',
      intent VARCHAR(50) DEFAULT 'inquiry',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_messages_business_id ON messages(business_id)`,
    `CREATE INDEX IF NOT EXISTS idx_messages_user_number ON messages(user_number)`,
    `CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC)`,
    `CREATE TABLE IF NOT EXISTS subscriptions (
      id UUID PRIMARY KEY,
      business_id UUID UNIQUE NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      plan VARCHAR(50) DEFAULT 'trial',
      status VARCHAR(50) DEFAULT 'trial',
      trial_start_date TIMESTAMPTZ DEFAULT NOW(),
      trial_end_date TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
      current_period_start TIMESTAMPTZ DEFAULT NOW(),
      current_period_end TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
      stripe_customer_id VARCHAR(255) DEFAULT '',
      stripe_subscription_id VARCHAR(255) DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS leads (
      id UUID PRIMARY KEY,
      business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
      phone VARCHAR(50) NOT NULL,
      name VARCHAR(255) DEFAULT '',
      interest VARCHAR(255) DEFAULT '',
      status VARCHAR(50) DEFAULT 'new',
      notes TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`
  ];

  for (const sql of tables) {
    await pool.query(sql);
  }

  console.log('Railway PostgreSQL database initialized');
  return true;
}

async function query(text, params = []) {
  if (!pool) throw new Error('Database not initialized');
  const result = await pool.query(text, params);
  return result;
}

async function queryOne(text, params = []) {
  const result = await query(text, params);
  return result.rows[0] || null;
}

const uuid = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
};

async function getUserByEmail(email) {
  return queryOne('SELECT * FROM users WHERE email = $1', [email]);
}

async function getUserById(id) {
  return queryOne('SELECT * FROM users WHERE id = $1', [id]);
}

async function createUser(email, passwordHash, fullName) {
  const id = uuid();
  await query(
    'INSERT INTO users (id, email, password_hash, full_name) VALUES ($1, $2, $3, $4)',
    [id, email, passwordHash, fullName || '']
  );
  return { id, email, full_name: fullName || '' };
}

async function getBusinessByPhone(phone) {
  const biz = await queryOne(`
    SELECT b.*, row_to_json(ai.*) as ai_settings
    FROM businesses b
    LEFT JOIN ai_settings ai ON ai.business_id = b.id
    WHERE b.phone_number = $1
  `, [phone]);
  if (!biz) return null;
  if (biz.services && typeof biz.services === 'string') biz.services = JSON.parse(biz.services);
  if (biz.faqs && typeof biz.faqs === 'string') biz.faqs = JSON.parse(biz.faqs);
  if (biz.ai_settings) biz.ai_settings = biz.ai_settings;
  return biz;
}

async function getBusinessById(id) {
  const biz = await queryOne(`
    SELECT b.*, 
      row_to_json(ai.*) as ai_settings,
      row_to_json(sub.*) as subscriptions
    FROM businesses b
    LEFT JOIN ai_settings ai ON ai.business_id = b.id
    LEFT JOIN subscriptions sub ON sub.business_id = b.id
    WHERE b.id = $1
  `, [id]);
  if (!biz) return null;
  if (biz.services && typeof biz.services === 'string') biz.services = JSON.parse(biz.services);
  if (biz.faqs && typeof biz.faqs === 'string') biz.faqs = JSON.parse(biz.faqs);
  return biz;
}

async function getUserBusinesses(userId) {
  const result = await query('SELECT * FROM businesses WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
  return result.rows.map(b => ({
    ...b,
    services: typeof b.services === 'string' ? JSON.parse(b.services) : b.services,
    faqs: typeof b.faqs === 'string' ? JSON.parse(b.faqs) : b.faqs
  }));
}

async function createBusiness(data) {
  const id = uuid();
  await query(`
    INSERT INTO businesses (id, user_id, name, type, description, location, phone_number, working_hours, services, faqs)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
  `, [
    id, data.user_id, data.name, data.type || 'general', data.description || '',
    data.location || '', data.phone_number || '',
    data.working_hours || '9:00 AM - 6:00 PM',
    JSON.stringify(data.services || []), JSON.stringify(data.faqs || [])
  ]);

  await query(`
    INSERT INTO ai_settings (id, business_id, personality, tone, language, custom_rules, greeting_message)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
  `, [uuid(), id, data.personality || 'professional', data.tone || 'polite',
    data.language || 'auto', data.custom_rules || '',
    data.greeting_message || 'Hello! How can I help you today?']);

  await query('INSERT INTO subscriptions (id, business_id) VALUES ($1, $2)', [uuid(), id]);

  return getBusinessById(id);
}

async function updateBusiness(id, data) {
  const fields = [];
  const values = [];
  let idx = 1;
  for (const [key, value] of Object.entries(data)) {
    if (['name', 'type', 'description', 'location', 'working_hours', 'phone_number',
         'whatsapp_connected', 'whatsapp_qr', 'ai_active'].includes(key)) {
      fields.push(`${key} = $${idx++}`);
      values.push(typeof value === 'boolean' ? value : value);
    }
    if (key === 'services') { fields.push(`services = $${idx++}`); values.push(JSON.stringify(value)); }
    if (key === 'faqs') { fields.push(`faqs = $${idx++}`); values.push(JSON.stringify(value)); }
  }
  if (fields.length === 0) return true;
  fields.push("updated_at = NOW()");
  values.push(id);
  await query(`UPDATE businesses SET ${fields.join(', ')} WHERE id = $${idx}`, values);
  return true;
}

async function deleteBusiness(id) {
  await query('DELETE FROM messages WHERE business_id = $1', [id]);
  await query('DELETE FROM customers WHERE business_id = $1', [id]);
  await query('DELETE FROM leads WHERE business_id = $1', [id]);
  await query('DELETE FROM ai_settings WHERE business_id = $1', [id]);
  await query('DELETE FROM subscriptions WHERE business_id = $1', [id]);
  await query('DELETE FROM businesses WHERE id = $1', [id]);
  return true;
}

async function saveMessage(businessId, userNumber, message, response, intent) {
  const id = uuid();
  await query(
    `INSERT INTO messages (id, business_id, user_number, message, response, intent)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, businessId, userNumber, message, response, intent || 'inquiry']
  );
  return queryOne('SELECT * FROM messages WHERE id = $1', [id]);
}

async function getBusinessMessages(businessId, limit = 50) {
  const result = await query(
    'SELECT * FROM messages WHERE business_id = $1 ORDER BY created_at DESC LIMIT $2',
    [businessId, limit]
  );
  return result.rows;
}

async function getCustomerMessages(businessId, userNumber, limit = 20) {
  const result = await query(
    'SELECT * FROM messages WHERE business_id = $1 AND user_number = $2 ORDER BY created_at ASC LIMIT $3',
    [businessId, userNumber, limit]
  );
  return result.rows;
}

async function upsertCustomer(businessId, phone, name) {
  const existing = await queryOne(
    'SELECT * FROM customers WHERE business_id = $1 AND phone = $2',
    [businessId, phone]
  );
  if (existing) {
    await query(
      `UPDATE customers SET name = $1, last_message_at = NOW(), total_chats = total_chats + 1 WHERE id = $2`,
      [name || existing.name, existing.id]
    );
    return queryOne('SELECT * FROM customers WHERE id = $1', [existing.id]);
  }
  const id = uuid();
  await query(
    `INSERT INTO customers (id, business_id, phone, name, total_chats, last_message_at)
     VALUES ($1, $2, $3, $4, 1, NOW())`,
    [id, businessId, phone, name || '']
  );
  return queryOne('SELECT * FROM customers WHERE id = $1', [id]);
}

async function getBusinessCustomers(businessId) {
  const result = await query(
    'SELECT * FROM customers WHERE business_id = $1 ORDER BY last_message_at DESC',
    [businessId]
  );
  return result.rows;
}

async function getAiSettings(businessId) {
  return queryOne('SELECT * FROM ai_settings WHERE business_id = $1', [businessId]);
}

async function updateAiSettings(businessId, settings) {
  const fields = [];
  const values = [];
  let idx = 1;
  for (const [key, value] of Object.entries(settings)) {
    if (['personality', 'tone', 'language', 'custom_rules', 'greeting_message', 'response_length'].includes(key)) {
      fields.push(`${key} = $${idx++}`);
      values.push(value);
    }
  }
  if (fields.length === 0) return true;
  values.push(businessId);
  await query(`UPDATE ai_settings SET ${fields.join(', ')}, updated_at = NOW() WHERE business_id = $${idx}`, values);
  return true;
}

async function getSubscription(businessId) {
  return queryOne('SELECT * FROM subscriptions WHERE business_id = $1', [businessId]);
}

async function isSubscriptionActive(businessId) {
  const sub = await getSubscription(businessId);
  if (!sub) return { active: false, plan: 'none', status: 'none' };
  const now = new Date();
  const trialEnd = new Date(sub.trial_end_date);
  const inTrial = trialEnd > now;

  if (sub.status === 'active') return { active: true, plan: sub.plan, status: 'active' };
  if (sub.status === 'trial' && inTrial) {
    return { active: true, plan: 'trial', status: 'trial', daysLeft: Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24)) };
  }
  if (sub.status === 'trial' && !inTrial) {
    await query("UPDATE subscriptions SET status = 'expired' WHERE business_id = $1", [businessId]);
    return { active: false, plan: 'trial', status: 'expired', limited: true, maxMessages: 3 };
  }
  return { active: false, plan: sub.plan, status: sub.status, limited: true, maxMessages: 3 };
}

async function getMessageCount24h(businessId, userNumber) {
  const result = await query(
    `SELECT COUNT(*) as count FROM messages 
     WHERE business_id = $1 AND user_number = $2 
     AND created_at >= NOW() - INTERVAL '24 hours'`,
    [businessId, userNumber]
  );
  return parseInt(result.rows[0]?.count || 0);
}

async function checkCanRespond(businessId, userNumber) {
  const subStatus = await isSubscriptionActive(businessId);
  if (subStatus.active) return { allowed: true, reason: 'active' };
  if (subStatus.limited) {
    const count = await getMessageCount24h(businessId, userNumber);
    if (count >= subStatus.maxMessages) {
      return { allowed: false, reason: 'limit_reached', max: subStatus.maxMessages };
    }
    return { allowed: true, reason: 'limited', remaining: subStatus.maxMessages - count };
  }
  return { allowed: false, reason: 'blocked' };
}

async function createLead(businessId, customerId, phone, name, interest) {
  const id = uuid();
  await query(
    `INSERT INTO leads (id, business_id, customer_id, phone, name, interest, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'new')`,
    [id, businessId, customerId, phone, name || '', interest || '']
  );
  return queryOne('SELECT * FROM leads WHERE id = $1', [id]);
}

async function getBusinessLeads(businessId) {
  const result = await query(
    'SELECT * FROM leads WHERE business_id = $1 ORDER BY created_at DESC',
    [businessId]
  );
  return result.rows;
}

async function execute(sql, params = []) {
  const result = await query(sql, params);
  return { changes: result.rowCount };
}

async function close() {
  if (pool) await pool.end();
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
