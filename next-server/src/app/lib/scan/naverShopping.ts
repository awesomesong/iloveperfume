/**
 * 네이버 쇼핑 검색 링크 생성 (순수 함수 — 서버·클라이언트 공용).
 *
 * 네이버 검색 API의 '쇼핑'은 2026-07-31에 종료됐고 NAVER API HUB로도 이관되지 않았다.
 * 그래서 상품·가격을 받아와 그리지 않고, 향수 이름으로 만든 네이버 쇼핑 검색 페이지
 * 주소로 사용자를 보낸다. 외부 호출이 없으므로 키·한도·실패 처리가 필요 없다.
 * 배경: docs/decisions/0003-naver-shopping-link-only.md
 */

const NAVER_SHOPPING_SEARCH = 'https://search.shopping.naver.com/search/all';

/**
 * 검색어에서 중복 단어 제거 (대소문자 무시).
 *   예) "Polo Polo 67" → "Polo 67"
 * 한 글자 단어는 그대로 둔다 — "오 소바쥬 오 드 뚜왈렛"의 두 번째 "오"처럼 이름의 일부인 경우가 많다.
 */
function dedupeWords(query: string): string {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const word of query.split(/\s+/).filter(Boolean)) {
    const lower = word.toLowerCase();
    if (word.length > 1 && seen.has(lower)) continue;
    seen.add(lower);
    unique.push(word);
  }
  return unique.join(' ');
}

/**
 * 검색어 정리 — 중복 단어 제거 + "향수" 키워드 보강.
 * 의류·잡화 겸업 브랜드에서 옷이 먼저 검색되는 것을 막는다.
 * 이미 향수 관련 단어가 있으면 덧붙이지 않는다.
 */
function normalizeQuery(query: string): string {
  const deduped = dedupeWords(query.trim());
  const hasFragranceKeyword = /향수|코롱|perfume|fragrance|cologne|eau\s*de/i.test(deduped);
  return hasFragranceKeyword ? deduped : `${deduped} 향수`;
}

/** 검색어 그대로 네이버 쇼핑 검색 페이지 URL을 만든다. */
export function buildFallbackSearchUrl(query: string): string {
  return `${NAVER_SHOPPING_SEARCH}?query=${encodeURIComponent(normalizeQuery(query))}`;
}

/**
 * 향수 이름으로 네이버 쇼핑 검색 URL 생성 (브랜드는 넣지 않음).
 * 네이버 검색은 표기에 민감해서 한글 이름이 있으면 그것을 우선 쓴다.
 */
export function buildNaverSearchUrl(name: string, koreanName?: string | null): string {
  return buildFallbackSearchUrl((koreanName || name).trim());
}

/** 쿠팡 검색 결과 URL — 네이버와 같은 검색어(한글 이름 우선 + "향수")를 쓴다. */
export function buildCoupangSearchUrl(name: string, koreanName?: string | null): string {
  const query = normalizeQuery((koreanName || name).trim());
  return `https://www.coupang.com/np/search?q=${encodeURIComponent(query)}`;
}
