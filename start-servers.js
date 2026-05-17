const { spawn } = require('child_process');
const path = require('path');

const ROOT = __dirname;

console.log(`
╔═══════════════════════════════════════════╗
║     AWB-OS v1.0.0                        ║
║     Starting both servers...             ║
╚═══════════════════════════════════════════╝
`);

// Start Backend
const backend = spawn('node', ['src/index.js'], {
  cwd: path.join(ROOT, 'backend'),
  stdio: 'inherit',
  env: { ...process.env, PORT: '3456' }
});

console.log('✅ Backend starting on http://localhost:3456');

// Wait then start frontend
setTimeout(() => {
  const frontend = spawn('npx', ['next', 'start', '-p', '3000'], {
    cwd: path.join(ROOT, 'frontend'),
    stdio: 'inherit',
    shell: true,
    env: { ...process.env }
  });

  console.log('✅ Frontend starting on http://localhost:3000');
  console.log('\n🌐 OPEN: http://localhost:3000');
  console.log('📧 Login: final@demo.com / demo123');
  console.log('\n⚠️  Keep this window OPEN. Close it to stop servers.\n');

  frontend.on('error', (e) => console.error('Frontend error:', e.message));
  frontend.on('exit', (code) => {
    console.log(`Frontend exited (code: ${code})`);
    backend.kill();
    process.exit();
  });
}, 3000);

backend.on('error', (e) => console.error('Backend error:', e.message));
backend.on('exit', (code) => {
  console.log(`Backend exited (code: ${code})`);
  process.exit();
});

process.on('SIGINT', () => {
  console.log('\nShutting down...');
  backend.kill();
  process.exit();
});
