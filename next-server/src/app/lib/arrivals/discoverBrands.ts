import { DISCOVER_PAGES_PER_RUN, REQUEST_GAP_MS, type Retailer } from "./config";
import { looksLikePerfume } from "./perfumeSignals";
import { checkAccess } from "./probeSource";
import { fetchText, isPast, isRateLimited, parseProductPage, readSitemap, sleep, type ProductPage } from "./siteData";
import { toKey } from "./text";

/**
 * 브랜드 찾기 — 국내 판매처의 상품 데이터에서 "한국에서 살 수 있는 향수 브랜드" 목록을 만든다 (DB를 읽거나 쓰지 않는다).
 * 1) 판매처 접근 판정(공식 사이트와 같은 기준) → 2) 사이트맵의 상품 주소 → 3) 상품 페이지 구조화 데이터의 브랜드·이름
 * → 4) 향수 상품만 남겨 브랜드별로 묶는다. 영문 공식명과 공식 사이트는 다음 단계(resolveBrandSites)가 찾는다.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** 수집 대상 후보 브랜드 */
export type BrandLead = {
  /** 표기 차이(띄어쓰기·기호·대소문자)를 무시한 키 — 나르시소로드리게즈 = 나르시소 로드리게즈 */
  key: string;
  /** 판매처에 적힌 표기 (한글일 수 있다) */
  name: string;
  /** 후보가 나온 곳 — 판매처 이름 또는 "회원 등록". 한국에서 살 수 있다고 보는 근거다 */
  origin: string;
  /** 예시 상품명 — 공식 사이트를 찾을 때 같은 이름의 다른 브랜드와 구분하는 데 쓴다 */
  examples: string[];
};

const MAX_EXAMPLES = 3;

/** 판매처가 브랜드 칸에 넣었지만 브랜드가 아닌 값 — "[아울렛]" 같은 판매처 분류, 자체 상표·부자재, 판매처 이름 */
function isPseudoBrand(brand: string, retailer: Retailer): boolean {
  return /^\[.*\]$/.test(brand) || /자체\s*브랜드|부자재/.test(brand) || toKey(brand) === toKey(retailer.name);
}

/**
 * 읽은 상품을 브랜드별로 묶는다 (순수 함수). 향수가 아닌 상품(핸드크림·디퓨저·세트 등), 브랜드가 비어 있거나
 * 브랜드가 아닌 값은 뺀다. 표기만 다른 브랜드는 하나로 묶고 가장 많이 쓰인 표기를 남긴다.
 */
export function aggregateBrands(retailer: Retailer, products: readonly ProductPage[]): BrandLead[] {
  const byKey = new Map<string, { spellings: Map<string, number>; examples: string[] }>();
  for (const product of products) {
    const brand = product.brand.replace(/\s+/g, " ").trim();
    const key = toKey(brand);
    if (!key || isPseudoBrand(brand, retailer) || !looksLikePerfume(product.name, product.category)) continue;

    const entry = byKey.get(key) ?? { spellings: new Map<string, number>(), examples: [] };
    entry.spellings.set(brand, (entry.spellings.get(brand) ?? 0) + 1);
    if (entry.examples.length < MAX_EXAMPLES) entry.examples.push(product.name);
    byKey.set(key, entry);
  }
  return [...byKey].map(([key, { spellings, examples }]) => ({
    key,
    name: [...spellings].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko"))[0][0],
    origin: retailer.name,
    examples,
  }));
}

/** 판매처 상품 주소만 남긴다 — 숫자를 뺀 주소 모양이 가장 흔한 것이 상품 주소다 ("/shop_view/3989" 1,000건 vs 안내 페이지 "/1234" 179건) */
function productShaped(urls: readonly string[]): string[] {
  const shape = (url: string) => url.replace(/\d+/g, "N");
  const counts = new Map<string, number>();
  for (const url of urls) counts.set(shape(url), (counts.get(shape(url)) ?? 0) + 1);
  const top = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
  return urls.filter((url) => shape(url) === top);
}

/**
 * 이번에 읽을 주소를 목록 전체에서 고르게 뽑는다. 날마다 한 칸씩 밀려 (목록 길이 ÷ 읽는 수)일이면 전체를 한 번 돈다.
 * 앞에서부터 차례로 읽으면 같은 기획전·브랜드 상품이 몰려 있어 하루치가 한 브랜드로 끝난다.
 */
export function pickSpread(urls: readonly string[], count: number, offset: number): string[] {
  if (urls.length <= count) return [...urls];
  const step = Math.floor(urls.length / count);
  return Array.from({ length: count }, (_, i) => urls[((offset % step) + i * step) % urls.length]);
}

export type DiscoverOptions = {
  /** 이번에 읽을 상품 페이지 수 */
  maxPages?: number;
  /** 고르게 뽑을 때의 시작 위치. 없으면 날마다 한 칸씩 밀린다 */
  offset?: number;
  now?: Date;
  deadline?: number;
};

export type DiscoverResult = { leads: BrandLead[]; totalUrls: number; pagesRead: number; products: ProductPage[] };

/**
 * 판매처 상품 페이지를 일부 읽어 브랜드 후보를 모은다. 상품 페이지가 무거워 한 번에 조금씩 읽고,
 * 날마다 다른 상품을 읽어 판매처 전체를 돌아본다(새로 입점한 브랜드도 이때 잡힌다).
 * 판매처가 자동 요청을 막거나 robots.txt가 금지하면 읽지 않는다.
 */
export async function discoverBrandLeads(retailer: Retailer, options: DiscoverOptions = {}): Promise<DiscoverResult> {
  const { maxPages = DISCOVER_PAGES_PER_RUN, now = new Date(), deadline } = options;

  const access = await checkAccess(retailer.host);
  if (!access.ok) throw new Error(`${retailer.name}: ${access.verdict.reason}`);
  const sitemap = await readSitemap(retailer.host, access.robots, { exhaustive: true, deadline });
  if (sitemap.productUrls.length === 0) throw new Error(`${retailer.name}: 사이트맵에서 상품 주소를 찾지 못함`);

  const urls = productShaped(sitemap.productUrls).sort();
  const picked = pickSpread(urls, maxPages, options.offset ?? Math.floor(now.getTime() / DAY_MS));

  const products: ProductPage[] = [];
  let pagesRead = 0;
  for (const [index, url] of picked.entries()) {
    if (isPast(deadline)) break;
    if (index > 0) await sleep(REQUEST_GAP_MS);
    const fetched = await fetchText(url, "text/html");
    if (!fetched || isRateLimited(fetched.status)) break;
    pagesRead += 1;
    const page = fetched.status === 200 ? parseProductPage(url, fetched.text) : null;
    if (page) products.push(page);
  }
  return { leads: aggregateBrands(retailer, products), totalUrls: urls.length, pagesRead, products };
}
