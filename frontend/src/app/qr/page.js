'use client';
import { useState, useEffect } from 'react';

const RAILWAY = 'https://jubilant-hope-production-ccfa.up.railway.app';

export default function QrPage() {
  const [qr, setQr] = useState(null);
  const [connected, setConnected] = useState(false);
  const [pairing, setPairing] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchQr() {
      try {
        const login = await fetch(RAILWAY + '/api/auth/login', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({email:'admin@awb-os.com',password:'Admin@123456'})
        });
        if (!login.ok) { setLoading(false); return; }
        const { token } = await login.json();
        const biz = await fetch(RAILWAY + '/api/businesses', {
          headers: {Authorization:'Bearer '+token}
        });
        if (!biz.ok) { setLoading(false); return; }
        const { businesses } = await biz.json();
        const b = businesses?.[0];
        if (!b) { setLoading(false); return; }

        const qrRes = await fetch(RAILWAY + '/api/businesses/' + b.id + '/qr', {
          headers: {Authorization:'Bearer '+token}
        });
        const qrData = await qrRes.json();
        setQr(qrData.qr);
        setConnected(qrData.connected);
        if (b.pairing_code) setPairing(b.pairing_code);
      } catch (e) { console.error(e); }
      setLoading(false);
    }
    fetchQr();
    const timer = setInterval(fetchQr, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div style={{
      minHeight:'100vh', background:'#0f0f0f', color:'#fff',
      fontFamily:'system-ui,-apple-system,sans-serif',
      display:'flex', justifyContent:'center', alignItems:'center', padding:20
    }}>
      <div style={{
        background:'#1a1a2e', borderRadius:16, padding:'32px 24px',
        maxWidth:420, width:'100%', textAlign:'center'
      }}>
        <div style={{fontSize:40,marginBottom:8}}>{connected ? '✅' : '📱'}</div>
        <h1 style={{fontSize:20,marginBottom:4}}>AWB-OS</h1>
        <p style={{color:'#888',fontSize:13,marginBottom:20}}>AI WhatsApp Business OS</p>

        <div style={{
          display:'inline-block', padding:'6px 18px', borderRadius:20,
          fontSize:12, fontWeight:600, marginBottom:20,
          ...(connected
            ? {background:'#00c85320',color:'#00c853',border:'1px solid #00c853'}
            : {background:'#ff525220',color:'#ff5252',border:'1px solid #ff5252'})
        }}>
          {connected ? '✅ Connected' : loading ? '⏳ Loading...' : '⏳ Waiting'}
        </div>

        {!loading && qr && !connected && (
          <div style={{background:'#fff',borderRadius:12,padding:16,display:'inline-block',marginBottom:16}}>
            <img src={qr} alt="QR" style={{width:280,height:280,display:'block'}} />
          </div>
        )}

        {!loading && !qr && !connected && (
          <p style={{color:'#666',padding:'30px 0',fontSize:13}}>
            QR not available.<br />
            Start the bot locally with:<br />
            <code style={{background:'#333',padding:'2px 8px',borderRadius:4,fontSize:12}}>
              cd backend && node run-both.js
            </code>
          </p>
        )}

        {connected && (
          <p style={{color:'#00c853',fontWeight:600,marginBottom:12}}>
            ✓ WhatsApp is connected. Bot is active.
          </p>
        )}

        {pairing && !connected && (
          <div style={{background:'#252540',borderRadius:10,padding:14,marginTop:12}}>
            <p style={{fontSize:12,color:'#aaa',marginBottom:4}}>Pairing Code:</p>
            <p style={{fontSize:26,letterSpacing:6,color:'#7c4dff',fontFamily:'monospace',fontWeight:700}}>
              {pairing}
            </p>
          </div>
        )}

        <div style={{
          textAlign:'left', marginTop:16, padding:12,
          background:'#1f1f35', borderRadius:10, fontSize:12,
          color:'#ccc', lineHeight:1.8
        }}>
          <b>How to connect:</b><br />
          1. Open WhatsApp on phone<br />
          2. Go to <b>Linked Devices</b><br />
          3. Tap <b>Link a Device</b> & scan QR<br />
          — OR —<br />
          4. Tap <b>Link with Phone Number</b> & enter pairing code
        </div>

        <a href="/qr" style={{
          display:'inline-block', marginTop:16, padding:'10px 24px',
          background:'#7c4dff', color:'#fff', borderRadius:8,
          textDecoration:'none', fontWeight:600, fontSize:13
        }}>↻ Refresh</a>

        <p style={{color:'#444',fontSize:11,marginTop:12}}>
          AWB-OS v1.0 · AI: Hugging Face
        </p>
      </div>
    </div>
  );
}
