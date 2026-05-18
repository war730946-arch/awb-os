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

    const subscription = await db.getSubscription(req.user.id);

    const now = new Date();
    const endDate = new Date(subscription?.end_date || subscription?.trial_end_date || now);
    const daysLeft = Math.max(0, Math.ceil((endDate - now) / (1000 * 60 * 60 * 24)));

    res.json({
      subscription,
      days_remaining: daysLeft,
      is_active: (await db.isSubscriptionActive(req.user.id)).active,
      subscription_status: await db.isSubscriptionActive(req.user.id)
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

router.post('/:businessId/upgrade', async (req, res) => {
  try {
    const business = await db.getBusinessById(req.params.businessId);
    if (!business || business.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Business not found' });
    }

    await db.createSubscription(req.user.id, 'monthly', 49900, 'manual_upgrade');

    res.json({ success: true, message: 'Subscription upgraded to monthly' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to upgrade subscription' });
  }
});

router.post('/:businessId/cancel', async (req, res) => {
  try {
    const business = await db.getBusinessById(req.params.businessId);
    if (!business || business.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Business not found' });
    }

    // Memory DB: subscription cancellation is a no-op for demo
    res.json({ success: true, message: 'Subscription cancelled' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

module.exports = router;
