// Vercel 서버리스 함수 공통 어댑터 (파일명이 _ 로 시작하면 엔드포인트로 노출되지 않음)
const { handle } = require('./_payments.js');

module.exports = (action) => async (req, res) => {
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const [status, data] = await handle(action, req.method, body || {});
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(data);
};
