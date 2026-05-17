'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Building2, MessageSquare, Users, CreditCard, Plus, TrendingUp, Clock } from 'lucide-react';
import { getBusinesses } from '../../lib/api';

export default function Dashboard() {
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const res = await getBusinesses();
      setBusinesses(res.businesses || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const totalMessages = businesses.reduce((sum, b) => sum + (b.message_count || 0), 0);
  const activeBots = businesses.filter(b => b.bot_active).length;
  const totalLeads = businesses.reduce((sum, b) => sum + (b.lead_count || 0), 0);

  const stats = [
    { label: 'Total Businesses', value: businesses.length, icon: Building2, color: 'text-blue-600 bg-blue-100' },
    { label: 'Active Bots', value: activeBots, icon: TrendingUp, color: 'text-green-600 bg-green-100' },
    { label: 'Total Messages', value: totalMessages, icon: MessageSquare, color: 'text-purple-600 bg-purple-100' },
    { label: 'Total Leads', value: totalLeads, icon: Users, color: 'text-orange-600 bg-orange-100' },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">Overview of your AI WhatsApp system</p>
        </div>
        <Link href="/dashboard/businesses/new" className="btn-primary flex items-center gap-2">
          <Plus size={18} />
          New Business
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{stat.label}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    {loading ? '-' : stat.value}
                  </p>
                </div>
                <div className={`p-3 rounded-lg ${stat.color}`}>
                  <Icon size={24} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Businesses</h2>
        {loading ? (
          <div className="text-center py-8 text-gray-400">Loading...</div>
        ) : businesses.length === 0 ? (
          <div className="text-center py-12">
            <Building2 size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-700 mb-2">No businesses yet</h3>
            <p className="text-gray-400 mb-4">Create your first AI-powered WhatsApp business</p>
            <Link href="/dashboard/businesses/new" className="btn-primary">
              Create Business
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {businesses.map((b) => (
              <Link
                key={b.id}
                href={`/dashboard/businesses/${b.id}`}
                className="flex items-center justify-between p-4 rounded-lg hover:bg-gray-50 border border-gray-100 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full ${b.bot_active ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <div>
                    <h3 className="font-medium text-gray-900">{b.name}</h3>
                    <p className="text-sm text-gray-500">{b.type} &middot; {b.location || 'No location'}</p>
                  </div>
                </div>
                <div className="text-sm text-gray-400">
                  {b.whatsapp_connected ? 'WhatsApp Connected' : 'Not Connected'}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
