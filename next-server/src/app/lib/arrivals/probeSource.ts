import { PROBE_MAX_PAGES, REQUEST_GAP_MS } from "./config";
import { pageToRaw, shopifyToRaw } from "./collectArrivals";
import { isPerfumeArrival, perfumeUrlScore } from "./perfumeSignals";
import { isPathAllowed, type RobotsRules } from "./robots";
import {
  fetchRobots,
  fetchShopifyProducts,
  fetchShopifyShop,
  fetchText,
  isPast,
  isRateLimited,
  looksLikeProductUrl,
  parseProductPage,
  readSitemap,
  sleep,
} from "./siteData";
import type { ArrivalSource, ArrivalSourceKind } from "./types";

/**
 * 사이트 자동 판정 — 사람 확인 없이 "이 사이트에서 향수 신제품을 읽어 올 수 있는가"를 정한다.
 * 1) 접근: 홈이 자동 요청을 막거나(401·403·503) robots.txt가 수집을 금지하면 수집하지 않는다 (우회하지 않는다)
 * 2) 구조: Shopify 상품 목록 → 없으면 사이트맵 + 상품 페이지의 구조화 데이터(JSON-LD·Open Graph)
 * 3) 향수: 수집과 같은 판별 규칙(isPerfumeArrival)으로 향수 단품을 하나라도 읽을 수 있어야 한다
 * 소개문이 충분한지는 사이트 단위로 보지 않는다 — 수집 단계가 제품마다 본다(표본 몇 개로는 판정이 흔들렸다).
 * 요청 과다(429)·응답 없음·시간 부족은 탈락이 아니라 "나중에 다시"(retry)다.
 */

export type ProbeVerdict =
  | { outcome: "collectable"; kind: ArrivalSourceKind; /** 원화로 팔거나 한국 주소가 있는 한국 스토어 */ koreanStore: boolean; reason: string }
  | { outcome: "rejected"; reason: string }
  | { outcome: "retry"; reason: string };

const retry = (reason: string): ProbeVerdict => ({ outcome: "retry", reason });
const rejected = (reason: string): ProbeVerdict => ({ outcome: "rejected", reason });

export type Access = { ok: true; robots: RobotsRules } | { ok: false; verdict: ProbeVerdict };

/** 접근 판정 — 판매처(discoverBrands)와 공식 사이트가 같은 기준을 쓴다 */
export async function checkAccess(host: string): Promise<Access> {
  const home = await fetchText(`https://${host}/`, "text/html");
  if (!home) return { ok: false, verdict: retry("홈 응답 없음") };
  if (isRateLimited(home.status)) return { ok: false, verdict: retry("요청 과다(429)") };
  if ([401, 403, 503].includes(home.status)) return { ok: false, verdict: rejected(`자동 요청을 막는 사이트 (홈 ${home.status})`) };
  if (home.status >= 500) return { ok: false, verdict: retry(`홈 ${home.status}`) };
  if (home.status !== 200) return { ok: false, verdict: rejected(`홈 ${home.status}`) };

  const robots = await fetchRobots(host);
  if (!isPathAllowed(robots, "/")) return { ok: false, verdict: rejected("robots.txt가 수집을 허용하지 않음") };
  return { ok: true, robots };
}

/** 판정 중에만 쓰는 임시 수집 대상 — 수집과 같은 변환 함수(shopifyToRaw·pageToRaw)를 쓰기 위한 것 */
const probeSourceOf = (host: string): ArrivalSource => ({ id: host, brand: "", aliases: [], host, kind: "SHOPIFY", baselineAt: null });

const KOREAN_HOST = /(?:^kr\.|\.kr$)/i;

async function probeShopify(host: string, robots: RobotsRules): Promise<ProbeVerdict | null> {
  if (!isPathAllowed(robots, "/products.json")) return null;
  const feed = await fetchShopifyProducts(host, 1);
  if (!feed.ok) return feed.reason === "rateLimited" ? retry("상품 목록 요청 과다(429)") : null;

  const source = probeSourceOf(host);
  const perfumes = feed.products.filter((product) => {
    const raw = shopifyToRaw(source, product);
    return raw !== null && isPerfumeArrival(raw);
  }).length;
  if (feed.products.length === 0) return null; // 목록이 비어 있으면 사이트맵으로 다시 본다
  if (perfumes === 0) return rejected(`Shopify 상품 ${feed.products.length}건 중 향수 단품이 없음`);

  const shop = await fetchShopifyShop(host);
  return {
    outcome: "collectable",
    kind: "SHOPIFY",
    koreanStore: shop?.currency === "KRW" || shop?.country === "KR" || KOREAN_HOST.test(host),
    reason: `Shopify 상품 목록 — 첫 페이지 ${feed.products.length}건 중 향수 ${perfumes}건`,
  };
}

async function probeSitemap(host: string, robots: RobotsRules, deadline?: number): Promise<ProbeVerdict> {
  const sitemap = await readSitemap(host, robots, { deadline });
  if (sitemap.rateLimited) return retry("사이트맵 요청 과다(429)");
  if (sitemap.productUrls.length === 0) {
    return sitemap.incomplete
      ? retry("사이트맵을 읽지 못함")
      : rejected(`사이트맵에 상품 주소가 없음 (전체 ${sitemap.totalUrls}건)`);
  }

  // 상품 주소 형식이 뚜렷하고 향수일 가능성이 높은 주소부터 연다. 홈·바디 제품 주소는 열지 않는다.
  // 주소로는 구분되지 않을 때(탬버린즈 "/item/S12500601/")는 목록 전체에서 고르게 뽑는다 — 앞쪽만 열면 한 종류에 몰린다
  const ranked = sitemap.productUrls
    .map((url) => ({ url, rank: Number(looksLikeProductUrl(url)) * 10 + perfumeUrlScore(url), score: perfumeUrlScore(url) }))
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => b.rank - a.rank);
  const top = ranked.filter((entry) => entry.rank === ranked[0]?.rank);
  const step = Math.max(1, Math.floor(top.length / PROBE_MAX_PAGES));
  const spread = top.filter((_, index) => index % step === 0);
  const urls = [...spread, ...ranked.filter((entry) => !spread.includes(entry))].slice(0, PROBE_MAX_PAGES);

  const source = probeSourceOf(host);
  let parsed = 0;
  for (const [index, { url }] of urls.entries()) {
    if (isPast(deadline)) return retry("시간 부족 — 다음에 이어서 판정");
    if (index > 0) await sleep(REQUEST_GAP_MS);
    const fetched = await fetchText(url, "text/html");
    if (!fetched) continue;
    if (isRateLimited(fetched.status)) return retry("상품 페이지 요청 과다(429)");
    if ([401, 403].includes(fetched.status)) return rejected(`상품 페이지가 자동 요청을 막음 (${fetched.status})`);

    const page = fetched.status === 200 ? parseProductPage(url, fetched.text) : null;
    if (!page) continue;
    parsed += 1;
    if (!isPerfumeArrival(pageToRaw(source, page, new Date()))) continue;
    return {
      outcome: "collectable",
      kind: "SITEMAP",
      koreanStore: page.currencies.includes("KRW") || page.koreanAddress || KOREAN_HOST.test(host),
      reason: `사이트맵 상품 주소 ${sitemap.productUrls.length}건, 상품 페이지에서 향수 확인 (${page.name})`,
    };
  }
  return rejected(
    parsed === 0
      ? `상품 페이지 ${urls.length}개에서 상품 정보(JSON-LD·Open Graph)를 읽지 못함`
      : `상품 페이지 ${parsed}개를 읽었지만 향수 단품이 없음`,
  );
}

/** host(예: "www.loewe.com")가 수집 가능한지 판정한다. deadline을 주면 그 시각을 넘기지 않는다 */
export async function probeSource(host: string, deadline?: number): Promise<ProbeVerdict> {
  const access = await checkAccess(host);
  if (!access.ok) return access.verdict;
  return (await probeShopify(host, access.robots)) ?? (await probeSitemap(host, access.robots, deadline));
}
