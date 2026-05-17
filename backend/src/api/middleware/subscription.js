const { isSubscriptionActive } = require('../../database');

async function checkSubscription(req, res, next) {
  const businessId = req.params.id || req.body.business_id;

  if (!businessId) {
    return res.status(400).json({ error: 'Business ID required' });
  }

  const active = await isSubscriptionActive(businessId);

  if (!active) {
    return res.status(403).json({
      error: 'Subscription expired',
      message: 'Please renew your subscription to use AI features',
      requireUpgrade: true
    });
  }

  next();
}

module.exports = { checkSubscription };
