// Standalone WhatsApp pairing code generator
// Run: node get-pairing.js

process.env.DATABASE_URL = '';

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestWaWebVersion } = require('@whiskeysockets/baileys');
const path = require('path');
const fs = require('fs');

const db = require('./src/database');

process.env.NODE_OPTIONS = '--dns-result-order=verbatim';

async function main() {
  if (db.init) await db.init();
  
  const user = await db.getUserByEmail('admin@awb-os.com');
  if (!user) { console.error('Admin not found'); process.exit(1); }
  
  const businesses = await db.getUserBusinesses(user.id);
  if (businesses.length === 0) { console.error('No business'); process.exit(1); }
  
  const business = businesses[0];
  const phone = business.phone_number || '923281146929';
  console.log('Phone:', phone);

  const authDir = path.join(__dirname, `auth_info_${business.id}`);
  if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const { version } = await fetchLatestWaWebVersion().catch(() => ({ version: [2, 3000, 1023223821] }));

  const sock = makeWASocket({
    version, auth: state, printQRInTerminal: false,
    browser: ['AWB-OS', 'Chrome', '1.0.0'],
    syncFullHistory: false, markOnlineOnConnect: true,
    connectTimeoutMs: 30000, keepAliveIntervalMs: 25000
  });

  sock.ev.on('creds.update', saveCreds);

  let codeRequested = false;

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    
    if (qr && !codeRequested) {
      codeRequested = true;  // Only attempt once
      console.log('Requesting pairing code...');
      try {
        const code = await sock.requestPairingCode(phone);
        console.log(`\n✦ PAIRING CODE: ${code} ✦`);
        console.log(`\nHow to use:`);
        console.log(`1. Open WhatsApp on your phone`);
        console.log(`2. Go to Linked Devices (3-dot menu)`);
        console.log(`3. Tap "Link a Device"`);
        console.log(`4. When QR scanner opens, tap the 3 dots (top right)`);
        console.log(`5. Select "Link with Phone Number"`);
        console.log(`6. Enter: ${code}`);
        console.log(`\nCode expires in ~2 minutes\n`);
      } catch (err) {
        console.error('Pairing failed:', err.message);
        console.log('Fallback: Scan the QR when it appears below');
      }
    }

    if (connection === 'open') {
      console.log('\n✓ WhatsApp connected successfully!');
      process.exit(0);
    }

    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (!shouldReconnect) {
        console.log('\nLogged out or pairing expired.');
        console.log('Run again for a new code.');
        process.exit(0);
      }
    }
  });

  console.log('\nConnecting... (waiting up to 30s)\n');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
