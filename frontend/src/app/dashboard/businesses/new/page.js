'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createBusiness } from '../../../../lib/api';

export default function NewBusinessPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    type: 'general',
    description: '',
    location: '',
    working_hours: '9:00 AM - 6:00 PM',
    phone_number: '',
    personality: 'professional',
    tone: 'polite',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const businessTypes = [
    'general', 'clinic', 'restaurant', 'real_estate', 'salon',
    'fitness', 'education', 'retail', 'service', 'other'
  ];

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await createBusiness(form);
      router.push(`/dashboard/businesses/${res.business.id}`);
    } catch (err) {
      if (err.message === 'Internal server error' && form.phone_number) {
        setError(`Phone number "${form.phone_number}" is already registered with another business. Go back to dashboard and use your existing business.`);
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-8">
        <Link href="/dashboard/businesses" className="text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-2">
          <ArrowLeft size={16} /> Back to Businesses
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Create New Business</h1>
        <p className="text-gray-500 mt-1">Set up an AI-powered WhatsApp business</p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
        <div className="card space-y-4">
          <h2 className="font-semibold text-gray-900">Business Details</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Business Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm({...form, name: e.target.value})}
                className="input-field"
                placeholder="My Business"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Business Type *</label>
              <select
                value={form.type}
                onChange={e => setForm({...form, type: e.target.value})}
                className="input-field"
              >
                {businessTypes.map(t => (
                  <option key={t} value={t}>{t.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm({...form, description: e.target.value})}
              className="input-field"
              rows={3}
              placeholder="Describe your business..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
              <input
                type="text"
                value={form.location}
                onChange={e => setForm({...form, location: e.target.value})}
                className="input-field"
                placeholder="City, Area"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Working Hours</label>
              <input
                type="text"
                value={form.working_hours}
                onChange={e => setForm({...form, working_hours: e.target.value})}
                className="input-field"
                placeholder="9:00 AM - 6:00 PM"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp Number</label>
            <input
              type="text"
              value={form.phone_number}
              onChange={e => setForm({...form, phone_number: e.target.value})}
              className="input-field"
              placeholder="+911234567890"
            />
            <p className="text-xs text-gray-400 mt-1">With country code, no spaces</p>
          </div>
        </div>

        <div className="card space-y-4">
          <h2 className="font-semibold text-gray-900">AI Personality</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Personality</label>
              <select
                value={form.personality}
                onChange={e => setForm({...form, personality: e.target.value})}
                className="input-field"
              >
                <option value="professional">Professional</option>
                <option value="friendly">Friendly</option>
                <option value="formal">Formal</option>
                <option value="casual">Casual</option>
                <option value="luxury">Luxury</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tone</label>
              <select
                value={form.tone}
                onChange={e => setForm({...form, tone: e.target.value})}
                className="input-field"
              >
                <option value="polite">Polite</option>
                <option value="warm">Warm</option>
                <option value="direct">Direct</option>
                <option value="empathetic">Empathetic</option>
              </select>
            </div>
          </div>
        </div>

        {error && <div className="bg-red-50 text-red-600 text-sm p-4 rounded-lg">{error}</div>}

        <div className="flex gap-3">
          <button type="submit" disabled={loading} className="btn-primary px-8">
            {loading ? 'Creating...' : 'Create Business'}
          </button>
          <Link href="/dashboard/businesses" className="btn-secondary">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
