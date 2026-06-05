const https = require('https');
const http = require('http');

// Try to access Railway backboard API directly
const endpoints = [
  { host: 'backboard.railway.com', path: '/graphql/v2', method: 'POST' },
  { host: 'backboard.railway.app', path: '/graphql/v2', method: 'POST' },
  { host: 'api.railway.com', path: '/graphql/v2', method: 'POST' },
  { host: 'api.railway.app', path: '/graphql/v2', method: 'POST' },
];

function tryEndpoint(host, path, method) {
  return new Promise((resolve) => {
    const req = https.request({ host, path, method, timeout: 5000 }, (res) => {
      let body = '';
      res.on('data', (c) => body += c);
      res.on('end', () => {
        resolve({ host, path, status: res.statusCode, body: body.substring(0, 200) });
      });
    });
    req.on('error', (e) => resolve({ host, path, error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ host, path, error: 'timeout' }); });
    req.end();
  });
}

async function main() {
  for (const ep of endpoints) {
    const result = await tryEndpoint(ep.host, ep.path, ep.method);
    console.log(`${result.host}${result.path}: ${result.status || result.error}`);
    if (result.body) console.log('  Body:', result.body);
  }
}

main();
