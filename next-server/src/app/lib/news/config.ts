/**
 * 향수 뉴스 파이프라인 설정.
 * 운영하면서 가장 자주 손보는 값(검색어·제외 키워드·기준 점수)은 모두 여기에 모은다.
 */

/** 고정 검색어 — "향수" 단독 검색은 잡음이 많아 의도가 분명한 조합만 쓴다 */
export const BASE_QUERIES = [
  "향수 신제품",
  "향수 출시",
  "오 드 퍼퓸 출시",
  "향수 한정판",
  "니치 향수",
  "향수 팝업",
  "향수 브랜드 론칭",
] as const;

/** DB에 등록 수가 많은 브랜드 상위 N개를 "{브랜드} 향수"로 추가 검색 */
export const BRAND_QUERY_COUNT = 5;

/** 쿼리당 가져올 기사 수 (네이버 API 최대 100) */
export const PER_QUERY_DISPLAY = 20;

/** 이 시간 이내에 발행된 기사만 후보로 삼는다 (하루 1회 실행 + 누락 방지 여유분) */
export const WINDOW_HOURS = 48;

/** 제목·발췌문에 포함되면 LLM 호출 전에 제외하는 키워드 */
export const EXCLUDE_KEYWORDS = [
  "주가",
  "주식",
  "실적",
  "영업이익",
  "매출액",
  "증권",
  "고향",
  "향수병",
  "노스탤지어",
  "부고",
] as const;

/** 차단할 매체 도메인 (품질이 낮거나 광고성 기사가 많은 곳을 운영하며 추가) */
export const BLOCKED_DOMAINS: readonly string[] = [];

/** 제목 유사도(바이그램 자카드)가 이 값 이상이면 같은 뉴스의 중복 보도로 본다 */
export const TITLE_SIMILARITY_THRESHOLD = 0.6;

/** LLM에 넘기는 후보 최대 수 (최신순으로 자름) */
export const MAX_CANDIDATES = 40;

/** LLM 관련도 점수(0~100)가 이 값 미만이면 게시하지 않는다 */
export const MIN_RELEVANCE = 70;

/** 1회 실행당 최대 게시 수. 기준을 넘는 기사가 없으면 0건도 정상이다 */
export const MAX_PUBLISH_PER_RUN = 5;

export const TITLE_MAX_LENGTH = 60;
export const SUMMARY_MIN_LENGTH = 80;
export const SUMMARY_MAX_LENGTH = 750;

export const OPENAI_MODEL = "gpt-4o-mini";
export const NAVER_TIMEOUT_MS = 8_000;
export const OPENAI_TIMEOUT_MS = 40_000;

/** 원문 도메인 → 매체명. 없으면 도메인을 그대로 표시한다 */
export const SOURCE_NAME_BY_DOMAIN: Record<string, string> = {
  "yna.co.kr": "연합뉴스",
  "newsis.com": "뉴시스",
  "news1.kr": "뉴스1",
  "chosun.com": "조선일보",
  "joongang.co.kr": "중앙일보",
  "donga.com": "동아일보",
  "hani.co.kr": "한겨레",
  "khan.co.kr": "경향신문",
  "hankyung.com": "한국경제",
  "mk.co.kr": "매일경제",
  "sedaily.com": "서울경제",
  "edaily.co.kr": "이데일리",
  "mt.co.kr": "머니투데이",
  "asiae.co.kr": "아시아경제",
  "fnnews.com": "파이낸셜뉴스",
  "heraldcorp.com": "헤럴드경제",
  "etnews.com": "전자신문",
  "zdnet.co.kr": "지디넷코리아",
  "fashionbiz.co.kr": "패션비즈",
  "apparelnews.co.kr": "어패럴뉴스",
  "cosinkorea.com": "코스인코리아",
  "cosmorning.com": "코스모닝",
  "beautynury.com": "뷰티누리",
  "jangup.com": "장업신문",
};

/** 검증된 매체만 수집한다 — 위 SOURCE_NAME_BY_DOMAIN에 등록된 도메인만 통과시킨다 */
export const TRUSTED_DOMAINS: readonly string[] = Object.keys(SOURCE_NAME_BY_DOMAIN);
