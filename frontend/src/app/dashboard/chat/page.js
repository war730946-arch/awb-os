'use client';

import { useState, useEffect } from 'react';
import { MessageSquare, Search, Phone } from 'lucide-react';
import { getBusinesses, getMessages, getCustomerMessages } from '../../../lib/api';

export default function ChatPage() {
  const [businesses, setBusinesses] = useState([]);
  const [selectedBiz, setSelectedBiz] = useState(null);
  const [messages, setMessages] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerChat, setCustomerChat] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

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
      getMessages(selectedBiz, 100).then(res => {
        setMessages(res.messages || []);
        const uniquePhones = [...new Set((res.messages || []).map(m => m.user_number))];
        setCustomers(uniquePhones);
      });
    }
  }, [selectedBiz]);

  useEffect(() => {
    if (selectedBiz && selectedCustomer) {
      getCustomerMessages(selectedBiz, selectedCustomer).then(res => {
        setCustomerChat(res.messages || []);
      });
    }
  }, [selectedBiz, selectedCustomer]);

  const filteredMessages = search
    ? messages.filter(m => m.message.toLowerCase().includes(search.toLowerCase()))
    : messages;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Chat History</h1>
        <p className="text-gray-500 mt-1">View all customer conversations</p>
      </div>

      <div className="flex gap-6">
        <div className="w-72 space-y-4">
          <select
            value={selectedBiz || ''}
            onChange={e => { setSelectedBiz(e.target.value); setSelectedCustomer(null); }}
            className="input-field"
          >
            <option value="">Select business...</option>
            {businesses.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>

          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input-field pl-9"
              placeholder="Search messages..."
            />
          </div>

          <div className="card p-2 max-h-[600px] overflow-y-auto">
            {selectedCustomer ? (
              <div>
                <button
                  onClick={() => setSelectedCustomer(null)}
                  className="text-sm text-primary-600 mb-2 hover:underline"
                >
                  ← All messages
                </button>
                <div className="space-y-2">
                  {customerChat.map((msg) => (
                    <div key={msg.id} className="p-2 text-sm border-b border-gray-100 last:border-0">
                      <div className="bg-blue-50 p-2 rounded mb-1">
                        <span className="text-xs text-gray-400">Customer:</span>
                        <p>{msg.message}</p>
                      </div>
                      <div className="bg-green-50 p-2 rounded">
                        <span className="text-xs text-gray-400">AI:</span>
                        <p>{msg.response.slice(0, 80)}{msg.response.length > 80 ? '...' : ''}</p>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{new Date(msg.created_at).toLocaleString()}</p>
                    </div>
                  ))}
                  {customerChat.length === 0 && <p className="text-sm text-gray-400 p-2">No messages yet</p>}
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                {customers.map((phone) => {
                  const msgs = messages.filter(m => m.user_number === phone);
                  const last = msgs[0];
                  return (
                    <button
                      key={phone}
                      onClick={() => setSelectedCustomer(phone)}
                      className="w-full text-left p-2 rounded hover:bg-gray-50 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <Phone size={14} className="text-gray-400" />
                        <span className="font-mono text-xs">{phone.slice(-8)}</span>
                      </div>
                      <p className="text-gray-500 text-xs mt-1 truncate">{last?.message?.slice(0, 40)}</p>
                      <p className="text-gray-400 text-xs">{msgs.length} messages</p>
                    </button>
                  );
                })}
                {customers.length === 0 && (
                  <p className="text-sm text-gray-400 p-2 text-center">No conversations</p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 card">
          <h3 className="font-semibold text-gray-900 mb-4">
            {selectedCustomer ? `Chat with ${selectedCustomer.slice(-8)}` : 'All Messages'}
          </h3>
          {!selectedCustomer && (
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {filteredMessages.slice(0, 50).map((msg) => (
                <div key={msg.id} className="p-3 border border-gray-100 rounded-lg">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span className="font-mono">{msg.user_number}</span>
                    <span>Intent: {msg.intent}</span>
                  </div>
                  <div className="bg-blue-50 p-2 rounded mb-1">
                    <span className="text-xs text-gray-500">Customer:</span>
                    <p>{msg.message}</p>
                  </div>
                  <div className="bg-green-50 p-2 rounded">
                    <span className="text-xs text-gray-500">AI:</span>
                    <p>{msg.response}</p>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{new Date(msg.created_at).toLocaleString()}</p>
                </div>
              ))}
              {filteredMessages.length === 0 && (
                <p className="text-gray-400 text-center py-8">No messages found</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
