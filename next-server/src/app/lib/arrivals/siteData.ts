import { gunzipSync } from "node:zlib";
import { DESKTOP_USER_AGENT, FEED_PAGE_SIZE, FEED_TIMEOUT_MS } from "./config";
import { EMPTY_ROBOTS, isPathAllowed, parseRobots, type RobotsRules } from "./robots";
import { htmlToText } from "./text";

/**
 * 외부 사이트 읽기 — 요청, robots.txt, 사이트맵, 상품 페이지(JSON-LD·Open Graph), Shopify 상품 목록.
 * 수집(collectArrivals)·사이트 판정(probeSource)·판매처 브랜드 찾기(discoverBrands)가 함께 쓴다.
 */

export type Fetched = { status: number; text: string; contentType: string };

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** 요청 과다 — 탈락이 아니라 "나중에 다시"로 다룬다 */
export const isRateLimited = (status: number) => status === 429;

export async function fetchText(url: string, accept = "*/*"): Promise<Fetched | null> {
  try {
    const res = await fetch(url, {
      // Accept-Language가 있으면 스토어가 요청 IP의 국가용 목록으로 줄여서 응답한다(DEDCOOL: 181건 → 152건).
      // fetch가 기본값("*")을 붙이지 않도록 빈 값으로 보내 스토어의 기본 목록을 받는다.
      headers: { "User-Agent": DESKTOP_USER_AGENT, Accept: accept, "Accept-Language": "" },
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
    });
    const buffer = Buffer.from(await res.arrayBuffer());
    const gzipped = buffer[0] === 0x1f && buffer[1] === 0x8b;
    return {
      status: res.status,
      text: (gzipped ? gunzipSync(buffer) : buffer).toString("utf8"),
      contentType: res.headers.get("content-type") ?? "",
    };
  } catch {
    return null;
  }
}

/** robots.txt 규칙. 파일이 없거나 읽지 못하면 제한 없음으로 본다 */
export async function fetchRobots(host: string): Promise<RobotsRules> {
  const fetched = await fetchText(`https://${host}/robots.txt`, "text/plain");
  return fetched?.status === 200 ? parseRobots(fetched.text) : EMPTY_ROBOTS;
}

// ───────── 상품 페이지 (JSON-LD · Open Graph) ─────────

type JsonObject = Record<string, unknown>;

function jsonLdNodes(html: string): JsonObject[] {
  const nodes: JsonObject[] = [];
  const pattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const visit = (value: unknown) => {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === "object") {
      const node = value as JsonObject;
      nodes.push(node);
      if (node["@graph"]) visit(node["@graph"]);
    }
  };
  for (const match of html.matchAll(pattern)) {
    try {
      visit(JSON.parse(match[1].trim()));
    } catch {
      // 깨진 블록은 건너뛴다
    }
  }
  return nodes;
}

const hasType = (node: JsonObject, type: string) =>
  node["@type"] === type || (Array.isArray(node["@type"]) && node["@type"].includes(type));

/** 글자 값 — 문자열이거나 { name } 객체(Brand 등)면 그 이름 */
export const asText = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && typeof (value as JsonObject).name === "string") {
    return (value as JsonObject).name as string;
  }
  return "";
};

function imageUrls(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(imageUrls);
  if (value && typeof value === "object") {
    const node = value as JsonObject;
    return imageUrls(node.url ?? node.contentUrl);
  }
  return [];
}

function offerList(offers: unknown): JsonObject[] {
  const list = Array.isArray(offers) ? offers : offers ? [offers] : [];
  return list.filter((offer): offer is JsonObject => Boolean(offer) && typeof offer === "object");
}

function hasKoreanAddress(nodes: JsonObject[]): boolean {
  return nodes.some((node) => {
    const text = JSON.stringify([node.address, node.hasShippingService, node.areaServed]);
    return /"addressCountry"\s*:\s*"KR"|"(?:KR|Korea|South Korea)"/.test(text);
  });
}

function metaContent(html: string, key: string): string {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]*content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${escaped}["']`,
    "i",
  );
  const match = html.match(pattern);
  return htmlToText(match?.[1] ?? match?.[2] ?? "");
}

/** 상품 주소처럼 보이는 경로 (Shopify·Cafe24·imweb 등 흔한 형식) */
const PRODUCT_PATH = /\/(?:products?|items?|shop_view|goods|p)\/|[?&](?:idx|product_no|goodsno)=/i;

/** 상품이 아닌 주소 — 카테고리·목록·게시판·안내 페이지 (Cafe24 "/category/perfume/24/", "/product/list.html?cate_no=24") */
const NON_PRODUCT_PATH =
  /\/(?:category|categories|board|blog|news|journal|articles?|pages?|shopinfo|member|events?|magazine|stories|story|search|cart|account|login|list\.html)(?:[/?]|$)|[?&]cate(?:gory)?_?(?:no|id)=/i;

const isNonProductUrl = (pathAndSearch: string) => NON_PRODUCT_PATH.test(pathAndSearch);

/**
 * 개별 상품 주소처럼 보이는지 — 상품 경로 형식이거나, 상품 번호(숫자 4자리 이상)가 있거나,
 * 마지막 경로가 상품 코드로 시작한다(이솝 "FR21.html", 반클리프 아펠 "vcarpat300---…", 탬버린즈 "S12500601").
 * 카테고리·기획전·홈("/kr/shop/perfume")은 Open Graph 태그가 있어도 상품으로 읽지 않는다.
 */
export function looksLikeProductUrl(url: string): boolean {
  try {
    const { pathname, search } = new URL(url);
    if (isNonProductUrl(pathname + search)) return false;
    const last = pathname.split("/").filter(Boolean).pop() ?? "";
    return PRODUCT_PATH.test(pathname + search) || /\d{4,}/.test(pathname) || /^[a-z]{0,8}\d{2,}/i.test(last);
  } catch {
    return false;
  }
}

/** 구조화 데이터의 글자 값을 일반 텍스트로 — 태그가 엔티티로 한 번 더 감싸인 경우("&lt;br&gt;")가 있어 두 번 푼다 */
const plainText = (value: unknown) => htmlToText(htmlToText(asText(value)));

/** 상품 페이지에서 읽은 값 */
export type ProductPage = {
  url: string;
  name: string;
  brand: string;
  description: string;
  images: string[];
  /** 카테고리·경로 표시(BreadcrumbList) 또는 주소 경로 — 향수 여부 판단에 쓴다 */
  category: string;
  currencies: string[];
  inStock: boolean;
  /** 같은 페이지의 상점 정보에 한국 주소·배송이 있는지 */
  koreanAddress: boolean;
};

/**
 * 상품 페이지 HTML에서 상품 정보를 읽는다. 없으면 null.
 * 1) JSON-LD Product (용량별 변형을 묶은 ProductGroup 포함 — 이솝 한국몰)
 * 2) 없으면 Open Graph 메타 태그 — 개별 상품 주소일 때만 (로에베처럼 JSON-LD를 쓰지 않는 사이트)
 * 소개문은 구조화 데이터·og·meta 설명 가운데 가장 긴 것을 쓴다 (구조화 데이터 설명이 짧은 요약인 사이트가 있다).
 */
export function parseProductPage(url: string, html: string): ProductPage | null {
  const nodes = jsonLdNodes(html);
  const product = nodes.find((node) => hasType(node, "Product") || hasType(node, "ProductGroup"));
  const metaDescription = [metaContent(html, "og:description"), metaContent(html, "description")];
  const longest = (texts: string[]) => texts.reduce((best, text) => (text.length > best.length ? text : best), "");

  if (!product) {
    const title = metaContent(html, "og:title");
    const description = longest(metaDescription);
    if (!looksLikeProductUrl(url) || !title || !description) return null;
    const currency = metaContent(html, "product:price:currency") || metaContent(html, "og:price:currency");
    return {
      url,
      // 제목 끝의 " - LOEWE International official website" 같은 사이트 이름은 뗀다
      name: title.split(/\s[-|–]\s/)[0].trim(),
      brand: metaContent(html, "og:site_name"),
      description,
      images: [metaContent(html, "og:image")].filter(Boolean),
      category: decodeURIComponent(new URL(url).pathname).replace(/[/_-]+/g, " "),
      currencies: currency ? [currency] : [],
      inStock: false,
      koreanAddress: false,
    };
  }

  const crumbs = nodes
    .filter((node) => hasType(node, "BreadcrumbList"))
    .flatMap((node) => (Array.isArray(node.itemListElement) ? node.itemListElement : []))
    .map((item) => asText((item as JsonObject).name));
  const variants = Array.isArray(product.hasVariant) ? (product.hasVariant as JsonObject[]) : [];
  const offers = [...offerList(product.offers), ...variants.flatMap((variant) => offerList(variant?.offers))];

  return {
    url,
    name: plainText(product.name),
    brand: plainText(product.brand),
    description: longest([plainText(product.description), ...metaDescription]),
    // 묶음 상품(ProductGroup)은 이미지가 변형 쪽에만 있거나 아예 없다(이솝 한국몰) — 변형, og:image 순으로 채운다
    images: [...new Set([...imageUrls(product.image), ...variants.flatMap((variant) => imageUrls(variant?.image)), metaContent(html, "og:image")])].filter(Boolean),
    category: [asText(product.category), ...crumbs].join(" "),
    currencies: offers.map((offer) => asText(offer.priceCurrency)).filter(Boolean),
    inStock: offers.some((offer) => /InStock/i.test(asText(offer.availability))),
    koreanAddress: hasKoreanAddress(nodes),
  };
}

// ───────── 기사 페이지 ─────────

/** 기사 본문이 아닌 영역 — 메뉴·광고·댓글·관련 기사 목록 */
const NON_ARTICLE_BLOCK = /<(script|style|noscript|nav|header|footer|aside|form|figure|figcaption|button|select|iframe)\b[\s\S]*?<\/\1>/gi;
/** 본문 문장으로 보는 줄의 최소 길이 — 메뉴·관련 기사 제목은 이보다 짧다 */
const ARTICLE_LINE_MIN = 40;
/** 본문 사이에 끼는 짧은 줄(사진 설명·소제목)을 이만큼까지는 본문에 이어 붙인다 */
const ARTICLE_GAP_LINES = 2;
const ARTICLE_MIN_LENGTH = 200;

/** text: 본문(찾지 못하면 빈 문자열), image: 대표 이미지(og:image) */
export type ArticlePage = { text: string; image: string };

const compact = (text: string) => text.replace(/\s+/g, "").toLowerCase();

/**
 * 기사 페이지에서 본문 글과 대표 이미지를 읽는다.
 * 1) 구조화 데이터(JSON-LD articleBody)가 있으면 그것
 * 2) 없으면 긴 문장이 이어지는 가장 큰 덩어리 — 언론사마다 마크업이 달라 특정 태그·클래스에 기대지 않는다
 * keywords(브랜드 표기)를 주면 그중 하나가 들어 있는 덩어리만 본문으로 본다 — 하단 고지문·다른 기사 목록을 고르지 않기 위해서다.
 */
export function parseArticlePage(html: string, keywords: readonly string[] = []): ArticlePage {
  const image = metaContent(html, "og:image");
  const keys = keywords.map(compact).filter(Boolean);
  const mentions = (text: string) => keys.length === 0 || keys.some((key) => compact(text).includes(key));

  const structured = jsonLdNodes(html)
    .map((node) => plainText(node.articleBody))
    .reduce((best, text) => (text.length > best.length ? text : best), "");
  if (structured.length >= ARTICLE_MIN_LENGTH && mentions(structured)) return { text: structured, image };

  const lines = htmlToText(html.replace(NON_ARTICLE_BLOCK, " ")).split("\n");
  let best: string[] = [];
  let bestLength = 0;
  let run: string[] = [];
  let runLength = 0;
  let gap = 0;
  const close = () => {
    if (runLength > bestLength && mentions(run.join(" "))) [best, bestLength] = [run, runLength];
    [run, runLength, gap] = [[], 0, 0];
  };
  for (const line of lines) {
    if (line.length >= ARTICLE_LINE_MIN) {
      run.push(line);
      runLength += line.length;
      gap = 0;
    } else if (run.length > 0 && ++gap > ARTICLE_GAP_LINES) {
      close();
    }
  }
  close();
  return { text: bestLength >= ARTICLE_MIN_LENGTH ? best.join("\n") : "", image };
}

// ───────── 사이트맵 ─────────

const PRODUCT_SITEMAP_HINT = /product|item|goods|shop|catalog/i;
/** 사이트맵 파일이 상품 목록인지 — 파일 이름의 "sitemap"에 들어 있는 "item"은 세지 않는다 */
const isProductSitemap = (url: string) => PRODUCT_SITEMAP_HINT.test(url.replace(/sitemap/gi, ""));
const KOREAN_LOCALE_HINT = /(?:^|[-_/.])(?:kr|ko|ko[-_]kr)(?:[-_/.]|$)/i;
const ENGLISH_LOCALE_HINT = /(?:^|[-_/.])(?:en|us|usa|gb|uk|int)(?:[-_/.]|$)/i;
/** 사이트맵이 나라·언어별로 여러 겹인 사이트(프라다 73개 등)도 상품 목록까지 내려가도록 넉넉히 둔다 */
const MAX_SITEMAP_FILES = 20;
/** 판정에서는 상품 주소가 이만큼 모이면 다음 파일은 읽지 않는다 */
const ENOUGH_PRODUCT_URLS = 60;

/** 하위 사이트맵 우선순위 — 상품 목록, 한국어, 영어 순. 다른 나라·언어 사이트맵은 뒤로 미룬다 */
function sitemapPriority(url: string): number {
  return (
    (isProductSitemap(url) ? 4 : 0) +
    (KOREAN_LOCALE_HINT.test(url) ? 2 : ENGLISH_LOCALE_HINT.test(url) ? 1 : 0)
  );
}

export type SitemapRead = {
  /** robots.txt가 허용하는 상품 주소 (중복 없음, 사이트맵에 적힌 순서) */
  productUrls: string[];
  /** 상품 주소가 아닌 것까지 포함한 전체 주소 수 */
  totalUrls: number;
  rateLimited: boolean;
  /** 끝까지 읽지 못했다(응답 없음·5xx·시간 부족·파일 수 한도) — 주소가 없을 때 "없음"과 "일시 실패"를 가른다 */
  incomplete: boolean;
};

export type SitemapOptions = {
  /**
   * true(수집): 상품 주소가 나온 파일과 같은 등급(같은 나라·언어의 상품 목록)의 파일을 모두 읽는다 —
   *   새 상품이 어느 파일에 실릴지 모르기 때문이다.
   * false(판정·기본값): 상품 주소가 충분히 모이면 멈춘다.
   */
  exhaustive?: boolean;
  /** 이 시각(ms)을 넘기면 더 읽지 않는다 */
  deadline?: number;
};

export const isPast = (deadline?: number) => deadline !== undefined && Date.now() >= deadline;

/**
 * 상품 주소 형식이 따로 없는 작은 사이트("/ambre-khandjar"처럼 향수 이름이 곧 주소인 사이트)는
 * 사이트맵 주소가 이 수 이하일 때 전체를 후보로 본다. 상품인지는 상품 페이지의 구조화 데이터로 가린다.
 */
const SMALL_SITE_URLS = 300;

/** robots.txt에 Sitemap이 없을 때 찾아볼 흔한 위치 — 마지막은 PrestaShop 기본 위치(Room 1015·Obvious Parfums) */
const DEFAULT_SITEMAP_PATHS = ["/sitemap.xml", "/sitemap_index.xml", "/1_index_sitemap.xml"];

/**
 * robots.txt의 Sitemap(없으면 흔한 위치)에서 시작해 상품 주소를 모은다.
 * 사이트맵 묶음(index)은 여러 겹일 수 있어(나라별 → 상품별) 우선순위가 높은 파일부터 내려간다.
 * 같은 사이트는 실행마다 같은 파일을 읽는다(우선순위가 고정이라서).
 */
export async function readSitemap(host: string, robots: RobotsRules, options: SitemapOptions = {}): Promise<SitemapRead> {
  const roots = robots.sitemaps.length > 0 ? robots.sitemaps : DEFAULT_SITEMAP_PATHS.map((path) => `https://${host}${path}`);
  const queue = roots.map((url) => ({
    url,
    priority: sitemapPriority(url) + 10, // robots.txt에 적힌 것은 먼저 본다
  }));
  const visited = new Set<string>();
  const productUrls = new Set<string>();
  /** 상품 주소 형식은 아니지만 상품일 수 있는 주소 (홈·카테고리·안내 페이지 제외) */
  const looseUrls = new Set<string>();
  let totalUrls = 0;
  let files = 0;
  let incomplete = false;
  /** 상품 주소가 처음 나온 파일의 우선순위 */
  let productPriority: number | null = null;

  while (queue.length > 0) {
    queue.sort((a, b) => b.priority - a.priority);
    const { url, priority } = queue.shift()!;
    if (visited.has(url)) continue;
    if (productPriority !== null && priority < productPriority) break; // 다른 나라·언어, 상품이 아닌 목록
    if (files >= MAX_SITEMAP_FILES || isPast(options.deadline)) {
      incomplete = options.exhaustive === true || productUrls.size === 0;
      break;
    }
    visited.add(url);
    files += 1;

    const fetched = await fetchText(url, "application/xml,text/xml,*/*");
    if (fetched && isRateLimited(fetched.status)) {
      return { productUrls: [...productUrls], totalUrls, rateLimited: true, incomplete: true };
    }
    if (!fetched || fetched.status >= 500) incomplete = true;
    if (!fetched || fetched.status !== 200) continue;

    // 주소를 CDATA로 감싼 사이트맵(PrestaShop 등)도 같은 식으로 읽는다
    const xml = fetched.text.replace(/<!\[CDATA\[|\]\]>/g, "");
    if (/<sitemapindex/i.test(xml)) {
      for (const match of xml.matchAll(/<sitemap>[\s\S]*?<loc>\s*([^<]+?)\s*<\/loc>/gi)) {
        const loc = htmlToText(match[1]);
        queue.push({ url: loc, priority: sitemapPriority(loc) });
      }
      continue;
    }

    // 상품 전용 사이트맵(sitemap_0-product.xml 등)의 주소는 경로 형식과 관계없이 상품으로 본다 (카테고리·안내 페이지 제외).
    // 그 밖의 사이트맵에서는 상품 주소처럼 보이는 것만 고른다
    const productFile = isProductSitemap(url);
    const before = productUrls.size;
    for (const match of xml.matchAll(/<url>[\s\S]*?<loc>\s*([^<]+?)\s*<\/loc>/gi)) {
      totalUrls += 1;
      const loc = htmlToText(match[1]);
      try {
        const parsed = new URL(loc);
        const path = parsed.pathname + parsed.search;
        if (isNonProductUrl(path) || !isPathAllowed(robots, path)) continue;
        if (productFile || looksLikeProductUrl(loc)) productUrls.add(loc);
        else if (parsed.pathname.length > 1) looseUrls.add(loc);
      } catch {
        // 주소 형식이 아니면 건너뛴다
      }
    }
    if (productUrls.size > before && productPriority === null) productPriority = priority;
    if (!options.exhaustive && productUrls.size >= ENOUGH_PRODUCT_URLS) break;
  }
  const useLoose = productUrls.size === 0 && totalUrls <= SMALL_SITE_URLS;
  return { productUrls: [...(useLoose ? looseUrls : productUrls)], totalUrls, rateLimited: false, incomplete };
}

// ───────── Shopify 상품 목록 ─────────

export type ShopifyProduct = {
  title?: unknown;
  handle?: unknown;
  body_html?: unknown;
  published_at?: unknown;
  product_type?: unknown;
  tags?: unknown;
  variants?: unknown;
  images?: unknown;
};

export type ShopifyPage =
  | { ok: true; products: ShopifyProduct[] }
  /** rateLimited: 요청 과다, unavailable: Shopify 상품 목록이 없거나 읽지 못함 */
  | { ok: false; reason: "rateLimited" | "unavailable" };

/** Shopify 스토어의 상품 목록 한 페이지 (/products.json) */
export async function fetchShopifyProducts(host: string, page: number): Promise<ShopifyPage> {
  const fetched = await fetchText(`https://${host}/products.json?limit=${FEED_PAGE_SIZE}&page=${page}`, "application/json");
  if (fetched && isRateLimited(fetched.status)) return { ok: false, reason: "rateLimited" };
  if (!fetched || fetched.status !== 200 || !fetched.contentType.includes("json")) return { ok: false, reason: "unavailable" };
  try {
    const data = JSON.parse(fetched.text) as { products?: unknown };
    return Array.isArray(data.products)
      ? { ok: true, products: data.products as ShopifyProduct[] }
      : { ok: false, reason: "unavailable" };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

/** Shopify 스토어 정보 (/meta.json) — 통화와 나라. 없는 스토어도 있다 */
export async function fetchShopifyShop(host: string): Promise<{ currency: string; country: string } | null> {
  const fetched = await fetchText(`https://${host}/meta.json`, "application/json");
  if (fetched?.status !== 200) return null;
  try {
    const shop = JSON.parse(fetched.text) as JsonObject;
    return { currency: asText(shop.currency), country: asText(shop.country) };
  } catch {
    return null;
  }
}
