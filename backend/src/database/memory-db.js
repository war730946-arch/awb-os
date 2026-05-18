const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join('/tmp', 'awb-db.json');

const data = {
  users: [],
  businesses: [],
  messages: [],
  customers: [],
  subscriptions: [],
  ai_settings: [],
  leads: []
};

function load() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const raw = fs.readFileSync(DB_PATH, 'utf-8');
      const saved = JSON.parse(raw);
      Object.assign(data, saved);
    }
  } catch (e) {
    console.error('DB load error:', e.message);
  }
}

function persist() {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data), 'utf-8');
  } catch (e) {
    console.error('DB persist error:', e.message);
  }
}

function uuid(seed) {
  if (seed) {
    return crypto.createHash('md5').update(seed).digest('hex').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
  }
  return crypto.randomUUID();
}

function where(items, filters) {
  return items.filter(item => Object.entries(filters).every(([k, v]) => item[k] === v));
}

function findOne(items, filters) {
  return where(items, filters)[0] || null;
}

function call(fnName, fn) {
  return function(...args) {
    const result = fn.apply(this, args);
    const readonlyOps = ['getUserByEmail','getUserById','getUserBusinesses','getBusinessById','getBusinessByPhone','getBusinessMessages','getCustomerMessages','getBusinessCustomers','getAiSettings','getSubscription','isSubscriptionActive','checkCanRespond','getBusinessLeads','execute','init'];
    if (!readonlyOps.includes(fnName)) {
      if (result && typeof result.then === 'function') {
        return result.then(val => { persist(); return val; });
      }
      persist();
    }
    return result;
  };
}

module.exports = {
  init() {
    load();
    data.users = data.users.filter(u => u.email !== 'test@demo.com');
    data.users.push({
      id: uuid('test@demo.com'), email: 'test@demo.com',
      password_hash: '$2a$10$CILlKIk./42EUfLsp2k7ZeSp6qN6Wv7j/wSOT5yilO6GSZdbI0IMK',
      full_name: 'Demo User', created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    });
    persist();
    return true;
  },
  createUser: call('createUser', (email, passwordHash, fullName) => {
    const user = { id: uuid(), email, password_hash: passwordHash, full_name: fullName || '', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    data.users.push(user);
    return user;
  }),
  getUserByEmail(email) { return findOne(data.users, { email }); },
  getUserById(id) { return findOne(data.users, { id }); },
  createBusiness: call('createBusiness', (d) => {
    const b = { id: uuid(), user_id: d.user_id, name: d.name, type: d.type || 'general', phone_number: d.phone_number || null, whatsapp_connected: 0, whatsapp_qr: '', description: d.description || '', location: d.location || '', working_hours: d.working_hours || '9:00 AM - 6:00 PM', services: d.services || '[]', faqs: d.faqs || '[]', ai_active: 1, settings_json: '{}', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    data.businesses.push(b);
    return b;
  }),
  getUserBusinesses(userId) { return where(data.businesses, { user_id: userId }); },
  getBusinessById(id) { return findOne(data.businesses, { id }); },
  getBusinessByPhone(phone) { return findOne(data.businesses, { phone_number: phone }); },
  updateBusiness: call('updateBusiness', (id, updates) => {
    const b = data.businesses.find(x => x.id === id);
    if (b) Object.assign(b, updates, { updated_at: new Date().toISOString() });
    return !!b;
  }),
  deleteBusiness: call('deleteBusiness', (id) => {
    const idx = data.businesses.findIndex(x => x.id === id);
    if (idx !== -1) { data.businesses.splice(idx, 1); return true; }
    return false;
  }),
  saveMessage: call('saveMessage', async (businessId, userNumber, message, response, intent) => {
    const m = { id: uuid(), business_id: businessId, customer_phone: userNumber, message, response, intent: intent || null, created_at: new Date().toISOString() };
    data.messages.push(m);
    return m;
  }),
  async getBusinessMessages(businessId, limit) {
    return data.messages.filter(m => m.business_id === businessId).slice(-limit);
  },
  async getCustomerMessages(businessId, phone) {
    return data.messages.filter(m => m.business_id === businessId && m.customer_phone === phone);
  },
  upsertCustomer: call('upsertCustomer', async (businessId, phone, name) => {
    let c = findOne(data.customers, { business_id: businessId, phone });
    if (c) { c.name = name || c.name; c.updated_at = new Date().toISOString(); }
    else { c = { id: uuid(), business_id: businessId, phone, name: name || 'Unknown', last_message: '', message_count: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }; data.customers.push(c); }
    return c;
  }),
  async getBusinessCustomers(businessId) { return where(data.customers, { business_id: businessId }); },
  async getAiSettings(businessId) { return findOne(data.ai_settings, { business_id: businessId }) || { business_id: businessId, prompt: '', temperature: 0.7, model: 'default' }; },
  updateAiSettings: call('updateAiSettings', async (businessId, settings) => {
    let s = findOne(data.ai_settings, { business_id: businessId });
    if (s) Object.assign(s, settings);
    else { s = { id: uuid(), business_id: businessId, ...settings, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }; data.ai_settings.push(s); }
    return s;
  }),
  createSubscription: call('createSubscription', async (userId, plan, amount, paymentId) => {
    const sub = { id: uuid(), user_id: userId, plan, amount, payment_id: paymentId, status: 'active', start_date: new Date().toISOString(), end_date: new Date(Date.now() + (plan === 'yearly' ? 365 : 30) * 86400000).toISOString(), created_at: new Date().toISOString() };
    data.subscriptions.push(sub);
    return sub;
  }),
  async getSubscription(userId) {
    const subs = where(data.subscriptions, { user_id: userId }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return subs[0] || null;
  },
  async isSubscriptionActive(userId) {
    const sub = await this.getSubscription(userId);
    if (!sub) return { active: false, plan: null, status: 'none', daysLeft: 0 };
    const now = new Date(); const end = new Date(sub.end_date);
    if (end > now) return { active: true, plan: sub.plan, status: 'active', daysLeft: Math.ceil((end - now) / 86400000) };
    return { active: false, plan: sub.plan, status: 'expired', daysLeft: 0 };
  },
  async checkCanRespond(businessId, userNumber) {
    const msgCount = data.messages.filter(m => m.business_id === businessId && m.customer_phone === userNumber).length;
    if (msgCount < 3) return true;
    const business = await this.getBusinessById(businessId);
    if (!business) return false;
    const sub = await this.getSubscription(business.user_id);
    return sub && new Date(sub.end_date) > new Date();
  },
  createLead: call('createLead', async (businessId, phone, name, source) => {
    const l = { id: uuid(), business_id: businessId, phone, name: name || 'Unknown', source: source || 'whatsapp', status: 'new', notes: '', created_at: new Date().toISOString() };
    data.leads.push(l);
    return l;
  }),
  async getBusinessLeads(businessId) { return where(data.leads, { business_id: businessId }); },
  execute(sql, params) {
    console.log('Memory DB: execute ignored:', sql?.substring(0, 50));
    return { changes: 0 };
  }
};
