const https = require('https');
https.get('https://railway.com/login', (res) => {
  let body = '';
  res.on('data', (c) => body += c);
  res.on('end', () => {
    const links = body.match(/https?:\/\/[^"'\s]+/g) || [];
    links.filter(x => x.includes('auth') || x.includes('oauth')).forEach(x => console.log(x));
    console.log('---');
    const scripts = body.match(/src="[^"]+\.js"/g) || [];
    scripts.forEach(x => console.log(x));
  });
}).on('error', (e) => console.log(e.message));
