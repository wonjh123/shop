// 결제 공통 로직 — 로컬 server.js 와 Vercel 함수(api/*.js)가 함께 사용한다.
//
// 서버리스 환경은 요청 사이에 메모리가 유지되지 않으므로 주문을 저장하지 않는다.
// 대신 주문번호(orderId) 안에 "주문번호 + 금액"에 대한 HMAC 서명을 넣어,
// 결제 승인 시 서명을 다시 계산해 금액이 위변조되지 않았는지 확인한다.

const crypto = require('crypto');
const { PRODUCTS } = require('../data.js');

// 기본값은 토스페이먼츠 문서용 공개 테스트 키 (실제 돈이 나가지 않음).
// 운영/본인 키는 환경변수 TOSS_CLIENT_KEY, TOSS_SECRET_KEY 로 설정한다.
const CLIENT_KEY = process.env.TOSS_CLIENT_KEY || 'test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm';
const SECRET_KEY = process.env.TOSS_SECRET_KEY || 'test_gsk_docs_OaPz8L5KdmQXkzRz3y47BMw6';
// 주문 서명용 키. 별도 지정이 없으면 시크릿 키에서 파생한다.
const SIGNING_KEY = process.env.ORDER_SIGNING_KEY || `daywear-order:${SECRET_KEY}`;
const MAX_QTY = 10;
const ORDER_TTL_MS = 60 * 60 * 1000; // 주문 생성 후 1시간 안에 결제해야 함

class PaymentError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const sign = (base, amount) =>
  crypto.createHmac('sha256', SIGNING_KEY).update(`${base}:${amount}`).digest('base64url').slice(0, 22);

/* ---------- 주문 생성: 금액은 서버가 data.js 가격으로 계산 ---------- */
function createOrder(items) {
  if (!Array.isArray(items) || items.length === 0) throw new PaymentError(400, 'INVALID_ORDER', '장바구니가 비어 있습니다.');
  if (items.length > 50) throw new PaymentError(400, 'INVALID_ORDER', '주문 항목이 너무 많습니다.');

  const lines = items.map((i) => {
    const p = PRODUCTS.find((x) => x.id === Number(i && i.id));
    const qty = Number(i && i.qty);
    if (!p) throw new PaymentError(400, 'INVALID_ORDER', '존재하지 않는 상품이 있습니다.');
    if (!p.colors.includes(i.color) || !p.sizes.includes(i.size)) {
      throw new PaymentError(400, 'INVALID_ORDER', `${p.name}의 옵션이 올바르지 않습니다.`);
    }
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) {
      throw new PaymentError(400, 'INVALID_ORDER', `${p.name}의 수량이 올바르지 않습니다.`);
    }
    return { id: p.id, name: p.name, color: i.color, size: i.size, qty, price: p.price };
  });

  const amount = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const orderName = lines.length > 1 ? `${lines[0].name} 외 ${lines.length - 1}건` : lines[0].name;
  // 토스 orderId 규칙: 6~64자, 영문 대소문자·숫자·-·_  → 예) DW-mf3k2a1b-9f2c4e1a-<서명 22자>
  const base = `DW-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;
  const orderId = `${base}-${sign(base, amount)}`;
  return { orderId, orderName, amount, lines };
}

/* ---------- 결제 승인 ---------- */
function verifyOrder(orderId, amount) {
  const m = /^(DW-([0-9a-z]+)-[0-9a-f]{8})-([A-Za-z0-9_-]{22})$/.exec(String(orderId || ''));
  if (!m) throw new PaymentError(404, 'ORDER_NOT_FOUND', '주문 정보를 찾을 수 없습니다. 다시 주문해 주세요.');
  const [, base, ts, sig] = m;
  const expected = Buffer.from(sign(base, amount));
  const given = Buffer.from(sig);
  // 금액이 바뀌면 서명이 달라진다 (금액 위변조 방지)
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) {
    throw new PaymentError(400, 'AMOUNT_MISMATCH', '결제 금액이 주문 금액과 일치하지 않습니다.');
  }
  if (Date.now() - parseInt(ts, 36) > ORDER_TTL_MS) {
    throw new PaymentError(400, 'ORDER_EXPIRED', '주문 유효 시간이 지났습니다. 다시 주문해 주세요.');
  }
}

async function confirmPayment({ paymentKey, orderId, amount } = {}) {
  const value = Number(amount);
  if (!paymentKey || !Number.isInteger(value) || value <= 0) {
    throw new PaymentError(400, 'INVALID_REQUEST', '결제 정보가 올바르지 않습니다.');
  }
  verifyOrder(orderId, value);

  const r = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${SECRET_KEY}:`).toString('base64')}`,
      'Content-Type': 'application/json',
      // 같은 결제(paymentKey)의 재요청(새로고침 등)에는 토스가 첫 응답을 그대로 돌려준다.
      'Idempotency-Key': `confirm-${paymentKey}`,
    },
    body: JSON.stringify({ paymentKey, orderId, amount: value }),
  });
  const data = await r.json();
  if (!r.ok) throw new PaymentError(r.status, data.code, data.message);

  return {
    paymentKey: data.paymentKey,
    orderId: data.orderId,
    orderName: data.orderName,
    totalAmount: data.totalAmount,
    method: data.method,
    approvedAt: data.approvedAt,
    receiptUrl: (data.receipt && data.receipt.url) || null,
  };
}

/* ---------- 요청 처리 (로컬 서버·Vercel 공용) ---------- */
// action: 'config' | 'orders' | 'confirm'  →  [status, body]
async function handle(action, method, body) {
  try {
    if (action === 'config' && method === 'GET') return [200, { clientKey: CLIENT_KEY }];
    if (action === 'orders' && method === 'POST') return [200, createOrder(body && body.items)];
    if (action === 'confirm' && method === 'POST') return [200, await confirmPayment(body)];
    return [405, { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' }];
  } catch (e) {
    if (e instanceof PaymentError) return [e.status, { code: e.code, message: e.message }];
    console.error(e);
    return [500, { code: 'SERVER_ERROR', message: '서버 오류가 발생했습니다.' }];
  }
}

module.exports = { handle, createOrder, confirmPayment, usingDocsKeys: !process.env.TOSS_SECRET_KEY };
