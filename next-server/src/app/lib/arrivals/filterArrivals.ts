import prisma from "@/prisma/db";
import {
  EXCLUDE_TAGS,
  EXCLUSIVE_SALE_PATTERNS,
  MAX_CANDIDATES,
  MAX_IMAGES,
  MIN_BODY_LENGTH,
  WINDOW_DAYS,
} from "./config";
import { isPerfumeArrival } from "./perfumeSignals";
import { effectiveTextLength, stripAccents, toKey } from "./text";
import type { ArrivalCandidate, RawArrival, RuleDropReason, RuleFilterResult } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

/** 이름이 아니라 농도·형태를 나타내는 표기 (긴 표현을 먼저 둔다) */
const CONCENTRATION_PATTERN =
  /\b(?:extrait de parfum|eau de parfum|eau de toilette|eau de cologne|perfume oil|fragrance|parfum|edp|edt)\b|엑스트레\s*드\s*(?:퍼퓸|빠르펭)|오\s*드\s*(?:퍼퓸|빠르펭|뚜왈렛|뚜알렛|투알렛|코롱)|퍼퓸\s*오일|퍼퓸|향수/gi;
const SIZE_PATTERN = /\b\d+(?:[.,]\d+)?\s*(?:ml|fl\.?\s*oz\.?|oz)\b/gi;
/** 쇼핑몰이 제목 끝에 붙이는 색상 속성 — 향수에는 "무색"이 붙는다 (로에베 "… 100 ml Colourless") */
const COLOR_ATTRIBUTE_PATTERN = /\bcolou?rless\b/gi;
const EDGE_SEPARATORS = /^[\s\-–—,:|/]+|[\s\-–—,:|/]+$/g;

/** 옵션명이 "3X10 ML", "100mL + 10mL", "2mL x7"처럼 묶음 구성을 뜻하는지 */
const MULTI_PACK_PATTERN = /(\d|ml|oz)\s*x\s*\d|\bx\s*\d|\+/i;

/** 제목 앞에 붙은 브랜드명을 뗀다. 예) "LOEWE Aire" → " Aire" (악센트·대소문자 무시, 긴 표기부터) */
function stripBrandPrefix(title: string, brandNames: readonly string[]): string {
  const text = title.normalize("NFC").trimStart();
  const plain = stripAccents(text).toLowerCase();
  if (plain.length !== text.length) return text; // 글자 수가 달라지는 드문 글자(합자 등)가 있으면 건드리지 않는다
  for (const brand of [...brandNames].sort((a, b) => b.length - a.length)) {
    const plainBrand = stripAccents(brand.normalize("NFC")).toLowerCase().trim();
    const next = plain[plainBrand.length] ?? "";
    if (plainBrand && plain.startsWith(plainBrand) && !/[\p{L}\p{N}]/u.test(next)) return text.slice(plainBrand.length);
  }
  return text;
}

const stripDescriptors = (text: string) =>
  text
    .replace(CONCENTRATION_PATTERN, " ")
    .replace(SIZE_PATTERN, " ")
    .replace(COLOR_ATTRIBUTE_PATTERN, " ")
    .replace(/\s+/g, " ")
    .replace(EDGE_SEPARATORS, "");

/**
 * 제목에서 브랜드명·농도·용량 표기를 뺀 향수 이름.
 * 예) "Eau de Parfum - No.15 Vanille Infinie" → "No.15 Vanille Infinie", "Miu Miu Miutine Eau de Parfum 30ml" → "Miutine"
 * 브랜드명을 떼면 남는 것이 없을 때(이름이 브랜드명과 같은 향수)는 브랜드명을 남긴다.
 */
export function cleanName(title: string, brandNames: readonly string[] = []): string {
  return stripDescriptors(stripBrandPrefix(title, brandNames)) || stripDescriptors(title);
}

/** 저장할 이미지 주소 — https만 받고, 상대 주소("//cdn…", "/img/…")는 제품 주소 기준으로 푼다 */
function toImageUrls(images: readonly string[], pageUrl: string): string[] {
  const urls = new Set<string>();
  for (const src of images) {
    try {
      const url = new URL(src.trim(), pageUrl);
      if (url.protocol === "https:") urls.add(url.href);
    } catch {
      // 주소 형식이 아니면 건너뛴다
    }
  }
  return [...urls].slice(0, MAX_IMAGES);
}

/** 향수 단품이 아닌 제품을 거르는 제품 단위 규칙. 통과하면 null */
function productDropReason(raw: RawArrival): RuleDropReason | null {
  if (!isPerfumeArrival(raw)) return "notPerfume";

  const tags = raw.tags.map((tag) => tag.toLowerCase());
  if (EXCLUDE_TAGS.some((excluded) => tags.includes(excluded))) return "excludedTag";

  if (raw.variantTitles.length > 0 && raw.variantTitles.every((v) => MULTI_PACK_PATTERN.test(v))) {
    return "multiPack";
  }
  // 특정 매장·공식몰에서만 파는 제품은 한국에서 살 수 없다
  if (EXCLUSIVE_SALE_PATTERNS.some((pattern) => pattern.test(raw.bodyText))) return "exclusiveChannel";
  return null;
}

type Member = { raw: RawArrival; images: string[] };

/** 같은 향수의 여러 제품(용량·농도별) 중 대표를 고른다: 이미지 있음 → 소개문 긴 것 → 먼저 게시된 것 → 주소 짧은 것 */
function pickRepresentative(members: Member[]): Member {
  return [...members].sort(
    (a, b) =>
      Number(b.images.length > 0) - Number(a.images.length > 0) ||
      b.raw.bodyText.length - a.raw.bodyText.length ||
      a.raw.publishedAt.getTime() - b.raw.publishedAt.getTime() ||
      a.raw.url.length - b.raw.url.length ||
      a.raw.url.localeCompare(b.raw.url),
  )[0];
}

/**
 * LLM 호출 전 코드 단계 필터 (순수 함수 — DB 조회 없음). 브랜드별 규칙 없이 모든 수집 대상에 같은 규칙을 쓴다.
 * 1) 제품 단위: 향수 단품인지(perfumeSignals) → 제외 태그 → 묶음 구성 → 판매처 한정(특정 매장·공식몰 전용)
 * 2) 이름 단위: 용량·농도만 다른 제품을 하나로 합치고, 그 이름이 처음 등장한 날이 기간 안인지 본다
 *    (예전 향수의 새 용량·트래블 스프레이는 신제품이 아니다)
 * 3) 대표 제품의 이미지 · 소개문 길이
 * 기간만 지난 향수는 버리지 않고 backlog로 돌려준다 (탈락 수는 예전처럼 notNew로만 센다).
 */
export function filterByRules(raw: RawArrival[], now: Date = new Date()): RuleFilterResult {
  const dropped: Record<RuleDropReason, number> = {
    notPerfume: 0,
    excludedTag: 0,
    multiPack: 0,
    exclusiveChannel: 0,
    noName: 0,
    notNew: 0,
    noImage: 0,
    shortBody: 0,
  };
  const since = now.getTime() - WINDOW_DAYS * DAY_MS;
  const until = now.getTime() + DAY_MS;

  // 수집 대상별 전체 제품의 제목 키 — "이 이름이 처음 등장한 날"을 찾는 데 쓴다 (세트·샘플·트래블 포함)
  const titlesBySource = new Map<string, { titleKey: string; time: number }[]>();
  for (const item of raw) {
    const list = titlesBySource.get(item.source.id) ?? [];
    list.push({ titleKey: toKey(item.title), time: item.publishedAt.getTime() });
    titlesBySource.set(item.source.id, list);
  }

  const groups = new Map<string, { nameKey: string; members: Member[] }>();
  for (const item of raw) {
    const reason = productDropReason(item);
    if (reason) {
      dropped[reason] += 1;
      continue;
    }
    const nameKey = toKey(cleanName(item.title, brandNamesOf(item)));
    if (!nameKey) {
      dropped.noName += 1;
      continue;
    }
    const groupKey = `${item.source.id}\n${nameKey}`;
    const group = groups.get(groupKey) ?? { nameKey, members: [] };
    group.members.push({ raw: item, images: toImageUrls(item.images, item.url) });
    groups.set(groupKey, group);
  }

  const kept: ArrivalCandidate[] = [];
  const backlog: ArrivalCandidate[] = [];
  let mergedVariants = 0;

  for (const { nameKey, members } of groups.values()) {
    mergedVariants += members.length - 1;
    const { raw: rep, images } = pickRepresentative(members);

    // 짧은 키는 다른 제목에 우연히 포함되기 쉬워 같은 이름끼리만 비교한다
    const memberTimes = members.map((m) => m.raw.publishedAt.getTime());
    const relatedTimes =
      nameKey.length >= 4
        ? (titlesBySource.get(rep.source.id) ?? []).filter((t) => t.titleKey.includes(nameKey)).map((t) => t.time)
        : [];
    const firstSeen = Math.min(...memberTimes, ...relatedTimes);

    // 기간이 지난 향수는 신제품이 아니다 — 나머지 규칙을 통과하면 backlog에 담는다
    const isNew = firstSeen >= since && firstSeen <= until;
    if (!isNew) dropped.notNew += 1;
    if (firstSeen > until) continue;
    if (images.length === 0) {
      if (isNew) dropped.noImage += 1;
      continue;
    }
    if (effectiveTextLength(rep.bodyText) < MIN_BODY_LENGTH) {
      if (isNew) dropped.shortBody += 1;
      continue;
    }

    const brandNames = brandNamesOf(rep);
    (isNew ? kept : backlog).push({
      brand: rep.source.brand,
      name: cleanName(rep.title, brandNames),
      title: rep.title,
      nameKey,
      brandNames,
      officialUrl: rep.url,
      bodyText: rep.bodyText,
      category: rep.category,
      images,
      firstSeenAt: new Date(firstSeen),
    });
  }

  for (const list of [kept, backlog]) {
    list.sort((a, b) => b.firstSeenAt.getTime() - a.firstSeenAt.getTime() || a.officialUrl.localeCompare(b.officialUrl));
  }

  return { kept, backlog, dropped, mergedVariants };
}

const brandNamesOf = (raw: RawArrival) => [raw.source.brand, ...raw.source.aliases];

/**
 * 이번 실행에서 LLM에 넘길 후보를 고른다 (순수 함수).
 * 후보가 한도보다 많으면 날마다 구간을 옮긴다 — 검증에 계속 실패하는 제품이 앞자리를 차지해
 * 뒤의 제품이 영영 처리되지 않는 일을 막는다.
 */
export function pickForRun(candidates: ArrivalCandidate[], now: Date = new Date()): ArrivalCandidate[] {
  if (candidates.length <= MAX_CANDIDATES) return candidates;
  const day = Math.floor(now.getTime() / DAY_MS);
  const start = (day * MAX_CANDIDATES) % candidates.length;
  return Array.from({ length: MAX_CANDIDATES }, (_, i) => candidates[(start + i) % candidates.length]);
}

/** 이미 처리한 공식 URL — 저장된 향수(수집분)와 다시 수집하지 않기로 한 URL(삭제분) */
export async function findKnownUrls(urls: string[]): Promise<Set<string>> {
  if (urls.length === 0) return new Set();
  const [saved, blocked] = await Promise.all([
    prisma.fragrance.findMany({ where: { officialUrl: { in: urls } }, select: { officialUrl: true } }),
    prisma.fragranceBlockedUrl.findMany({ where: { officialUrl: { in: urls } }, select: { officialUrl: true } }),
  ]);
  return new Set([...saved, ...blocked].flatMap((row) => (row.officialUrl ? [row.officialUrl] : [])));
}

/**
 * 이미 있는 향수를 제외한다: 처리한 공식 URL, 같은 브랜드+이름(사용자 등록분 포함, 대소문자 무시).
 * 이름이 한글인 후보(한국어 사이트·출시 기사)는 등록된 향수의 한글 이름(FragranceKoreanName)과도 견준다 —
 * 같은 향수가 영문 이름으로 이미 있을 때 한글 이름으로 또 등록되는 것을 막는다.
 */
export async function excludeExisting(candidates: ArrivalCandidate[]): Promise<ArrivalCandidate[]> {
  if (candidates.length === 0) return [];
  const koreanNamed = candidates.filter((c) => /[가-힣]/.test(c.name));

  const [knownUrls, sameName, koreanNames] = await Promise.all([
    findKnownUrls(candidates.map((c) => c.officialUrl)),
    prisma.fragrance.findMany({
      where: {
        OR: candidates.map((c) => ({
          brand: { equals: c.brand, mode: "insensitive" as const },
          name: { equals: c.name, mode: "insensitive" as const },
        })),
      },
      select: { brand: true, name: true },
    }),
    koreanNamed.length === 0
      ? []
      : prisma.fragranceKoreanName.findMany({
          where: { OR: [...new Set(koreanNamed.map((c) => c.brand))].map((brand) => ({ brand: { equals: brand, mode: "insensitive" as const } })) },
          select: { brand: true, korean: true },
        }),
  ]);
  const knownNames = new Set(sameName.map((f) => `${toKey(f.brand)}\n${f.name.trim().toLowerCase()}`));
  const knownKoreanNames = new Set(koreanNames.map((row) => `${toKey(row.brand)}\n${toKey(cleanName(row.korean))}`));

  return candidates.filter(
    (c) =>
      !knownUrls.has(c.officialUrl) &&
      !knownNames.has(`${toKey(c.brand)}\n${c.name.trim().toLowerCase()}`) &&
      !knownKoreanNames.has(`${toKey(c.brand)}\n${toKey(c.name)}`),
  );
}
