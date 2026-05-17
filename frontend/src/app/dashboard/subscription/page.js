'use client';

import { useState, useEffect } from 'react';
import { CreditCard, CheckCircle, XCircle, Clock, Zap } from 'lucide-react';
import { getBusinesses, getSubscription, upgradeSubscription, cancelSubscription } from '../../../lib/api';

export default function SubscriptionPage() {
  const [businesses, setBusinesses] = useState([]);
  const [selectedBiz, setSelectedBiz] = useState(null);
  const [sub, setSub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    getBusinesses().then(res => {
      setBusinesses(res.businesses || []);
      if (res.businesses?.length) {
        setSelectedBiz(res.businesses[0].id);
      }
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedBiz) {
      getSubscription(selectedBiz).then(res => {
        setSub(res);
      }).catch(() => setSub(null));
    }
  }, [selectedBiz]);

  async function handleUpgrade() {
    setUpgrading(true);
    try {
      await upgradeSubscription(selectedBiz);
      const res = await getSubscription(selectedBiz);
      setSub(res);
    } catch (err) {
      alert('Upgrade failed: ' + err.message);
    } finally {
      setUpgrading(false);
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
                <h2 className="font-semibold text-gray-900 mb-2">Upgrade to Monthly</h2>
                <p className="text-gray-500 text-sm mb-4">
                  Get unlimited AI responses, priority support, and more features.
                </p>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-3xl font-bold text-gray-900">$10</span>
                  <span className="text-gray-500">/month</span>
                </div>
                <ul className="space-y-2 mb-6 text-sm">
                  {['Unlimited AI responses', '24/7 WhatsApp automation', 'Chat history & analytics', 'Voice message support', 'Multi-business support'].map(f => (
                    <li key={f} className="flex items-center gap-2 text-gray-700">
                      <CheckCircle size={16} className="text-green-500" />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={handleUpgrade}
                  disabled={upgrading}
                  className="btn-primary flex items-center gap-2"
                >
                  <Zap size={16} />
                  {upgrading ? 'Processing...' : 'Upgrade Now - $10/month'}
                </button>
              </div>
            )}

            {sub.subscription?.status === 'expired' && (
              <div className="card border-red-200 bg-red-50">
                <h2 className="font-semibold text-red-800 mb-2">Trial Expired</h2>
                <p className="text-red-600 text-sm mb-4">Your trial has ended. Upgrade to continue using AI features.</p>
                <button onClick={handleUpgrade} disabled={upgrading} className="btn-primary">
                  {upgrading ? 'Processing...' : 'Reactivate - $10/month'}
                </button>
              </div>
            )}
          </div>

          <div className="card h-fit">
            <h3 className="font-semibold text-gray-900 mb-4">Plan Details</h3>
            <div className="space-y-4 text-sm">
              <div>
                <p className="font-medium text-gray-900">Free Trial</p>
                <p className="text-gray-500">30 days free access</p>
                <ul className="mt-2 space-y-1 text-gray-600">
                  <li>• AI responses</li>
                  <li>• WhatsApp connection</li>
                  <li>• Basic chat history</li>
                </ul>
              </div>
              <div className="border-t pt-4">
                <p className="font-medium text-gray-900">Monthly Plan</p>
                <p className="text-gray-500">$10/month</p>
                <ul className="mt-2 space-y-1 text-gray-600">
                  <li>• Everything in trial</li>
                  <li>• Unlimited messages</li>
                  <li>• Priority support</li>
                  <li>• Voice message support</li>
                  <li>• Analytics dashboard</li>
                  <li>• Lead management</li>
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
