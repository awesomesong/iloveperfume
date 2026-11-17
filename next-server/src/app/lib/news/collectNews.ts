import prisma from "@/prisma/db";
import {
  BASE_QUERIES,
  BRAND_QUERY_COUNT,
  NAVER_TIMEOUT_MS,
  PER_QUERY_DISPLAY,
  SOURCE_NAME_BY_DOMAIN,
} from "./config";
import type { NewsCandidate } from "./types";

const NAVER_NEWS_API = "https://openapi.naver.com/v1/search/news.json";

type NaverNewsItem = {
  title: string;
  originallink: string;
  link: string;
  description: string;
  pubDate: string;
};

const HTML_ENTITIES: Record<string, string> = {
  "&quot;": '"',
  "&apos;": "'",
  "&#39;": "'",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&nbsp;": " ",
};

/** 검색 API가 넣는 <b> 강조 태그와 HTML 엔티티를 제거해 일반 텍스트로 만든다 */
export function toPlainText(input: string): string {
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/&(quot|apos|#39|amp|lt|gt|nbsp);/g, (m) => HTML_ENTITIES[m] ?? m)
    .replace(/\s+/g, " ")
    .trim();
}

export function parseHttpUrl(value: string | undefined): URL | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

/** www./m./news. 같은 앞머리를 겹쳐서 다 떼어낸다 (예: www.news.example.com → example.com) */
export function getDomain(url: URL): string {
  let host = url.hostname;
  while (/^(www|m|news)\./.test(host)) {
    host = host.replace(/^(www|m|news)\./, "");
  }
  return host;
}

function getSourceName(url: URL): string {
  const domain = getDomain(url);
  const matched = Object.keys(SOURCE_NAME_BY_DOMAIN).find(
    (key) => domain === key || domain.endsWith(`.${key}`),
  );
  return matched ? SOURCE_NAME_BY_DOMAIN[matched] : domain;
}

/** 고정 검색어 + DB에 등록 수가 많은 브랜드 검색어 */
export async function buildQueries(): Promise<string[]> {
  const queries: string[] = [...BASE_QUERIES];

  try {
    const topBrands = await prisma.fragrance.groupBy({
      by: ["brand"],
      _count: { brand: true },
      orderBy: { _count: { brand: "desc" } },
      take: BRAND_QUERY_COUNT,
    });
    for (const { brand } of topBrands) {
      const name = brand?.trim();
      if (name) queries.push(`${name} 향수`);
    }
  } catch (e) {
    // 브랜드 검색어는 보조 수단 — 실패해도 고정 검색어로 계속 진행
    console.error("[news] buildQueries brand lookup failed:", e);
  }

  return [...new Set(queries)];
}

async function searchNaverNews(
  query: string,
  clientId: string,
  clientSecret: string,
): Promise<NewsCandidate[]> {
  const url = `${NAVER_NEWS_API}?query=${encodeURIComponent(query)}&display=${PER_QUERY_DISPLAY}&start=1&sort=date`;

  const res = await fetch(url, {
    headers: {
      "X-Naver-Client-Id": clientId,
      "X-Naver-Client-Secret": clientSecret,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(NAVER_TIMEOUT_MS),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Naver News API ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as { items?: NaverNewsItem[] };

  const candidates: NewsCandidate[] = [];
  for (const item of data.items ?? []) {
    const url = parseHttpUrl(item.originallink) ?? parseHttpUrl(item.link);
    const publishedAt = new Date(item.pubDate);
    const title = toPlainText(item.title ?? "");
    if (!url || !title || Number.isNaN(publishedAt.getTime())) continue;

    candidates.push({
      url: url.toString(),
      title,
      description: toPlainText(item.description ?? ""),
      publishedAt,
      sourceName: getSourceName(url),
    });
  }
  return candidates;
}

/**
 * 모든 검색어를 병렬로 조회한다. 일부 검색어가 실패해도 나머지 결과로 진행하고,
 * 전부 실패했을 때만 에러를 던진다.
 */
export async function collectNews(queries: string[]): Promise<NewsCandidate[]> {
  // 쇼핑 검색과 같은 네이버 "검색" API — 별도 키가 없으면 쇼핑 키를 그대로 쓴다
  const clientId = process.env.NAVER_NEWS_CLIENT_ID ?? process.env.NAVER_SHOPPING_CLIENT_ID;
  const clientSecret = process.env.NAVER_NEWS_CLIENT_SECRET ?? process.env.NAVER_SHOPPING_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("NAVER_NEWS_CLIENT_ID/SECRET (또는 NAVER_SHOPPING_CLIENT_ID/SECRET) missing");
  }

  const results = await Promise.allSettled(
    queries.map((query) => searchNaverNews(query, clientId, clientSecret)),
  );

  const collected: NewsCandidate[] = [];
  let failed = 0;
  results.forEach((result, i) => {
    if (result.status === "fulfilled") {
      collected.push(...result.value);
    } else {
      failed += 1;
      console.error(`[news] query failed: "${queries[i]}"`, result.reason);
    }
  });

  if (queries.length > 0 && failed === queries.length) {
    throw new Error("네이버 뉴스 검색이 모두 실패했습니다.");
  }

  return collected;
}
