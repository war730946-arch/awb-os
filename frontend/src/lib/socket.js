let socket = null;

const RAILWAY_API = 'https://jubilant-hope-production-ccfa.up.railway.app';

export function connectSocket(token) {
  if (typeof window === 'undefined') return null;
  if (socket?.connected) return socket;

  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  if (!isLocal) {
    return null;
  }

  try {
    const { io } = require('socket.io-client');
    socket = io('http://localhost:3456', {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 2000,
      timeout: 5000
    });

    socket.on('connect', () => console.log('[WS] Connected'));
    socket.on('disconnect', () => console.log('[WS] Disconnected'));
    socket.on('connect_error', () => {});
  } catch (e) {
    socket = null;
  }

  return socket;
}

export function getSocket() {
  return socket;
}

export function subscribeBusiness(businessId) {
  if (socket?.connected) {
    socket.emit('subscribe:business', businessId);
  }
}

export function unsubscribeBusiness(businessId) {
  if (socket?.connected) {
    socket.emit('unsubscribe:business', businessId);
  }
}

export function requestQr(businessId) {
  if (socket?.connected) {
    socket.emit('get:qr', businessId);
  }
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
