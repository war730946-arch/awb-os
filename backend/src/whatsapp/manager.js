const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestWaWebVersion } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode-terminal');
const path = require('path');
const fs = require('fs');
const { getBusinessByPhone, saveMessage, upsertCustomer, checkCanRespond, getCustomerMessages, createLead } = require('../database');
const { generateResponse } = require('../ai/engine');
const { processVoice } = require('../voice/processor');

process.env.NODE_OPTIONS = '--dns-result-order=verbatim';

class WhatsAppManager {
  constructor() {
    this.connections = new Map();
    this.processedMessages = new Map();
    this.healthIntervals = new Map();
    this.io = null;
    this._initialized = false;
  }

  setSocketIO(io) {
    this.io = io;
  }

  _emit(businessId, event, data) {
    if (this.io) {
      this.io.to(`business:${businessId}`).emit(event, data);
    }
  }

  _getAuthDir(businessId) {
    const isCloud = !!(process.env.RAILWAY_PUBLIC_DOMAIN || process.env.VERCEL || process.env.RENDER_EXTERNAL_URL || process.env.DATABASE_URL);
    return isCloud
      ? path.join('/tmp', `auth_${businessId}`)
      : path.join(__dirname, `../../auth_${businessId}`);
  }

  async startBot(businessId, phoneNumber) {
    if (this.connections.has(businessId)) {
      const existing = this.connections.get(businessId);
      if (existing.socket?.user?.id || existing.connected) {
        console.log(`[${businessId}] Bot already connected for ${phoneNumber}`);
        return existing.socket;
      }
      console.log(`[${businessId}] Previous session stale, restarting...`);
      await this.stopBot(businessId);
    }

    const authDir = this._getAuthDir(businessId);
    if (!fs.existsSync(authDir)) {
      fs.mkdirSync(authDir, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const hasSession = fs.existsSync(path.join(authDir, 'creds.json'));

    const { version } = await fetchLatestWaWebVersion().catch(() => ({ version: [2, 3000, 1023223821] }));

    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      browser: ['AWB-OS', 'Chrome', '1.0.0'],
      syncFullHistory: false,
      markOnlineOnConnect: true,
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 15000,
      defaultQueryTimeoutMs: 60000,
      emitOwnEvents: false
    });

    const connectionState = {
      socket: sock,
      businessId,
      phoneNumber,
      authDir,
      hasSession,
      saveCreds,
      lastQr: '',
      qrTimeout: null,
      qrGeneratedAt: null,
      connected: false,
      stopped: false,
      healthCheckFailures: 0
    };

    this.connections.set(businessId, connectionState);

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      if (connectionState.stopped) return;

      const { connection, lastDisconnect, qr } = update;

      if (qr && qr !== connectionState.lastQr) {
        connectionState.lastQr = qr;
        connectionState.qrGeneratedAt = Date.now();
        qrcode.generate(qr, { small: true });
        console.log(`\n[${new Date().toLocaleTimeString()}] QR for ${phoneNumber}`);
        const { updateBusiness } = require('../database');
        await updateBusiness(businessId, { whatsapp_qr: qr, whatsapp_connected: false });

        try {
          const qrPng = require('qrcode');
          await qrPng.toFile(path.join(__dirname, '../../wa-qr.png'), qr, { width: 500, margin: 2 });
        } catch (e) {}

        clearTimeout(connectionState.qrTimeout);
        connectionState.qrTimeout = setTimeout(async () => {
          if (connectionState.stopped || connectionState.connected) return;
          const biz = await getBusinessByPhone(phoneNumber);
          if (biz && !biz.whatsapp_connected) {
            console.log(`[${businessId}] QR expired, clearing...`);
            connectionState.lastQr = '';
            connectionState.qrGeneratedAt = null;
            const { updateBusiness } = require('../database');
            await updateBusiness(businessId, { whatsapp_qr: '' });
            this._emit(businessId, 'qr_expired', { businessId });
          }
        }, 120000);
      }

      if (connection === 'open') {
        connectionState.connected = true;
        clearTimeout(connectionState.qrTimeout);
        console.log(`\n✅ Connected ${phoneNumber}`);
        const { updateBusiness } = require('../database');
        await updateBusiness(businessId, {
          whatsapp_connected: true,
          phone_number: phoneNumber,
          whatsapp_qr: ''
        });
        const biz = await getBusinessByPhone(phoneNumber);
        if (biz && biz.pairing_code) {
          await updateBusiness(businessId, { pairing_code: '' });
        }
        this._emit(businessId, 'connection_open', { businessId, phoneNumber });
        this._startHealthCheck(businessId);
      }

      if (connection === 'close') {
        connectionState.connected = false;
        const code = lastDisconnect?.error?.output?.statusCode;
        const message = lastDisconnect?.error?.message?.substring(0, 80) || '';
        console.log(`❌ Closed ${phoneNumber}: ${message}`);

        if (code === DisconnectReason.loggedOut) {
          console.log(`[${businessId}] Logged out, removing session`);
          this.connections.delete(businessId);
          this._stopHealthCheck(businessId);
          try { fs.rmSync(authDir, { recursive: true }); } catch (e) {}
          const { updateBusiness } = require('../database');
          await updateBusiness(businessId, { whatsapp_connected: false, whatsapp_qr: '' });
          this._emit(businessId, 'logged_out', { businessId });
          return;
        }

        if (code === DisconnectReason.badSession) {
          console.log(`[${businessId}] Bad session, clearing and awaiting QR...`);
          try { fs.rmSync(authDir, { recursive: true }); } catch (e) {}
          this.connections.delete(businessId);
          this._stopHealthCheck(businessId);
          const { updateBusiness } = require('../database');
          await updateBusiness(businessId, { whatsapp_connected: false, whatsapp_qr: '' });
          this._emit(businessId, 'session_bad', { businessId });
          return;
        }

        const recoverableCodes = [
          DisconnectReason.connectionClosed,
          DisconnectReason.connectionLost,
          DisconnectReason.restartRequired,
          DisconnectReason.timedOut
        ];

        if (connectionState.hasSession && recoverableCodes.includes(code)) {
          console.log(`[${businessId}] Reconnecting in 3s...`);
          this._emit(businessId, 'reconnecting', { businessId });
          connectionState.stopped = true;
          this.connections.delete(businessId);
          setTimeout(() => this.startBot(businessId, phoneNumber), 3000);
          return;
        }

        this.connections.delete(businessId);
        this._stopHealthCheck(businessId);
        this._emit(businessId, 'connection_close', { businessId, code });
      }
    });

    sock.ev.on('messages.upsert', async (msg) => {
      if (connectionState.stopped) return;
      const message = msg.messages[0];
      if (!message.key || !message.message || message.key.fromMe) return;

      const msgId = message.key.id;
      const bizProcessed = this.processedMessages.get(businessId) || new Set();
      if (bizProcessed.has(msgId)) return;
      bizProcessed.add(msgId);
      if (bizProcessed.size > 1000) {
        const arr = [...bizProcessed];
        bizProcessed.clear();
        arr.slice(-500).forEach(id => bizProcessed.add(id));
      }
      this.processedMessages.set(businessId, bizProcessed);

      const userPhone = message.key.remoteJid?.replace('@s.whatsapp.net', '');
      if (!userPhone) return;

      const business = await getBusinessByPhone(phoneNumber);
      if (!business) return;

      const canRespond = await checkCanRespond(businessId, userPhone);
      if (!canRespond.allowed) {
        if (canRespond.reason === 'limit_reached') {
          await sock.sendMessage(message.key.remoteJid, {
            text: `⏳ *Free Limit Reached*\n\nYou have used your ${canRespond.max} free responses for today.\nTo continue, please upgrade the subscription.\n\nContact admin to upgrade.`
          });
        } else {
          await sock.sendMessage(message.key.remoteJid, {
            text: `⏳ *Trial Expired*\n\nAI assistant is paused.\nPlease renew subscription to continue.\nContact admin to upgrade.`
          });
        }
        return;
      }

      let userText = '';

      if (message.message.conversation) {
        userText = message.message.conversation;
      } else if (message.message.extendedTextMessage?.text) {
        userText = message.message.extendedTextMessage.text;
      } else if (message.message.imageMessage) {
        await sock.sendMessage(message.key.remoteJid, {
          text: `📸 I received your image. I can't view images, but feel free to describe it or ask me something!`
        });
        return;
      } else if (message.message.videoMessage) {
        return;
      } else if (message.message.audioMessage) {
        try {
          const buffer = await sock.downloadMediaMessage(message);
          const result = await processVoice(buffer);
          if (result.success) userText = result.text;
          else {
            if (result.error === 'Whisper not installed') {
              await sock.sendMessage(message.key.remoteJid, {
                text: '🎵 Voice transcription is not available. Please send a text message.'
              });
            }
            userText = '';
          }
        } catch (err) {
          console.error('Voice download error:', err);
        }
      }

      if (!userText.trim()) return;

      console.log(`\n💬 ${userPhone}: ${userText.substring(0, 100)}`);

      const customer = await upsertCustomer(businessId, userPhone, '');
      const history = await getCustomerMessages(businessId, userPhone, 10);

      try {
        const { reply, intent } = await generateResponse(business, userText, history);
        await sock.sendMessage(message.key.remoteJid, { text: reply });
        await saveMessage(businessId, userPhone, userText, reply, intent);
        console.log(`🤖 Reply: ${reply.substring(0, 100)}`);

        if (['booking', 'pricing'].includes(intent)) {
          await createLead(businessId, customer?.id, userPhone, customer?.name, intent);
        }
      } catch (err) {
        console.error('AI error:', err.message);
        await sock.sendMessage(message.key.remoteJid, {
          text: 'Thanks for your message! We will get back to you shortly.'
        });
      }
    });

    if (hasSession) {
      console.log(`[${businessId}] Session found for ${phoneNumber}, restoring...`);
      this._emit(businessId, 'session_restored', { businessId, phoneNumber });
    }

    return sock;
  }

  async stopBot(businessId) {
    const state = this.connections.get(businessId);
    if (state) {
      state.stopped = true;
      clearTimeout(state.qrTimeout);
      this._stopHealthCheck(businessId);
      try {
        state.socket.end(new Error('Bot stopped by admin'));
      } catch (e) {}
      this.connections.delete(businessId);
      const { updateBusiness } = require('../database');
      await updateBusiness(businessId, { whatsapp_connected: false });
    }
  }

  async requestPairing(businessId, phoneNumber) {
    const state = this.connections.get(businessId);
    if (!state || !state.socket) {
      return { success: false, error: 'Bot not active' };
    }
    try {
      const code = await state.socket.requestPairingCode(phoneNumber);
      console.log(`🔑 Pairing code for ${phoneNumber}: ${code}`);
      const { updateBusiness } = require('../database');
      await updateBusiness(businessId, { pairing_code: code });
      return { success: true, code };
    } catch (err) {
      console.error('Pairing code error:', err.message);
      return { success: false, error: err.message };
    }
  }

  async sendMessage(businessId, remoteJid, text) {
    const state = this.connections.get(businessId);
    if (!state || !state.socket) throw new Error('Bot not active');
    await state.socket.sendMessage(remoteJid, { text });
  }

  getBotStatus(businessId) {
    const state = this.connections.get(businessId);
    return state ? state.connected : false;
  }

  isBotRunning(businessId) {
    return this.connections.has(businessId);
  }

  getConnectionState(businessId) {
    const state = this.connections.get(businessId);
    if (!state) return null;
    return {
      connected: state.connected,
      phoneNumber: state.phoneNumber,
      hasSession: state.hasSession,
      qrGeneratedAt: state.qrGeneratedAt,
      stopped: state.stopped
    };
  }

  _startHealthCheck(businessId) {
    this._stopHealthCheck(businessId);
    const interval = setInterval(async () => {
      const state = this.connections.get(businessId);
      if (!state || state.stopped) {
        this._stopHealthCheck(businessId);
        return;
      }

      try {
        const { updateBusiness } = require('../database');
        const biz = await getBusinessByPhone(state.phoneNumber);

        if (!biz) {
          state.healthCheckFailures++;
          if (state.healthCheckFailures > 3) {
            console.log(`[${businessId}] Health: business not found, stopping`);
            await this.stopBot(businessId);
          }
          return;
        }

        if (!state.connected) {
          state.healthCheckFailures++;
          if (state.healthCheckFailures > 6) {
            console.log(`[${businessId}] Health: disconnected for 3min, restarting`);
            await this.stopBot(businessId);
            setTimeout(() => this.startBot(businessId, state.phoneNumber), 1000);
          }
          return;
        }

        state.healthCheckFailures = 0;

        if (biz.whatsapp_connected !== true) {
          await updateBusiness(businessId, { whatsapp_connected: true });
        }

        this._emit(businessId, 'health_check', {
          businessId,
          connected: true,
          timestamp: Date.now()
        });
      } catch (e) {
        console.error(`[${businessId}] Health check error:`, e.message);
      }
    }, 30000);

    this.healthIntervals.set(businessId, interval);
  }

  _stopHealthCheck(businessId) {
    if (this.healthIntervals.has(businessId)) {
      clearInterval(this.healthIntervals.get(businessId));
      this.healthIntervals.delete(businessId);
    }
  }

  async disconnectAll() {
    for (const [businessId, state] of this.connections) {
      state.stopped = true;
      clearTimeout(state.qrTimeout);
      this._stopHealthCheck(businessId);
      try {
        state.socket.end(new Error('Server shutting down'));
      } catch (e) {}
    }
    this.connections.clear();
    this.processedMessages.clear();
  }
}

const manager = new WhatsAppManager();

module.exports = manager;
