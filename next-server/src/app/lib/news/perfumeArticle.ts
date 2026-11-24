/**
 * 향수 기사 판별 (순수 함수 — DB 조회 없음).
 *
 * 네이버 검색 결과는 본문 어딘가에 "향수"만 있어도 걸린다. 매장 매출 기사에 판매 품목으로 한 번,
 * 게임·공연 기사에 "어린 시절의 향수를 자극"처럼 추억의 뜻으로 한 번 나오는 식이라
 * 향수 용어(PERFUME_TERM_PATTERN·PERFUME_PRODUCT_NAMES)가 제목에 있거나, 제목에 향수 브랜드(PERFUME_BRANDS)가 있거나,
 * 발췌문에 여러 번 나오는 기사만 향수 기사로 본다.
 */
import {
  MIN_DESCRIPTION_PERFUME_MENTIONS,
  NOSTALGIA_PATTERN,
  PERFUME_BRANDS,
  PERFUME_PRODUCT_NAMES,
  PERFUME_TERM_PATTERN,
  type PerfumeBrand,
} from "./config";
import { compactText } from "./dedupe";
import type { NewsCandidate } from "./types";

/** 따옴표·낫표 — 지워야 "‘13년 전 향수’를 넘어" 같은 표현이 추억 패턴에 맞는다 */
const QUOTE_MARKS = /[‘’“”'"「」『』]/g;

/** 제품명 비교용 정규화: 소문자 + 글자·숫자·°(˚)만 남김 — "N°5", "N˚ 5"를 살린다 */
function compactForProducts(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}°˚]/gu, "");
}

/** text 안에 needle이 겹치지 않게 몇 번 나오는지 */
function countOccurrences(text: string, needle: string): number {
  let count = 0;
  for (let i = text.indexOf(needle); i !== -1; i = text.indexOf(needle, i + needle.length)) count++;
  return count;
}

/** 추억 뜻의 "향수"를 지운 텍스트 */
function removeNostalgia(text: string): string {
  return text.replace(QUOTE_MARKS, "").replace(NOSTALGIA_PATTERN, " ");
}

/** 추억 뜻의 "향수"를 뺀 향수 용어 등장 횟수 (제품명 제외) */
export function countPerfumeMentions(text: string): number {
  return removeNostalgia(text).match(PERFUME_TERM_PATTERN)?.length ?? 0;
}

/** 향수 제품명 등장 횟수 */
export function countPerfumeProducts(text: string): number {
  const compact = compactForProducts(removeNostalgia(text));
  return PERFUME_PRODUCT_NAMES.reduce((sum, name) => sum + countOccurrences(compact, name), 0);
}

/** 제목에 있는 향수 브랜드 (띄어쓰기·기호 무시, excludes에 걸린 부분은 지우고 비교) */
export function findTitleBrands(title: string): PerfumeBrand[] {
  const compact = compactText(title);
  return PERFUME_BRANDS.filter((brand) => {
    const text = (brand.excludes ?? []).reduce((acc, word) => acc.split(word).join(" "), compact);
    return brand.aliases.some((alias) => text.includes(alias));
  });
}

/**
 * 향수 기사 판별 — 다음 중 하나면 통과(추억 뜻의 "향수"는 세지 않는다).
 * 1. 제목에 향수 용어나 제품명이 있다.
 * 2. 제목에 향수 전문 브랜드(kind "house")가 있다.
 * 3. 제목에 패션·화장품 브랜드(kind "fashion")가 있고, 발췌문에 향수 용어나 제품명이 1번 이상 있다.
 * 4. 발췌문에 향수 용어가 MIN_DESCRIPTION_PERFUME_MENTIONS번 이상 있다.
 *    제품명은 세지 않는다 — "디올 향수 '소바쥬'의 광고 모델"처럼 용어와 제품명이 붙어 나오는 곁가지 언급이 2회로 세어졌다.
 */
export function isPerfumeArticle(candidate: Pick<NewsCandidate, "title" | "description">): boolean {
  const { title, description } = candidate;
  if (countPerfumeMentions(title) + countPerfumeProducts(title) >= 1) return true;

  const brands = findTitleBrands(title);
  if (brands.some((brand) => brand.kind === "house")) return true;

  const descriptionMentions = countPerfumeMentions(description);
  if (brands.length > 0 && descriptionMentions + countPerfumeProducts(description) >= 1) return true;
  return descriptionMentions >= MIN_DESCRIPTION_PERFUME_MENTIONS;
}
