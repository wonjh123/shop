// DAYWEAR 로컬 개발 서버 — 정적 파일 + 결제 API
// 실행: node server.js  →  http://localhost:3000
// 배포(Vercel)에서는 이 파일 대신 api/*.js 서버리스 함수가 같은 로직(api/_payments.js)을 실행한다.
// 외부 패키지 없이 Node 18+ 내장 모듈만 사용한다.

const http = require('http');
const fs = require('fs');
const path = require('path');
const { handle, usingDocsKeys } = require('./api/_payments.js');

const PORT = Number(process.env.PORT) || 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};
// 공개하지 않을 파일·폴더 (배포 시 .vercelignore 와 같은 기준)
const DENY_FILES = new Set(['server.js', 'PRD.md', 'seo.config.json']);
const DENY_DIRS = ['api/', 'scripts/', 'node_modules/'];

function sendJSON(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 100_000) req.destroy();
    });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

function serveStatic(pathname, res) {
  const rel = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
  const file = path.join(__dirname, rel);
  const denied = !file.startsWith(__dirname + path.sep)
    || rel.startsWith('.')
    || DENY_FILES.has(rel)
    || DENY_DIRS.some((d) => rel.startsWith(d));
  if (denied) { res.writeHead(404); return res.end('Not found'); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
}

http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  const api = /^\/api\/(config|orders|confirm)$/.exec(pathname);
  if (api) {
    const body = req.method === 'POST' ? await readBody(req) : {};
    const [status, data] = await handle(api[1], req.method, body);
    return sendJSON(res, status, data);
  }
  if (req.method === 'GET') return serveStatic(pathname, res);
  sendJSON(res, 405, { message: 'Method not allowed' });
}).listen(PORT, () => {
  console.log(`DAYWEAR → http://localhost:${PORT}`);
  if (usingDocsKeys) console.log('토스페이먼츠 문서용 테스트 키 사용 중 (실제 결제되지 않음)');
});
