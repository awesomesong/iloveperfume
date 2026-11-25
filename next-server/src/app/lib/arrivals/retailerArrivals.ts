import {
  BACKFILL_BATCH_SIZE,
  MAX_IMAGES,
  MIN_BODY_LENGTH,
  REQUEST_GAP_MS,
  RETAILERS,
  RETAILER_PAGES_PER_RUN,
  RETAILER_RESERVE_MS,
  RETAILER_SEARCH_TIMEOUT_MS,
} from "./config";
import { describeArrivals } from "./describeArrivals";
import { pickSpread, productShaped } from "./discoverBrands";
import { cleanName, excludeExisting } from "./filterArrivals";
import { looksLikePerfume } from "./perfumeSignals";
import { checkAccess } from "./probeSource";
import { saveAsFragrances } from "./saveAsFragrances";
import { fetchText, isPast, isRateLimited, parseProductPage, readSitemap, sleep, type ProductPage } from "./siteData";
import { loadClosedBrands, newsStore, recordArticles, type ClosedBrand } from "./sourceStore";
import { effectiveTextLength, toKey } from "./text";
import { UNKNOWN_FIRST_SEEN, type ArrivalCandidate, type DescribedArrival, type ValidationRejectReason } from "./types";
import { webSearchJson } from "./webSearch";

/**
 * 공식 사이트를 읽을 수 없는 브랜드(디올·에르메스 등)의 기존 향수.
 * 판매처 상품 페이지에서는 "그 브랜드의 어떤 향수가 국내에서 팔리는지"와 이미지만 얻고,
 * 내용(이름·노트·향 설명)은 그 브랜드의 공식 도메인으로만 제한한 웹 검색으로 공식 상품 페이지에서 가져온다.
 * 가져온 글은 공식 사이트 소개문과 똑같이 다룬다 — describeArrivals가 그 글에 있는 노트만 받고 한국어 소개를 쓴다.
 * 공식 페이지를 못 찾으면 등록하지 않는다(AI가 아는 지식으로 채우지 않는다). 한 번 판정한 판매처 주소는 기록해 다시 검색하지 않는다.
 */

const SYSTEM_PROMPT = `너는 향수 브랜드의 공식 사이트에서 특정 향수의 상품 페이지를 찾는다.
- 검색 결과에서 그 향수의 공식 상품 페이지를 찾았을 때만 found를 true로 한다. 농도(오 드 퍼퓸·오 드 뚜왈렛 등)가 다른 제품이거나 같은 향수인지 확실하지 않으면 false다.
- name: 그 페이지에 적힌 제품명 그대로.
- url: 그 상품 페이지 주소.
- text: 그 페이지에 적힌 향 설명과 노트를 원문 그대로 옮긴다. 번역·요약하지 않고, 페이지에 없는 내용을 보태지 않는다.
- found가 false면 나머지는 빈 문자열로 둔다.`;

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["found", "name", "url", "text"],
  properties: { found: { type: "boolean" }, name: { type: "string" }, url: { type: "string" }, text: { type: "string" } },
};

const bareHost = (host: string) => host.toLowerCase().replace(/^www\./, "");
const isOnHosts = (url: string, hosts: readonly string[]) => {
  try {
    const host = bareHost(new URL(url).hostname);
    return hosts.some((official) => host === official || host.endsWith(`.${official}`));
  } catch {
    return false;
  }
};

type OfficialPage = { name: string; url: string; text: string };

/** 브랜드 공식 도메인 안에서만 검색해 그 향수의 공식 상품 페이지 내용을 가져온다. 못 찾았거나 출처가 공식 도메인이 아니면 null */
async function findOfficialPage(brand: ClosedBrand, retailerName: string, apiKey: string): Promise<OfficialPage | null> {
  const hosts = brand.hosts.map(bareHost);
  const { text, sourceUrls } = await webSearchJson({
    apiKey,
    input: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify({ brand: brand.brand, perfume: retailerName }) },
    ],
    schemaName: "official_perfume_page",
    schema: RESPONSE_SCHEMA,
    timeoutMs: RETAILER_SEARCH_TIMEOUT_MS,
    allowedDomains: hosts,
  });
  let page: Partial<OfficialPage> & { found?: boolean };
  try {
    page = JSON.parse(text) as typeof page;
  } catch {
    return null;
  }
  const { name = "", url = "", text: body = "" } = page;
  // 검색이 실제로 공식 도메인의 페이지를 읽었고, 답의 주소도 공식 도메인이어야 한다
  if (!page.found || !name.trim() || !isOnHosts(url, hosts) || !sourceUrls.some((source) => isOnHosts(source, hosts))) return null;
  if (effectiveTextLength(body) < MIN_BODY_LENGTH) return null;
  return { name: name.trim(), url, text: body };
}

function toCandidate(brand: ClosedBrand, product: ProductPage, official: OfficialPage): ArrivalCandidate {
  const brandNames = [brand.brand, ...brand.aliases];
  const name = cleanName(official.name, brandNames);
  return {
    brand: brand.brand,
    name,
    title: official.name,
    nameKey: toKey(name),
    brandNames,
    officialUrl: official.url,
    bodyText: official.text,
    category: "perfume",
    images: product.images.filter((src) => src.startsWith("https://")).slice(0, MAX_IMAGES),
    firstSeenAt: UNKNOWN_FIRST_SEEN,
  };
}

/** 판정이 끝나지 않은 탈락 — 판매처 주소를 기록하지 않고 다음에 다시 본다 */
const RETRYABLE: readonly ValidationRejectReason[] = ["noResponse", "overLimit"];

export type RetailerFillOptions = {
  /** 열어 볼 판매처 상품 페이지 수 */
  pages?: number;
  deadline: number;
  /** true면 저장·기록 없이 결과만 돌려준다 */
  dryRun?: boolean;
};

export type RetailerFillResult = {
  brands: number;
  pagesRead: number;
  /** 대상 브랜드의 향수 단품으로 확인한 상품 수 */
  matched: number;
  /** 공식 페이지를 찾은 수 */
  found: number;
  saved: number;
  skipped: Record<string, number>;
  durationMs: number;
  preview?: DescribedArrival[];
};

export async function runRetailerFill({ pages = RETAILER_PAGES_PER_RUN, deadline, dryRun = false }: RetailerFillOptions): Promise<RetailerFillResult> {
  const startedAt = Date.now();
  const result: RetailerFillResult = { brands: 0, pagesRead: 0, matched: 0, found: 0, saved: 0, skipped: {}, durationMs: 0, ...(dryRun && { preview: [] }) };
  const skip = (reason: string) => (result.skipped[reason] = (result.skipped[reason] ?? 0) + 1);
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY missing");

  const brands = await loadClosedBrands();
  result.brands = brands.length;
  const brandByName = new Map(brands.flatMap((brand) => [brand.brand, ...brand.aliases].map((name) => [toKey(name), brand] as const)));
  const done = await newsStore.seenArticles(brands.map((brand) => brand.sourceId));
  const hasTime = () => Date.now() + RETAILER_RESERVE_MS < deadline;

  /** 공식 페이지까지 찾은 후보와 그 후보가 나온 판매처 주소 */
  let batch: { candidate: ArrivalCandidate; brand: ClosedBrand; retailerUrl: string }[] = [];
  const outcomes: { sourceId: string; url: string; saved: boolean; publishedAt: Date }[] = [];
  const finish = (brand: ClosedBrand, url: string, saved: boolean) => outcomes.push({ sourceId: brand.sourceId, url, saved, publishedAt: new Date(startedAt) });

  /** 모아 둔 후보를 기존 단계(중복 제외 → LLM 작성·검증 → 저장)로 넘긴다 */
  const flush = async () => {
    const pending = batch;
    batch = [];
    if (pending.length === 0) return;
    const fresh = new Set(await excludeExisting(pending.map((item) => item.candidate)));
    const { accepted, rejected } = await describeArrivals(pending.map((item) => item.candidate).filter((candidate) => fresh.has(candidate)));
    const { saved } = dryRun ? { saved: 0 } : await saveAsFragrances(accepted);
    result.saved += saved;
    result.preview?.push(...accepted);
    const acceptedSet = new Set(accepted.map((item) => item.candidate));
    const reasonByUrl = new Map(rejected.map((item) => [item.officialUrl, item.reason]));
    for (const { candidate, brand, retailerUrl } of pending) {
      const reason = fresh.has(candidate) ? reasonByUrl.get(candidate.officialUrl) : "alreadyRegistered";
      if (reason) skip(reason);
      if (!reason || !RETRYABLE.includes(reason as ValidationRejectReason)) finish(brand, retailerUrl, acceptedSet.has(candidate));
    }
  };

  for (const retailer of brands.length > 0 ? RETAILERS : []) {
    const access = await checkAccess(retailer.host);
    if (!access.ok) continue;
    const sitemap = await readSitemap(retailer.host, access.robots, { exhaustive: true, deadline });
    const urls = productShaped(sitemap.productUrls).filter((url) => !done.has(url)).sort();
    for (const [index, url] of pickSpread(urls, pages, Math.floor(startedAt / 86_400_000)).entries()) {
      if (!hasTime()) break;
      if (index > 0) await sleep(REQUEST_GAP_MS);
      const fetched = await fetchText(url, "text/html");
      if (!fetched || isRateLimited(fetched.status)) break;
      result.pagesRead += 1;
      const product = fetched.status === 200 ? parseProductPage(url, fetched.text) : null;
      const brand = product ? brandByName.get(toKey(product.brand)) : undefined;
      if (!product || !brand) continue;
      if (!looksLikePerfume(product.name, product.category) || product.images.length === 0) {
        finish(brand, url, false);
        continue;
      }
      result.matched += 1;

      // 이미 등록된 향수면 검색 비용을 쓰지 않는다 (판매처의 한글 이름으로 먼저 견준다)
      const brandNames = [brand.brand, ...brand.aliases];
      const retailerName = cleanName(product.name, brandNames);
      const known = await excludeExisting([{ ...toCandidate(brand, product, { name: product.name, url, text: "" }), name: retailerName, nameKey: toKey(retailerName) }]);
      if (known.length === 0) {
        skip("alreadyRegistered");
        finish(brand, url, false);
        continue;
      }
      if (isPast(deadline - RETAILER_RESERVE_MS - RETAILER_SEARCH_TIMEOUT_MS)) break; // 검색을 끝낼 시간이 없다 — 다음 실행에서
      const official = await findOfficialPage(brand, product.name, apiKey);
      if (!official) {
        skip("officialPageNotFound");
        finish(brand, url, false);
        continue;
      }
      result.found += 1;
      batch.push({ candidate: toCandidate(brand, product, official), brand, retailerUrl: url });
      if (batch.length >= BACKFILL_BATCH_SIZE) await flush();
    }
  }
  await flush();
  if (!dryRun) await recordArticles(outcomes);

  result.durationMs = Date.now() - startedAt;
  console.log("[arrivals] retailer fill", JSON.stringify({ ...result, preview: undefined, dryRun }));
  return result;
}
