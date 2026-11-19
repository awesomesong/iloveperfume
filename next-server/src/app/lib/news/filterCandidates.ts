import prisma from "@/prisma/db";
import {
  BLOCKED_DOMAINS,
  DUPLICATE_SIMILARITY_THRESHOLD,
  EXCLUDE_KEYWORDS,
  MAX_CANDIDATES,
  TRUSTED_DOMAINS,
  WINDOW_HOURS,
} from "./config";
import { getDomain, parseHttpUrl } from "./collectNews";
import { createTitleSimilarity, isSimilarToAny } from "./dedupe";
import { isPerfumeArticle } from "./perfumeArticle";
import type { NewsCandidate } from "./types";

/**
 * LLM 호출 전 코드 단계 필터 (순수 함수 — DB 조회 없음).
 * 기간 → 차단 도메인 → 검증된 매체 → 제외 키워드 → 향수 기사 판별 → URL 중복 → 제목 유사 중복 순으로 거른다.
 * 향수 기사 판별을 중복 판별보다 먼저 해서 향수와 무관한 기사가 중복 연결(A≈B≈C)에 끼지 않게 한다.
 * 검증된 매체 = TRUSTED_DOMAINS 화이트리스트 또는 네이버 뉴스 제휴 매체(naverPartner). BLOCKED_DOMAINS가 둘보다 우선한다.
 * 제목 유사 중복은 최근 게시 글 제목(recentTitles)과, 이번 실행에서 먼저 본 후보 전부와 비교한다.
 */
export function filterByRules(
  raw: NewsCandidate[],
  now: Date = new Date(),
  recentTitles: string[] = [],
): NewsCandidate[] {
  const since = now.getTime() - WINDOW_HOURS * 60 * 60 * 1000;

  // 최신순 정렬 — 중복 보도는 가장 최근 기사를 남긴다
  const sorted = [...raw].sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

  const seenUrls = new Set<string>();
  const passed: NewsCandidate[] = [];

  for (const candidate of sorted) {
    const time = candidate.publishedAt.getTime();
    if (time < since || time > now.getTime() + 60 * 60 * 1000) continue;

    const url = parseHttpUrl(candidate.url);
    if (!url) continue;
    const domain = getDomain(url);
    if (BLOCKED_DOMAINS.some((blocked) => domain === blocked || domain.endsWith(`.${blocked}`))) continue;
    const whitelisted = TRUSTED_DOMAINS.some((trusted) => domain === trusted || domain.endsWith(`.${trusted}`));
    if (!whitelisted && !candidate.naverPartner) continue;

    const text = `${candidate.title} ${candidate.description}`;
    if (EXCLUDE_KEYWORDS.some((keyword) => text.includes(keyword))) continue;
    // 제목에 향수 용어가 있거나 발췌문에 여러 번 나오는 기사만 — 품목 나열·추억 뜻의 "향수" 한 번으로는 통과하지 못한다
    if (!isPerfumeArticle(candidate)) continue;

    if (seenUrls.has(candidate.url)) continue;
    seenUrls.add(candidate.url);

    passed.push(candidate);
  }

  // IDF 코퍼스: 수집한 기사 전체(제목+발췌문, collectNews에서 URL 중복 제거됨) + 최근 게시 글 제목 — 여러 기사에 흔한 단어일수록 가중치가 낮다
  const similarity = createTitleSimilarity([
    ...raw.map((c) => `${c.title} ${c.description}`),
    ...recentTitles,
  ]);

  // 먼저 본 후보와 비교할 때는 중복으로 버린 것도 포함한다(단일 연결) — A≈B, B≈C면 C도 같은 소식으로 본다
  const seenTitles: string[] = [];
  const kept: NewsCandidate[] = [];
  for (const candidate of passed) {
    const isDuplicate =
      isSimilarToAny(similarity, candidate.title, recentTitles, DUPLICATE_SIMILARITY_THRESHOLD) ||
      isSimilarToAny(similarity, candidate.title, seenTitles, DUPLICATE_SIMILARITY_THRESHOLD);
    seenTitles.push(candidate.title);
    if (!isDuplicate) kept.push(candidate);
  }

  return kept;
}

/**
 * 규칙 필터 + 이미 DB에 있는 원문 URL 제외. 내린 글(HIDDEN)도 포함해 제외한다.
 * recentTitles: 최근 DUPLICATE_LOOKBACK_DAYS일 안에 만든 글 제목 — 다른 매체가 쓴 같은 소식을 거른다.
 *
 * 주의: 후보 URL은 추적용 파라미터(utm_*, ?ref=naver)를 지운 정규화 URL인데, 정규화 도입 전에 저장된 sourceUrl에는
 * 그 파라미터가 남아 있어 이 URL 대조로는 걸리지 않는다. 후보가 48시간 창이고 최근 DUPLICATE_LOOKBACK_DAYS(3)일 글과의
 * 제목 유사도 비교(recentTitles)가 같은 기사를 잡으므로 별도 이관 없이 둔다.
 */
export async function filterCandidates(
  raw: NewsCandidate[],
  recentTitles: string[] = [],
): Promise<NewsCandidate[]> {
  const byRules = filterByRules(raw, new Date(), recentTitles);
  if (byRules.length === 0) return [];

  const existing = await prisma.notice.findMany({
    where: { sourceUrl: { in: byRules.map((c) => c.url) } },
    select: { sourceUrl: true },
  });
  const existingUrls = new Set(existing.map((n) => n.sourceUrl));

  return byRules.filter((c) => !existingUrls.has(c.url)).slice(0, MAX_CANDIDATES);
}
