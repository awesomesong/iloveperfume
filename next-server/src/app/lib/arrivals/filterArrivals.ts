import prisma from "@/prisma/db";
import { parseHttpUrl } from "@/src/app/lib/news/collectNews";
import {
  EXCLUDE_TAGS,
  EXCLUDE_TITLE_WORDS,
  EXCLUSIVE_SALE_PATTERNS,
  MAX_CANDIDATES,
  MAX_IMAGES,
  MIN_BODY_LENGTH,
  SHOPIFY_IMAGE_HOST,
  WINDOW_DAYS,
} from "./config";
import { buildOfficialUrl } from "./collectArrivals";
import type { ArrivalCandidate, RawArrival, RuleDropReason, RuleFilterResult } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

/** 이름이 아니라 농도·형태를 나타내는 표기 (긴 표현을 먼저 둔다) */
const CONCENTRATION_PATTERN =
  /\b(extrait de parfum|eau de parfum|eau de toilette|perfume oil|fragrance|parfum|edp|edt)\b/gi;
const SIZE_PATTERN = /\b\d+(?:[.,]\d+)?\s*(?:ml|fl\.?\s*oz\.?|oz)\b/gi;
const EDGE_SEPARATORS = /^[\s\-–—,:|/]+|[\s\-–—,:|/]+$/g;

/** 옵션명이 "3X10 ML", "100mL + 10mL", "2mL x7"처럼 묶음 구성을 뜻하는지 */
const MULTI_PACK_PATTERN = /(\d|ml|oz)\s*x\s*\d|\bx\s*\d|\+/i;

const EXCLUDE_TITLE_PATTERN = new RegExp(`\\b(${EXCLUDE_TITLE_WORDS.join("|")})\\b`);

/** 악센트 제거 + 소문자 (비교용) */
export function normalizeText(text: string): string {
  return text.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** 비교용 키: 악센트·대소문자·공백·기호를 무시한 글자와 숫자 */
export function toKey(text: string): string {
  return normalizeText(text).replace(/[^\p{L}\p{N}]/gu, "");
}

/** 제목에서 농도·용량 표기를 뺀 향수 이름. 예) "Eau de Parfum - No.15 Vanille Infinie" → "No.15 Vanille Infinie" */
export function cleanName(title: string): string {
  return title
    .replace(CONCENTRATION_PATTERN, " ")
    .replace(SIZE_PATTERN, " ")
    .replace(/\s+/g, " ")
    .replace(EDGE_SEPARATORS, "");
}

function isAllowedImage(src: string, domain: string): boolean {
  const url = parseHttpUrl(src);
  if (!url || url.protocol !== "https:") return false;
  const bareDomain = domain.replace(/^www\./, "");
  return (
    url.hostname === SHOPIFY_IMAGE_HOST ||
    url.hostname === bareDomain ||
    url.hostname.endsWith(`.${bareDomain}`)
  );
}

/** 향수 단품이 아닌 제품을 거르는 제품 단위 규칙. 통과하면 null */
function productDropReason(raw: RawArrival): RuleDropReason | null {
  const { source } = raw;
  if (!source.productTypes.includes(raw.productType.toLowerCase())) return "notPerfumeType";
  if (source.titlePattern && !source.titlePattern.test(raw.title)) return "notPerfumeType";
  if (EXCLUDE_TITLE_PATTERN.test(normalizeText(raw.title))) return "excludedTitle";

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
      a.raw.handle.length - b.raw.handle.length ||
      a.raw.handle.localeCompare(b.raw.handle),
  )[0];
}

/**
 * LLM 호출 전 코드 단계 필터 (순수 함수 — DB 조회 없음).
 * 1) 제품 단위: 향수 유형 → 제외 단어 → 제외 태그 → 묶음 구성 → 판매처 한정(특정 매장·공식몰 전용)
 * 2) 이름 단위: 용량·농도만 다른 제품을 하나로 합치고, 그 이름이 피드에 처음 등장한 날이 기간 안인지 본다
 *    (예전 향수의 새 용량·트래블 스프레이는 신제품이 아니다)
 * 3) 대표 제품의 이미지 출처 · 소개문 길이
 */
export function filterByRules(raw: RawArrival[], now: Date = new Date()): RuleFilterResult {
  const dropped: Record<RuleDropReason, number> = {
    notPerfumeType: 0,
    excludedTitle: 0,
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

  // 브랜드별 전체 제품의 제목 키 — "이 이름이 처음 등장한 날"을 찾는 데 쓴다 (세트·샘플·트래블 포함)
  const titlesByDomain = new Map<string, { titleKey: string; time: number }[]>();
  for (const item of raw) {
    const list = titlesByDomain.get(item.source.domain) ?? [];
    list.push({ titleKey: toKey(item.title), time: item.publishedAt.getTime() });
    titlesByDomain.set(item.source.domain, list);
  }

  const groups = new Map<string, { nameKey: string; members: Member[] }>();
  for (const item of raw) {
    const reason = productDropReason(item);
    if (reason) {
      dropped[reason] += 1;
      continue;
    }
    const nameKey = toKey(cleanName(item.title));
    if (!nameKey) {
      dropped.noName += 1;
      continue;
    }
    const groupKey = `${item.source.domain}\n${nameKey}`;
    const group = groups.get(groupKey) ?? { nameKey, members: [] };
    group.members.push({
      raw: item,
      images: item.images.filter((src) => isAllowedImage(src, item.source.domain)).slice(0, MAX_IMAGES),
    });
    groups.set(groupKey, group);
  }

  const kept: ArrivalCandidate[] = [];
  let mergedVariants = 0;

  for (const { nameKey, members } of groups.values()) {
    mergedVariants += members.length - 1;
    const { raw: rep, images } = pickRepresentative(members);

    // 짧은 키는 다른 제목에 우연히 포함되기 쉬워 같은 이름끼리만 비교한다
    const memberTimes = members.map((m) => m.raw.publishedAt.getTime());
    const relatedTimes =
      nameKey.length >= 4
        ? (titlesByDomain.get(rep.source.domain) ?? [])
            .filter((t) => t.titleKey.includes(nameKey))
            .map((t) => t.time)
        : [];
    const firstSeen = Math.min(...memberTimes, ...relatedTimes);

    if (firstSeen < since || firstSeen > until) {
      dropped.notNew += 1;
      continue;
    }
    if (images.length === 0) {
      dropped.noImage += 1;
      continue;
    }
    if (rep.bodyText.length < MIN_BODY_LENGTH) {
      dropped.shortBody += 1;
      continue;
    }

    kept.push({
      brand: rep.source.brand,
      name: cleanName(rep.title),
      title: rep.title,
      nameKey,
      officialUrl: buildOfficialUrl(rep.source.domain, rep.handle),
      bodyText: rep.bodyText,
      productType: rep.productType,
      images,
      firstSeenAt: new Date(firstSeen),
    });
  }

  kept.sort(
    (a, b) =>
      b.firstSeenAt.getTime() - a.firstSeenAt.getTime() || a.officialUrl.localeCompare(b.officialUrl),
  );

  return { kept, dropped, mergedVariants };
}

/**
 * 이번 실행에서 LLM에 넘길 후보를 고른다 (순수 함수).
 * 후보가 한도보다 많으면 날마다 구간을 옮긴다 — 검증에 계속 실패하는 제품이 앞자리를 차지해
 * 뒤의 제품이 영영 처리되지 않는 일을 막는다.
 */
export function pickForRun(candidates: ArrivalCandidate[], now: Date = new Date()): ArrivalCandidate[] {
  if (candidates.length <= MAX_CANDIDATES) return candidates;
  const day = Math.floor(now.getTime() / DAY_MS);
  const start = (day * MAX_CANDIDATES) % candidates.length;
  return Array.from(
    { length: MAX_CANDIDATES },
    (_, i) => candidates[(start + i) % candidates.length],
  );
}

/**
 * 이미 있는 향수를 제외한다: 같은 공식 URL(수집분), 다시 수집하지 않기로 한 URL(삭제분),
 * 같은 브랜드+이름(사용자 등록분 포함, 대소문자 무시).
 */
export async function excludeExisting(candidates: ArrivalCandidate[]): Promise<ArrivalCandidate[]> {
  if (candidates.length === 0) return [];
  const urls = candidates.map((c) => c.officialUrl);

  const [saved, blocked, sameName] = await Promise.all([
    prisma.fragrance.findMany({
      where: { officialUrl: { in: urls } },
      select: { officialUrl: true },
    }),
    prisma.fragranceBlockedUrl.findMany({
      where: { officialUrl: { in: urls } },
      select: { officialUrl: true },
    }),
    prisma.fragrance.findMany({
      where: {
        OR: candidates.map((c) => ({
          brand: { equals: c.brand, mode: "insensitive" as const },
          name: { equals: c.name, mode: "insensitive" as const },
        })),
      },
      select: { brand: true, name: true },
    }),
  ]);

  const knownUrls = new Set<string>();
  for (const row of [...saved, ...blocked]) {
    if (row.officialUrl) knownUrls.add(row.officialUrl);
  }
  const knownNames = new Set(sameName.map((f) => `${toKey(f.brand)}\n${f.name.trim().toLowerCase()}`));

  return candidates.filter(
    (c) =>
      !knownUrls.has(c.officialUrl) &&
      !knownNames.has(`${toKey(c.brand)}\n${c.name.trim().toLowerCase()}`),
  );
}
