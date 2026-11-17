import { toPlainText } from "@/src/app/lib/news/collectNews";
import {
  ARRIVAL_SOURCES,
  DESKTOP_USER_AGENT,
  FEED_MAX_PAGES,
  FEED_PAGE_SIZE,
  FEED_TIMEOUT_MS,
  type ArrivalSource,
} from "./config";
import type { RawArrival } from "./types";

type ShopifyProduct = {
  title?: unknown;
  handle?: unknown;
  body_html?: unknown;
  published_at?: unknown;
  product_type?: unknown;
  tags?: unknown;
  variants?: unknown;
  images?: unknown;
};

const asString = (value: unknown) => (typeof value === "string" ? value : "");

const asStringArray = (value: unknown, key?: string): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (key ? asString((item as Record<string, unknown> | null)?.[key]) : asString(item)))
    .filter(Boolean);
};

/** 공식 제품 페이지 주소 — 피드의 handle로 코드가 만든다 */
export function buildOfficialUrl(domain: string, handle: string): string {
  return `https://${domain}/products/${encodeURIComponent(handle)}`;
}

/** 피드 응답의 제품 한 건을 정리한다. 제목·handle·게시일이 없으면 버린다 */
export function toRawArrival(source: ArrivalSource, product: ShopifyProduct): RawArrival | null {
  const title = asString(product.title).trim();
  const handle = asString(product.handle).trim();
  const publishedAt = new Date(asString(product.published_at));
  if (!title || !handle || Number.isNaN(publishedAt.getTime())) return null;

  return {
    source,
    title,
    handle,
    bodyText: toPlainText(asString(product.body_html)),
    productType: asString(product.product_type).trim(),
    tags: asStringArray(product.tags),
    variantTitles: asStringArray(product.variants, "title"),
    images: asStringArray(product.images, "src"),
    publishedAt,
  };
}

async function fetchFeedPage(source: ArrivalSource, page: number): Promise<ShopifyProduct[]> {
  const url = `https://${source.domain}/products.json?limit=${FEED_PAGE_SIZE}&page=${page}`;
  const res = await fetch(url, {
    // Accept-Language가 있으면 스토어가 요청 IP의 국가용 목록으로 줄여서 응답한다(DEDCOOL: 181건 → 152건).
    // fetch가 기본값("*")을 붙이지 않도록 빈 값으로 보내 스토어의 기본 목록을 받는다.
    headers: { "User-Agent": DESKTOP_USER_AGENT, Accept: "application/json", "Accept-Language": "" },
    cache: "no-store",
    signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${source.domain} feed ${res.status}`);

  const data = (await res.json()) as { products?: unknown };
  return Array.isArray(data.products) ? (data.products as ShopifyProduct[]) : [];
}

/** 한 브랜드의 제품 피드 전체를 가져온다 (페이지가 가득 차면 다음 페이지도) */
async function fetchSource(source: ArrivalSource): Promise<RawArrival[]> {
  const collected: RawArrival[] = [];
  for (let page = 1; page <= FEED_MAX_PAGES; page++) {
    const products = await fetchFeedPage(source, page);
    for (const product of products) {
      const raw = toRawArrival(source, product);
      if (raw) collected.push(raw);
    }
    if (products.length < FEED_PAGE_SIZE) break;
  }
  return collected;
}

/**
 * 모든 브랜드의 제품 피드를 병렬로 가져온다. 일부 브랜드가 실패해도 나머지로 진행하고,
 * 전부 실패했을 때만 에러를 던진다.
 */
export async function collectArrivals(
  sources: readonly ArrivalSource[] = ARRIVAL_SOURCES,
): Promise<{ collected: RawArrival[]; failedSources: number }> {
  const results = await Promise.allSettled(sources.map((source) => fetchSource(source)));

  const collected: RawArrival[] = [];
  let failedSources = 0;
  results.forEach((result, i) => {
    if (result.status === "fulfilled") {
      collected.push(...result.value);
    } else {
      failedSources += 1;
      console.error(`[arrivals] feed failed: ${sources[i].domain}`, result.reason);
    }
  });

  if (sources.length > 0 && failedSources === sources.length) {
    throw new Error("브랜드 제품 피드를 모두 가져오지 못했습니다.");
  }

  return { collected, failedSources };
}
