const CATEGORIES = [
  { key: 'all', label: '전체' },
  { key: 'top', label: '상의' },
  { key: 'bottom', label: '하의' },
  { key: 'outer', label: '아우터' },
  { key: 'acc', label: '액세서리' },
];

const COLOR_HEX = {
  화이트: '#ffffff', 블랙: '#1a1a1a', 그레이: '#9a9a9a', 베이지: '#d8c8ad', 네이비: '#1f2a44',
  인디고: '#2f4467', 라이트블루: '#a9c3de', 차콜: '#3d3d3d', 카키: '#7a7350', 브라운: '#7b5136',
  카멜: '#b8875a', 오렌지: '#c8673a', 핑크: '#e7b9b6', 실버: '#c7c7c7', 골드: '#c9a45c',
};

const MAX_QTY = 10;

const $ = (sel) => document.querySelector(sel);
const won = (n) => n.toLocaleString('ko-KR') + '원';
const catLabel = (key) => CATEGORIES.find((c) => c.key === key).label;
const findProduct = (id) => PRODUCTS.find((p) => p.id === id);

const state = {
  category: 'all',
  cart: loadCart(),
  modal: { product: null, color: null, size: null, qty: 1 },
};

/* ---------- storage ---------- */
function loadCart() {
  try {
    const data = JSON.parse(localStorage.getItem(CART_KEY));
    return Array.isArray(data) ? data.filter((i) => findProduct(i.id)) : [];
  } catch {
    return [];
  }
}
function saveCart() {
  try { localStorage.setItem(CART_KEY, JSON.stringify(state.cart)); } catch { /* ignore */ }
}

/* ---------- image fallback ---------- */
function imgTag(p, cls = '') {
  return `<img src="${p.image}" alt="${p.name}" class="${cls}" loading="lazy" data-name="${p.name}">`;
}
document.addEventListener('error', (e) => {
  const img = e.target;
  if (img.tagName !== 'IMG' || img.dataset.failed) return;
  img.dataset.failed = '1';
  img.style.visibility = 'hidden';
  const box = img.parentElement;
  if (box && box.classList.contains('card-img')) {
    box.insertAdjacentHTML('beforeend', `<div class="img-fallback">${img.dataset.name || img.alt}</div>`);
  }
}, true);

/* ---------- F1: tabs + grid ---------- */
function renderTabs() {
  $('#tabs').innerHTML = CATEGORIES.map((c) =>
    `<button type="button" data-cat="${c.key}" class="${c.key === state.category ? 'active' : ''}">${c.label}</button>`
  ).join('');
}

function renderGrid() {
  const list = state.category === 'all' ? PRODUCTS : PRODUCTS.filter((p) => p.category === state.category);
  $('#listTitle').textContent = catLabel(state.category);
  $('#listCount').textContent = `${list.length}개 상품`;
  $('#grid').innerHTML = list.map((p) => `
    <li class="card" data-id="${p.id}">
      <div class="card-img">${imgTag(p)}</div>
      <p class="card-cat">${catLabel(p.category)}</p>
      <p class="card-name">${p.name}</p>
      <p class="card-price">${won(p.price)}</p>
      <div class="swatches">${p.colors.map((c) => `<span class="swatch" title="${c}" style="background:${COLOR_HEX[c]}"></span>`).join('')}</div>
    </li>`).join('');
}

$('#tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-cat]');
  if (!btn) return;
  state.category = btn.dataset.cat;
  renderTabs();
  renderGrid();
});

$('#grid').addEventListener('click', (e) => {
  const card = e.target.closest('.card');
  if (card) openModal(Number(card.dataset.id));
});

/* ---------- overlay / panel helpers ---------- */
let openPanel = null;

function showPanel(el) {
  if (openPanel && openPanel !== el) hidePanel(openPanel, true);
  openPanel = el;
  el.hidden = false;
  document.body.classList.add('locked');
  $('#overlay').classList.add('show');
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show')));
}

function hidePanel(el, keepOverlay = false) {
  el.classList.remove('show');
  if (openPanel === el) openPanel = null;
  if (!keepOverlay) {
    $('#overlay').classList.remove('show');
    document.body.classList.remove('locked');
  }
  setTimeout(() => { if (!el.classList.contains('show')) el.hidden = true; }, 300);
}

function closeAll() {
  if (openPanel) hidePanel(openPanel);
}

$('#overlay').addEventListener('click', closeAll);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAll(); });
document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeAll));

/* ---------- F2: detail modal ---------- */
function openModal(id) {
  const p = findProduct(id);
  state.modal = { product: p, color: null, size: p.sizes.length === 1 ? p.sizes[0] : null, qty: 1 };
  $('#mImg').src = p.image;
  $('#mImg').alt = p.name;
  $('#mCat').textContent = catLabel(p.category);
  $('#mName').textContent = p.name;
  $('#mPrice').textContent = won(p.price);
  $('#mDesc').textContent = p.desc;
  renderModalOptions();
  showPanel($('#modal'));
}

function renderModalOptions() {
  const { product: p, color, size, qty } = state.modal;
  $('#mColors').innerHTML = p.colors.map((c) => `
    <button type="button" class="chip ${c === color ? 'selected' : ''}" data-color="${c}">
      <span class="swatch" style="background:${COLOR_HEX[c]}"></span>${c}
    </button>`).join('');
  $('#mSizes').innerHTML = p.sizes.map((s) =>
    `<button type="button" class="chip ${s === size ? 'selected' : ''}" data-size="${s}">${s}</button>`
  ).join('');
  $('#mColorSel').textContent = color || '';
  $('#mSizeSel').textContent = size || '';
  $('#mQty').textContent = qty;
  $('#mMinus').disabled = qty <= 1;
  $('#mPlus').disabled = qty >= MAX_QTY;

  const ready = Boolean(color && size);
  $('#mAdd').disabled = !ready;
  $('#mAdd').textContent = ready ? `${won(p.price * qty)} · 장바구니 담기` : '장바구니 담기';
  $('#mHint').classList.toggle('ok', ready);
}

$('#mColors').addEventListener('click', (e) => {
  const b = e.target.closest('[data-color]');
  if (!b) return;
  state.modal.color = b.dataset.color;
  renderModalOptions();
});
$('#mSizes').addEventListener('click', (e) => {
  const b = e.target.closest('[data-size]');
  if (!b) return;
  state.modal.size = b.dataset.size;
  renderModalOptions();
});
$('#mMinus').addEventListener('click', () => { state.modal.qty = Math.max(1, state.modal.qty - 1); renderModalOptions(); });
$('#mPlus').addEventListener('click', () => { state.modal.qty = Math.min(MAX_QTY, state.modal.qty + 1); renderModalOptions(); });

$('#mAdd').addEventListener('click', () => {
  const { product, color, size, qty } = state.modal;
  if (!color || !size) return;
  addToCart(product.id, color, size, qty);
  openDrawer();
});

/* ---------- F3: cart drawer ---------- */
function addToCart(id, color, size, qty) {
  const item = state.cart.find((i) => i.id === id && i.color === color && i.size === size);
  if (item) item.qty = Math.min(MAX_QTY, item.qty + qty);
  else state.cart.push({ id, color, size, qty });
  saveCart();
  renderCart();
}

function changeQty(index, delta) {
  const item = state.cart[index];
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) state.cart.splice(index, 1);
  else item.qty = Math.min(MAX_QTY, item.qty);
  saveCart();
  renderCart();
}

function removeItem(index) {
  state.cart.splice(index, 1);
  saveCart();
  renderCart();
}

function renderCart() {
  const totalQty = state.cart.reduce((s, i) => s + i.qty, 0);
  const totalPrice = state.cart.reduce((s, i) => s + findProduct(i.id).price * i.qty, 0);
  const empty = state.cart.length === 0;

  const badge = $('#cartBadge');
  badge.hidden = totalQty === 0;
  badge.textContent = totalQty;

  $('#drawerCount').textContent = empty ? '' : totalQty;
  $('#cartList').hidden = empty;
  $('#cartFoot').hidden = empty;
  $('#cartEmpty').hidden = !empty;

  $('#cartList').innerHTML = state.cart.map((i, idx) => {
    const p = findProduct(i.id);
    return `
      <li class="cart-item" data-index="${idx}">
        ${imgTag(p)}
        <div>
          <p class="ci-name">${p.name}</p>
          <p class="ci-opt">${i.color} / ${i.size}</p>
          <div class="stepper">
            <button type="button" data-act="minus" aria-label="수량 감소">−</button>
            <span>${i.qty}</span>
            <button type="button" data-act="plus" aria-label="수량 증가" ${i.qty >= MAX_QTY ? 'disabled' : ''}>+</button>
          </div>
        </div>
        <div class="ci-right">
          <p class="ci-price">${won(p.price * i.qty)}</p>
          <p class="ci-unit">${won(p.price)} × ${i.qty}</p>
          <button type="button" class="ci-remove" data-act="remove">삭제</button>
        </div>
      </li>`;
  }).join('');

  $('#sumQty').textContent = `${totalQty}개`;
  $('#sumPrice').textContent = won(totalPrice);
  $('#orderBtn').textContent = `${won(totalPrice)} 주문하기`;
}

$('#cartList').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const idx = Number(btn.closest('.cart-item').dataset.index);
  if (btn.dataset.act === 'minus') changeQty(idx, -1);
  if (btn.dataset.act === 'plus') changeQty(idx, 1);
  if (btn.dataset.act === 'remove') removeItem(idx);
});

function openDrawer() {
  renderCart();
  showPanel($('#drawer'));
}
$('#cartBtn').addEventListener('click', openDrawer);

/* ---------- init ---------- */
renderTabs();
renderGrid();
renderCart();
