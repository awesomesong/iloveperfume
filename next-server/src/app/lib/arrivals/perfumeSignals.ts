import {
  DESCRIPTION_PERFUME_SIGNAL,
  NON_PERFUME_CATEGORY_WORDS,
  NON_PERFUME_HEAD_PHRASES,
  NON_PERFUME_NAME_WORDS,
  NON_PERFUME_NAME_WORDS_KO,
  PERFUME_SIGNAL,
} from "./config";
import { stripAccents } from "./text";
import type { RawArrival } from "./types";

/**
 * 향수 단품 판별 (순수 함수). 브랜드별 규칙(상품 유형 목록·제목 패턴) 없이 공통 표현으로 본다.
 * 수집 필터, 사이트 판정, 판매처 브랜드 찾기가 모두 이 함수 하나를 쓴다.
 */

const wordPattern = (words: readonly string[]) => new RegExp(`\\b(?:${words.join("|")})\\b`);

const NON_PERFUME_NAME = wordPattern(NON_PERFUME_NAME_WORDS);
const NON_PERFUME_CATEGORY = wordPattern(NON_PERFUME_CATEGORY_WORDS);
const NON_PERFUME_HEAD = wordPattern(NON_PERFUME_HEAD_PHRASES);
/** 품번만 있는 이름 — 띄어쓰기 없이 영문과 숫자가 섞인 것 (DIFFMLM15). "FLASHPOINT"처럼 대문자 이름은 품번이 아니다 */
const SKU_ONLY = /^(?=[A-Z0-9-]*\d)(?=[A-Z0-9-]*[A-Z])[A-Z0-9-]{4,}$/;
/** 1~15ml 소용량 (트래블·미니어처) */
const SMALL_SIZE = /(?:^|[^\d.])(?:[1-9]|1[0-5])(?:[.,]\d)?\s*ml\b/;
/** 소개문에서 상품 종류를 보는 앞부분 길이 */
const DESCRIPTION_HEAD = 200;

/**
 * 향수 단품 후보인지.
 * 1) 이름·유형·카테고리에 세트·샘플·소용량·다른 제품(향초·비누 등) 표현이 있거나, 무료 증정품이거나, 품번만 있으면 아니다
 * 2) 소개문 첫머리가 향수가 아닌 상품 종류를 밝히면 아니다
 * 3) 이름·유형·카테고리(context)에 향수 표현이 있으면 맞다
 * 4) 향수 전문 브랜드는 이름이 향 이름뿐이라("Hakuna Matata") 소개문 첫머리에 향수 표현이 있으면 맞다
 */
export function looksLikePerfume(name: string, context: string, description = ""): boolean {
  // 스토어가 붙인 유형·카테고리("Candle", "Home Fragrance", "바디")도 이름과 같은 기준으로 본다
  const labels = `${name} ${context}`;
  const plainLabels = stripAccents(labels).toLowerCase();
  const compactLabels = labels.replace(/\s+/g, "");
  if (NON_PERFUME_NAME.test(plainLabels) || NON_PERFUME_NAME_WORDS_KO.some((word) => compactLabels.includes(word))) return false;
  if (NON_PERFUME_CATEGORY.test(stripAccents(context).toLowerCase())) return false;
  const plainName = stripAccents(name).toLowerCase();
  if (/\bfree\b/.test(plainName) || SKU_ONLY.test(name.trim()) || SMALL_SIZE.test(plainName)) return false;

  const head = description.slice(0, DESCRIPTION_HEAD);
  const plainHead = stripAccents(head).toLowerCase();
  const compactHead = head.replace(/\s+/g, "");
  if (NON_PERFUME_HEAD.test(plainHead) || NON_PERFUME_NAME_WORDS_KO.some((word) => compactHead.startsWith(word))) return false;

  return PERFUME_SIGNAL.test(`${name} ${context}`) || PERFUME_SIGNAL.test(head) || DESCRIPTION_PERFUME_SIGNAL.test(head);
}

export const isPerfumeArrival = (raw: Pick<RawArrival, "title" | "category" | "bodyText">) =>
  looksLikePerfume(raw.title, raw.category, raw.bodyText);

/** 주소에 향수 단품을 뜻하는 표현이 있다 */
const PERFUME_URL_STRONG = /eau-de-(?:parfum|toilette|cologne)|extrait|parfum|perfume|%ED%96%A5%EC%88%98|향수/i;
const PERFUME_URL_HINT = /fragrance|cologne/i;
/** 주소에 홈·바디 제품 표현이 있다 ("home-fragrance"에도 fragrance가 들어 있다) */
const NON_PERFUME_URL_HINT = /home|room|candle|diffuser|body|hand|hair|skin|bath|oil-burner|incense/i;

/**
 * 상품 주소가 향수일 가능성 점수 — 사이트맵에서 먼저 열어 볼 주소를 고르는 데 쓴다.
 * 패션·주얼리가 주력인 사이트(로에베·미우미우)에서 향수가 아닌 상품에 요청을 쓰지 않기 위해서다.
 */
export function perfumeUrlScore(url: string): number {
  // 사이트 이름은 보지 않는다 — "room1015.com"의 room, "bdkparfums.com"의 parfums가 모든 상품에 걸린다
  const path = url.replace(/^https?:\/\/[^/]+/i, "");
  return (PERFUME_URL_STRONG.test(path) ? 2 : PERFUME_URL_HINT.test(path) ? 1 : 0) - (NON_PERFUME_URL_HINT.test(path) ? 3 : 0);
}
