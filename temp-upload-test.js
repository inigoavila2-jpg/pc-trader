const http = require('http');
const boundary = '----WebKitFormBoundary' + Date.now();
const chunks = [];
chunks.push(Buffer.from(`--${boundary}\r\n`));
chunks.push(Buffer.from('Content-Disposition: form-data; name="photo"; filename="test.jpg"\r\n'));
chunks.push(Buffer.from('Content-Type: image/jpeg\r\n\r\n'));
chunks.push(Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
chunks.push(Buffer.from(`\r\n--${boundary}--\r\n`));
const body = Buffer.concat(chunks);

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/photo',
  method: 'POST',
  headers: {
    'Content-Type': 'multipart/form-data; boundary=' + boundary,
    'Content-Length': body.length,
  },
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('status', res.statusCode);
    console.log(data);
  });
});

req.on('error', (err) => {
  console.error('request error', err.message);
});

req.write(body);
req.end();
