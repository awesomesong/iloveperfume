/**
 * 향수 신제품 수집 파이프라인 설정.
 * 운영하면서 손보는 값(판매처·제외 단어·기준 값)은 모두 여기에 모은다.
 * 수집 대상 브랜드는 여기 적지 않는다 — 판매처에서 찾아 DB(ArrivalSource)에 자동으로 등록된다.
 */
import { OPENAI_TEXT_MODEL } from "@/src/app/lib/ai/models";

// ───────── 수집 대상 찾기 (브랜드 → 공식 사이트 → 판정) ─────────

/**
 * 브랜드 목록을 모으는 국내 판매처 — 여기 입점한 향수 브랜드는 "한국에서 살 수 있는 브랜드"로 본다.
 * 판매처만 등록하면 그 안의 브랜드가 자동으로 모인다. 등록 조건: 자동 요청을 막지 않고, robots.txt가
 * 상품 페이지를 허용하고, 사이트맵과 상품 구조화 데이터(JSON-LD Product, brand 포함)를 공개한다.
 */
export type Retailer = { name: string; host: string };
export const RETAILERS: readonly Retailer[] = [{ name: "퍼퓸그라피", host: "www.perfumegraphy.com" }];

/** 회원이 직접 등록한 향수의 브랜드도 후보로 쓴다. 이 경우는 공식 사이트가 한국 스토어(원화 판매)일 때만 수집한다 */
export const MEMBER_LEAD_SOURCE = "회원 등록";

/** 판매처 상품 페이지를 한 번에 읽는 수 — 상품 페이지가 무거워(약 1.5MB) 조금씩 읽고 날마다 이어서 본다 */
export const DISCOVER_PAGES_PER_RUN = 8;
/** 웹 검색 1회에 공식 사이트를 묻는 브랜드 수 — 5개에 약 20초가 걸려, 크론의 남는 시간(22초) 안에 끝나도록 3개로 둔다 */
export const RESOLVE_BATCH_SIZE = 3;
export const RESOLVE_TIMEOUT_MS = 120_000;
/** 공식 사이트를 못 찾은 브랜드를 다시 찾아보는 횟수 */
export const RESOLVE_MAX_ATTEMPTS = 2;
/** 판정에서 열어 볼 상품 페이지 최대 수 (사이트맵 방식) — 향수 한 건을 찾으면 멈춘다 */
export const PROBE_MAX_PAGES = 8;
/** 판정 결과를 다시 확인하는 주기 — 사이트가 바뀌면 자동으로 켜지거나 꺼진다 */
export const REPROBE_DAYS = 30;
/** 요청 과다·시간 초과로 판정하지 못했을 때 다시 시도하기까지 */
export const RETRY_PROBE_DAYS = 1;
/** 수집이 이만큼 잇달아 실패한 대상은 수집을 멈추고 다시 판정한다 */
export const MAX_COLLECT_FAILURES = 3;

/**
 * 공식 사이트로 인정하지 않는 도메인 — 판매처·마켓·위키·SNS·향수 정보 사이트.
 * 웹 검색이 이런 주소를 "공식 사이트"로 돌려주면 버린다.
 */
export const NON_OFFICIAL_DOMAINS = [
  "perfumegraphy.com",
  "wikipedia.org",
  "fragrantica.com",
  "fragrantica.co.kr",
  "parfumo.com",
  "basenotes.com",
  "instagram.com",
  "facebook.com",
  "youtube.com",
  "x.com",
  "twitter.com",
  "naver.com",
  "coupang.com",
  "gmarket.co.kr",
  "auction.co.kr",
  "11st.co.kr",
  "ssg.com",
  "lotteon.com",
  "kream.co.kr",
  "musinsa.com",
  "29cm.co.kr",
  "oliveyoung.co.kr",
  "chicor.com",
  "amazon.com",
  "sephora.com",
  "myshopify.com",
  "imweb.me",
] as const;

// ───────── 수집 ─────────

/** 1회 실행에서 읽는 수집 대상 수 — 넘치면 날마다 순환한다 */
export const MAX_SOURCES_PER_RUN = 15;
/** Shopify 상품 목록 한 페이지의 제품 수 (최대 250) */
export const FEED_PAGE_SIZE = 250;
/** 브랜드당 최대 페이지 수 — "처음 등장한 날"을 판단하려면 예전 제품까지 봐야 한다 */
export const FEED_MAX_PAGES = 4;
/** 사이트맵 방식에서 대상 하나당 1회 실행에 여는 상품 페이지 수 */
export const SITEMAP_PAGES_PER_RUN = 6;
/** 사이트맵 방식에서 향수로 확인했지만 저장되지 않은 상품을 다시 읽어 보는 기간 — 지나면 더 읽지 않는다 */
export const SITEMAP_RETRY_DAYS = 7;
/** 사이트맵에 한 번에 이보다 많은 주소가 새로 보이면 신제품이 아니라 사이트 개편으로 보고 기준선에 넣는다 */
export const SITEMAP_NEW_URL_LIMIT = 20;
/** 상품이 이보다 많은 종합 사이트(패션·주얼리)는 주소에 향수 표현이 있는 상품만 지켜본다 */
export const LARGE_CATALOG_SIZE = 2_000;
/** 수집 단계에 쓰는 시간 — 넘기면 남은 페이지는 다음 실행에서 이어서 본다 (크론 실행 시간 제한 60초) */
export const COLLECT_BUDGET_MS = 14_000;
/** 같은 사이트에 이어서 요청할 때 간격 */
export const REQUEST_GAP_MS = 1_000;
export const FEED_TIMEOUT_MS = 8_000;

/** 수집·작성 뒤 시간이 이만큼 안 지났을 때만 수집 대상 관리(찾기·판정)를 한 단계 진행한다 — 크론 실행 시간 제한(60초) 때문 */
export const MAINTENANCE_START_LIMIT_MS = 28_000;
/** 수집 대상 관리 한 단계에 쓰는 시간 */
export const MAINTENANCE_BUDGET_MS = 22_000;

// ───────── 향수 단품 판별 (브랜드별 규칙 없이 공통 표현으로) ─────────

/** 상품 이름·유형·카테고리에 이 표현이 있으면 향수 후보로 본다 (영·불·한) */
export const PERFUME_SIGNAL =
  /\b(?:eau de parfum|eau de toilette|eau de cologne|extrait|parfums?|perfumes?|fragrances?|colognes?|edp|edt)\b|향수|퍼퓸|코롱|오\s*드\s*(?:퍼퓸|뚜왈렛|코롱)|엑스트레/i;

/**
 * 소개문 첫머리에서 향수라고 볼 표현 — 이름에 향수라는 말이 없는 향수 전문 브랜드용.
 * 영어 "scent"(27 87), 이탈리아어 "fragranza·profumo"(판테온 로마), 독일어 "Duft"까지 본다.
 */
export const DESCRIPTION_PERFUME_SIGNAL = /\b(?:scents?|fragranza|profumo|duft)\b/i;

/**
 * 이름에 있으면 향수 단품이 아닌 것으로 보는 단어·구 (악센트 제거·소문자 기준, 단어 단위).
 * 세트·샘플·소용량, 향초·디퓨저·비누 같은 다른 제품, 굿즈. 영·불·독·이·스.
 * "body"·"hand"처럼 향수 이름에도 쓰이는 단어는 단독으로 넣지 않는다 (예: Vilhelm "Body Paint").
 */
export const NON_PERFUME_NAME_WORDS = [
  "set", "sets", "sample", "samples", "discovery", "kit", "duo", "trio", "quartet", "bundle", "coffret",
  "miniature", "miniatures", "mini", "travel", "pocket", "refill", "refills", "recharge", "recharges", "collector",
  "candle", "candles", "bougie", "bougies", "chandelle", "kerze", "candela", "vela",
  "diffuser", "diffuseur", "incense", "soap", "savon", "seife", "sapone", "jabon", "lotion", "gel", "detergent",
  "body wash", "body oil", "body mist", "body care", "hair mist", "hair perfume", "hand cream", "hand wash",
  "shower", "bath", "room spray", "home spray", "room mist", "home fragrance", "home scent", "ceramic",
  "gift card", "carte cadeau", "mug", "tote", "pouch", "etui", "case", "sachet", "wax", "cire",
  "decouverte", "echantillon", "echantillons", "advent", "calendar", "calendrier",
  "watch", "watches", "jewelry", "jewellery", "necklace", "bracelet", "earrings", "pendant",
] as const;

/**
 * 스토어가 붙인 상품 유형·카테고리에 있으면 향수 단품이 아닌 것으로 보는 단어 (이름에는 적용하지 않는다 —
 * "Old Books" 같은 향수 이름이 있다). 차량용 방향제, 책·굿즈, 증정·샘플 프로그램("Deluxe Cart", "GWP").
 */
export const NON_PERFUME_CATEGORY_WORDS = [
  "auto fragrance", "car fragrance", "car diffuser", "book", "books", "accessory", "accessories", "accessoire", "accessoires",
  "merch", "apparel", "gwp", "deluxe", "loyalty", "pick & mix", "box",
] as const;

/** 이름에 있으면 향수 단품이 아닌 것으로 보는 한글 표현 (띄어쓰기 무시) */
export const NON_PERFUME_NAME_WORDS_KO = [
  "세트", "샘플", "증정", "미니어처", "디스커버리", "키트", "리필", "공병", "시향",
  "핸드크림", "핸드워시", "바디", "헤어", "샴푸", "캔들", "향초", "디퓨저", "룸스프레이", "룸미스트",
  "홈프래그런스", "오일버너", "버너블렌드", "인센스스틱", "섬유", "사쉐", "쇼핑백",
] as const;

/**
 * 소개문 첫머리가 이 표현으로 상품 종류를 밝히면 향수가 아니다 — 이름·카테고리만으로는 향수처럼 보이는 상품용
 * (반클리프 아펠 "Les Mimosas d'Hiver" → "Scented Candle, 240 g"). 일반 문장에도 흔한 낱말(set·case·candle)은
 * 종류를 밝히는 구("scented candle", "set includes")로만 넣는다.
 */
export const NON_PERFUME_HEAD_PHRASES = [
  "scented candle", "bougie parfumee", "parfum d'interieur", "room spray", "home spray", "room mist",
  "shower gel", "gel douche", "body lotion", "hand cream", "duschgel", "raumspray", "seife", "kerze",
  "watch", "pendant", "necklace", "bracelet", "earrings",
  "gift set", "set includes", "set of", "bestehend aus", "verlag", "taschchen",
] as const;

/** 이 태그가 붙은 제품은 제외한다 (스토어가 숨김·증정용으로 표시한 제품) */
export const EXCLUDE_TAGS = [
  "search_hide",
  "hidethis",
  "unsellable",
  "gift_product",
  "free sample",
  "discovery_product",
] as const;

/**
 * 판매처를 특정 매장·공식몰로 한정한 제품은 한국에서 살 수 없다. 소개문에 이 문구가 있으면 제외한다 (영·불).
 * 넓게 잡으면 오탐이 난다 — "exclusive" 하나로는 "Exclusive, Elégante…" 같은 수식어까지 걸린다.
 * 예) "sold exclusively at D.S. & Durga New York stores", "sold direct only"
 */
export const EXCLUSIVE_SALE_PATTERNS: readonly RegExp[] = [
  /\b(?:sold|available) (?:only|exclusively) (?:at|in|through|on|via|from)\b/i,
  /\b(?:only|exclusively) (?:sold|available) (?:at|in|through|on|via|from)\b/i,
  /\bsold direct(?:ly)? only\b|\bdirect[- ]only\b/i,
  /\b(?:online|web|website|boutique|in-store|u\.?s\.?|usa|north america)[- ]exclusive\b/i,
  /\bexclusive(?:ly)? (?:to|at) (?:our|the) (?:[\w.&' -]{1,40} )?(?:stores?|boutiques?|shops?|website|flagship)\b/i,
  /\b(?:vendue?s?|disponibles?) (?:exclusivement|uniquement) (?:en|sur|dans|chez|à)\b/i,
  /\ben exclusivité (?:sur|en|dans|chez)\b/i,
];

// ───────── 신제품 후보 기준 ─────────

/** 같은 이름의 제품이 처음 등장한 날이 이 기간 안이어야 신제품으로 본다 */
export const WINDOW_DAYS = 60;
/** 향수 한 건에 저장할 이미지 수 */
export const MAX_IMAGES = 3;
/** 공식 소개문이 이보다 짧으면 설명을 쓸 근거가 부족하다고 보고 제외한다 (영어 기준 글자 수 — text.ts effectiveTextLength) */
export const MIN_BODY_LENGTH = 150;
/** LLM에 넘기는 소개문 최대 길이 — 노트 목록이 소개문 끝에 오는 브랜드가 있어 넉넉히 둔다 */
export const MAX_BODY_FOR_LLM = 3000;
/** 1회 실행당 LLM에 넘기는 후보 수 — 넘치면 날마다 순환한다 */
export const MAX_CANDIDATES = 12;

// ───────── LLM 작성·검증 ─────────

/** LLM 확신도(0~100)가 이 값 미만이면 저장하지 않는다 */
export const MIN_CONFIDENCE = 80;
/** 1회 실행당 최대 저장 수. 기준을 넘는 제품이 없으면 0건도 정상이다 */
export const MAX_SAVE_PER_RUN = 10;
export const NAME_MAX_LENGTH = 80;
export const DESCRIPTION_MIN_LENGTH = 60;
export const DESCRIPTION_MAX_LENGTH = 500;
/** 설명에 한글이 이만큼은 있어야 한국어로 쓴 것으로 본다 */
export const DESCRIPTION_MIN_HANGUL = 20;
export const NOTES_MAX_LENGTH = 300;
/** 노트 이름 한 개의 최대 길이 — 문장을 통째로 노트로 준 경우를 거른다 */
export const NOTE_NAME_MAX_LENGTH = 40;

/**
 * 소개문·노트를 쓰고 공식 사이트를 찾는 모델 — AI 채팅과 같은 모델을 쓴다(교체는 lib/ai/models.ts 한 곳에서).
 * gpt-4o-mini는 풍경·사물 노트의 뜻을 옮기지 못하고 소개문의 원료 표기도 용어집을 따르지 않았다.
 */
export const OPENAI_MODEL = OPENAI_TEXT_MODEL;
export const OPENAI_TIMEOUT_MS = 45_000;

export const DESKTOP_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
