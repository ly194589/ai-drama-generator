// 本地 OpenAI 兼容模拟端点：用于验证「自定义厂商」真实分发（chat / images / audio）
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const OUT = import.meta.dirname;
const hits = [];

const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', c => { body += c; });
  req.on('end', () => {
    hits.push({ url: req.url, method: req.method, body: body.slice(0, 300) });
    fs.writeFileSync(path.join(OUT, 'mock-hits.json'), JSON.stringify(hits, null, 2));

    if (req.url.endsWith('/chat/completions')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        id: 'mock-chat-1',
        model: 'mock-model',
        choices: [{ index: 0, message: { role: 'assistant', content: 'mock ok' }, finish_reason: 'stop' }],
      }));
    } else if (req.url.endsWith('/audio/speech')) {
      // 返回一段伪 mp3 二进制，验证二进制音频链路
      const buf = Buffer.concat([Buffer.from('ID3'), Buffer.alloc(2048, 7)]);
      res.writeHead(200, { 'Content-Type': 'audio/mpeg' });
      res.end(buf);
    } else if (req.url.endsWith('/images/generations')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ data: [{ url: 'http://127.0.0.1:5099/mock.png' }] }));
    } else if (req.url === '/mock.png') {
      const png = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        'base64'
      );
      res.writeHead(200, { 'Content-Type': 'image/png' });
      res.end(png);
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'not found' } }));
    }
  });
});

server.listen(5099, '127.0.0.1', () => console.log('mock openai-compatible endpoint on 5099'));