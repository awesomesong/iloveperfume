/**
 * 향수 신제품 수집 파이프라인 설정.
 * 운영하면서 손보는 값(수집 대상 브랜드·제외 키워드·기준 점수)은 모두 여기에 모은다.
 */
import { OPENAI_TEXT_MODEL } from "@/src/app/lib/ai/models";

export type ArrivalSource = {
  /** DB에 저장할 브랜드 표기 — 기존 관례대로 영문 대문자 (피드의 vendor는 쓰지 않는다) */
  brand: string;
  /** 제품 피드와 공식 제품 페이지의 호스트 */
  domain: string;
  /** 향수 단품에 붙는 product_type (소문자로 비교) */
  productTypes: readonly string[];
  /** product_type만으로 향수 단품을 가를 수 없는 브랜드는 제목 패턴도 맞아야 한다 */
  titlePattern?: RegExp;
};

/**
 * 수집 대상 — 공식 사이트가 제품 목록(/products.json)을 공개하는 브랜드만 등록한다.
 * 브랜드별 규칙은 2026-11-17 기준 실제 피드를 보고 정했다 (근거: docs/arrivals-pipeline.md).
 */
export const ARRIVAL_SOURCES: readonly ArrivalSource[] = [
  { brand: "D.S. & DURGA", domain: "dsanddurga.com", productTypes: ["eau de parfum", "perfume oil"] },
  { brand: "VILHELM PARFUMERIE", domain: "vilhelmparfumerie.com", productTypes: ["eau de parfum"] },
  {
    brand: "IMAGINARY AUTHORS",
    domain: "www.imaginaryauthors.com",
    productTypes: ["perfume"],
    // 캔들·비누·머그도 product_type이 "Perfume"이다 — 향수만 제목이 "- FRAGRANCE"로 끝난다
    titlePattern: /-\s*FRAGRANCE$/i,
  },
  { brand: "GOLDFIELD & BANKS", domain: "www.goldfieldandbanks.com", productTypes: ["100ml"] },
  { brand: "NONFICTION", domain: "www.nonfiction.com", productTypes: ["parfum", "perfume"] },
  { brand: "DEDCOOL", domain: "dedcool.com", productTypes: ["fragrance"] },
  {
    brand: "MAISON LOUIS MARIE",
    domain: "www.maisonlouismarie.com",
    productTypes: ["personal fragrance"],
    // 헤어·바디 미스트와 세트도 같은 product_type이다
    titlePattern: /^(eau de parfum|perfume oil)\s*-/i,
  },
  { brand: "JULIETTE HAS A GUN", domain: "www.juliettehasagun.com", productTypes: ["eau de parfum"] },
];

/** 피드 한 페이지의 제품 수 (Shopify 최대 250) */
export const FEED_PAGE_SIZE = 250;

/** 브랜드당 최대 페이지 수 — "처음 등장한 날"을 판단하려면 예전 제품까지 봐야 한다 */
export const FEED_MAX_PAGES = 4;

/** 같은 이름의 제품이 피드에 처음 등장한 날이 이 기간 안이어야 신제품으로 본다 */
export const WINDOW_DAYS = 60;

/**
 * 제목에 포함되면 향수 단품이 아닌 것으로 보고 제외하는 단어·구 (악센트 제거·소문자 기준, 단어 단위).
 * "body"·"hand"처럼 향수 이름에도 쓰이는 단어는 단독으로 넣지 않는다 (예: Vilhelm "Body Paint").
 */
export const EXCLUDE_TITLE_WORDS = [
  "set",
  "sets",
  "sample",
  "samples",
  "discovery",
  "kit",
  "duo",
  "trio",
  "quartet",
  "bundle",
  "coffret",
  "miniature",
  "miniatures",
  "mini",
  "travel",
  "refill",
  "collector",
  "candle",
  "diffuser",
  "incense",
  "soap",
  "lotion",
  "detergent",
  "body wash",
  "body oil",
  "body mist",
  "hair mist",
  "hand cream",
  "hand wash",
  "gift card",
  "mug",
  "tote",
  "pouch",
  "decouverte",
  "echantillon",
  "echantillons",
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

/** 이미지는 이 호스트 또는 해당 브랜드 도메인에서 온 것만 쓴다 */
export const SHOPIFY_IMAGE_HOST = "cdn.shopify.com";

/** 향수 한 건에 저장할 이미지 수 */
export const MAX_IMAGES = 3;

/** 공식 소개문이 이보다 짧으면 설명을 쓸 근거가 부족하다고 보고 제외한다 */
export const MIN_BODY_LENGTH = 150;

/** LLM에 넘기는 소개문 최대 길이 — 노트 목록이 소개문 끝에 오는 브랜드가 있어 넉넉히 둔다 */
export const MAX_BODY_FOR_LLM = 3000;

/** 1회 실행당 LLM에 넘기는 후보 수 — 넘치면 날마다 순환한다 */
export const MAX_CANDIDATES = 12;

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
 * 소개문·노트를 쓰는 모델 — AI 채팅과 같은 모델을 쓴다(교체는 lib/ai/models.ts 한 곳에서).
 * gpt-4o-mini는 풍경·사물 노트의 뜻을 옮기지 못하고 소개문의 원료 표기도 용어집을 따르지 않았다.
 */
export const OPENAI_MODEL = OPENAI_TEXT_MODEL;
export const FEED_TIMEOUT_MS = 8_000;
export const OPENAI_TIMEOUT_MS = 45_000;

export const DESKTOP_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
