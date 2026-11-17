import prisma from "@/prisma/db";
import {
  BLOCKED_DOMAINS,
  EXCLUDE_KEYWORDS,
  MAX_CANDIDATES,
  TITLE_SIMILARITY_THRESHOLD,
  TRUSTED_DOMAINS,
  WINDOW_HOURS,
} from "./config";
import { getDomain, parseHttpUrl } from "./collectNews";
import type { NewsCandidate } from "./types";

/** 비교용 제목 정규화: [속보]·(종합) 같은 머리말, 기호, 공백 제거 */
function normalizeTitle(title: string): string {
  return title
    .replace(/[\[\(【<][^\]\)】>]{0,12}[\]\)】>]/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "")
    .toLowerCase();
}

function bigrams(text: string): Set<string> {
  const set = new Set<string>();
  for (let i = 0; i < text.length - 1; i++) set.add(text.slice(i, i + 2));
  return set;
}

/** 바이그램 자카드 유사도 (0~1) */
export function titleSimilarity(a: string, b: string): number {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const A = bigrams(na);
  const B = bigrams(nb);
  if (A.size === 0 || B.size === 0) return 0;
  let intersection = 0;
  for (const gram of A) if (B.has(gram)) intersection += 1;
  return intersection / (A.size + B.size - intersection);
}

/**
 * LLM 호출 전 코드 단계 필터 (순수 함수 — DB 조회 없음).
 * 기간 → 차단 도메인 → 검증된 매체 → 제외 키워드 → URL 중복 → 제목 유사 중복 순으로 거른다.
 */
export function filterByRules(raw: NewsCandidate[], now: Date = new Date()): NewsCandidate[] {
  const since = now.getTime() - WINDOW_HOURS * 60 * 60 * 1000;

  // 최신순 정렬 — 중복 보도는 가장 최근 기사를 남긴다
  const sorted = [...raw].sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

  const seenUrls = new Set<string>();
  const kept: NewsCandidate[] = [];

  for (const candidate of sorted) {
    const time = candidate.publishedAt.getTime();
    if (time < since || time > now.getTime() + 60 * 60 * 1000) continue;

    const url = parseHttpUrl(candidate.url);
    if (!url) continue;
    const domain = getDomain(url);
    if (BLOCKED_DOMAINS.some((blocked) => domain === blocked || domain.endsWith(`.${blocked}`))) continue;
    if (!TRUSTED_DOMAINS.some((trusted) => domain === trusted || domain.endsWith(`.${trusted}`))) continue;

    const text = `${candidate.title} ${candidate.description}`;
    if (EXCLUDE_KEYWORDS.some((keyword) => text.includes(keyword))) continue;

    if (seenUrls.has(candidate.url)) continue;
    seenUrls.add(candidate.url);

    const isDuplicateReport = kept.some(
      (other) => titleSimilarity(other.title, candidate.title) >= TITLE_SIMILARITY_THRESHOLD,
    );
    if (isDuplicateReport) continue;

    kept.push(candidate);
  }

  return kept;
}

/** 규칙 필터 + 이미 DB에 있는 원문 URL 제외. 내린 글(HIDDEN)도 포함해 제외한다 */
export async function filterCandidates(raw: NewsCandidate[]): Promise<NewsCandidate[]> {
  const byRules = filterByRules(raw);
  if (byRules.length === 0) return [];

  const existing = await prisma.notice.findMany({
    where: { sourceUrl: { in: byRules.map((c) => c.url) } },
    select: { sourceUrl: true },
  });
  const existingUrls = new Set(existing.map((n) => n.sourceUrl));

  return byRules.filter((c) => !existingUrls.has(c.url)).slice(0, MAX_CANDIDATES);
}
