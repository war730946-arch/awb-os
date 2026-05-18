const express = require('express');
const cors = require('cors');
const { init, getBusinessByPhone, getBusinessById, getUserBusinesses, createBusiness, updateBusiness, deleteBusiness, saveMessage, getBusinessMessages, getCustomerMessages, upsertCustomer, getBusinessCustomers, getAiSettings, updateAiSettings, getSubscription, isSubscriptionActive, checkCanRespond, createLead, getBusinessLeads, getUserByEmail, getUserById, createUser } = require('./src/database/local-db');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', system: 'AWB-OS', version: '1.0.0' });
});

const authRoutes = require('./src/api/routes/auth');
const businessRoutes = require('./src/api/routes/businesses');
const messageRoutes = require('./src/api/routes/messages');
const subscriptionRoutes = require('./src/api/routes/subscriptions');
const paymentRoutes = require('./src/api/routes/payments');

app.use('/api/auth', authRoutes);
app.use('/api/businesses', businessRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/payments', paymentRoutes);

module.exports = app;
