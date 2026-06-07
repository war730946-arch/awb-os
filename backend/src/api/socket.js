const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const db = require('../database');
const manager = require('../whatsapp/manager');

const JWT_SECRET = process.env.JWT_SECRET || 'awb-os-secret-key';

function setupSocket(httpServer, corsOptions) {
  const io = new Server(httpServer, {
    cors: corsOptions,
    pingInterval: 25000,
    pingTimeout: 20000,
    transports: ['websocket', 'polling']
  });

  manager.setSocketIO(io);

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) {
        return next(new Error('Authentication required'));
      }
      const decoded = jwt.verify(token, JWT_SECRET);
      let user = db.getUserById ? await db.getUserById(decoded.userId) : null;
      if (!user && decoded.email) {
        user = db.getUserByEmail ? await db.getUserByEmail(decoded.email) : null;
      }
      if (!user) {
        return next(new Error('User not found'));
      }
      socket.user = { id: user.id, email: user.email };
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.user.email} (${socket.id})`);

    socket.on('subscribe:business', async (businessId) => {
      try {
        const biz = await db.getBusinessById(businessId);
        if (!biz || biz.user_id !== socket.user.id) {
          socket.emit('error', { message: 'Business not found' });
          return;
        }
        const room = `business:${businessId}`;
        socket.join(room);
        console.log(`${socket.user.email} joined room ${room}`);

        const state = manager.getConnectionState(businessId);
        socket.emit('connection_state', {
          businessId,
          connected: state?.connected || false,
          hasSession: state?.hasSession || false,
          qrGeneratedAt: state?.qrGeneratedAt || null,
          botRunning: manager.isBotRunning(businessId)
        });

        if (biz.whatsapp_qr) {
          try {
            const qrcode = require('qrcode');
            const qrImage = await qrcode.toDataURL(biz.whatsapp_qr);
            socket.emit('qr_updated', { businessId, qr: qrImage });
          } catch (e) {}
        }
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    socket.on('unsubscribe:business', (businessId) => {
      socket.leave(`business:${businessId}`);
    });

    socket.on('start:bot', async (businessId) => {
      try {
        const biz = await db.getBusinessById(businessId);
        if (!biz || biz.user_id !== socket.user.id) {
          socket.emit('error', { message: 'Business not found' });
          return;
        }
        await manager.stopBot(businessId);
        await new Promise(r => setTimeout(r, 500));
        await manager.startBot(businessId, biz.phone_number);
        socket.emit('bot_starting', { businessId });
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    socket.on('stop:bot', async (businessId) => {
      try {
        const biz = await db.getBusinessById(businessId);
        if (!biz || biz.user_id !== socket.user.id) {
          socket.emit('error', { message: 'Business not found' });
          return;
        }
        await manager.stopBot(businessId);
        socket.emit('bot_stopped', { businessId });
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    socket.on('get:qr', async (businessId) => {
      try {
        const biz = await db.getBusinessById(businessId);
        if (!biz || biz.user_id !== socket.user.id) {
          socket.emit('error', { message: 'Business not found' });
          return;
        }
        if (biz.whatsapp_qr) {
          const qrcode = require('qrcode');
          const qrImage = await qrcode.toDataURL(biz.whatsapp_qr);
          socket.emit('qr_updated', { businessId, qr: qrImage });
        } else {
          socket.emit('qr_updated', { businessId, qr: null });
        }
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    socket.on('disconnect', (reason) => {
      console.log(`Socket disconnected: ${socket.user.email} (${reason})`);
    });
  });

  return io;
}

module.exports = { setupSocket };
