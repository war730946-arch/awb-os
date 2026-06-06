const express = require('express');
const qrcode = require('qrcode');
const { authenticate } = require('../middleware/auth');
const db = require('../../database');

function getBotModule() {
  try {
    const mod = require('../../whatsapp/bot');
    return mod;
  } catch {
    return { startBot: () => {}, stopBot: () => {}, getBotStatus: () => false, requestPairing: async () => ({ success: false, error: 'Bot not available' }) };
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
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Phone number already registered with another business. Please use a different number.' });
    }
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

    await db.updateBusiness(req.params.id, { phone_number, whatsapp_connected: false });
    try {
      await getBotModule().stopBot(req.params.id);
      await new Promise(r => setTimeout(r, 1000));
      await getBotModule().startBot(req.params.id, phone_number);
    } catch (e) {
      console.log('Bot auto-start skipped (QR from local bot sync):', e.message);
    }

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

router.post('/:id/pairing-code', async (req, res) => {
  try {
    const business = await db.getBusinessById(req.params.id);
    if (!business || business.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Business not found' });
    }

    const { phone_number } = req.body;
    if (!phone_number) {
      return res.status(400).json({ error: 'Phone number required' });
    }

    const result = await getBotModule().requestPairing(req.params.id, phone_number);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get pairing code' });
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
