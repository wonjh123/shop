const $ = (sel) => document.querySelector(sel);
const won = (n) => n.toLocaleString('ko-KR') + '원';
const findProduct = (id) => PRODUCTS.find((p) => p.id === id);

function showNotice(html) {
  $('#payLayout').hidden = true;
  $('#notice').hidden = false;
  $('#notice').innerHTML = html;
}

async function postJSON(url, body) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await r.json();
  if (!r.ok) throw new Error(data.message || '요청에 실패했습니다.');
  return data;
}

function renderOrder(order) {
  $('#orderCount').textContent = `${order.lines.reduce((s, l) => s + l.qty, 0)}개`;
  $('#orderList').innerHTML = order.lines.map((l) => `
    <li class="order-item">
      <img src="${findProduct(l.id).image}" alt="${l.name}">
      <div>
        <p class="ci-name">${l.name}</p>
        <p class="ci-opt">${l.color} / ${l.size} · ${l.qty}개</p>
      </div>
      <p class="ci-price">${won(l.price * l.qty)}</p>
    </li>`).join('');
  $('#sumGoods').textContent = won(order.amount);
  $('#sumTotal').textContent = won(order.amount);
}

async function main() {
  if (location.protocol === 'file:') {
    return showNotice(`<b>결제는 로컬 서버에서만 동작합니다.</b><br>
      터미널에서 <code>cd day1/clothes && node server.js</code> 실행 후
      <code>http://localhost:3000</code> 으로 접속해 주세요.`);
  }

  let cart = [];
  try { cart = JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch { /* ignore */ }
  if (!cart.length) {
    return showNotice('장바구니가 비어 있어요. <a href="index.html">쇼핑하러 가기 →</a>');
  }

  let order, config;
  try {
    // 금액은 서버가 상품 가격으로 다시 계산한 값을 사용한다.
    [config, order] = await Promise.all([
      fetch('/api/config').then((r) => r.json()),
      postJSON('/api/orders', { items: cart }),
    ]);
  } catch (e) {
    return showNotice(`주문을 만들지 못했습니다: ${e.message} <a href="index.html">장바구니로 돌아가기</a>`);
  }

  $('#payLayout').hidden = false;
  renderOrder(order);

  if (typeof TossPayments !== 'function') {
    return showNotice('결제 모듈을 불러오지 못했습니다. 네트워크 연결을 확인하고 새로고침해 주세요.');
  }

  const tossPayments = TossPayments(config.clientKey);
  const widgets = tossPayments.widgets({ customerKey: TossPayments.ANONYMOUS });

  try {
    await widgets.setAmount({ currency: 'KRW', value: order.amount });
    await Promise.all([
      widgets.renderPaymentMethods({ selector: '#payment-method', variantKey: 'DEFAULT' }),
      widgets.renderAgreement({ selector: '#agreement', variantKey: 'AGREEMENT' }),
    ]);
  } catch (e) {
    return showNotice(`결제 수단을 불러오지 못했습니다: ${e.message}`);
  }

  const payBtn = $('#payBtn');
  payBtn.disabled = false;
  payBtn.textContent = `${won(order.amount)} 결제하기`;

  payBtn.addEventListener('click', async () => {
    payBtn.disabled = true;
    // 서버는 주문을 저장하지 않으므로, 완료 화면에 보여줄 상품 목록을 브라우저에 잠시 보관한다.
    // (금액·승인 여부는 서버/토스 응답만 신뢰)
    try { sessionStorage.setItem('daywear.lastOrder', JSON.stringify({ orderId: order.orderId, lines: order.lines })); } catch { /* ignore */ }
    try {
      await widgets.requestPayment({
        orderId: order.orderId,
        orderName: order.orderName,
        successUrl: `${location.origin}/success.html`,
        failUrl: `${location.origin}/fail.html`,
      });
    } catch (e) {
      // 사용자가 결제창을 닫은 경우 등은 조용히 버튼만 다시 활성화
      if (e.code !== 'USER_CANCEL') alert(e.message);
      payBtn.disabled = false;
    }
  });
}

main();
