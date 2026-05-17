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

    const subscription = await db.getSubscription(req.params.businessId);

    const now = new Date();
    const trialEnd = new Date(subscription.trial_end_date);
    const daysLeft = Math.max(0, Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24)));

    res.json({
      subscription,
      days_remaining: daysLeft,
      is_active: (await db.isSubscriptionActive(req.params.businessId)).active,
      subscription_status: await db.isSubscriptionActive(req.params.businessId)
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

    db.execute("UPDATE subscriptions SET plan = 'monthly', status = 'active', current_period_start = datetime('now'), current_period_end = datetime('now', '+30 days'), updated_at = datetime('now') WHERE business_id = ?", [req.params.businessId]);

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

    db.execute("UPDATE subscriptions SET status = 'cancelled', plan = 'none', updated_at = datetime('now') WHERE business_id = ?", [req.params.businessId]);

    res.json({ success: true, message: 'Subscription cancelled' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

module.exports = router;
