const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', system: 'AWB-OS', version: '1.0.0', message: 'Health check passed' });
});

const authRoutes = require('../src/api/routes/auth');
const businessRoutes = require('../src/api/routes/businesses');
const messageRoutes = require('../src/api/routes/messages');
const subscriptionRoutes = require('../src/api/routes/subscriptions');
const paymentRoutes = require('../src/api/routes/payments');

app.use('/api/auth', authRoutes);
app.use('/api/businesses', businessRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/payments', paymentRoutes);

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;