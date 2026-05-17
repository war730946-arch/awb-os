const express = require('express');
const { authenticate } = require('../middleware/auth');
const db = require('../../database');
const Razorpay = require('razorpay');

const router = express.Router();

router.use(authenticate);

router.post('/create-order', async (req, res) => {
  try {
    const { businessId, plan } = req.body;
    const business = await db.getBusinessById(businessId);
    if (!business || business.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Business not found' });
    }

    const amount = plan === 'monthly' ? 49900 : 499900;
    const keyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder';
    const keySecret = process.env.RAZORPAY_KEY_SECRET || 'placeholder';

    // Dev/test mode: return mock order
    if (keyId === 'rzp_test_placeholder' || keyId.includes('placeholder')) {
      return res.json({
        orderId: 'order_dev_' + Date.now(),
        amount,
        currency: 'INR',
        keyId: 'rzp_test_placeholder'
      });
    }

    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
    const order = await razorpay.orders.create({
      amount,
      currency: 'INR',
      receipt: `rcpt_${businessId}_${Date.now()}`,
      notes: { businessId, plan, userId: req.user.id }
    });

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId
    });
  } catch (error) {
    console.error('Order creation error:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

router.post('/verify', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, businessId, plan } = req.body;
    
    const keySecret = process.env.RAZORPAY_KEY_SECRET || 'placeholder';

    // Dev/test mode: auto-verify
    if (keySecret === 'placeholder') {
      const months = plan === 'yearly' ? 365 : 30;
      db.execute(`UPDATE subscriptions SET 
        plan = ?, status = 'active',
        current_period_start = datetime('now'),
        current_period_end = datetime('now', '+${months} days'),
        updated_at = datetime('now')
        WHERE business_id = ?`, [plan || 'monthly', businessId]);
      return res.json({ success: true, message: 'Test payment: subscription activated!' });
    }

    const crypto = require('crypto');
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSig = crypto.createHmac('sha256', keySecret)
      .update(body).digest('hex');

    if (expectedSig !== razorpay_signature) {
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const months = plan === 'yearly' ? 365 : 30;
    db.execute(`UPDATE subscriptions SET 
      plan = ?, status = 'active', 
      current_period_start = datetime('now'),
      current_period_end = datetime('now', '+${months} days'),
      updated_at = datetime('now')
      WHERE business_id = ?`, [plan || 'monthly', businessId]);

    res.json({ success: true, message: 'Payment verified, subscription activated!' });
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

module.exports = router;
