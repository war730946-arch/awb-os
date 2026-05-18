const supabase = require('./supabase');

// ============ BUSINESS QUERIES ============

async function getBusinessByPhone(phone) {
  const { data, error } = await supabase
    .from('businesses')
    .select('*, ai_settings(*)')
    .eq('phone_number', phone)
    .single();
  if (error) return null;
  return data;
}

async function getBusinessById(id) {
  const { data, error } = await supabase
    .from('businesses')
    .select('*, ai_settings(*), subscriptions(*)')
    .eq('id', id)
    .single();
  if (error) return null;
  return data;
}

async function getUserBusinesses(userId) {
  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) return [];
  return data;
}

async function createBusiness(data) {
  const { data: business, error } = await supabase
    .from('businesses')
    .insert({
      user_id: data.user_id,
      name: data.name,
      type: data.type || 'general',
      description: data.description || '',
      location: data.location || '',
      working_hours: data.working_hours || '9:00 AM - 6:00 PM',
      services: data.services || [],
      faqs: data.faqs || []
    })
    .select()
    .single();
  if (error) throw error;

  await supabase.from('ai_settings').insert({
    business_id: business.id,
    personality: data.personality || 'professional',
    tone: data.tone || 'polite',
    language: data.language || 'auto',
    custom_rules: data.custom_rules || '',
    greeting_message: data.greeting_message || 'Hello! How can I help you today?'
  });

  await supabase.from('subscriptions').insert({
    business_id: business.id,
    plan: 'trial',
    status: 'trial'
  });

  return business;
}

async function updateBusiness(id, data) {
  const { error } = await supabase
    .from('businesses')
    .update(data)
    .eq('id', id);
  return !error;
}

async function deleteBusiness(id) {
  const { error } = await supabase
    .from('businesses')
    .delete()
    .eq('id', id);
  return !error;
}

// ============ MESSAGE QUERIES ============

async function saveMessage(businessId, userNumber, message, response, intent) {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      business_id: businessId,
      user_number: userNumber,
      message,
      response,
      intent: intent || 'inquiry'
    })
    .select()
    .single();
  return error ? null : data;
}

async function getBusinessMessages(businessId, limit = 50) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return [];
  return data;
}

async function getCustomerMessages(businessId, userNumber, limit = 20) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('business_id', businessId)
    .eq('user_number', userNumber)
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) return [];
  return data;
}

// ============ CUSTOMER QUERIES ============

async function upsertCustomer(businessId, phone, name) {
  const { data, error } = await supabase
    .from('customers')
    .upsert({
      business_id: businessId,
      phone,
      name: name || '',
      last_message_at: new Date().toISOString()
    }, { onConflict: 'business_id,phone' })
    .select()
    .single();
  return error ? null : data;
}

async function getBusinessCustomers(businessId) {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('business_id', businessId)
    .order('last_message_at', { ascending: false });
  if (error) return [];
  return data;
}

// ============ AI SETTINGS QUERIES ============

async function getAiSettings(businessId) {
  const { data, error } = await supabase
    .from('ai_settings')
    .select('*')
    .eq('business_id', businessId)
    .single();
  if (error) return null;
  return data;
}

async function updateAiSettings(businessId, settings) {
  const { error } = await supabase
    .from('ai_settings')
    .update(settings)
    .eq('business_id', businessId);
  return !error;
}

// ============ SUBSCRIPTION QUERIES ============

async function getSubscription(businessId) {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('business_id', businessId)
    .single();
  if (error) return null;
  return data;
}

async function isSubscriptionActive(businessId) {
  const sub = await getSubscription(businessId);
  if (!sub) return false;
  if (sub.status === 'active' || sub.status === 'trial') {
    const endDate = new Date(sub.trial_end_date);
    if (endDate > new Date()) return true;
    if (sub.status === 'trial') {
      await supabase.from('subscriptions')
        .update({ status: 'expired' })
        .eq('business_id', businessId);
      return false;
    }
    return sub.status === 'active';
  }
  return false;
}

// ============ LEAD QUERIES ============

async function createLead(businessId, customerId, phone, name, interest) {
  const { data, error } = await supabase
    .from('leads')
    .insert({
      business_id: businessId,
      customer_id: customerId,
      phone,
      name: name || '',
      interest: interest || '',
      status: 'new'
    })
    .select()
    .single();
  return error ? null : data;
}

async function getBusinessLeads(businessId) {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });
  if (error) return [];
  return data;
}

async function checkCanRespond(businessId, userNumber) {
  const sub = await getSubscription(businessId);
  if (!sub) return { allowed: false, reason: 'no_subscription' };

  if (sub.status === 'active') return { allowed: true, reason: 'active' };

  if (sub.status === 'trial') {
    const now = new Date();
    const trialEnd = new Date(sub.trial_end_date);
    if (trialEnd > now) {
      const { count, error } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .eq('user_number', userNumber)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
      const msgCount = count || 0;
      const maxMessages = 3;
      if (msgCount >= maxMessages) {
        return { allowed: false, reason: 'limit_reached', max: maxMessages };
      }
      return { allowed: true, reason: 'limited', remaining: maxMessages - msgCount };
    }
    await supabase.from('subscriptions')
      .update({ status: 'expired' })
      .eq('business_id', businessId);
    return { allowed: false, reason: 'expired' };
  }

  return { allowed: false, reason: 'blocked' };
}

module.exports = {
  getBusinessByPhone,
  getBusinessById,
  getUserBusinesses,
  createBusiness,
  updateBusiness,
  deleteBusiness,
  saveMessage,
  getBusinessMessages,
  getCustomerMessages,
  upsertCustomer,
  getBusinessCustomers,
  getAiSettings,
  updateAiSettings,
  getSubscription,
  isSubscriptionActive,
  createLead,
  getBusinessLeads,
  checkCanRespond
};
