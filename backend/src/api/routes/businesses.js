const express = require('express');
const qrcode = require('qrcode');
const { authenticate } = require('../middleware/auth');
const db = require('../../database');

function getBotModule() {
  if (process.env.VERCEL || process.env.VERCEL_ENV) {
    return { startBot: () => {}, stopBot: () => {}, getBotStatus: () => false };
  }
  try {
    return require('../../whatsapp/bot');
  } catch {
    return { startBot: () => {}, stopBot: () => {}, getBotStatus: () => false };
  }
}

const router = express.Router();

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const businesses = await db.getUserBusinesses(req.user.id);
    const withStatus = businesses.map(b => ({
      ...b,
      bot_active: getBotModule().getBotStatus(b.id)
    }));
    res.json({ businesses: withStatus });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch businesses' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const business = await db.getBusinessById(req.params.id);
    if (!business || business.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Business not found' });
    }
    business.bot_active = getBotModule().getBotStatus(business.id);
    res.json({ business });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch business' });
  }
});

router.post('/', async (req, res) => {
  try {
    const data = { ...req.body, user_id: req.user.id };
    const business = await db.createBusiness(data);

    try {
      if (req.body.phone_number) {
        await getBotModule().startBot(business.id, req.body.phone_number);
      }
    } catch (botErr) {
      console.error('Bot start skipped (expected on serverless):', botErr.message);
    }

    res.status(201).json({ business });
  } catch (error) {
    console.error('Create business error:', error);
    res.status(500).json({ error: 'Failed to create business' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const business = await db.getBusinessById(req.params.id);
    if (!business || business.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Business not found' });
    }

    const updated = await db.updateBusiness(req.params.id, req.body);

    if (req.body.ai_settings) {
      await db.updateAiSettings(req.params.id, req.body.ai_settings);
    }

    res.json({ success: updated });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update business' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const business = await db.getBusinessById(req.params.id);
    if (!business || business.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Business not found' });
    }

    await getBotModule().stopBot(req.params.id);
    await db.deleteBusiness(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete business' });
  }
});

router.post('/:id/connect-whatsapp', async (req, res) => {
  try {
    const business = await db.getBusinessById(req.params.id);
    if (!business || business.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Business not found' });
    }

    const { phone_number } = req.body;
    if (!phone_number) {
      return res.status(400).json({ error: 'Phone number required' });
    }

    await db.updateBusiness(req.params.id, { phone_number, whatsapp_qr: '', whatsapp_connected: false });
    await getBotModule().startBot(req.params.id, phone_number);

    res.json({ success: true, message: 'WhatsApp connection initiated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to connect WhatsApp' });
  }
});

router.post('/:id/disconnect-whatsapp', async (req, res) => {
  try {
    await getBotModule().stopBot(req.params.id);
    await db.updateBusiness(req.params.id, { whatsapp_connected: false, phone_number: '' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

router.get('/:id/qr', async (req, res) => {
  try {
    const business = await db.getBusinessById(req.params.id);
    if (!business || business.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Business not found' });
    }
    if (!business.whatsapp_qr) {
      return res.json({ qr: null, connected: business.whatsapp_connected });
    }
    const qrImage = await qrcode.toDataURL(business.whatsapp_qr);
    res.json({ qr: qrImage, connected: business.whatsapp_connected });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get QR code' });
  }
});

module.exports = router;
