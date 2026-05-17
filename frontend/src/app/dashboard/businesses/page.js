'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Building2, Wifi, WifiOff, Trash2 } from 'lucide-react';
import { getBusinesses, deleteBusiness } from '../../../lib/api';

export default function BusinessesPage() {
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const res = await getBusinesses();
      setBusinesses(res.businesses || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this business? This cannot be undone.')) return;
    try {
      await deleteBusiness(id);
      load();
    } catch (err) {
      alert('Failed to delete');
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Businesses</h1>
          <p className="text-gray-500 mt-1">Manage your WhatsApp AI businesses</p>
        </div>
        <Link href="/dashboard/businesses/new" className="btn-primary flex items-center gap-2">
          <Plus size={18} />
          Add Business
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : businesses.length === 0 ? (
        <div className="card text-center py-12">
          <Building2 size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-700 mb-2">No businesses</h3>
          <p className="text-gray-400 mb-4">Create your first business to get started</p>
          <Link href="/dashboard/businesses/new" className="btn-primary">Create Business</Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {businesses.map((b) => (
            <div key={b.id} className="card flex items-center justify-between">
              <Link href={`/dashboard/businesses/${b.id}`} className="flex items-center gap-4 flex-1">
                <div className={`p-2 rounded-lg ${b.bot_active ? 'bg-green-100' : 'bg-gray-100'}`}>
                  {b.bot_active ? <Wifi size={20} className="text-green-600" /> : <WifiOff size={20} className="text-gray-400" />}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{b.name}</h3>
                  <p className="text-sm text-gray-500">
                    {b.type} {b.location ? `• ${b.location}` : ''}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {b.whatsapp_connected ? '✅ WhatsApp Connected' : '❌ Not Connected'}
                  </p>
                </div>
              </Link>
              <button onClick={() => handleDelete(b.id)} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
