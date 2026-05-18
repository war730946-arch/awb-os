const express = require('express');
const router = express.Router();

router.get('/:phone', async (req, res) => {
  try {
    const db = require('../../database');
    const business = await db.getBusinessByPhone(req.params.phone);
    if (!business) return res.status(404).json({ error: 'No business with this phone' });
    const sub = await db.isSubscriptionActive(business.user_id);
    const aiSettings = await db.getAiSettings(business.id) || {};
    res.json({ ...business, ai_settings: aiSettings, subscription: sub });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch business' });
  }
});

module.exports = router;
