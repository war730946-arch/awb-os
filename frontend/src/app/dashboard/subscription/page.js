'use client';

import { useState, useEffect } from 'react';
import { CreditCard, CheckCircle, XCircle, Clock, Zap, IndianRupee } from 'lucide-react';
import { getBusinesses, getSubscription, cancelSubscription } from '../../../lib/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL + '/api';

export default function SubscriptionPage() {
  const [businesses, setBusinesses] = useState([]);
  const [selectedBiz, setSelectedBiz] = useState(null);
  const [sub, setSub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    getBusinesses().then(res => {
      setBusinesses(res.businesses || []);
      if (res.businesses?.length) setSelectedBiz(res.businesses[0].id);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedBiz) getSubscription(selectedBiz).then(setSub).catch(() => setSub(null));
  }, [selectedBiz]);

  function loadRazorpay(src) {
    return new Promise((resolve) => {
      if (window.Razorpay) { resolve(true); return; }
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  }

  async function handlePayment(plan) {
    setProcessing(true);
    try {
      const token = localStorage.getItem('awb_token');
      const orderRes = await fetch(`${API_BASE}/payments/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ businessId: selectedBiz, plan })
      });
      const order = await orderRes.json();
      if (order.error) { alert(order.error); return; }

      const loaded = await loadRazorpay('https://checkout.razorpay.com/v1/checkout.js');
      if (!loaded) { alert('Failed to load payment gateway'); return; }

      const options = {
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: 'AWB-OS',
        description: plan === 'yearly' ? 'Yearly Plan - ₹4999' : 'Monthly Plan - ₹499',
        order_id: order.orderId,
        handler: async function (response) {
          const verifyRes = await fetch(`${API_BASE}/payments/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              businessId: selectedBiz,
              plan
            })
          });
          const verify = await verifyRes.json();
          if (verify.success) {
            alert('✅ Payment successful! Subscription activated.');
            const updated = await getSubscription(selectedBiz);
            setSub(updated);
          } else {
            alert('❌ Payment verification failed');
          }
        },
        modal: { ondismiss: () => setProcessing(false) },
        prefill: { contact: '', email: '' },
        theme: { color: '#6366f1' }
      };
      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      alert('Payment failed: ' + err.message);
    } finally {
      setProcessing(false);
    }
  }

  async function handleCancel() {
    if (!confirm('Cancel subscription? AI features will be disabled.')) return;
    try {
      await cancelSubscription(selectedBiz);
      const res = await getSubscription(selectedBiz);
      setSub(res);
    } catch (err) {
      alert(err.message);
    }
  }

  const statusColor = {
    trial: 'text-blue-600 bg-blue-100',
    active: 'text-green-600 bg-green-100',
    expired: 'text-red-600 bg-red-100',
    cancelled: 'text-gray-600 bg-gray-100'
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Subscription</h1>
        <p className="text-gray-500 mt-1">Manage your AI assistant subscription</p>
      </div>

      <div className="mb-6">
        <select
          value={selectedBiz || ''}
          onChange={e => setSelectedBiz(e.target.value)}
          className="input-field max-w-md"
        >
          <option value="">Select business...</option>
          {businesses.map(b => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>

      {selectedBiz && sub && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="card">
              <h2 className="font-semibold text-gray-900 mb-4">Current Plan</h2>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-3xl font-bold text-gray-900 capitalize">{sub.subscription?.plan || 'Trial'}</p>
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm mt-2 ${statusColor[sub.subscription?.status] || 'text-gray-600 bg-gray-100'}`}>
                    {sub.subscription?.status === 'active' ? <CheckCircle size={14} /> : sub.subscription?.status === 'trial' ? <Clock size={14} /> : <XCircle size={14} />}
                    {sub.subscription?.status || 'Unknown'}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">Days Remaining</p>
                  <p className="text-4xl font-bold text-primary-600">{sub.days_remaining}</p>
                </div>
              </div>

              <div className="border-t pt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Plan</span>
                  <span className="font-medium capitalize">{sub.subscription?.plan}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Trial Start</span>
                  <span>{new Date(sub.subscription?.trial_start_date).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Trial End</span>
                  <span>{new Date(sub.subscription?.trial_end_date).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">AI Active</span>
                  <span className={sub.is_active ? 'text-green-600' : 'text-red-600'}>
                    {sub.is_active ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
            </div>

            {sub.subscription?.status === 'trial' && (
              <div className="card">
                <h2 className="font-semibold text-gray-900 mb-2">Upgrade Plan</h2>
                <p className="text-gray-500 text-sm mb-4">Get unlimited AI responses for your business.</p>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="border rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-gray-900">₹499</p>
                    <p className="text-gray-500 text-sm">/month</p>
                    <ul className="text-xs text-gray-600 mt-3 space-y-1 text-left">
                      <li>✅ Unlimited AI responses</li>
                      <li>✅ WhatsApp automation</li>
                      <li>✅ Chat history</li>
                      <li>✅ Lead management</li>
                    </ul>
                    <button onClick={() => handlePayment('monthly')} disabled={processing} className="btn-primary w-full mt-4 text-sm">
                      {processing ? 'Processing...' : 'Subscribe ₹499'}
                    </button>
                  </div>
                  <div className="border-2 border-primary-500 rounded-lg p-4 text-center relative">
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary-500 text-white text-xs px-3 py-0.5 rounded-full">Best Value</span>
                    <p className="text-2xl font-bold text-gray-900">₹4,999</p>
                    <p className="text-gray-500 text-sm">/year <span className="text-green-600">(save 16%)</span></p>
                    <ul className="text-xs text-gray-600 mt-3 space-y-1 text-left">
                      <li>✅ Everything in monthly</li>
                      <li>✅ Priority support</li>
                      <li>✅ Voice messages</li>
                      <li>✅ Analytics dashboard</li>
                    </ul>
                    <button onClick={() => handlePayment('yearly')} disabled={processing} className="btn-primary w-full mt-4 text-sm bg-green-600 hover:bg-green-700">
                      {processing ? 'Processing...' : 'Subscribe ₹4,999'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {sub.subscription?.status === 'expired' && (
              <div className="card border-red-200 bg-red-50">
                <h2 className="font-semibold text-red-800 mb-2">Trial Expired</h2>
                <p className="text-red-600 text-sm mb-4">Your trial has ended. Upgrade to continue using AI features.</p>
                <div className="flex gap-3">
                  <button onClick={() => handlePayment('monthly')} disabled={processing} className="btn-primary">
                    {processing ? 'Processing...' : 'Subscribe ₹499/mo'}
                  </button>
                  <button onClick={() => handlePayment('yearly')} disabled={processing} className="btn-primary bg-green-600 hover:bg-green-700">
                    {processing ? 'Processing...' : '₹4,999/year'}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="card h-fit">
            <h3 className="font-semibold text-gray-900 mb-4">Plan Details</h3>
            <div className="space-y-4 text-sm">
              <div>
                <p className="font-medium text-gray-900">Free Trial</p>
                <p className="text-gray-500">30 days free + 3 messages/day after expiry</p>
                <ul className="mt-2 space-y-1 text-gray-600">
                  <li>• AI responses (limited)</li>
                  <li>• WhatsApp connection</li>
                  <li>• Basic chat history</li>
                </ul>
              </div>
              <div className="border-t pt-4">
                <p className="font-medium text-gray-900">Monthly — ₹499</p>
                <ul className="mt-2 space-y-1 text-gray-600">
                  <li>• Unlimited AI responses</li>
                  <li>• Priority support</li>
                  <li>• Voice message support</li>
                  <li>• Lead management</li>
                </ul>
              </div>
              <div className="border-t pt-4">
                <p className="font-medium text-gray-900">Yearly — ₹4,999</p>
                <ul className="mt-2 space-y-1 text-gray-600">
                  <li>• Everything in monthly</li>
                  <li>• Priority support</li>
                  <li>• Analytics dashboard</li>
                </ul>
              </div>
              {sub.subscription?.status !== 'cancelled' && sub.subscription?.status !== 'expired' && (
                <button onClick={handleCancel} className="text-sm text-red-500 hover:text-red-600 mt-4">
                  Cancel subscription
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedBiz && !sub && !loading && (
        <div className="card text-center py-12">
          <CreditCard size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">No subscription data found</p>
        </div>
      )}
    </div>
  );
}
