// SEO · AEO · GEO 정적 산출물 생성기 (외부 패키지 없음)
// 실행: node scripts/build-seo.js
//
// data.js(상품) + seo.config.json(사이트 정보)을 읽어 아래를 생성/갱신한다.
//   index.html      <!-- SEO:* --> 마커 사이: 메타 태그, JSON-LD, 사전 렌더링된 상품 그리드, FAQ, 푸터 링크
//   products/*.html 상품별 정적 상세 페이지 (Product + BreadcrumbList JSON-LD)
//   sitemap.xml, robots.txt, llms.txt
// 상품·가격·문구를 바꾼 뒤에는 이 스크립트를 다시 실행하고 커밋한다.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'seo.config.json'), 'utf8'));
const { PRODUCTS, CATEGORY_LABEL, COLOR_HEX } = require(path.join(ROOT, 'data.js'));

const SITE = cfg.siteUrl.replace(/\/+$/, '');
const TODAY = new Date().toISOString().slice(0, 10);
const ORG_ID = `${SITE}/#organization`;

/* ---------- helpers ---------- */
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const won = (n) => n.toLocaleString('ko-KR') + '원';
const productUrl = (p) => `${SITE}/products/${p.slug}.html`;
const sku = (p) => `DW-${String(p.id).padStart(3, '0')}`;
const sizeText = (p) => (p.sizes.length === 1 ? p.sizes[0] : `${p.sizes[0]}~${p.sizes[p.sizes.length - 1]}`);
const jsonLd = (obj) =>
  `<script type="application/ld+json">${JSON.stringify(obj, null, 2).replace(/</g, '\\u003c')}</script>`;
const prices = PRODUCTS.map((p) => p.price);
const MIN_PRICE = Math.min(...prices);
const MAX_PRICE = Math.max(...prices);

function replaceBlock(html, name, content) {
  const re = new RegExp(`(<!-- SEO:${name}[^>]*-->)[\\s\\S]*?(<!-- /SEO:${name} -->)`);
  if (!re.test(html)) throw new Error(`index.html 에 SEO:${name} 마커가 없습니다.`);
  return html.replace(re, `$1\n${content}\n$2`);
}

function verificationMeta() {
  return [
    cfg.googleVerification && `<meta name="google-site-verification" content="${esc(cfg.googleVerification)}">`,
    cfg.naverVerification && `<meta name="naver-site-verification" content="${esc(cfg.naverVerification)}">`,
  ].filter(Boolean).join('\n');
}

function socialMeta({ title, description, url, image, type = 'website' }) {
  return `<meta property="og:type" content="${type}">
<meta property="og:site_name" content="${esc(cfg.siteName)}">
<meta property="og:locale" content="ko_KR">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${esc(image)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(image)}">`;
}

/* ---------- 공통 데이터 ---------- */
const ORGANIZATION = {
  '@type': 'OnlineStore',
  '@id': ORG_ID,
  name: cfg.siteName,
  url: `${SITE}/`,
  logo: `${SITE}/favicon.svg`,
  description: cfg.description,
};

const SHIPPING = {
  '@type': 'OfferShippingDetails',
  shippingRate: { '@type': 'MonetaryAmount', value: 0, currency: 'KRW' },
  shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'KR' },
};

// FAQ — 메인 FAQ 섹션(home: true 만), faq.html, FAQPage JSON-LD(faq.html), llms.txt 가 같은 내용을 쓴다.
// 사실과 다른 내용(교환·환불 정책, 배송 기간 등 정해지지 않은 것)을 넣지 말 것.
const FAQ_GROUPS = ['상품', '주문', '결제', '배송'];
const FAQ = [
  {
    group: '상품', home: true,
    q: 'DAYWEAR에서는 어떤 옷을 파나요?',
    a: `남녀공용 데일리 캐주얼 의류를 판매합니다. 상의, 하의, 아우터, 액세서리 4개 카테고리에 총 ${PRODUCTS.length}개 상품이 있습니다.`,
  },
  {
    group: '상품', home: true,
    q: '가격대는 어느 정도인가요?',
    a: `${won(MIN_PRICE)}부터 ${won(MAX_PRICE)}까지입니다. 티셔츠·비니는 19,000원, 데님은 59,000~65,000원, 아우터는 89,000~229,000원입니다.`,
  },
  {
    group: '배송', home: true,
    q: '배송비가 있나요?',
    a: '전 상품 무료배송입니다.',
  },
  {
    group: '상품', home: true,
    q: '사이즈는 어떻게 되나요?',
    a: '의류(상의·하의·아우터)는 S, M, L, XL 네 가지 사이즈, 액세서리는 FREE 사이즈입니다. 모든 상품은 남녀공용입니다.',
  },
  {
    group: '결제', home: true,
    q: '어떤 결제 수단을 쓸 수 있나요?',
    a: '토스페이먼츠 결제창을 통해 신용·체크카드, 계좌이체, 토스페이 등 간편결제로 결제할 수 있습니다.',
  },
  {
    group: '주문', home: true,
    q: '한 번에 몇 개까지 주문할 수 있나요?',
    a: '상품·색상·사이즈 조합별로 최대 10개까지 장바구니에 담아 주문할 수 있습니다.',
  },
  {
    group: '상품',
    q: '상품 상세 정보는 어디서 볼 수 있나요?',
    a: '상품 카드를 누르면 상세 창에서 설명·색상·사이즈를 확인하고 바로 담을 수 있습니다. 상품마다 별도 상세 페이지도 있어 상품번호, 색상, 사이즈, 가격을 한눈에 볼 수 있습니다.',
  },
  {
    group: '주문',
    q: '회원가입을 해야 주문할 수 있나요?',
    a: '아니요. 회원가입이나 로그인 없이 장바구니에 담고 바로 주문할 수 있습니다.',
  },
  {
    group: '주문',
    q: '장바구니에 담은 상품은 계속 남아 있나요?',
    a: '장바구니는 사용 중인 브라우저에 저장되어 새로고침하거나 다시 방문해도 유지됩니다. 다른 기기나 다른 브라우저에서는 보이지 않습니다.',
  },
  {
    group: '주문',
    q: '주문 내역은 어디서 확인하나요?',
    a: '결제가 끝나면 주문 완료 화면에 주문번호, 주문 상품, 결제수단, 결제 금액이 표시됩니다. 별도의 주문 내역 조회 기능은 없으니 완료 화면의 주문번호를 확인해 두세요.',
  },
  {
    group: '결제',
    q: '실제로 돈이 결제되나요?',
    a: '현재 DAYWEAR는 토스페이먼츠 테스트 결제 환경으로 운영됩니다. 결제 과정은 그대로 진행되지만 실제로 돈이 빠져나가지 않습니다.',
  },
  {
    group: '결제',
    q: '결제 도중 창을 닫거나 결제에 실패하면 어떻게 되나요?',
    a: '장바구니는 그대로 유지됩니다. 장바구니에서 다시 주문하기를 눌러 결제를 진행하면 됩니다.',
  },
  {
    group: '결제',
    q: '주문서를 열어 두고 나중에 결제해도 되나요?',
    a: '주문서는 만든 뒤 1시간 동안 유효합니다. 1시간이 지나면 결제가 승인되지 않으니 장바구니에서 다시 주문해 주세요.',
  },
];
const HOME_FAQ = FAQ.filter((f) => f.home);
const faqItemsHTML = (list, indent = '    ') => list.map((f) => `${indent}<details class="faq-item">
${indent}  <summary>${esc(f.q)}</summary>
${indent}  <p>${esc(f.a)}</p>
${indent}</details>`).join('\n');

/* ---------- 카드 (script.js renderGrid 와 같은 마크업) ---------- */
function cardHTML(p, base = '') {
  return `    <li class="card" data-id="${p.id}">
      <a class="card-link" href="${base}products/${p.slug}.html">
        <div class="card-img"><img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" data-name="${esc(p.name)}"></div>
        <p class="card-cat">${CATEGORY_LABEL[p.category]}</p>
        <h3 class="card-name">${esc(p.name)}</h3>
        <p class="card-price">${won(p.price)}</p>
        <div class="swatches">${p.colors.map((c) => `<span class="swatch" title="${c}" style="background:${COLOR_HEX[c]}"></span>`).join('')}</div>
      </a>
    </li>`;
}

/* ---------- index.html ---------- */
function buildIndex() {
  const file = path.join(ROOT, 'index.html');
  let html = fs.readFileSync(file, 'utf8');

  const head = `<title>${esc(cfg.title)}</title>
<meta name="description" content="${esc(cfg.description)}">
<link rel="canonical" href="${SITE}/">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta name="theme-color" content="#ffffff">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="alternate" type="text/plain" href="llms.txt" title="LLM 요약">
${verificationMeta()}
${socialMeta({ title: cfg.title, description: cfg.description, url: `${SITE}/`, image: cfg.ogImage })}
${jsonLd({
  '@context': 'https://schema.org',
  '@graph': [
    ORGANIZATION,
    {
      '@type': 'WebSite',
      '@id': `${SITE}/#website`,
      name: cfg.siteName,
      url: `${SITE}/`,
      inLanguage: 'ko-KR',
      publisher: { '@id': ORG_ID },
    },
    {
      '@type': 'ItemList',
      name: `${cfg.siteName} 전체 상품`,
      numberOfItems: PRODUCTS.length,
      itemListElement: PRODUCTS.map((p, i) => ({
        '@type': 'ListItem', position: i + 1, url: productUrl(p), name: p.name,
      })),
    },
  ],
})}`.replace(/\n{2,}/g, '\n');

  // FAQPage 구조화 데이터는 중복을 피해 faq.html 에만 둔다.
  const faq = faqItemsHTML(HOME_FAQ);

  const footer = Object.entries(CATEGORY_LABEL).map(([key, label]) => `    <div class="footer-col">
      <p class="footer-title">${label}</p>
${PRODUCTS.filter((p) => p.category === key).map((p) => `      <a href="products/${p.slug}.html">${esc(p.name)}</a>`).join('\n')}
    </div>`).join('\n');

  html = replaceBlock(html, 'HEAD', head);
  html = replaceBlock(html, 'GRID', PRODUCTS.map((p) => cardHTML(p)).join('\n'));
  html = replaceBlock(html, 'FAQ', faq);
  html = replaceBlock(html, 'FOOTER', footer);
  fs.writeFileSync(file, html);
}

/* ---------- products/*.html ---------- */
function productPage(p) {
  const cat = CATEGORY_LABEL[p.category];
  const url = productUrl(p);
  const title = `${p.name} — 남녀공용 ${cat} ${won(p.price)} | ${cfg.siteName}`;
  const description = `${p.desc} 색상 ${p.colors.join('·')}, 사이즈 ${p.sizes.join('·')}. ${won(p.price)}, 무료배송.`;
  // AEO/GEO: 질문에 바로 답하는 요약 문장 (답변 우선)
  const summary = `${p.name}은(는) ${cfg.siteName}의 남녀공용 ${cat} 상품으로 가격은 ${won(p.price)}입니다. `
    + `색상은 ${p.colors.join(', ')} 중 선택할 수 있고, 사이즈는 ${sizeText(p)}${p.sizes.length > 1 ? `(${p.sizes.join('·')})` : ''}이며, 무료배송됩니다.`;
  const related = PRODUCTS.filter((x) => x.category === p.category && x.id !== p.id);

  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Product',
        '@id': `${url}#product`,
        name: p.name,
        description: p.desc,
        image: [p.image],
        sku: sku(p),
        category: `의류 > ${cat}`,
        brand: { '@type': 'Brand', name: cfg.siteName },
        color: p.colors.join(', '),
        size: p.sizes.join(', '),
        audience: { '@type': 'PeopleAudience', suggestedGender: 'unisex' },
        offers: {
          '@type': 'Offer',
          url,
          priceCurrency: 'KRW',
          price: p.price,
          availability: 'https://schema.org/InStock',
          itemCondition: 'https://schema.org/NewCondition',
          seller: { '@id': ORG_ID },
          shippingDetails: SHIPPING,
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: cfg.siteName, item: `${SITE}/` },
          { '@type': 'ListItem', position: 2, name: p.name, item: url },
        ],
      },
      ORGANIZATION,
    ],
  };

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<!-- scripts/build-seo.js 가 생성한 파일입니다. 직접 수정하지 말고 data.js 를 고친 뒤 다시 생성하세요. -->
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta name="theme-color" content="#ffffff">
<link rel="icon" href="../favicon.svg" type="image/svg+xml">
${socialMeta({ title, description, url, image: p.image, type: 'product' })}
<meta property="product:price:amount" content="${p.price}">
<meta property="product:price:currency" content="KRW">
${jsonLd(ld)}
<link rel="preconnect" href="https://images.unsplash.com">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<link rel="stylesheet" href="../style.css">
</head>
<body>

<header class="header">
  <div class="header-inner">
    <a href="../" class="logo">${esc(cfg.siteName)}</a>
    <a href="../" class="step">← 전체 상품</a>
  </div>
</header>

<main class="container pdp">
  <nav class="breadcrumb" aria-label="경로">
    <a href="../">${esc(cfg.siteName)}</a> › <span>${cat}</span> › <span aria-current="page">${esc(p.name)}</span>
  </nav>

  <article class="pdp-main">
    <div class="pdp-img"><img src="${esc(p.image)}" alt="${esc(p.name)} 상품 사진" width="800" height="1000"></div>
    <div class="pdp-info">
      <p class="cat">${cat} · 남녀공용</p>
      <h1>${esc(p.name)}</h1>
      <p class="price">${won(p.price)}</p>
      <p class="pdp-summary">${esc(summary)}</p>
      <p class="desc">${esc(p.desc)}</p>

      <h2 class="sec-title">상품 정보</h2>
      <dl class="spec">
        <dt>상품번호</dt><dd>${sku(p)}</dd>
        <dt>카테고리</dt><dd>${cat}</dd>
        <dt>색상</dt><dd>${p.colors.map((c) => `<span class="swatch" style="background:${COLOR_HEX[c]}"></span>${c}`).join(' &nbsp; ')}</dd>
        <dt>사이즈</dt><dd>${p.sizes.join(' · ')}</dd>
        <dt>가격</dt><dd>${won(p.price)}</dd>
        <dt>배송</dt><dd>무료배송</dd>
      </dl>

      <a class="add-btn pdp-cta" href="../#product-${p.id}">색상·사이즈 선택하고 담기</a>
    </div>
  </article>

  <section class="related" aria-labelledby="relTitle">
    <h2 class="sec-title" id="relTitle">같은 카테고리 상품</h2>
    <ul class="grid">
${related.map((r) => cardHTML(r, '../').replace(`href="../products/${r.slug}.html"`, `href="${r.slug}.html"`)).join('\n')}
    </ul>
  </section>
</main>

</body>
</html>
`;
}

function buildProducts() {
  const dir = path.join(ROOT, 'products');
  fs.mkdirSync(dir, { recursive: true });
  const keep = new Set(PRODUCTS.map((p) => `${p.slug}.html`));
  for (const f of fs.readdirSync(dir)) if (f.endsWith('.html') && !keep.has(f)) fs.unlinkSync(path.join(dir, f));
  for (const p of PRODUCTS) fs.writeFileSync(path.join(dir, `${p.slug}.html`), productPage(p));
}

/* ---------- faq.html ---------- */
const FAQ_URL = `${SITE}/faq.html`;

function buildFaqPage() {
  const title = `자주 묻는 질문 — 배송·사이즈·주문·결제 안내 | ${cfg.siteName}`;
  const description = `${cfg.siteName} 자주 묻는 질문. 전 상품 무료배송, 의류 S~XL·액세서리 FREE 사이즈, 조합별 최대 10개 주문, 토스페이먼츠 결제 안내.`;
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'FAQPage',
        '@id': `${FAQ_URL}#faq`,
        url: FAQ_URL,
        inLanguage: 'ko-KR',
        mainEntity: FAQ.map((f) => ({
          '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: cfg.siteName, item: `${SITE}/` },
          { '@type': 'ListItem', position: 2, name: '자주 묻는 질문', item: FAQ_URL },
        ],
      },
      ORGANIZATION,
    ],
  };

  const nav = FAQ_GROUPS.map((g, i) => `<a href="#faq-${i + 1}">${g}</a>`).join('\n      ');
  const sections = FAQ_GROUPS.map((g, i) => `  <section class="faq-group" id="faq-${i + 1}" aria-labelledby="faqGroup${i + 1}">
    <h2 id="faqGroup${i + 1}">${g}</h2>
${faqItemsHTML(FAQ.filter((f) => f.group === g))}
  </section>`).join('\n\n');

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<!-- scripts/build-seo.js 가 생성한 파일입니다. 직접 수정하지 말고 build-seo.js 의 FAQ 를 고친 뒤 다시 생성하세요. -->
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${FAQ_URL}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta name="theme-color" content="#ffffff">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
${socialMeta({ title, description, url: FAQ_URL, image: cfg.ogImage })}
${jsonLd(ld)}
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<link rel="stylesheet" href="style.css">
</head>
<body>

<header class="header">
  <div class="header-inner">
    <a href="./" class="logo">${esc(cfg.siteName)}</a>
    <a href="./" class="step">← 전체 상품</a>
  </div>
</header>

<main class="container faq-page">
  <nav class="breadcrumb" aria-label="경로">
    <a href="./">${esc(cfg.siteName)}</a> › <span aria-current="page">자주 묻는 질문</span>
  </nav>

  <h1>자주 묻는 질문</h1>
  <p class="faq-lead">상품, 주문, 결제, 배송에 대해 자주 묻는 질문을 모았습니다. 질문을 누르면 답변이 열립니다.</p>

  <nav class="faq-nav" aria-label="질문 분류">
      ${nav}
  </nav>

${sections}

  <div class="faq-cta">
    <a class="add-btn" href="./">상품 둘러보기</a>
  </div>
</main>

</body>
</html>
`;
  fs.writeFileSync(path.join(ROOT, 'faq.html'), html);
}

/* ---------- sitemap / robots / llms ---------- */
function buildSitemap() {
  const urls = [{ loc: `${SITE}/`, priority: '1.0', image: cfg.ogImage }]
    .concat({ loc: FAQ_URL, priority: '0.6', image: cfg.ogImage })
    .concat(PRODUCTS.map((p) => ({ loc: productUrl(p), priority: '0.8', image: p.image, title: p.name })));
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.map((u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${TODAY}</lastmod>
    <priority>${u.priority}</priority>
    <image:image><image:loc>${esc(u.image)}</image:loc></image:image>
  </url>`).join('\n')}
</urlset>
`;
  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), xml);
}

function buildRobots() {
  // 검색엔진과 AI 검색/답변 크롤러 모두 허용 (GEO).
  // 주문·결제 페이지는 robots 차단 대신 각 페이지의 noindex 메타로 제외한다 (차단하면 noindex를 못 읽음).
  const txt = `# ${cfg.siteName} robots.txt
User-agent: *
Allow: /
Disallow: /api/

# AI 검색·답변 엔진 (명시적 허용)
User-agent: Googlebot
User-agent: Bingbot
User-agent: Yeti
User-agent: Google-Extended
User-agent: OAI-SearchBot
User-agent: ChatGPT-User
User-agent: GPTBot
User-agent: PerplexityBot
User-agent: ClaudeBot
User-agent: Claude-SearchBot
Allow: /
Disallow: /api/

Sitemap: ${SITE}/sitemap.xml
`;
  fs.writeFileSync(path.join(ROOT, 'robots.txt'), txt);
}

function buildLlms() {
  // llms.txt: LLM이 사이트를 빠르게 이해하도록 돕는 마크다운 요약 (https://llmstxt.org)
  const sections = Object.entries(CATEGORY_LABEL).map(([key, label]) => `## ${label}

${PRODUCTS.filter((p) => p.category === key).map((p) =>
    `- [${p.name}](${productUrl(p)}): ${won(p.price)}. ${p.desc} 색상 ${p.colors.join('·')}, 사이즈 ${p.sizes.join('·')}.`).join('\n')}`).join('\n\n');

  const txt = `# ${cfg.siteName}

> ${cfg.description}

- 브랜드: ${cfg.siteName} (남녀공용 데일리 캐주얼 의류 온라인 쇼핑몰)
- 상품 수: ${PRODUCTS.length}개 (상의·하의·아우터·액세서리 각 4개)
- 가격대: ${won(MIN_PRICE)} ~ ${won(MAX_PRICE)} (KRW)
- 배송: 전 상품 무료배송
- 사이즈: 의류 S·M·L·XL, 액세서리 FREE
- 결제: 토스페이먼츠 (카드, 계좌이체, 간편결제)
- 최종 갱신: ${TODAY}

${sections}

## 자주 묻는 질문

전체 질문: ${FAQ_URL}

${FAQ.map((f) => `- **${f.q}** ${f.a}`).join('\n')}
`;
  fs.writeFileSync(path.join(ROOT, 'llms.txt'), txt);
}

buildIndex();
buildProducts();
buildFaqPage();
buildSitemap();
buildRobots();
buildLlms();
console.log(`SEO 산출물 생성 완료 → ${SITE}  (상품 페이지 ${PRODUCTS.length}개, ${TODAY})`);
if (!cfg.googleVerification) console.log('※ seo.config.json 의 googleVerification 이 비어 있습니다. 서치 콘솔 코드를 넣고 다시 실행하세요.');
