# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

DAYWEAR — 남녀공용 캐주얼 의류 쇼핑몰(상품 16개). 순수 HTML/CSS/JS, **npm 의존성·빌드 도구·테스트 프레임워크 없음**. 요구사항과 결정 이력은 `PRD.md`(버전별 섹션)에 있으며, 기능을 바꾸면 PRD에도 반영한다.

- 저장소: GitHub `wonjh123/shop` (`main`) → push 시 Vercel 자동 배포
- 라이브: https://shop-five-alpha-24.vercel.app (구글 서치 콘솔 등록됨, `google15f41376fad5fc2c.html`은 소유권 확인 파일이므로 삭제 금지)
- 데스크톱 전용 레이아웃 (`body { min-width: 1200px }`)

## 명령어

모든 명령과 이 문서의 경로는 `day1/clothes/` 기준이다.

```bash
cd day1/clothes               # 상위 genai-project 에서 작업 중일 때
node server.js                # 로컬 개발 서버 http://localhost:3000 (PORT 환경변수로 변경)
node scripts/build-seo.js     # SEO 산출물 재생성 — data.js / seo.config.json / FAQ 변경 후 반드시 실행 후 커밋
PORT=3123 node server.js & sleep 1; curl -s -o /dev/null -w "%{http_code}" localhost:3123/faq.html; kill %1   # 테스트 없음 — 빌드 후 이렇게 응답 확인
```

`index.html`을 `file://`로 열면 목록·장바구니는 되지만 결제(`/api/*`)는 동작하지 않는다.
`build-seo.js`의 "googleVerification 이 비어 있습니다" 경고는 무시 (소유권은 `google15f41376fad5fc2c.html` 파일로 확인됨).

## 아키텍처

### 단일 데이터 소스: `data.js`
브라우저(전역 `const`)와 Node(`module.exports` 가드) 양쪽에서 로드된다. `PRODUCTS`, `CATEGORY_LABEL`, `COLOR_HEX`, `CART_KEY`가 여기 있다. 상품 가격은 **결제 금액의 기준**이기도 하다(서버가 이 값으로 금액을 재계산).

### 생성 파일 — 직접 수정 금지
`scripts/build-seo.js`가 `data.js` + `seo.config.json`으로 아래를 만든다:
- `index.html`의 `<!-- SEO:HEAD|GRID|FAQ|FOOTER -->` 마커 사이 (메타, JSON-LD, 사전 렌더링 상품 카드, FAQ, 푸터 링크)
  마커 밖(헤더, 모달, 드로어, 섹션 제목 등)은 직접 수정한다.
- `products/<slug>.html` 16개, `faq.html`, `sitemap.xml`, `robots.txt`, `llms.txt`
- 새 정적 페이지는 `build-seo.js`에 `buildXxx()`를 만들고 맨 아래에서 호출한 뒤, `buildSitemap()`의 urls에 추가한다 (예: `buildFaqPage`).

주의할 결합:
- 상품 카드 마크업이 `script.js`의 `renderGrid()`와 `build-seo.js`의 `cardHTML()`에 **중복**되어 있다. 한쪽을 바꾸면 다른 쪽도 맞출 것 (사전 렌더링 HTML을 JS가 그대로 덮어씀).
- FAQ 문구는 `build-seo.js`의 `FAQ` 배열 하나가 메인 FAQ 섹션(`home: true`만), `faq.html`, FAQPage JSON-LD(`faq.html`에만), `llms.txt`에 쓰인다. 사실(무료배송, S~XL/FREE, 최대 10개 등)과 다른 내용을 넣지 말 것. 교환·환불 정책과 배송 기간은 정해진 것이 없으니 지어내지 말 것.
- 사이트 URL·인증 코드는 `seo.config.json`의 `siteUrl`, `googleVerification`, `naverVerification`.

### 프론트엔드 (`script.js`)
- 장바구니: `localStorage['daywear.cart']` = `[{id, color, size, qty}]`, 상품+색상+사이즈 조합당 수량 최대 10.
- 카드 클릭은 모달(기본 동작 막음), ⌘/Ctrl 클릭은 상품 페이지로. 상품 페이지 CTA는 `/#product-<id>` 로 돌아와 모달을 연다(init의 deep link 처리).

### 결제 (토스페이먼츠 결제위젯 v2)
흐름: `checkout.js` → `POST /api/orders` → 위젯 `requestPayment` → `success.html` → `POST /api/confirm` → 토스 `/v1/payments/confirm`.

- 공통 로직은 `api/_payments.js` 하나. 배포에선 Vercel 함수 `api/config.js`·`orders.js`·`confirm.js`(어댑터 `api/_handler.js`)가, 로컬에선 `server.js`가 이를 호출한다. `_`로 시작하는 파일은 Vercel 엔드포인트로 노출되지 않는다.
- **무상태(stateless)**: 서버는 주문을 저장하지 않는다. `orderId = DW-<ts36>-<rand>-<HMAC(주문번호:금액)>` 로 금액을 서명하고, 승인 시 서명 재검증(불일치 `AMOUNT_MISMATCH`, 1시간 경과 `ORDER_EXPIRED`). 주문 데이터를 서버 메모리에 저장하는 방식으로 되돌리면 Vercel에서 깨진다.
- 완료 화면의 상품 목록은 결제 직전 `sessionStorage['daywear.lastOrder']`에 넣은 표시용 값이다.
- 키: `TOSS_CLIENT_KEY`, `TOSS_SECRET_KEY`, `ORDER_SIGNING_KEY`(선택) 환경변수. 미설정 시 토스 문서용 공개 테스트 키 사용.
- 토스 연동 문서는 MCP 서버 `tosspayments-integration-guide`로 조회 가능(프로젝트 local scope에 등록됨).

### 공개 범위
비공개 파일 목록이 **두 곳**에 있으며 함께 갱신해야 한다: `.vercelignore`(배포 제외)와 `server.js`의 `DENY_FILES`/`DENY_DIRS`(로컬 서빙 제외). 현재 `server.js`, `PRD.md`, `CLAUDE.md`, `scripts/`, `seo.config.json`이 비공개이고, 결제·주문 페이지(`checkout/success/fail.html`)는 robots 차단 대신 `noindex` 메타로 검색에서 제외한다.
