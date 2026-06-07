'use client';
import { useState, useEffect, useCallback } from 'react';
import { X, RefreshCw, Smartphone, CheckCircle, AlertCircle, Clock, Wifi, WifiOff } from 'lucide-react';
import { connectWhatsApp, fetchBusinessQr, requestPairingCode } from '../lib/api';
import { connectSocket, subscribeBusiness, unsubscribeBusiness } from '../lib/socket';

const STATUS = {
  INIT: 'init',
  CONNECTING: 'connecting',
  WAITING_SCAN: 'waiting_scan',
  EXPIRED: 'expired',
  REFRESHING: 'refreshing',
  CONNECTED: 'connected',
  ERROR: 'error',
  PAIRING: 'pairing'
};

export default function QrModal({ isOpen, onClose, businessId, phoneNumber, onConnected }) {
  const [qr, setQr] = useState(null);
  const [status, setStatus] = useState(STATUS.INIT);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(120);
  const [phoneInput, setPhoneInput] = useState(phoneNumber || '');
  const [pairingCode, setPairingCode] = useState('');
  const [pairingLoading, setPairingLoading] = useState(false);
  const [pollInterval, setPollInterval] = useState(null);

  const startPolling = useCallback(() => {
    if (pollInterval) clearInterval(pollInterval);
    const interval = setInterval(async () => {
      try {
        const data = await fetchBusinessQr(businessId);
        if (data.qr) {
          setQr(data.qr);
          setStatus(STATUS.WAITING_SCAN);
          setCountdown(120);
          setError('');
        }
        if (data.connected) {
          setStatus(STATUS.CONNECTED);
          clearInterval(interval);
          setPollInterval(null);
          if (onConnected) onConnected();
        }
      } catch (e) {}
      try {
        const data = await fetchBusinessQr(businessId);
        if (data.connected) {
          setStatus(STATUS.CONNECTED);
          clearInterval(interval);
          setPollInterval(null);
          setTimeout(() => onClose(), 1500);
        }
      } catch (e) {}
    }, 2000);
    setPollInterval(interval);
  }, [businessId, onConnected, onClose]);

  useEffect(() => {
    if (!isOpen) {
      if (pollInterval) clearInterval(pollInterval);
      setPollInterval(null);
      setQr(null);
      setStatus(STATUS.INIT);
      setError('');
      setCountdown(120);
      setPairingCode('');
      return;
    }

    const token = localStorage.getItem('awb_token');
    const sock = connectSocket(token);
    if (sock?.connected) {
      subscribeBusiness(businessId);
      sock.on('qr_updated', (data) => {
        if (data.qr) {
          setQr(data.qr);
          setStatus(STATUS.WAITING_SCAN);
          setCountdown(120);
          setError('');
        }
        if (data.connected) {
          setStatus(STATUS.CONNECTED);
          setTimeout(() => onClose(), 1500);
        }
      });
      sock.on('connection_open', () => {
        setStatus(STATUS.CONNECTED);
        setTimeout(() => onClose(), 1500);
      });
      sock.on('connection_close', () => {
        setStatus(STATUS.INIT);
        setQr(null);
      });
      sock.on('qr_expired', () => {
        setStatus(STATUS.EXPIRED);
        setQr(null);
      });
    }

    return () => {
      if (sock?.connected) {
        unsubscribeBusiness(businessId);
        sock.off('qr_updated');
        sock.off('connection_open');
        sock.off('connection_close');
        sock.off('qr_expired');
      }
    };
  }, [isOpen, businessId, onClose]);

  const handleConnect = async () => {
    const phone = phoneInput.trim();
    if (!phone) {
      setError('Enter a phone number with country code');
      return;
    }
    setStatus(STATUS.CONNECTING);
    setError('');
    setQr(null);
    setCountdown(120);

    try {
      await connectWhatsApp(businessId, phone);
      startPolling();
    } catch (err) {
      setStatus(STATUS.ERROR);
      setError(err.message);
    }
  };

  const handleRefresh = async () => {
    setStatus(STATUS.REFRESHING);
    setQr(null);
    setError('');
    setCountdown(120);

    try {
      await connectWhatsApp(businessId, phoneInput.trim() || phoneNumber);
      startPolling();
    } catch (err) {
      setStatus(STATUS.ERROR);
      setError(err.message);
    }
  };

  const handlePairingCode = async () => {
    const phone = phoneInput.trim();
    if (!phone) {
      setError('Enter a phone number with country code');
      return;
    }
    setPairingLoading(true);
    setError('');

    try {
      await connectWhatsApp(businessId, phone);
      const res = await requestPairingCode(businessId, phone);
      if (res.success && res.code) {
        setPairingCode(res.code);
        setStatus(STATUS.PAIRING);
      } else {
        setError(res.error || 'Failed to get pairing code');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setPairingLoading(false);
    }
  };

  useEffect(() => {
    if (status !== STATUS.WAITING_SCAN || countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          setStatus(STATUS.EXPIRED);
          setQr(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [status, countdown]);

  if (!isOpen) return null;

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${
              status === STATUS.CONNECTED ? 'bg-green-100' :
              status === STATUS.ERROR ? 'bg-red-100' :
              status === STATUS.EXPIRED ? 'bg-orange-100' :
              'bg-indigo-100'
            }`}>
              {status === STATUS.CONNECTED ? <CheckCircle size={20} className="text-green-600" /> :
               status === STATUS.ERROR ? <AlertCircle size={20} className="text-red-600" /> :
               status === STATUS.EXPIRED ? <Clock size={20} className="text-orange-600" /> :
               <Smartphone size={20} className="text-indigo-600" />}
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">WhatsApp Connection</h3>
              <p className="text-xs text-gray-500">
                {status === STATUS.CONNECTED ? 'Connected' :
                 status === STATUS.CONNECTING ? 'Initializing...' :
                 status === STATUS.WAITING_SCAN ? 'Scan with WhatsApp' :
                 status === STATUS.EXPIRED ? 'QR expired' :
                 status === STATUS.REFRESHING ? 'Generating new QR...' :
                 status === STATUS.PAIRING ? 'Pairing code ready' :
                 status === STATUS.ERROR ? 'Connection failed' :
                 'Enter phone number'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        <div className="p-6">
          {status === STATUS.INIT && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp Number</label>
                <input
                  type="text"
                  value={phoneInput}
                  onChange={e => setPhoneInput(e.target.value)}
                  placeholder="923001234567"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
                <p className="text-xs text-gray-400 mt-1">Include country code, no + sign</p>
              </div>
              <button onClick={handleConnect} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors">
                Generate QR Code
              </button>
            </div>
          )}

          {(status === STATUS.CONNECTING || status === STATUS.WAITING_SCAN || status === STATUS.REFRESHING) && (
            <div className="text-center space-y-4">
              {qr ? (
                <div className="inline-block bg-white p-4 rounded-2xl border-2 border-gray-100 shadow-sm">
                  <img src={qr} alt="WhatsApp QR" className="w-64 h-64" />
                </div>
              ) : (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4" />
                    <p className="text-sm text-gray-500">
                      {status === STATUS.CONNECTING ? 'Connecting to WhatsApp...' : 'Generating QR code...'}
                    </p>
                  </div>
                </div>
              )}

              {status === STATUS.WAITING_SCAN && (
                <>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-sm text-gray-500">QR expires in</span>
                    <span className={`font-mono font-bold text-lg ${countdown < 30 ? 'text-red-600' : 'text-gray-900'}`}>
                      {formatTime(countdown)}
                    </span>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-3 text-left">
                    <p className="text-sm text-blue-800 font-medium mb-1">How to scan:</p>
                    <ol className="text-xs text-blue-700 space-y-1 ml-4 list-decimal">
                      <li>Open WhatsApp on your phone</li>
                      <li>Tap Menu (⋮) → Linked Devices</li>
                      <li>Tap Link a Device</li>
                      <li>Scan this QR code</li>
                    </ol>
                  </div>
                  <button onClick={handleRefresh} className="w-full py-2.5 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
                    <RefreshCw size={16} /> Refresh QR
                  </button>
                </>
              )}
            </div>
          )}

          {status === STATUS.EXPIRED && (
            <div className="text-center space-y-4">
              <div className="bg-orange-50 rounded-2xl p-8">
                <Clock size={48} className="text-orange-400 mx-auto mb-3" />
                <p className="text-gray-900 font-medium mb-1">QR Code Expired</p>
                <p className="text-sm text-gray-500 mb-4">The QR code was not scanned in time. Generate a new one.</p>
                <button onClick={handleRefresh} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2">
                  <RefreshCw size={16} /> Generate New QR
                </button>
              </div>
            </div>
          )}

          {status === STATUS.CONNECTED && (
            <div className="text-center space-y-4">
              <div className="bg-green-50 rounded-2xl p-8">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle size={36} className="text-green-600" />
                </div>
                <p className="text-gray-900 font-semibold text-lg mb-1">Connected Successfully</p>
                <p className="text-sm text-gray-500">WhatsApp is now linked. The bot is active.</p>
              </div>
            </div>
          )}

          {status === STATUS.PAIRING && pairingCode && (
            <div className="text-center space-y-4">
              <div className="bg-indigo-50 rounded-2xl p-6">
                <p className="text-sm text-gray-600 mb-3">Enter this code in WhatsApp:</p>
                <p className="text-3xl font-bold text-indigo-600 tracking-[0.3em] mb-4 select-all">{pairingCode}</p>
                <p className="text-xs text-gray-500">WhatsApp → Settings → Linked Devices → Link with Phone Number</p>
              </div>
            </div>
          )}

          {status === STATUS.ERROR && error && (
            <div className="text-center space-y-4">
              <div className="bg-red-50 rounded-2xl p-6">
                <AlertCircle size={36} className="text-red-400 mx-auto mb-2" />
                <p className="text-red-800 font-medium mb-1">Connection Failed</p>
                <p className="text-sm text-red-600 mb-4">{error}</p>
                <button onClick={handleConnect} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors">
                  Try Again
                </button>
              </div>
            </div>
          )}

          {status !== STATUS.CONNECTED && status !== STATUS.INIT && status !== STATUS.PAIRING && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <button onClick={handlePairingCode} disabled={pairingLoading} className="w-full py-2.5 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
                <Smartphone size={14} />
                {pairingLoading ? 'Getting code...' : 'Use Pairing Code Instead'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
