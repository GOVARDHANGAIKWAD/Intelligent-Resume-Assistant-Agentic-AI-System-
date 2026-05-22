// Quick test script — run with: node test_upload.js
const http = require('http');
const fs = require('fs');
const path = require('path');

const boundary = '----TestBoundary' + Date.now();
const filePath = path.join(__dirname, 'test_resume.txt');
const fileContent = fs.readFileSync(filePath);
const fileName = 'test_resume.txt';

const bodyParts = [
  `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: text/plain\r\n\r\n`,
  fileContent,
  `\r\n--${boundary}--\r\n`,
];

const body = Buffer.concat(bodyParts.map(p => Buffer.isBuffer(p) ? p : Buffer.from(p)));

const options = {
  hostname: 'localhost',
  port: 4000,
  path: '/api/upload-resume',
  method: 'POST',
  headers: {
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
    'Content-Length': body.length,
  },
};

console.log('📤 Uploading test_resume.txt to http://localhost:4000/api/upload-resume ...');

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log(`\n📊 Status: ${res.statusCode}`);
    try {
      const parsed = JSON.parse(data);
      if (parsed.success) {
        console.log('✅ Upload SUCCESS!');
        console.log('   Session ID :', parsed.sessionId);
        console.log('   Candidate  :', parsed.candidateName);
        console.log('   Score      :', parsed.score);
        console.log('   Parsed with:', parsed.parsedWith);
        console.log('   Skills     :', parsed.resumeData?.skills?.slice(0,8).join(', '));
        console.log('\n📝 Now test chat with session:', parsed.sessionId);
        testChat(parsed.sessionId);
      } else {
        console.error('❌ Upload failed:', parsed.error);
      }
    } catch {
      console.error('❌ Raw response:', data);
    }
  });
});

req.on('error', (e) => console.error('❌ Request error:', e.message));
req.write(body);
req.end();

function testChat(sessionId) {
  const chatBody = JSON.stringify({ sessionId, message: 'What are the top skills of this candidate?' });
  const chatOptions = {
    hostname: 'localhost',
    port: 4000,
    path: '/api/chat',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(chatBody) },
  };
  const chatReq = http.request(chatOptions, (res) => {
    let data = '';
    res.on('data', (c) => data += c);
    res.on('end', () => {
      console.log(`\n💬 Chat Status: ${res.statusCode}`);
      try {
        const parsed = JSON.parse(data);
        if (parsed.success) {
          console.log('✅ Chat SUCCESS!');
          console.log('   Answer     :', parsed.response.answer.slice(0, 200));
          console.log('   Confidence :', parsed.response.confidence);
          console.log('   Source     :', parsed.response.source);
        } else {
          console.error('❌ Chat error:', parsed.error);
        }
      } catch { console.error('Raw:', data); }
    });
  });
  chatReq.on('error', (e) => console.error('Chat error:', e.message));
  chatReq.write(chatBody);
  chatReq.end();
}
