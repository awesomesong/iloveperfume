import {
  COLLECT_BUDGET_MS,
  FEED_MAX_PAGES,
  FEED_PAGE_SIZE,
  LARGE_CATALOG_SIZE,
  REQUEST_GAP_MS,
  SITEMAP_NEW_URL_LIMIT,
  SITEMAP_PAGES_PER_RUN,
  SITEMAP_RETRY_DAYS,
  WINDOW_DAYS,
} from "./config";
import { isPerfumeArrival, perfumeUrlScore } from "./perfumeSignals";
import {
  asText,
  fetchRobots,
  fetchShopifyProducts,
  fetchText,
  isPast,
  isRateLimited,
  parseProductPage,
  readSitemap,
  sleep,
  type ProductPage,
  type ShopifyProduct,
} from "./siteData";
import { htmlToText } from "./text";
import { UNKNOWN_FIRST_SEEN, type ArrivalSource, type RawArrival } from "./types";

/**
 * 수집 — 등록된 공식 사이트에서 제품을 읽어 온다. 방식은 두 가지고 결과 모양(RawArrival)은 같다.
 * - SHOPIFY: 상품 목록(/products.json)을 통째로 읽는다. 게시일이 있어 신제품을 바로 가릴 수 있다.
 * - SITEMAP: 사이트맵의 상품 주소 가운데 처음 보는 것만 상품 페이지를 연다(게시일이 없어서 "처음 본 날"을 쓴다).
 */

const DAY_MS = 24 * 60 * 60 * 1000;

// ───────── SHOPIFY ─────────

const textArray = (value: unknown, key?: string): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asText(key ? (item as Record<string, unknown> | null)?.[key] : item))
    .filter(Boolean);
};

/** Shopify 상품 한 건을 정리한다. 제목·handle·게시일이 없으면 버린다 */
export function shopifyToRaw(source: ArrivalSource, product: ShopifyProduct): RawArrival | null {
  const title = asText(product.title).trim();
  const handle = asText(product.handle).trim();
  const publishedAt = new Date(asText(product.published_at));
  if (!title || !handle || Number.isNaN(publishedAt.getTime())) return null;

  return {
    source,
    title,
    url: `https://${source.host}/products/${encodeURIComponent(handle)}`,
    bodyText: htmlToText(asText(product.body_html)),
    category: asText(product.product_type).trim(),
    tags: textArray(product.tags),
    variantTitles: textArray(product.variants, "title"),
    images: textArray(product.images, "src"),
    publishedAt,
  };
}

/** 한 스토어의 상품 목록 전체 (페이지가 가득 차면 다음 페이지도) */
export async function collectShopify(source: ArrivalSource, deadline: number): Promise<RawArrival[]> {
  const collected: RawArrival[] = [];
  for (let page = 1; page <= FEED_MAX_PAGES; page++) {
    // 목록을 일부만 읽으면 예전 제품이 빠져 "처음 등장한 날"이 틀어진다 — 이번 실행은 건너뛴다
    if (page > 1 && isPast(deadline)) throw new Error("상품 목록을 시간 안에 다 읽지 못함");
    const result = await fetchShopifyProducts(source.host, page);
    if (!result.ok) {
      // 첫 페이지를 못 읽으면 실패. 뒤 페이지에서 막히면 읽은 데까지 쓴다
      if (page === 1) throw new Error(result.reason === "rateLimited" ? "상품 목록 요청 과다(429)" : "상품 목록을 읽지 못함");
      break;
    }
    for (const product of result.products) {
      const raw = shopifyToRaw(source, product);
      if (raw) collected.push(raw);
    }
    if (result.products.length < FEED_PAGE_SIZE) break;
  }
  return collected;
}

// ───────── SITEMAP ─────────

/** 사이트맵에서 본 상품 주소 — perfume: 향수인지(null이면 아직 열어 보지 않음) */
export type SeenUrl = { url: string; perfume: boolean | null; firstSeenAt: Date };

export type SeenChanges = {
  added: SeenUrl[];
  marked: { url: string; perfume: boolean }[];
  /** 이번에 기준선을 기록했다 */
  baseline: boolean;
};

/** "이미 본 주소" 저장소 — 실제로는 DB(sourceStore), 시험에서는 메모리 */
export type SeenStore = {
  load(sourceId: string): Promise<SeenUrl[]>;
  save(sourceId: string, changes: SeenChanges): Promise<void>;
  /** 아직 향수로 저장되지 않았고 차단 목록에도 없는 주소만 돌려준다 */
  unsaved(urls: string[]): Promise<Set<string>>;
};

/**
 * 같은 향수의 다른 용량 주소를 알아보는 키 — 주소에서 상품 이름 부분(영문 낱말이 하이픈으로 이어진 마지막 경로)을
 * 뽑고 용량 표기를 뺀다. 예) ".../miu-miu-miutine-eau-de-parfum-30ml/5A1002" → "miu-miu-miutine-eau-de-parfum"
 * 이름 부분이 없는 주소(상품 번호만 있는 주소)는 주소 전체가 키다.
 */
export function urlStem(url: string): string {
  try {
    const { pathname } = new URL(url);
    const slug = pathname
      .split("/")
      .reverse()
      .find((segment) => /[a-z]{2,}-[a-z0-9]/i.test(segment));
    if (!slug) return pathname.toLowerCase();
    return slug
      .toLowerCase()
      .replace(/\.[a-z]{2,5}$/, "")
      .replace(/-?\d+(?:[.,]\d+)?-?ml\b/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  } catch {
    return url;
  }
}

export function pageToRaw(source: ArrivalSource, page: ProductPage, firstSeenAt: Date): RawArrival {
  return {
    source,
    title: page.name,
    url: page.url,
    bodyText: page.description,
    // 분류를 적지 않은 사이트는 주소의 향수 표현을 분류로 쓴다 (킬리안 "/perfume/old-fashioned" — 이름은 향 이름뿐이다)
    category: page.category || (perfumeUrlScore(page.url) >= 2 ? "perfume" : ""),
    tags: [],
    variantTitles: [],
    images: page.images,
    publishedAt: firstSeenAt,
  };
}

/**
 * 사이트맵에서 지켜볼 상품 주소.
 * - 주소에 홈·바디 제품 표현이 있으면(향초·핸드크림 등) 열어 보지 않는다
 * - 상품이 아주 많은 종합 사이트(패션·주얼리)는 주소에 향수 표현이 있는 상품만 본다 — 가방·옷 페이지를 열지 않기 위해서다
 */
export function trackedUrls(productUrls: readonly string[]): string[] {
  const scored = productUrls.map((url) => ({ url, score: perfumeUrlScore(url) }));
  const perfumeMarked = scored.filter((entry) => entry.score > 0);
  const kept = productUrls.length > LARGE_CATALOG_SIZE && perfumeMarked.length > 0 ? perfumeMarked : scored.filter((entry) => entry.score >= 0);
  return kept.map((entry) => entry.url);
}

/**
 * 사이트맵 방식 수집.
 * 1) 첫 실행: 지금 있는 상품 주소를 기준선으로 기록만 한다 (기존 상품은 신제품이 아니다)
 * 2) 이후: 처음 보는 주소를 기록한다. 예전 상품의 다른 용량이거나(urlStem이 같으면) 이번에 함께 올라온
 *    같은 상품의 다른 용량·언어 주소면 열지 않는다. 한 번에 너무 많은 주소가 새로 보이면 신제품이 아니라
 *    사이트 개편(주소·사이트맵 구조 변경)으로 보고 기준선에 넣는다
 * 3) 기간 안에 처음 본 주소 가운데 아직 열어 보지 않은 것, 향수인데 아직 저장되지 않은 것(며칠간만)을 정해진 수만큼 연다
 */
async function collectSitemap(source: ArrivalSource, store: SeenStore, now: Date, deadline: number): Promise<RawArrival[]> {
  const robots = await fetchRobots(source.host);
  const sitemap = await readSitemap(source.host, robots, { exhaustive: true, deadline });
  if (sitemap.rateLimited) throw new Error("사이트맵 요청 과다(429)");
  if (sitemap.productUrls.length === 0) throw new Error("사이트맵에서 상품 주소를 찾지 못함");

  const seen = new Map((await store.load(source.id)).map((entry) => [entry.url, entry]));
  const unseen = trackedUrls(sitemap.productUrls).filter((url) => !seen.has(url));
  const baseline = !source.baselineAt;

  if (baseline || unseen.length > SITEMAP_NEW_URL_LIMIT) {
    // 일부만 읽은 목록으로 기준선을 잡으면 나머지 기존 상품이 다음에 신제품으로 보인다
    if (baseline && sitemap.incomplete) throw new Error("사이트맵을 끝까지 읽지 못해 기준선 기록을 미룸");
    if (!baseline) console.warn(`[arrivals] ${source.host}: 새 주소 ${unseen.length}건 — 사이트 개편으로 보고 기준선에 넣음`);
    const added = unseen.map((url) => ({ url, perfume: null, firstSeenAt: UNKNOWN_FIRST_SEEN }));
    await store.save(source.id, { added, marked: [], baseline });
    return [];
  }

  const windowStart = now.getTime() - WINDOW_DAYS * DAY_MS;
  const knownStems = new Set(
    [...seen.values()].filter((entry) => entry.firstSeenAt.getTime() < windowStart).map((entry) => urlStem(entry.url)),
  );
  const added = new Set<SeenUrl>();
  for (const url of unseen) {
    const stem = urlStem(url);
    const entry: SeenUrl = { url, perfume: knownStems.has(stem) ? false : null, firstSeenAt: now };
    knownStems.add(stem); // 뒤에 나오는 같은 상품의 다른 용량·언어 주소는 열지 않는다
    seen.set(url, entry);
    added.add(entry);
  }

  const recent = [...seen.values()].filter((entry) => entry.firstSeenAt.getTime() >= windowStart && entry.perfume !== false);
  const unsaved = await store.unsaved(recent.filter((entry) => entry.perfume).map((entry) => entry.url));
  const retryStart = now.getTime() - SITEMAP_RETRY_DAYS * DAY_MS;
  const queue = recent
    .filter((entry) => entry.perfume === null || (unsaved.has(entry.url) && entry.firstSeenAt.getTime() >= retryStart))
    .sort(
      (a, b) =>
        Number(a.perfume !== null) - Number(b.perfume !== null) || // 아직 열어 보지 않은 것 먼저
        perfumeUrlScore(b.url) - perfumeUrlScore(a.url) ||
        a.url.localeCompare(b.url),
    )
    .slice(0, SITEMAP_PAGES_PER_RUN);

  const { collected, changed } = await openPages(source, queue, deadline);
  const marked = changed.filter((entry) => !added.has(entry)).map(({ url, perfume }) => ({ url, perfume: perfume === true }));
  await store.save(source.id, { added: [...added], marked, baseline: false });
  return collected;
}

/**
 * 상품 페이지를 차례로 열어 향수 단품인지 본다 — 신제품 수집과 기존 향수 채우기가 함께 쓴다.
 * 판정은 entry.perfume에 적고, 값이 바뀐 것을 changed로, 연 페이지 수를 opened로 돌려준다. 시간이 다 되거나 요청이 막히면 멈춘다(남은 주소는 다음에).
 */
async function openPages(
  source: ArrivalSource,
  queue: readonly SeenUrl[],
  deadline: number,
): Promise<{ collected: RawArrival[]; changed: SeenUrl[]; opened: number }> {
  const collected: RawArrival[] = [];
  const changed: SeenUrl[] = [];
  let opened = 0;
  for (const [index, entry] of queue.entries()) {
    if (isPast(deadline)) break;
    if (index > 0) await sleep(REQUEST_GAP_MS);
    const fetched = await fetchText(entry.url, "text/html");
    if (!fetched || isRateLimited(fetched.status)) break;

    const page = fetched.status === 200 ? parseProductPage(entry.url, fetched.text) : null;
    const raw = page ? pageToRaw(source, page, entry.firstSeenAt) : null;
    const perfume = raw !== null && isPerfumeArrival(raw);
    if (entry.perfume !== perfume) changed.push(entry);
    entry.perfume = perfume;
    opened += 1;
    if (raw && perfume) collected.push(raw);
  }
  return { collected, changed, opened };
}

/**
 * 기존 향수 채우기용 — 기준선에 기록만 해 둔 상품 주소(처음 본 날을 모르는 것)를 limit개까지 열어 본다.
 * 아직 열어 보지 않은 주소와, 향수로 확인했지만 판정을 끝내지 못한 주소(앞선 실행이 중간에 실패한 경우)가 대상이다.
 * 이미 판정한 상품의 다른 용량 주소(urlStem이 같은 것)는 열지 않고 끝낸다.
 * opened는 이번에 연 페이지 수, pending은 열지 못하고 남은 주소 수 — 0이면 이 사이트는 더 열 것이 없다.
 */
export async function collectSitemapBacklog(
  source: ArrivalSource,
  store: SeenStore,
  limit: number,
  deadline: number,
): Promise<{ collected: RawArrival[]; opened: number; pending: number }> {
  const baseline = (await store.load(source.id)).filter((entry) => entry.firstSeenAt.getTime() === UNKNOWN_FIRST_SEEN.getTime());
  const unsaved = await store.unsaved(baseline.filter((entry) => entry.perfume).map((entry) => entry.url));
  const judgedStems = new Set(baseline.filter((entry) => entry.perfume !== null && !unsaved.has(entry.url)).map((entry) => urlStem(entry.url)));

  const queue: SeenUrl[] = [];
  const marked: SeenChanges["marked"] = [];
  const waiting = baseline
    .filter((entry) => entry.perfume === null || unsaved.has(entry.url))
    .sort((a, b) => perfumeUrlScore(b.url) - perfumeUrlScore(a.url) || a.url.localeCompare(b.url));
  for (const entry of waiting) {
    if (queue.length >= limit) break; // 뒤의 주소는 다음 묶음에서 본다
    const stem = urlStem(entry.url);
    if (judgedStems.has(stem)) marked.push({ url: entry.url, perfume: false });
    else {
      judgedStems.add(stem);
      queue.push(entry);
    }
  }

  const skipped = marked.length;
  const { collected, changed, opened } = await openPages(source, queue, deadline);
  marked.push(...changed.map(({ url, perfume }) => ({ url, perfume: perfume === true })));
  await store.save(source.id, { added: [], marked, baseline: false });
  return { collected, opened, pending: waiting.length - skipped - opened };
}

// ───────── 전체 ─────────

export type CollectResult = {
  collected: RawArrival[];
  /** 읽지 못한 수집 대상과 이유 */
  failed: { source: ArrivalSource; reason: string }[];
};

/** 수집 대상을 병렬로 읽는다(서로 다른 사이트). 일부가 실패해도 나머지로 진행한다 */
export async function collectArrivals(
  sources: readonly ArrivalSource[],
  store: SeenStore,
  now: Date = new Date(),
): Promise<CollectResult> {
  const deadline = Date.now() + COLLECT_BUDGET_MS;
  const results = await Promise.allSettled(
    sources.map((source) =>
      source.kind === "SHOPIFY" ? collectShopify(source, deadline) : collectSitemap(source, store, now, deadline),
    ),
  );

  const collected: RawArrival[] = [];
  const failed: CollectResult["failed"] = [];
  results.forEach((result, i) => {
    if (result.status === "fulfilled") {
      collected.push(...result.value);
    } else {
      const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
      failed.push({ source: sources[i], reason });
      console.error(`[arrivals] collect failed: ${sources[i].host} — ${reason}`);
    }
  });
  return { collected, failed };
}
