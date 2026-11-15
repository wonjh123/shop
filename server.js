// DAYWEAR 로컬 서버 — 정적 파일 제공 + 토스페이먼츠 결제 승인
// 실행: node server.js  →  http://localhost:3000
// 외부 패키지 없이 Node 18+ 내장 모듈(http, fs, fetch)만 사용한다.

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PRODUCTS } = require('./data.js');

const PORT = Number(process.env.PORT) || 3000;
// 기본값은 토스페이먼츠 문서용 공개 테스트 키 (실제 돈이 나가지 않음).
// 본인 키를 쓰려면: TOSS_CLIENT_KEY=test_gck_... TOSS_SECRET_KEY=test_gsk_... node server.js
const CLIENT_KEY = process.env.TOSS_CLIENT_KEY || 'test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm';
const SECRET_KEY = process.env.TOSS_SECRET_KEY || 'test_gsk_docs_OaPz8L5KdmQXkzRz3y47BMw6';
const MAX_QTY = 10;

// 데모용 메모리 저장소 (서버 재시작 시 초기화)
const orders = new Map();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};
const PUBLIC_DENY = new Set(['server.js', 'PRD.md']);

function sendJSON(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 100_000) reject(new Error('body too large'));
    });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

/* ---------- 주문 생성: 금액은 서버가 계산 ---------- */
function createOrder(items) {
  if (!Array.isArray(items) || items.length === 0) throw new Error('장바구니가 비어 있습니다.');
  const lines = items.map((i) => {
    const p = PRODUCTS.find((x) => x.id === Number(i.id));
    const qty = Number(i.qty);
    if (!p) throw new Error('존재하지 않는 상품이 있습니다.');
    if (!p.colors.includes(i.color) || !p.sizes.includes(i.size)) throw new Error(`${p.name}의 옵션이 올바르지 않습니다.`);
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) throw new Error(`${p.name}의 수량이 올바르지 않습니다.`);
    return { id: p.id, name: p.name, color: i.color, size: i.size, qty, price: p.price };
  });
  const amount = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const orderName = lines.length > 1 ? `${lines[0].name} 외 ${lines.length - 1}건` : lines[0].name;
  // 토스 orderId 규칙: 6~64자, 영문 대소문자·숫자·-·_
  const orderId = `DW-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const order = { orderId, orderName, amount, lines, status: 'READY', createdAt: new Date().toISOString() };
  orders.set(orderId, order);
  return order;
}

/* ---------- 결제 승인 ---------- */
async function confirmPayment({ paymentKey, orderId, amount }) {
  const order = orders.get(orderId);
  if (!order) return [404, { code: 'ORDER_NOT_FOUND', message: '주문 정보를 찾을 수 없습니다. 다시 주문해 주세요.' }];

  // 새로고침 등으로 같은 결제를 다시 승인하려는 경우 저장된 결과 반환
  if (order.status === 'DONE') {
    if (order.payment.paymentKey === paymentKey) return [200, order.payment];
    return [409, { code: 'ALREADY_PAID', message: '이미 결제가 완료된 주문입니다.' }];
  }
  // 결제 요청 금액과 서버에 저장된 주문 금액이 다르면 승인하지 않는다 (금액 위변조 방지)
  if (Number(amount) !== order.amount) {
    return [400, { code: 'AMOUNT_MISMATCH', message: '결제 금액이 주문 금액과 일치하지 않습니다.' }];
  }

  const auth = Buffer.from(`${SECRET_KEY}:`).toString('base64');
  const r = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
      // 같은 결제(paymentKey)의 중복 승인 요청 방지. orderId 기준이면 실패 응답이 재사용될 수 있다.
      'Idempotency-Key': `confirm-${paymentKey}`,
    },
    body: JSON.stringify({ paymentKey, orderId, amount: order.amount }),
  });
  const data = await r.json();
  if (!r.ok) return [r.status, { code: data.code, message: data.message }];

  order.status = 'DONE';
  order.payment = {
    paymentKey: data.paymentKey,
    orderId: data.orderId,
    orderName: data.orderName,
    totalAmount: data.totalAmount,
    method: data.method,
    approvedAt: data.approvedAt,
    receiptUrl: data.receipt?.url || null,
    lines: order.lines,
  };
  return [200, order.payment];
}

/* ---------- 정적 파일 ---------- */
function serveStatic(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const file = path.join(__dirname, rel);
  if (!file.startsWith(__dirname + path.sep) || PUBLIC_DENY.has(path.basename(file)) || rel.startsWith('.')) {
    res.writeHead(404); return res.end('Not found');
  }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url, 'http://x');
    if (req.method === 'GET' && pathname === '/api/config') {
      return sendJSON(res, 200, { clientKey: CLIENT_KEY });
    }
    if (req.method === 'POST' && pathname === '/api/orders') {
      const { items } = await readBody(req);
      try {
        const o = createOrder(items);
        return sendJSON(res, 200, { orderId: o.orderId, orderName: o.orderName, amount: o.amount, lines: o.lines });
      } catch (e) {
        return sendJSON(res, 400, { code: 'INVALID_ORDER', message: e.message });
      }
    }
    if (req.method === 'POST' && pathname === '/api/confirm') {
      const [status, body] = await confirmPayment(await readBody(req));
      return sendJSON(res, status, body);
    }
    if (req.method === 'GET') return serveStatic(req, res);
    sendJSON(res, 405, { message: 'Method not allowed' });
  } catch (e) {
    console.error(e);
    sendJSON(res, 500, { code: 'SERVER_ERROR', message: '서버 오류가 발생했습니다.' });
  }
});

server.listen(PORT, () => {
  console.log(`DAYWEAR → http://localhost:${PORT}`);
  if (!process.env.TOSS_SECRET_KEY) console.log('토스페이먼츠 문서용 테스트 키 사용 중 (실제 결제되지 않음)');
});
