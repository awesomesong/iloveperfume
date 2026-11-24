import { collectNews, getDomain, parseHttpUrl } from "@/src/app/lib/news/collectNews";
import { BLOCKED_DOMAINS, EXCLUDE_KEYWORDS, TRUSTED_DOMAINS } from "@/src/app/lib/news/config";
import type { NewsCandidate } from "@/src/app/lib/news/types";
import {
  MAX_BODY_FOR_LLM,
  MAX_IMAGES,
  MIN_BODY_LENGTH,
  NEWS_ARTICLES_PER_BRAND,
  NEWS_LAUNCH_SIGNAL,
  NEWS_MAX_CANDIDATES,
  NEWS_SAME_RELEASE_DAYS,
  NEWS_TITLE_EXCLUDE,
  PERFUME_SIGNAL,
  WINDOW_DAYS,
} from "./config";
import { excludeExisting } from "./filterArrivals";
import { isPathAllowed } from "./robots";
import { fetchRobots, fetchText, isPast, isRateLimited, parseArticlePage } from "./siteData";
import { effectiveTextLength, toKey } from "./text";
import type { ArrivalCandidate, DescribedArrival, ValidationRejectReason, ValidationResult } from "./types";

/**
 * 출시 기사에서 등록 — 공식 사이트를 읽을 수 없는 브랜드(자동 요청 차단·robots.txt 금지·구조 없음)의 신제품을
 * 국내 언론의 출시 기사에서 찾는다. 공식 사이트 수집과 같은 LLM 호출·검증·저장을 쓴다.
 *
 * 공식 사이트 수집과 다른 점과 그에 맞춘 장치:
 * - 브랜드는 LLM이 정하지 않는다. 등록부의 브랜드 표기로 검색하고, 제목에 그 표기가 있는 기사만 본다
 * - 향수 이름은 기사에서 LLM이 읽는다 → 이름의 낱말이 기사에 실제로 있어야 하고, 등록 전 이름으로 중복을 확인한다
 * - 같은 보도자료를 여러 매체가 싣는다 → 며칠 안에 몰린 기사를 한 묶음으로 보고 한 건만 읽는다
 * - 팝업·실적·인터뷰 기사가 섞인다 → 제목 규칙으로 먼저 거르고, 출시 기사인지는 LLM이 판정한다
 * - 한 번 판단한 기사는 기록해 두고 다시 읽지 않는다 (ArrivalSeenUrl, article = true)
 * 기사 본문은 향수 이름·설명을 읽는 데만 쓰고 저장하지 않는다. robots.txt가 금지하거나 자동 요청을 막는 매체는 읽지 않는다.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** 출시 기사를 찾아볼 브랜드 — 등록부에 있지만 수집 중인 공식 사이트가 없는 브랜드 */
export type NewsBrand = {
  /** 브랜드의 등록부 행(ArrivalSource) id — 기사 주소를 이 행 아래에 기록한다 */
  sourceId: string;
  /** DB에 저장할 브랜드 표기 (영문 대문자) */
  brand: string;
  /** 판매처에 적힌 표기(한글 등) — 기사 검색어와 제목 대조에 쓴다 */
  aliases: string[];
};

export type LaunchArticle = {
  brand: NewsBrand;
  url: string;
  title: string;
  excerpt: string;
  publisher: string;
  publishedAt: Date;
  /** 뉴스 수집에 등록된 매체인지 — 같은 묶음에서 먼저 읽는다 */
  trusted: boolean;
};

/** 기사 한 건을 어떻게 끝냈는지 — saved: 이 기사로 향수를 등록했다 */
export type NewsOutcome = { sourceId: string; url: string; saved: boolean; publishedAt: Date };

/** 기사 기록 저장소 — 실제로는 DB(sourceStore), 시험에서는 메모리 */
export type NewsStore = {
  /** 이미 판단을 끝낸 기사 주소 */
  seenArticles(sourceIds: string[]): Promise<Set<string>>;
  /** 아직 향수로 저장되지 않았고 차단 목록에도 없는 주소만 돌려준다 */
  unsaved(urls: string[]): Promise<Set<string>>;
};

const compact = (text: string) => text.replace(/\s+/g, "").toLowerCase();
const inDomains = (domain: string, list: readonly string[]) =>
  list.some((entry) => domain === entry || domain.endsWith(`.${entry}`));
const namesOf = (brand: NewsBrand) => [brand.brand, ...brand.aliases];

/** 기사 검색어에 쓸 브랜드 표기 — 국내 기사는 한글로 쓰므로 한글 표기를 먼저 쓴다 */
export const searchName = (brand: NewsBrand) => brand.aliases.find((alias) => /[가-힣]/.test(alias)) ?? brand.brand;

/**
 * 검색 결과에서 출시 기사를 골라 "같은 출시" 묶음으로 나눈다 (순수 함수).
 * - 기간 안, 차단 매체 아님, 제목에 브랜드 표기, 제목·발췌문에 출시 표현과 향수 표현, 제목에 행사·실적 표현 없음
 * - 발행일이 며칠 안에 몰린 기사는 한 묶음(같은 보도자료). 묶음 안에서는 등록된 매체 → 발췌문이 긴 것 순으로 읽는다
 */
export function pickLaunchArticles(brand: NewsBrand, items: readonly NewsCandidate[], now: Date): LaunchArticle[][] {
  const names = namesOf(brand).map(compact).filter(Boolean);
  const since = now.getTime() - WINDOW_DAYS * DAY_MS;
  const until = now.getTime() + DAY_MS;
  const urls = new Set<string>();

  const hits: LaunchArticle[] = [];
  for (const item of items) {
    const url = parseHttpUrl(item.url);
    const time = item.publishedAt.getTime();
    if (!url || time < since || time > until || urls.has(item.url)) continue;
    const domain = getDomain(url);
    const text = `${item.title} ${item.description}`;
    if (inDomains(domain, BLOCKED_DOMAINS)) continue;
    if (!names.some((name) => compact(item.title).includes(name))) continue;
    if (!NEWS_LAUNCH_SIGNAL.test(text) || !PERFUME_SIGNAL.test(text)) continue;
    if (NEWS_TITLE_EXCLUDE.test(item.title) || EXCLUDE_KEYWORDS.some((keyword) => text.includes(keyword))) continue;

    urls.add(item.url);
    hits.push({
      brand,
      url: item.url,
      title: item.title,
      excerpt: item.description,
      publisher: item.sourceName,
      publishedAt: item.publishedAt,
      trusted: inDomains(domain, TRUSTED_DOMAINS),
    });
  }

  hits.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
  const clusters: LaunchArticle[][] = [];
  for (const hit of hits) {
    const last = clusters[clusters.length - 1];
    if (last && last[0].publishedAt.getTime() - hit.publishedAt.getTime() <= NEWS_SAME_RELEASE_DAYS * DAY_MS) last.push(hit);
    else clusters.push([hit]);
  }
  for (const cluster of clusters) {
    cluster.sort(
      (a, b) =>
        Number(b.trusted) - Number(a.trusted) ||
        b.excerpt.length - a.excerpt.length ||
        b.publishedAt.getTime() - a.publishedAt.getTime() ||
        a.url.localeCompare(b.url),
    );
  }
  return clusters;
}

/** 여러 브랜드·제품을 묶은 긴 기사는 이 브랜드가 처음 나오는 곳 근처만 남긴다 */
function focusOnBrand(text: string, names: readonly string[]): string {
  if (text.length <= MAX_BODY_FOR_LLM) return text;
  const positions = names.map((name) => text.indexOf(name)).filter((index) => index >= 0);
  const start = Math.max(0, (positions.length > 0 ? Math.min(...positions) : 0) - 300);
  return text.slice(start, start + MAX_BODY_FOR_LLM);
}

const toHttpsUrl = (src: string, base: string): string | null => {
  try {
    const url = new URL(src.trim(), base);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
};

/** 기사를 읽어 후보로 만든다. 읽을 수 없는 기사면 "끝냄"(다시 보지 않음), 잠깐의 실패면 null(다음에 다시) */
async function readArticle(
  article: LaunchArticle,
  siblings: string[],
  deadline: number,
): Promise<ArrivalCandidate | "handled" | null> {
  if (isPast(deadline)) return null;
  const url = new URL(article.url);
  const robots = await fetchRobots(url.hostname);
  if (!isPathAllowed(robots, url.pathname + url.search)) return "handled";

  const fetched = await fetchText(article.url, "text/html");
  if (!fetched || isRateLimited(fetched.status) || fetched.status >= 500) return null;
  if (fetched.status !== 200) return "handled";

  const names = namesOf(article.brand);
  const page = parseArticlePage(fetched.text, names);
  const image = page.image ? toHttpsUrl(page.image, article.url) : null;
  // 본문을 찾지 못하면 검색 결과의 발췌문으로 대신한다 (노트까지는 못 쓰지만 이름과 한두 문장은 쓸 수 있다)
  const bodyText = focusOnBrand(page.text || article.excerpt, names);
  if (!image || effectiveTextLength(bodyText) < MIN_BODY_LENGTH) return "handled";

  return {
    brand: article.brand.brand,
    name: "",
    title: article.title,
    nameKey: "",
    brandNames: names,
    officialUrl: article.url,
    bodyText,
    category: "",
    images: [image].slice(0, MAX_IMAGES),
    firstSeenAt: article.publishedAt,
    article: { sourceId: article.brand.sourceId, publisher: article.publisher, siblings },
  };
}

export type NewsCollectResult = {
  candidates: ArrivalCandidate[];
  /** 읽을 수 없어 끝낸 기사 */
  handled: NewsOutcome[];
  /** 단계별 수 — 로그용 */
  stats: { brands: number; launchArticles: number; read: number };
};

/**
 * 브랜드별로 출시 기사를 검색해 아직 판단하지 않은 것만 읽는다.
 * 묶음 안의 기사 하나가 이미 등록됐으면 그 묶음은 끝난 것이고, 아니면 아직 읽지 않은 기사 가운데 첫 번째를 읽는다
 * (읽은 기사가 출시 기사가 아니라고 판정되면 다음 실행에서 같은 묶음의 다른 기사를 읽는다).
 */
export async function collectLaunchNews(
  brands: readonly NewsBrand[],
  store: NewsStore,
  now: Date,
  deadline: number,
): Promise<NewsCollectResult> {
  const empty: NewsCollectResult = { candidates: [], handled: [], stats: { brands: brands.length, launchArticles: 0, read: 0 } };
  if (brands.length === 0) return empty;

  const searched = await Promise.all(
    brands.map((brand) =>
      collectNews([`${searchName(brand)} 향수 출시`])
        .then(({ items }) => pickLaunchArticles(brand, items, now))
        .catch((e) => {
          console.error(`[arrivals] news search failed: ${brand.brand}`, e);
          return [] as LaunchArticle[][];
        }),
    ),
  );
  const allUrls = searched.flat(2).map((article) => article.url);
  if (allUrls.length === 0) return empty;

  const [seen, unsaved] = await Promise.all([
    store.seenArticles(brands.map((brand) => brand.sourceId)),
    store.unsaved(allUrls),
  ]);

  const picks: { article: LaunchArticle; siblings: string[] }[] = [];
  for (const clusters of searched) {
    let taken = 0;
    for (const cluster of clusters) {
      if (taken >= NEWS_ARTICLES_PER_BRAND) break;
      if (cluster.some((article) => !unsaved.has(article.url))) continue; // 이 묶음으로 이미 등록했다
      const article = cluster.find((member) => !seen.has(member.url));
      if (!article) continue;
      picks.push({ article, siblings: cluster.filter((member) => member !== article && !seen.has(member.url)).map((member) => member.url) });
      taken += 1;
    }
  }
  picks.sort((a, b) => b.article.publishedAt.getTime() - a.article.publishedAt.getTime());
  const selected = picks.slice(0, NEWS_MAX_CANDIDATES);

  const results = await Promise.all(selected.map(({ article, siblings }) => readArticle(article, siblings, deadline)));
  const result: NewsCollectResult = {
    candidates: [],
    handled: [],
    stats: { brands: brands.length, launchArticles: allUrls.length, read: results.filter((item) => item !== null).length },
  };
  results.forEach((item, index) => {
    const { article } = selected[index];
    if (item === "handled") {
      result.handled.push({ sourceId: article.brand.sourceId, url: article.url, saved: false, publishedAt: article.publishedAt });
    } else if (item) {
      result.candidates.push(item);
    }
  });
  return result;
}

/** 다시 판단해도 결과가 같을 탈락 사유 — 이런 기사는 다시 읽지 않는다. 그 밖(응답 누락·한도 초과 등)은 다음 실행에서 다시 본다 */
const FINAL_REJECTIONS: readonly ValidationRejectReason[] = ["notPerfume", "lowConfidence", "nameMismatch"];

/**
 * LLM 판정이 끝난 기사 후보를 정리한다.
 * - 같은 실행에서 같은 향수를 다룬 기사가 둘이면 하나만 남긴다
 * - 이미 등록된 향수(같은 브랜드+이름, 한글 이름 포함)는 뺀다
 * 돌려주는 outcomes는 기사 기록에 남길 결과다 (등록한 기사, 다시 볼 필요가 없는 기사와 같은 묶음의 다른 기사).
 */
export async function settleNews(
  candidates: readonly ArrivalCandidate[],
  { accepted, rejected }: ValidationResult,
): Promise<{ toSave: DescribedArrival[]; outcomes: NewsOutcome[] }> {
  const outcomes: NewsOutcome[] = [];
  const close = (candidate: ArrivalCandidate, saved: boolean, withSiblings: boolean) => {
    if (!candidate.article) return;
    const { sourceId, siblings } = candidate.article;
    outcomes.push({ sourceId, url: candidate.officialUrl, saved, publishedAt: candidate.firstSeenAt });
    if (withSiblings) for (const url of siblings) outcomes.push({ sourceId, url, saved: false, publishedAt: candidate.firstSeenAt });
  };

  const described = accepted.filter((item) => item.candidate.article);
  const named = new Map<string, DescribedArrival>();
  for (const item of described) {
    const key = `${toKey(item.candidate.brand)}\n${toKey(item.name)}`;
    if (named.has(key)) close(item.candidate, false, true);
    else named.set(key, item);
  }

  const unique = [...named.values()];
  const fresh = new Set(
    (await excludeExisting(unique.map((item) => ({ ...item.candidate, name: item.name })))).map((candidate) => candidate.officialUrl),
  );
  const toSave = unique.filter((item) => fresh.has(item.candidate.officialUrl));
  for (const item of unique) close(item.candidate, fresh.has(item.candidate.officialUrl), true);

  const byUrl = new Map(candidates.map((candidate) => [candidate.officialUrl, candidate]));
  for (const { officialUrl, reason } of rejected) {
    const candidate = byUrl.get(officialUrl);
    if (candidate?.article && FINAL_REJECTIONS.includes(reason)) close(candidate, false, false);
  }
  return { toSave, outcomes };
}
