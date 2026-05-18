const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const data = {
  users: [],
  businesses: [],
  messages: [],
  customers: [],
  subscriptions: [],
  ai_settings: [],
  leads: []
};

function uuid() {
  return crypto.randomUUID();
}

function where(items, filters) {
  return items.filter(item => {
    return Object.entries(filters).every(([k, v]) => item[k] === v);
  });
}

function findOne(items, filters) {
  return where(items, filters)[0] || null;
}

module.exports = {
  init() {
    if (!data.users.find(u => u.email === 'test@demo.com')) {
      data.users.push({
        id: uuid(), email: 'test@demo.com', password_hash: '$2a$10$CILlKIk./42EUfLsp2k7ZeSp6qN6Wv7j/wSOT5yilO6GSZdbI0IMK',
        full_name: 'Demo User', created_at: new Date().toISOString(), updated_at: new Date().toISOString()
      });
    }
    return true;
  },
  createUser(email, passwordHash, fullName) {
    const user = { id: uuid(), email, password_hash: passwordHash, full_name: fullName || '', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    data.users.push(user);
    return user;
  },
  getUserByEmail(email) { return findOne(data.users, { email }); },
  getUserById(id) { return findOne(data.users, { id }); },
  createBusiness(data_) {
    const b = { id: uuid(), user_id: data_.user_id, name: data_.name, type: data_.type || 'general', phone_number: data_.phone_number || null, whatsapp_connected: 0, whatsapp_qr: '', description: data_.description || '', location: data_.location || '', working_hours: data_.working_hours || '9:00 AM - 6:00 PM', services: data_.services || '[]', faqs: data_.faqs || '[]', ai_active: 1, settings_json: '{}', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    data.businesses.push(b);
    return b;
  },
  getUserBusinesses(userId) { return where(data.businesses, { user_id: userId }); },
  getBusinessById(id) { return findOne(data.businesses, { id }); },
  getBusinessByPhone(phone) { return findOne(data.businesses, { phone_number: phone }); },
  updateBusiness(id, updates) {
    const b = data.businesses.find(x => x.id === id);
    if (b) Object.assign(b, updates, { updated_at: new Date().toISOString() });
    return !!b;
  },
  deleteBusiness(id) {
    const idx = data.businesses.findIndex(x => x.id === id);
    if (idx !== -1) { data.businesses.splice(idx, 1); return true; }
    return false;
  },
  async saveMessage(businessId, userNumber, message, response, intent) {
    const m = { id: uuid(), business_id: businessId, customer_phone: userNumber, message, response, intent: intent || null, created_at: new Date().toISOString() };
    data.messages.push(m);
    return m;
  },
  async getBusinessMessages(businessId, limit) {
    return data.messages.filter(m => m.business_id === businessId).slice(-limit);
  },
  async getCustomerMessages(businessId, phone) {
    return data.messages.filter(m => m.business_id === businessId && m.customer_phone === phone);
  },
  async upsertCustomer(businessId, phone, name) {
    let c = findOne(data.customers, { business_id: businessId, phone });
    if (c) { c.name = name || c.name; c.updated_at = new Date().toISOString(); }
    else { c = { id: uuid(), business_id: businessId, phone, name: name || 'Unknown', last_message: '', message_count: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }; data.customers.push(c); }
    return c;
  },
  async getBusinessCustomers(businessId) { return where(data.customers, { business_id: businessId }); },
  async getAiSettings(businessId) { return findOne(data.ai_settings, { business_id: businessId }) || { business_id: businessId, prompt: '', temperature: 0.7, model: 'default' }; },
  async updateAiSettings(businessId, settings) {
    let s = findOne(data.ai_settings, { business_id: businessId });
    if (s) Object.assign(s, settings);
    else { s = { id: uuid(), business_id: businessId, ...settings, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }; data.ai_settings.push(s); }
    return s;
  },
  async createSubscription(userId, plan, amount, paymentId) {
    const sub = { id: uuid(), user_id: userId, plan, amount, payment_id: paymentId, status: 'active', start_date: new Date().toISOString(), end_date: new Date(Date.now() + (plan === 'yearly' ? 365 : 30) * 86400000).toISOString(), created_at: new Date().toISOString() };
    data.subscriptions.push(sub);
    return sub;
  },
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
  async createLead(businessId, phone, name, source) {
    const l = { id: uuid(), business_id: businessId, phone, name: name || 'Unknown', source: source || 'whatsapp', status: 'new', notes: '', created_at: new Date().toISOString() };
    data.leads.push(l);
    return l;
  },
  async getBusinessLeads(businessId) { return where(data.leads, { business_id: businessId }); },
  execute(sql, params) {
    console.log('Memory DB: execute ignored:', sql?.substring(0, 50));
    return { changes: 0 };
  }
};