// 상품 데이터 — 브라우저(index/checkout)와 server.js가 함께 사용한다.
// 결제 금액은 서버가 이 가격으로 다시 계산하므로, 클라이언트 값은 신뢰하지 않는다.
const IMG = (id) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=800&h=1000&q=80`;
const CLOTH = ['S', 'M', 'L', 'XL'];
const FREE = ['FREE'];

const PRODUCTS = [
  { id: 1, name: '에센셜 크루넥 티셔츠', category: 'top', price: 19000, image: IMG('1521572163474-6864f9cf17ab'),
    colors: ['화이트', '블랙', '그레이'], sizes: CLOTH, desc: '20수 코튼으로 탄탄하게 짠 기본 반팔 티셔츠. 세탁 후에도 목이 늘어나지 않습니다.' },
  { id: 2, name: '오리지널 그래픽 티셔츠', category: 'top', price: 29000, image: IMG('1576566588028-4147f3842f27'),
    colors: ['베이지', '화이트'], sizes: CLOTH, desc: '빈티지 무드의 프린트가 들어간 세미 오버핏 티셔츠.' },
  { id: 3, name: '샴브레이 도트 셔츠', category: 'top', price: 45000, image: IMG('1596755094514-f87e34085b2c'),
    colors: ['인디고', '라이트블루'], sizes: CLOTH, desc: '잔잔한 도트 패턴의 샴브레이 셔츠. 단독으로도, 아우터처럼도 입기 좋습니다.' },
  { id: 4, name: '헤비웨이트 후드 스웨트셔츠', category: 'top', price: 59000, image: IMG('1556821840-3a63f95609a7'),
    colors: ['그레이', '블랙', '네이비'], sizes: CLOTH, desc: '도톰한 기모 안감의 후드. 넉넉한 실루엣으로 레이어드하기 좋습니다.' },

  { id: 5, name: '스트레이트 데님 팬츠', category: 'bottom', price: 59000, image: IMG('1542272604-787c3835535d'),
    colors: ['인디고', '블랙'], sizes: CLOTH, desc: '허리부터 밑단까지 일자로 떨어지는 클래식 핏 데님.' },
  { id: 6, name: '로우라이즈 와이드 데님', category: 'bottom', price: 65000, image: IMG('1624378439575-d8705ad7ae80'),
    colors: ['인디고', '차콜'], sizes: CLOTH, desc: '여유 있는 와이드 핏에 원워싱으로 깔끔한 데님.' },
  { id: 7, name: '컷오프 데님 쇼츠', category: 'bottom', price: 39000, image: IMG('1591195853828-11db59a44f6b'),
    colors: ['라이트블루'], sizes: CLOTH, desc: '디스트로이드 디테일과 롤업 밑단의 여름 데님 쇼츠.' },
  { id: 8, name: '코튼 치노 조거', category: 'bottom', price: 49000, image: IMG('1473966968600-fa801b869a1a'),
    colors: ['베이지', '카키', '블랙'], sizes: CLOTH, desc: '밴딩 허리와 시보리 밑단으로 편안한 치노 조거 팬츠.' },

  { id: 9, name: '레더 라이더 재킷', category: 'outer', price: 189000, image: IMG('1551028719-00167b16eac5'),
    colors: ['블랙'], sizes: CLOTH, desc: '부드러운 비건 레더로 만든 클래식 라이더 재킷.' },
  { id: 10, name: '나일론 봄버 재킷', category: 'outer', price: 89000, image: IMG('1591047139829-d91aecb6caea'),
    colors: ['오렌지', '블랙', '카키'], sizes: CLOTH, desc: '가벼운 나일론 소재의 MA-1 스타일 봄버.' },
  { id: 11, name: '코튼 필드 재킷', category: 'outer', price: 119000, image: IMG('1544022613-e87ca75a784a'),
    colors: ['카키', '베이지'], sizes: CLOTH, desc: '4포켓 디테일의 워크웨어 필드 재킷. 간절기 필수 아이템.' },
  { id: 12, name: '울 블렌드 벨티드 코트', category: 'outer', price: 229000, image: IMG('1539533018447-63fcce2678e3'),
    colors: ['카멜', '차콜'], sizes: CLOTH, desc: '허리 벨트로 실루엣을 조절할 수 있는 롱 코트.' },

  { id: 13, name: '메쉬 트러커 볼캡', category: 'acc', price: 25000, image: IMG('1588850561407-ed78c282e89b'),
    colors: ['화이트', '블랙'], sizes: FREE, desc: '통기성 좋은 메쉬 백 트러커 캡. 사이즈 조절 가능.' },
  { id: 14, name: '데일리 백팩', category: 'acc', price: 69000, image: IMG('1553062407-98eeb64c6a62'),
    colors: ['네이비', '블랙'], sizes: FREE, desc: '15인치 노트북 수납이 가능한 생활 방수 백팩.' },
  { id: 15, name: '립 니트 비니', category: 'acc', price: 19000, image: IMG('1576871337632-b9aef4c17ab9'),
    colors: ['차콜', '핑크', '블랙'], sizes: FREE, desc: '골지 조직으로 쫀쫀하게 짠 기본 비니.' },
  { id: 16, name: '라운드 메탈 선글라스', category: 'acc', price: 49000, image: IMG('1511499767150-a48a237f0083'),
    colors: ['골드', '실버'], sizes: FREE, desc: '얇은 메탈 프레임의 라운드 선글라스. UV400 차단.' },
];

const CART_KEY = 'daywear.cart';

if (typeof module !== 'undefined') module.exports = { PRODUCTS, CART_KEY };
