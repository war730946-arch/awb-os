'use client';

import { useState, useEffect } from 'react';
import { Save, User } from 'lucide-react';
import { getBusinesses, updateBusiness } from '../../../lib/api';

export default function SettingsPage() {
  const [businesses, setBusinesses] = useState([]);
  const [selectedBiz, setSelectedBiz] = useState(null);
  const [aiSettings, setAiSettings] = useState({
    personality: 'professional',
    tone: 'polite',
    language: 'auto',
    custom_rules: '',
    greeting_message: 'Hello! How can I help you today?',
    response_length: 'short'
  });
  const [services, setServices] = useState('');
  const [faqs, setFaqs] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getBusinesses().then(res => {
      setBusinesses(res.businesses || []);
    });
  }, []);

  async function loadBusiness(biz) {
    if (!biz) return;
    setSelectedBiz(biz);
    setServices(JSON.stringify(biz.services || [], null, 2));
    setFaqs(JSON.stringify(biz.faqs || [], null, 2));
    if (biz.ai_settings) {
      setAiSettings({
        personality: biz.ai_settings.personality || 'professional',
        tone: biz.ai_settings.tone || 'polite',
        language: biz.ai_settings.language || 'auto',
        custom_rules: biz.ai_settings.custom_rules || '',
        greeting_message: biz.ai_settings.greeting_message || 'Hello! How can I help you today?',
        response_length: biz.ai_settings.response_length || 'short'
      });
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      let parsedServices = [];
      let parsedFaqs = [];
      try { parsedServices = JSON.parse(services); } catch (_) {}
      try { parsedFaqs = JSON.parse(faqs); } catch (_) {}

      await updateBusiness(selectedBiz.id, {
        services: parsedServices,
        faqs: parsedFaqs,
        ai_settings: aiSettings
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert('Save failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">AI Personality Settings</h1>
        <p className="text-gray-500 mt-1">Customize how your AI assistant behaves</p>
      </div>

      <div className="mb-6">
        <select
          onChange={e => {
            const biz = businesses.find(b => b.id === e.target.value);
            loadBusiness(biz);
          }}
          className="input-field max-w-md"
          defaultValue=""
        >
          <option value="" disabled>Select a business to configure...</option>
          {businesses.map(b => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>

      {selectedBiz && (
        <div className="space-y-6 max-w-3xl">
          <div className="card space-y-4">
            <h2 className="font-semibold text-gray-900">AI Behavior</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Personality</label>
                <select
                  value={aiSettings.personality}
                  onChange={e => setAiSettings({...aiSettings, personality: e.target.value})}
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
                  value={aiSettings.tone}
                  onChange={e => setAiSettings({...aiSettings, tone: e.target.value})}
                  className="input-field"
                >
                  <option value="polite">Polite</option>
                  <option value="warm">Warm</option>
                  <option value="direct">Direct</option>
                  <option value="empathetic">Empathetic</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
                <select
                  value={aiSettings.language}
                  onChange={e => setAiSettings({...aiSettings, language: e.target.value})}
                  className="input-field"
                >
                  <option value="auto">Auto Detect</option>
                  <option value="english">English</option>
                  <option value="urdu">Urdu</option>
                  <option value="hindi">Hindi</option>
                  <option value="arabic">Arabic</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Response Length</label>
                <select
                  value={aiSettings.response_length}
                  onChange={e => setAiSettings({...aiSettings, response_length: e.target.value})}
                  className="input-field"
                >
                  <option value="short">Short (2-4 lines)</option>
                  <option value="medium">Medium (4-6 lines)</option>
                  <option value="detailed">Detailed</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Greeting Message</label>
              <input
                type="text"
                value={aiSettings.greeting_message}
                onChange={e => setAiSettings({...aiSettings, greeting_message: e.target.value})}
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Custom Rules</label>
              <textarea
                value={aiSettings.custom_rules}
                onChange={e => setAiSettings({...aiSettings, custom_rules: e.target.value})}
                className="input-field"
                rows={4}
                placeholder="Add custom instructions for the AI..."
              />
            </div>
          </div>

          <div className="card space-y-4">
            <h2 className="font-semibold text-gray-900">Services (JSON)</h2>
            <p className="text-xs text-gray-400">Format: [{'{'} \"name\": \"Service\", \"price\": 10, \"description\": \"...\" {'}'}]</p>
            <textarea
              value={services}
              onChange={e => setServices(e.target.value)}
              className="input-field font-mono text-sm"
              rows={6}
            />
          </div>

          <div className="card space-y-4">
            <h2 className="font-semibold text-gray-900">FAQs (JSON)</h2>
            <p className="text-xs text-gray-400">Format: [{'{'} \"question\": \"...\", \"answer\": \"...\" {'}'}]</p>
            <textarea
              value={faqs}
              onChange={e => setFaqs(e.target.value)}
              className="input-field font-mono text-sm"
              rows={6}
            />
          </div>

          <div className="flex items-center gap-3">
            <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
              <Save size={16} />
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
            {saved && <span className="text-green-600 text-sm">✅ Settings saved!</span>}
          </div>
        </div>
      )}
    </div>
  );
}
