'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Wifi, WifiOff, MessageSquare, Users, Edit3, Save, Smartphone } from 'lucide-react';
import { getBusiness, updateBusiness, connectWhatsApp, disconnectWhatsApp, getMessages, getSubscription } from '../../../../lib/api';

export default function BusinessDetailPage() {
  const { id } = useParams();
  const router = useRouter();

  const [business, setBusiness] = useState(null);
  const [messages, setMessages] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  const [form, setForm] = useState({});
  const [phoneInput, setPhoneInput] = useState('');
  const [connectLoading, setConnectLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [qrCode, setQrCode] = useState(null);

  useEffect(() => { load(); }, [id]);

  async function load() {
    try {
      const [bRes, mRes, sRes] = await Promise.all([
        getBusiness(id),
        getMessages(id, 30),
        getSubscription(id)
      ]);
      setBusiness(bRes.business);
      setMessages(mRes.messages || []);
      setSubscription(sRes.subscription);
      setForm({
        name: bRes.business.name,
        type: bRes.business.type,
        description: bRes.business.description || '',
        location: bRes.business.location || '',
        working_hours: bRes.business.working_hours || '',
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleConnect() {
    if (!phoneInput.trim()) return;
    setConnectLoading(true);
    try {
      await connectWhatsApp(id, phoneInput);
      // Poll for QR code
      const pollQr = setInterval(async () => {
        try {
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/businesses/${id}/qr`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('awb_token')}` }
          });
          const data = await res.json();
          if (data.qr) {
            setQrCode(data.qr);
          }
          if (data.connected) {
            clearInterval(pollQr);
            setQrCode(null);
            load();
          }
        } catch (_) {}
      }, 2000);
      // Stop polling after 2 minutes
      setTimeout(() => clearInterval(pollQr), 120000);
    } catch (err) {
      alert(err.message);
    } finally {
      setConnectLoading(false);
    }
  }

  async function handleDisconnect() {
    try {
      await disconnectWhatsApp(id);
      load();
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleSave() {
    setSaveLoading(true);
    try {
      await updateBusiness(id, form);
      setEditing(false);
      load();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaveLoading(false);
    }
  }

  if (loading) return <div className="text-center py-12 text-gray-400">Loading...</div>;
  if (!business) return <div className="text-center py-12 text-gray-400">Business not found</div>;

  const services = business.services || [];
  const faqs = business.faqs || [];

  return (
    <div>
      <div className="mb-8">
        <Link href="/dashboard/businesses" className="text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-2">
          <ArrowLeft size={16} /> Back to Businesses
        </Link>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{business.name}</h1>
            <p className="text-gray-500">{business.type?.replace('_', ' ')} {business.location ? `• ${business.location}` : ''}</p>
          </div>
          <button
            onClick={() => editing ? handleSave() : setEditing(true)}
            className={`flex items-center gap-2 ${editing ? 'btn-primary' : 'btn-secondary'}`}
            disabled={saveLoading}
          >
            {editing ? <Save size={16} /> : <Edit3 size={16} />}
            {editing ? (saveLoading ? 'Saving...' : 'Save') : 'Edit'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">WhatsApp Connection</h3>
          <div className="flex items-center gap-2 mb-4">
            {business.bot_active ? (
              <span className="flex items-center gap-1 text-green-600 text-sm"><Wifi size={16} /> Connected</span>
            ) : (
              <span className="flex items-center gap-1 text-gray-400 text-sm"><WifiOff size={16} /> Disconnected</span>
            )}
          </div>

          {!business.whatsapp_connected ? (
            <div className="space-y-2">
              <input
                type="text"
                value={phoneInput}
                onChange={e => setPhoneInput(e.target.value)}
                className="input-field text-sm"
                placeholder="+911234567890"
              />
              <button onClick={handleConnect} disabled={connectLoading} className="btn-primary w-full text-sm">
                {connectLoading ? 'Connecting...' : 'Connect WhatsApp'}
              </button>
              {qrCode && (
                <div className="mt-4 text-center">
                  <p className="text-sm text-gray-500 mb-2">Scan this QR with WhatsApp:</p>
                  <img src={qrCode} alt="WhatsApp QR" className="mx-auto w-48 h-48" />
                  <p className="text-xs text-gray-400 mt-2">Open WhatsApp → Menu → Linked Devices → Link a Device</p>
                  <Smartphone size={16} className="inline text-gray-400 mr-1" />
                </div>
              )}
            </div>
          ) : (
            <button onClick={handleDisconnect} className="btn-danger w-full text-sm">
              Disconnect
            </button>
          )}
        </div>

        <div className="card">
          <div className="flex items-center gap-2 text-gray-900 font-semibold mb-2">
            <MessageSquare size={18} />
            <span>Messages</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{messages.length}</p>
          <p className="text-sm text-gray-500">Total conversations</p>
        </div>

        <div className="card">
          <div className="flex items-center gap-2 text-gray-900 font-semibold mb-2">
            <Users size={18} />
            <span>Subscription</span>
          </div>
          <p className="text-lg font-bold text-gray-900 capitalize">{subscription?.status || 'Unknown'}</p>
          <p className="text-sm text-gray-500">
            {subscription?.plan} plan
            {subscription?.trial_end_date ? ` • Trial until ${new Date(subscription.trial_end_date).toLocaleDateString()}` : ''}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Business Info</h3>
          {editing ? (
            <div className="space-y-3">
              <input
                type="text"
                value={form.name}
                onChange={e => setForm({...form, name: e.target.value})}
                className="input-field"
                label="Name"
              />
              <select value={form.type} onChange={e => setForm({...form, type: e.target.value})} className="input-field">
                {['general','clinic','restaurant','real_estate','salon','fitness','education','retail','service','other'].map(t => (
                  <option key={t} value={t}>{t.replace('_',' ').replace(/\b\w/g,c=>c.toUpperCase())}</option>
                ))}
              </select>
              <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="input-field" rows={2} />
              <input type="text" value={form.location} onChange={e => setForm({...form, location: e.target.value})} className="input-field" />
              <input type="text" value={form.working_hours} onChange={e => setForm({...form, working_hours: e.target.value})} className="input-field" />
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <div><span className="text-gray-500">Type:</span> <span className="capitalize">{business.type.replace('_', ' ')}</span></div>
              {business.description && <div><span className="text-gray-500">Description:</span> {business.description}</div>}
              {business.location && <div><span className="text-gray-500">Location:</span> {business.location}</div>}
              <div><span className="text-gray-500">Hours:</span> {business.working_hours}</div>
              <div><span className="text-gray-500">Created:</span> {new Date(business.created_at).toLocaleDateString()}</div>
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Recent Messages</h3>
          {messages.length === 0 ? (
            <p className="text-gray-400 text-sm">No messages yet</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {messages.slice(0, 10).map((msg) => (
                <div key={msg.id} className="text-sm p-2 bg-gray-50 rounded">
                  <p className="text-gray-900">
                    <span className="text-gray-400 font-mono text-xs">{msg.user_number.slice(-6)}:</span>{' '}
                    {msg.message.slice(0, 60)}{msg.message.length > 60 ? '...' : ''}
                  </p>
                  <p className="text-gray-500 text-xs mt-1">Intent: {msg.intent} • {new Date(msg.created_at).toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-gray-900">Services</h3>
          <span className="text-sm text-gray-400">{services.length} services</span>
        </div>
        {services.length === 0 ? (
          <p className="text-gray-400 text-sm">No services added. Edit AI settings to add services.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {services.map((s, i) => (
              <div key={i} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex justify-between">
                  <span className="font-medium">{s.name}</span>
                  <span className="text-primary-600 font-medium">${s.price}</span>
                </div>
                {s.description && <p className="text-sm text-gray-500 mt-1">{s.description}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
