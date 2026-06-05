require('dotenv').config();
process.env.DATABASE_URL = '';

const { fork } = require('child_process');
const path = require('path');

let child;

function start() {
  child = fork(path.join(__dirname, 'run-both.js'), [], {
    stdio: 'inherit',
    env: { ...process.env }
  });
  child.on('exit', (code) => {
    console.log(`run-both.js exited (code ${code}), restarting in 3s...`);
    setTimeout(start, 3000);
  });
}

process.on('SIGINT', () => { if (child) child.kill(); process.exit(); });
process.on('SIGTERM', () => { if (child) child.kill(); process.exit(); });

start();
