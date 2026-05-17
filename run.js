const express = require('express');
const cors = require('cors');
const path = require('path');
const { spawn } = require('child_process');

// Kill old processes on our ports
const { execSync } = require('child_process');

const BACKEND_PORT = 3456;
const FRONTEND_PORT = 3000;

console.log(`
╔═══════════════════════════════════════════╗
║     AWB-OS v1.0.0                        ║
║     STARTING BOTH SERVERS...             ║
╚═══════════════════════════════════════════╝
`);

// Start Backend
const backend = spawn('node', ['src/index.js'], {
  cwd: path.join(__dirname, 'backend'),
  stdio: 'inherit',
  env: { ...process.env, PORT: String(BACKEND_PORT) }
});

console.log(`[Backend] Starting on port ${BACKEND_PORT}...`);

// Wait for backend, then start frontend
setTimeout(() => {
  // Start Frontend
  const frontend = spawn('npx', ['next', 'start', '-p', String(FRONTEND_PORT)], {
    cwd: path.join(__dirname, 'frontend'),
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, NEXT_PUBLIC_API_URL: `http://localhost:${BACKEND_PORT}` }
  });

  console.log(`[Frontend] Starting on port ${FRONTEND_PORT}...`);
  console.log(`[Frontend] API -> http://localhost:${BACKEND_PORT}`);

  frontend.on('error', (err) => console.error('[Frontend] Error:', err.message));
  frontend.on('exit', (code) => console.log(`[Frontend] Exited with code ${code}`));

  setTimeout(() => {
    const url = `http://localhost:${FRONTEND_PORT}`;
    console.log(`\n✅ AWB-OS IS RUNNING!`);
    console.log(`🌐 Open: ${url}`);
    console.log(`📡 API: http://localhost:${BACKEND_PORT}/api/health`);
    console.log(`\n📧 Demo login: final@demo.com / demo123\n`);

    // Try to open browser
    try {
      const { exec } = require('child_process');
      exec(`start ${url}`);
    } catch (_) {}
  }, 8000);

}, 4000);

backend.on('error', (err) => console.error('[Backend] Error:', err.message));
backend.on('exit', (code) => console.log(`[Backend] Exited with code ${code}`));

process.on('SIGINT', () => {
  console.log('\nShutting down...');
  backend.kill();
  process.exit();
});
