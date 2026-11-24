import prisma from "@/prisma/db";
import type { ArrivalSource as SourceRow } from "@prisma/client";
import {
  MAX_COLLECT_FAILURES,
  MAX_SOURCES_PER_RUN,
  MEMBER_LEAD_SOURCE,
  NEWS_BRANDS_PER_RUN,
  REPROBE_DAYS,
  RESOLVE_MAX_ATTEMPTS,
  RETRY_PROBE_DAYS,
} from "./config";
import type { CollectResult, SeenStore } from "./collectArrivals";
import type { BrandLead } from "./discoverBrands";
import type { NewsBrand, NewsOutcome, NewsStore } from "./newsArrivals";
import { findKnownUrls } from "./filterArrivals";
import type { ProbeVerdict } from "./probeSource";
import type { ResolveResult } from "./resolveBrandSites";
import { toKey } from "./text";
import type { ArrivalSource } from "./types";

/**
 * 수집 대상 등록부(DB) — 후보 브랜드(ArrivalBrandLead), 공식 사이트와 판정 결과(ArrivalSource),
 * 사이트맵에서 본 상품 주소(ArrivalSeenUrl)를 읽고 쓴다. 외부 요청과 판단은 하지 않는다.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const daysLater = (now: Date, days: number) => new Date(now.getTime() + days * DAY_MS);
const CHUNK = 1000;

// ───────── 수집 ─────────

/** 이번 실행에서 읽을 수집 대상 — 가장 오래 읽지 않은 것부터. 대상이 한도보다 많으면 날마다 순환한다 */
export async function loadSourcesForRun(): Promise<ArrivalSource[]> {
  const rows = await prisma.arrivalSource.findMany({
    where: { status: "ACTIVE", kind: { not: null } },
    orderBy: [{ lastCollectedAt: { sort: "asc", nulls: "first" } }, { host: "asc" }],
    take: MAX_SOURCES_PER_RUN,
  });
  return rows.flatMap(toSource);
}

const toSource = (row: SourceRow): ArrivalSource[] =>
  row.kind ? [{ id: row.id, brand: row.brand, aliases: row.aliases, host: row.host, kind: row.kind, baselineAt: row.baselineAt }] : [];

/**
 * 기존 향수를 아직 다 채우지 않은 수집 대상 — 주소 순으로 한 곳씩 끝낸다.
 * 사이트맵 방식은 기준선(지금 있는 상품 주소)을 기록한 뒤부터 대상이다.
 */
export async function loadBackfillSources(): Promise<ArrivalSource[]> {
  const rows = await prisma.arrivalSource.findMany({
    where: { status: "ACTIVE", backfilledAt: null, OR: [{ kind: "SHOPIFY" }, { kind: "SITEMAP", baselineAt: { not: null } }] },
    orderBy: { host: "asc" },
    take: MAX_SOURCES_PER_RUN,
  });
  return rows.flatMap(toSource);
}

export const markBackfilled = (sourceId: string, now: Date) =>
  prisma.arrivalSource.update({ where: { id: sourceId }, data: { backfilledAt: now } });

export const seenStore: SeenStore = {
  async load(sourceId) {
    return prisma.arrivalSeenUrl.findMany({
      where: { sourceId, article: false },
      select: { url: true, perfume: true, firstSeenAt: true },
    });
  },
  async save(sourceId, { added, marked, baseline }) {
    for (let i = 0; i < added.length; i += CHUNK) {
      await prisma.arrivalSeenUrl.createMany({
        data: added.slice(i, i + CHUNK).map((entry) => ({ sourceId, ...entry })),
        skipDuplicates: true,
      });
    }
    for (const { url, perfume } of marked) {
      await prisma.arrivalSeenUrl.update({ where: { sourceId_url: { sourceId, url } }, data: { perfume } });
    }
    if (baseline) await prisma.arrivalSource.update({ where: { id: sourceId }, data: { baselineAt: new Date() } });
  },
  async unsaved(urls) {
    const known = await findKnownUrls(urls);
    return new Set(urls.filter((url) => !known.has(url)));
  },
};

/** 저장하지 않는 저장소 — dryRun에서 쓴다 */
export const readOnlySeenStore: SeenStore = { ...seenStore, save: async () => {} };

/**
 * 수집 결과를 기록한다. 잘 읽힌 대상은 그 자체가 "수집 가능"의 증거라 재판정을 미루고,
 * 잇달아 실패한 대상은 수집을 멈추고 다시 판정하게 한다(사이트 구조가 바뀌었거나 자동 요청을 막기 시작한 경우).
 */
export async function recordCollectRun(sources: readonly ArrivalSource[], failed: CollectResult["failed"], now: Date): Promise<void> {
  const failedIds = new Set(failed.map((entry) => entry.source.id));
  const okIds = sources.filter((source) => !failedIds.has(source.id)).map((source) => source.id);
  if (okIds.length > 0) {
    await prisma.arrivalSource.updateMany({
      where: { id: { in: okIds } },
      data: { failCount: 0, lastCollectedAt: now, nextProbeAt: daysLater(now, REPROBE_DAYS) },
    });
  }
  for (const { source, reason } of failed) {
    const row = await prisma.arrivalSource.update({
      where: { id: source.id },
      data: { failCount: { increment: 1 }, lastCollectedAt: now, reason: `수집 실패: ${reason}` },
    });
    if (row.failCount >= MAX_COLLECT_FAILURES) {
      await prisma.arrivalSource.update({
        where: { id: source.id },
        data: { status: "INACTIVE", nextProbeAt: now, reason: `수집 ${row.failCount}회 연속 실패 — 다시 판정: ${reason}` },
      });
    }
  }
}

// ───────── 출시 기사 ─────────

/**
 * 출시 기사를 찾아볼 브랜드 — 등록부에 있고 판정까지 마쳤지만 수집 중인 공식 사이트가 없는 브랜드.
 * 공식 사이트에서 수집하는 브랜드는 넣지 않는다(같은 향수가 두 경로로 들어오지 않게). 한도보다 많으면 날마다 순환한다.
 */
export async function loadNewsBrands(now: Date): Promise<NewsBrand[]> {
  const rows = await prisma.arrivalSource.findMany({
    orderBy: [{ brandKey: "asc" }, { rank: "asc" }, { host: "asc" }],
    select: { id: true, brand: true, brandKey: true, aliases: true, status: true, reason: true },
  });
  const groups = new Map<string, typeof rows>();
  for (const row of rows) groups.set(row.brandKey, [...(groups.get(row.brandKey) ?? []), row]);

  const brands = [...groups.values()]
    .filter((group) => group.every((row) => row.status !== "ACTIVE" && row.reason !== null))
    .map((group) => ({ sourceId: group[0].id, brand: group[0].brand, aliases: [...new Set(group.flatMap((row) => row.aliases))] }));
  if (brands.length <= NEWS_BRANDS_PER_RUN) return brands;
  const start = (Math.floor(now.getTime() / DAY_MS) * NEWS_BRANDS_PER_RUN) % brands.length;
  return Array.from({ length: NEWS_BRANDS_PER_RUN }, (_, i) => brands[(start + i) % brands.length]);
}

export const newsStore: NewsStore = {
  async seenArticles(sourceIds) {
    const rows = await prisma.arrivalSeenUrl.findMany({ where: { sourceId: { in: sourceIds }, article: true }, select: { url: true } });
    return new Set(rows.map((row) => row.url));
  },
  unsaved: seenStore.unsaved,
};

/** 판단을 끝낸 기사를 기록한다 — 다음 실행에서 다시 읽지 않는다 */
export async function recordArticles(outcomes: readonly NewsOutcome[]): Promise<void> {
  if (outcomes.length === 0) return;
  await prisma.arrivalSeenUrl.createMany({
    data: outcomes.map(({ sourceId, url, saved, publishedAt }) => ({ sourceId, url, perfume: saved, firstSeenAt: publishedAt, article: true })),
    skipDuplicates: true,
  });
}

/** 수집된 향수의 출처 주소가 출시 기사인지 (화면에서 "공식 사이트"와 구분해 적는 데 쓴다) */
export async function isLaunchArticleUrl(url: string): Promise<boolean> {
  return (await prisma.arrivalSeenUrl.findFirst({ where: { url, article: true }, select: { url: true } })) !== null;
}

// ───────── 판정 ─────────

export type ProbeTarget = Pick<SourceRow, "id" | "host" | "brand" | "brandKey" | "rank" | "status" | "koreaBasis">;

export const countDueProbes = (now: Date) => prisma.arrivalSource.count({ where: { nextProbeAt: { lte: now } } });

/** 판정할 때가 된 사이트 — 우선 후보(한국 공식몰)부터 */
export async function loadDueProbes(now: Date, limit: number): Promise<ProbeTarget[]> {
  return prisma.arrivalSource.findMany({
    where: { nextProbeAt: { lte: now } },
    orderBy: [{ rank: "asc" }, { nextProbeAt: "asc" }, { host: "asc" }],
    take: limit,
  });
}

/** 같은 브랜드에서 이 사이트보다 우선하거나 같은 순위의 사이트를 이미 수집 중인지 */
async function hasPreferredActive(target: ProbeTarget): Promise<boolean> {
  const preferred = await prisma.arrivalSource.findFirst({
    where: { brandKey: target.brandKey, status: "ACTIVE", id: { not: target.id }, rank: { lte: target.rank } },
    select: { id: true },
  });
  return preferred !== null;
}

/** 우선 사이트를 이미 수집 중이면 판정(외부 요청) 없이 다음 주기로 미룬다. 미뤘으면 true */
export async function deferIfCovered(target: ProbeTarget, now: Date): Promise<boolean> {
  if (target.status === "ACTIVE" || !(await hasPreferredActive(target))) return false;
  await prisma.arrivalSource.update({
    where: { id: target.id },
    data: { nextProbeAt: daysLater(now, REPROBE_DAYS), reason: "같은 브랜드의 우선 사이트를 수집 중" },
  });
  return true;
}

/**
 * 판정 결과를 반영한다. 반환값은 이 사이트의 새 상태.
 * - 수집 가능: 켠다. 한 브랜드에 하나만 수집하므로 같은 브랜드의 다른 사이트는 끈다.
 *   회원 등록으로만 알려진 브랜드는 한국 스토어일 때만 켠다(한국에서 살 수 있다는 근거가 그것뿐이라서).
 * - 수집 불가: 끄고 다음 주기에 다시 본다 (사이트가 바뀌면 자동으로 켜진다)
 * - 보류(요청 과다·응답 없음): 상태는 그대로 두고 곧 다시 본다
 */
export async function applyProbeVerdict(target: ProbeTarget, verdict: ProbeVerdict, now: Date): Promise<"ACTIVE" | "INACTIVE"> {
  const { id } = target;
  if (verdict.outcome === "retry") {
    await prisma.arrivalSource.update({
      where: { id },
      data: { nextProbeAt: daysLater(now, RETRY_PROBE_DAYS), reason: `확인 보류: ${verdict.reason}` },
    });
    return target.status;
  }

  const nextProbeAt = daysLater(now, REPROBE_DAYS);
  const off = (reason: string, kind?: SourceRow["kind"]) =>
    prisma.arrivalSource.update({ where: { id }, data: { status: "INACTIVE", nextProbeAt, reason, ...(kind ? { kind } : {}) } });

  if (verdict.outcome === "rejected") {
    await off(`수집 불가: ${verdict.reason}`);
    return "INACTIVE";
  }
  if (target.koreaBasis === MEMBER_LEAD_SOURCE && !verdict.koreanStore) {
    await off(`수집 가능하지만 한국 스토어가 아님 — 한국 판매 근거 없음 (${verdict.reason})`, verdict.kind);
    return "INACTIVE";
  }
  if (await hasPreferredActive(target)) {
    await off(`수집 가능 — 같은 브랜드의 우선 사이트를 수집 중 (${verdict.reason})`, verdict.kind);
    return "INACTIVE";
  }

  await prisma.$transaction([
    prisma.arrivalSource.updateMany({
      where: { brandKey: target.brandKey, status: "ACTIVE", id: { not: id } },
      data: { status: "INACTIVE", nextProbeAt, reason: `더 우선하는 사이트(${target.host})로 교체` },
    }),
    prisma.arrivalSource.update({
      where: { id },
      data: {
        status: "ACTIVE",
        kind: verdict.kind,
        failCount: 0,
        nextProbeAt,
        reason: `수집 가능: ${verdict.reason}`,
        // 꺼져 있던 동안 올라온 상품이 신제품으로 보이지 않도록 기준선을 다시 잡는다
        ...(target.status === "ACTIVE" ? {} : { baselineAt: null }),
      },
    }),
  ]);
  return "ACTIVE";
}

// ───────── 브랜드 후보 ─────────

export const countPendingLeads = () => prisma.arrivalBrandLead.count({ where: { status: "PENDING" } });

export async function loadPendingLeads(limit: number): Promise<BrandLead[]> {
  return prisma.arrivalBrandLead.findMany({
    where: { status: "PENDING" },
    orderBy: [{ attempts: "asc" }, { createdAt: "asc" }, { key: "asc" }],
    take: limit,
    select: { key: true, name: true, origin: true, examples: true },
  });
}

/** 새 브랜드 후보를 등록한다(이미 있는 브랜드는 건너뛴다). 반환값은 새로 등록된 수 */
export async function saveLeads(leads: readonly BrandLead[]): Promise<number> {
  if (leads.length === 0) return 0;
  const { count } = await prisma.arrivalBrandLead.createMany({ data: [...leads], skipDuplicates: true });
  return count;
}

/** 회원이 등록한 향수의 브랜드 가운데 아직 후보·수집 대상에 없는 것 */
export async function loadMemberBrandLeads(): Promise<BrandLead[]> {
  const [fragrances, leads, sources] = await Promise.all([
    prisma.fragrance.findMany({ where: { source: "USER" }, distinct: ["brand"], select: { brand: true, name: true } }),
    prisma.arrivalBrandLead.findMany({ select: { key: true } }),
    prisma.arrivalSource.findMany({ select: { brandKey: true } }),
  ]);
  const known = new Set([...leads.map((lead) => lead.key), ...sources.map((source) => source.brandKey)]);
  const found = new Map<string, BrandLead>();
  for (const { brand, name } of fragrances) {
    const key = toKey(brand);
    if (key && !known.has(key) && !found.has(key)) found.set(key, { key, name: brand.trim(), origin: MEMBER_LEAD_SOURCE, examples: [name] });
  }
  return [...found.values()];
}

/**
 * 공식 사이트 찾기 결과를 반영한다. 찾은 사이트는 판정 대기 상태로 등록하고(곧바로 수집하지 않는다),
 * 이미 등록된 사이트면 표기만 더한다(딥티크·딥디크처럼 표기가 다른 같은 브랜드).
 */
export async function applyResolveResult({ resolved, unresolved }: ResolveResult, now: Date): Promise<void> {
  for (const { lead, brandEn, candidates } of resolved) {
    const brandKey = toKey(brandEn);
    const alias = toKey(lead.name) === brandKey ? [] : [lead.name];
    for (const { host, rank } of candidates) {
      const existing = await prisma.arrivalSource.findUnique({ where: { host } });
      if (!existing) {
        await prisma.arrivalSource.create({
          data: { brand: brandEn.toUpperCase(), brandKey, aliases: alias, host, rank, koreaBasis: lead.origin, nextProbeAt: now },
        });
        continue;
      }
      // 회원 등록으로만 알려졌던 브랜드가 판매처에서도 확인되면 근거를 바꾸고 다시 판정한다
      const upgraded = existing.koreaBasis === MEMBER_LEAD_SOURCE && lead.origin !== MEMBER_LEAD_SOURCE;
      const aliases = [...new Set([...existing.aliases, ...alias])];
      if (upgraded || aliases.length !== existing.aliases.length) {
        await prisma.arrivalSource.update({
          where: { host },
          data: { aliases, ...(upgraded ? { koreaBasis: lead.origin, nextProbeAt: now } : {}) },
        });
      }
    }
    await prisma.arrivalBrandLead.update({
      where: { key: lead.key },
      data: { status: "RESOLVED", note: candidates.map((candidate) => candidate.host).join(", ") },
    });
  }
  for (const { lead, reason } of unresolved) {
    const row = await prisma.arrivalBrandLead.update({
      where: { key: lead.key },
      data: { attempts: { increment: 1 }, note: reason },
    });
    if (row.attempts >= RESOLVE_MAX_ATTEMPTS) {
      await prisma.arrivalBrandLead.update({ where: { key: lead.key }, data: { status: "UNRESOLVED" } });
    }
  }
}
