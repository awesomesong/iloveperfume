import {
  BASE_QUERIES,
  NAVER_CONCURRENCY,
  NAVER_MAX_PAGES_PER_QUERY,
  NAVER_MIN_INTERVAL_MS,
  NAVER_RETRY_DELAYS_MS,
  NAVER_TIMEOUT_MS,
  PER_QUERY_DISPLAY,
  PERFUME_BRANDS,
  SOURCE_NAME_BY_DOMAIN,
  WINDOW_HOURS,
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

/** 네이버 뉴스 인링크 호스트 — 검색 결과의 link가 이 호스트면 네이버 뉴스 제휴 매체 기사다 */
const NAVER_PARTNER_HOSTS = new Set([
  "n.news.naver.com",
  "m.sports.naver.com",
  "sports.news.naver.com",
  "m.entertain.naver.com",
]);

/** 같은 기사인데 유입 경로만 다른 URL을 하나로 보기 위해 지우는 파라미터인지 */
function isTrackingParam(key: string, value: string): boolean {
  const name = key.toLowerCase();
  if (name.startsWith("utm_")) return true;
  // ?ref=naver, ?from=naver_news 같은 유입 표시 — 값에 naver가 있을 때만 지운다(다른 용도의 ref/from은 남긴다)
  return (name === "ref" || name === "from") && /naver/i.test(value);
}

function decodeQueryPart(part: string): string {
  try {
    return decodeURIComponent(part.replace(/\+/g, " "));
  } catch {
    return part;
  }
}

/**
 * 기사 URL 정규화: 해시와 추적용 파라미터(utm_*, 값에 naver가 들어간 ref/from)만 지운다.
 * 기사 식별 파라미터(idxno=, no=, ud= 등)는 원래 인코딩 그대로 남긴다.
 */
export function normalizeArticleUrl(url: URL): URL {
  const normalized = new URL(url.toString());
  normalized.hash = "";
  const query = normalized.search.slice(1);
  if (query) {
    const kept = query.split("&").filter((pair) => {
      if (!pair) return false;
      const eq = pair.indexOf("=");
      const key = decodeQueryPart(eq === -1 ? pair : pair.slice(0, eq));
      const value = eq === -1 ? "" : decodeQueryPart(pair.slice(eq + 1));
      return !isTrackingParam(key, value);
    });
    normalized.search = kept.length > 0 ? `?${kept.join("&")}` : "";
  }
  return normalized;
}

/**
 * 고정 검색어(BASE_QUERIES) + 브랜드별 "{브랜드} 향수" 검색어 (sync지만 파이프라인 단계 이름을 유지하려고 함수로 둔다).
 * 브랜드 검색어는 제목에 "향수"가 없는 샤넬·디올 등의 향수 기사(화보·행사)를 잡으려고 둔다 — 대부분 1페이지에서 끝난다.
 */
export function buildQueries(): string[] {
  return [...new Set<string>([...BASE_QUERIES, ...PERFUME_BRANDS.map((brand) => `${brand.name} 향수`)])];
}

type NaverCredentials = { clientId: string; clientSecret: string };

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** 요청 시작 간격을 minIntervalMs 이상으로 벌리는 대기 함수 — 동시에 도는 작업이 함께 쓴다 */
type Throttle = () => Promise<void>;
function createThrottle(minIntervalMs: number): Throttle {
  let nextAt = 0;
  return async () => {
    const now = Date.now();
    const startAt = Math.max(now, nextAt);
    nextAt = startAt + minIntervalMs;
    if (startAt > now) await sleep(startAt - now);
  };
}

/** 네이버 검색 API 한 페이지 조회 — 429(호출 한도)·5xx는 NAVER_RETRY_DELAYS_MS 간격으로 다시 시도한다 */
async function fetchNaverPage(
  query: string,
  start: number,
  credentials: NaverCredentials,
  throttle: Throttle,
): Promise<NaverNewsItem[]> {
  const url = `${NAVER_NEWS_API}?query=${encodeURIComponent(query)}&display=${PER_QUERY_DISPLAY}&start=${start}&sort=date`;

  for (let attempt = 0; ; attempt++) {
    await throttle();
    const res = await fetch(url, {
      headers: {
        "X-Naver-Client-Id": credentials.clientId,
        "X-Naver-Client-Secret": credentials.clientSecret,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(NAVER_TIMEOUT_MS),
    });

    if (res.ok) {
      const data = (await res.json()) as { items?: NaverNewsItem[] };
      return data.items ?? [];
    }

    const body = await res.text().catch(() => "");
    const retryable = res.status === 429 || res.status >= 500;
    if (retryable && attempt < NAVER_RETRY_DELAYS_MS.length) {
      await sleep(NAVER_RETRY_DELAYS_MS[attempt]);
      continue;
    }
    throw new Error(`Naver News API ${res.status}: ${body.slice(0, 200)}`);
  }
}

function toCandidate(item: NaverNewsItem): NewsCandidate | null {
  const original = parseHttpUrl(item.originallink);
  const naverLink = parseHttpUrl(item.link);
  const parsed = original ?? naverLink;
  const publishedAt = new Date(item.pubDate);
  const title = toPlainText(item.title ?? "");
  if (!parsed || !title || Number.isNaN(publishedAt.getTime())) return null;

  const url = normalizeArticleUrl(parsed);
  return {
    url: url.toString(),
    title,
    description: toPlainText(item.description ?? ""),
    publishedAt,
    sourceName: getSourceName(url),
    // 원문 링크가 따로 있을 때만 — 원문 없이 네이버 링크만 있으면 매체를 알 수 없다
    naverPartner: !!original && !!naverLink && NAVER_PARTNER_HOSTS.has(naverLink.hostname),
  };
}

/**
 * 검색어 하나를 최신순으로 조회한다. 페이지의 마지막 기사가 아직 since 이후면
 * 다음 페이지를 NAVER_MAX_PAGES_PER_QUERY까지 더 가져온다.
 * 첫 페이지가 실패하면 에러를 던지고, 다음 페이지가 실패하면 그때까지 모은 결과를 돌려준다.
 */
async function searchNaverNews(
  query: string,
  since: number,
  credentials: NaverCredentials,
  throttle: Throttle,
): Promise<NewsCandidate[]> {
  const candidates: NewsCandidate[] = [];

  for (let page = 0; page < NAVER_MAX_PAGES_PER_QUERY; page++) {
    let items: NaverNewsItem[];
    try {
      items = await fetchNaverPage(query, 1 + page * PER_QUERY_DISPLAY, credentials, throttle);
    } catch (e) {
      if (page === 0) throw e;
      console.error(`[news] query page ${page + 1} failed: "${query}"`, e);
      break;
    }

    for (const item of items) {
      const candidate = toCandidate(item);
      if (candidate) candidates.push(candidate);
    }

    // 결과가 한 페이지보다 적거나 마지막 기사가 이미 창 밖이면 더 볼 필요가 없다
    if (items.length < PER_QUERY_DISPLAY) break;
    const lastTime = new Date(items[items.length - 1].pubDate).getTime();
    if (Number.isNaN(lastTime) || lastTime < since) break;
  }

  return candidates;
}

/** 작업을 최대 limit개씩만 동시에 실행한다 (결과 순서는 입력 순서) */
async function settleWithConcurrency<T, R>(
  inputs: readonly T[],
  limit: number,
  task: (input: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(inputs.length);
  let next = 0;
  const worker = async () => {
    while (next < inputs.length) {
      const i = next++;
      try {
        results[i] = { status: "fulfilled", value: await task(inputs[i]) };
      } catch (reason) {
        results[i] = { status: "rejected", reason };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, inputs.length) }, worker));
  return results;
}

export type CollectResult = {
  /** 원문 URL(정규화 후) 기준으로 중복을 뺀 기사 — 먼저 나온 것을 남긴다 */
  items: NewsCandidate[];
  /** 재시도 후에도 첫 페이지를 못 가져온 검색어 */
  failedQueries: string[];
};

/**
 * 검색어를 NAVER_CONCURRENCY개씩 나눠 조회하고, 요청 시작 간격을 NAVER_MIN_INTERVAL_MS 이상 둔다(빠르게 보내면 429가 난다).
 * 일부 검색어가 실패해도 나머지 결과로 진행하고, 전부 실패했을 때만 에러를 던진다.
 * 여러 검색어에 같은 기사가 겹치므로 정규화한 URL로 중복을 뺀다.
 */
export async function collectNews(queries: string[], now: Date = new Date()): Promise<CollectResult> {
  // 쇼핑 검색과 같은 네이버 "검색" API — 별도 키가 없으면 쇼핑 키를 그대로 쓴다
  const clientId = process.env.NAVER_NEWS_CLIENT_ID ?? process.env.NAVER_SHOPPING_CLIENT_ID;
  const clientSecret = process.env.NAVER_NEWS_CLIENT_SECRET ?? process.env.NAVER_SHOPPING_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("NAVER_NEWS_CLIENT_ID/SECRET (또는 NAVER_SHOPPING_CLIENT_ID/SECRET) missing");
  }

  const since = now.getTime() - WINDOW_HOURS * 60 * 60 * 1000;
  const throttle = createThrottle(NAVER_MIN_INTERVAL_MS);
  const results = await settleWithConcurrency(queries, NAVER_CONCURRENCY, (query) =>
    searchNaverNews(query, since, { clientId, clientSecret }, throttle),
  );

  const byUrl = new Map<string, NewsCandidate>();
  const failedQueries: string[] = [];
  results.forEach((result, i) => {
    if (result.status === "fulfilled") {
      for (const candidate of result.value) {
        if (!byUrl.has(candidate.url)) byUrl.set(candidate.url, candidate);
      }
    } else {
      failedQueries.push(queries[i]);
      console.error(`[news] query failed: "${queries[i]}"`, result.reason);
    }
  });

  if (queries.length > 0 && failedQueries.length === queries.length) {
    throw new Error("네이버 뉴스 검색이 모두 실패했습니다.");
  }

  return { items: [...byUrl.values()], failedQueries };
}
