const express = require('express');
const router = express.Router();

router.post('/incoming', async (req, res) => {
  try {
    const { businessId, userPhone, messageText } = req.body;
    if (!businessId || !userPhone || !messageText) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    const db = require('../../database');
    const { generateResponse } = require('../../ai/engine');

    const business = await db.getBusinessById(businessId);
    if (!business) return res.status(404).json({ error: 'Business not found' });

    const canRespond = await db.checkCanRespond(businessId, userPhone);
    if (!canRespond) {
      return res.json({ reply: '⏳ AI assistant is currently unavailable. Please try again later.', allowed: false });
    }

    const customer = await db.upsertCustomer(businessId, userPhone, '');
    const history = await db.getCustomerMessages(businessId, userPhone) || [];
    const aiSettings = await db.getAiSettings(businessId) || {};
    const businessWithSettings = { ...business, ai_settings: aiSettings };

    const { reply, intent } = await generateResponse(businessWithSettings, messageText, history);
    await db.saveMessage(businessId, userPhone, messageText, reply, intent);

    if (['booking', 'pricing'].includes(intent)) {
      await db.createLead(businessId, customer?.id, userPhone, customer?.name, intent);
    }

    res.json({ reply, intent, allowed: true });
  } catch (error) {
    console.error('Bot webhook error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.get('/check-status', async (req, res) => {
  const { businessId, phone } = req.query;
  if (!businessId) return res.status(400).json({ error: 'businessId required' });
  const db = require('../../database');
  const business = await db.getBusinessById(businessId);
  if (!business) return res.status(404).json({ error: 'Business not found' });
  const canRespond = phone ? await db.checkCanRespond(businessId, phone) : { allowed: true };
  res.json({
    name: business.name,
    type: business.type,
    phone: business.phone_number,
    connected: !!business.whatsapp_connected,
    canRespond
  });
});

module.exports = router;
