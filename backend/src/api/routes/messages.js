const express = require('express');
const { authenticate } = require('../middleware/auth');
const db = require('../../database');

const router = express.Router();

router.use(authenticate);

router.get('/:businessId', async (req, res) => {
  try {
    const business = await db.getBusinessById(req.params.businessId);
    if (!business || business.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Business not found' });
    }

    const limit = parseInt(req.query.limit) || 50;
    const messages = await db.getBusinessMessages(req.params.businessId, limit);
    res.json({ messages });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

router.get('/:businessId/customer/:phone', async (req, res) => {
  try {
    const business = await db.getBusinessById(req.params.businessId);
    if (!business || business.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Business not found' });
    }

    const messages = await db.getCustomerMessages(req.params.businessId, req.params.phone);
    res.json({ messages });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

module.exports = router;
