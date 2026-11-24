import { BACKFILL_BATCH_BUDGET_MS, BACKFILL_BATCH_SIZE, BACKFILL_BRANDS_PER_RUN, BACKFILL_PAGES_BUDGET_MS } from "./config";
import { collectShopify, collectSitemapBacklog, fillThinBodies, type SeenStore } from "./collectArrivals";
import { describeArrivals } from "./describeArrivals";
import { excludeExisting, filterByRules } from "./filterArrivals";
import { saveAsFragrances } from "./saveAsFragrances";
import { loadBackfillSources, markBackfilled, readOnlySeenStore, seenStore } from "./sourceStore";
import {
  UNKNOWN_FIRST_SEEN,
  type ArrivalCandidate,
  type ArrivalSource,
  type DescribedArrival,
  type ValidationRejectReason,
} from "./types";

/**
 * 기존 향수 채우기 — 수집 중인 공식 사이트에 이미 올라와 있던 향수(신제품 기간이 지난 것)를 등록한다.
 * 신제품 파이프라인과 같은 단계(규칙 필터 → DB 중복 제외 → LLM 판정·작성 → 검증 → 저장)를 쓰고, 후보를 꺼내는 곳만 다르다.
 * - SHOPIFY: 상품 목록에서 규칙 필터가 "기간이 지났다"고 돌려준 향수(backlog)
 * - SITEMAP: 기준선에 기록만 해 둔 상품 주소를 묶음 크기만큼 열어 본 것
 * 한 번에 한 브랜드만 채우지 않고, 인지도가 높은 브랜드 몇 곳(BACKFILL_BRANDS_PER_RUN)에서 조금씩 꺼내 한 묶음으로 LLM에 넘긴다
 * — 실행마다 여러 브랜드의 향수가 고르게 들어온다. LLM 호출 수는 묶음당 1회 그대로다.
 * 한 번 판정한 향수는 주소를 기록해 다시 LLM에 넘기지 않는다. 사이트 하나를 다 채우면 backfilledAt을 적고, 다음 브랜드가 그 자리를 채운다.
 */

type Batch = {
  candidates: ArrivalCandidate[];
  /** 이번 묶음에서 판정 대상이 된 상품 주소 — 저장되지 않으면 "끝낸 주소"로 기록한다 */
  considered: string[];
  /** 이 사이트에 더 꺼낼 것이 없다 */
  exhausted: boolean;
  /** 아무것도 읽지 못했다(시간 부족·요청 과다) — 다음 실행에서 이어서 한다 */
  stalled: boolean;
};
/** until: 이 시각(ms)까지만 상품 페이지를 연다 */
type BacklogReader = (size: number, until: number) => Promise<Batch>;

/** 상품 목록은 한 번만 읽고 묶음 크기만큼씩 꺼낸다 (사이트에 추가 요청 없음) */
async function shopifyReader(source: ArrivalSource, store: SeenStore, now: Date, deadline: number): Promise<BacklogReader> {
  const { backlog } = filterByRules(await collectShopify(source, deadline), now);
  const finished = new Set((await store.load(source.id)).filter((entry) => entry.perfume === false).map((entry) => entry.url));
  const queue = (await excludeExisting(backlog)).filter((candidate) => !finished.has(candidate.officialUrl));
  return async (size, until) => {
    const taken = queue.splice(0, size);
    const { ready, unread } = await fillThinBodies(taken, Math.min(Date.now() + BACKFILL_PAGES_BUDGET_MS, until));
    queue.unshift(...unread); // 상품 페이지를 아직 읽지 못한 후보는 다음 묶음에서 다시 본다
    const considered = taken.filter((candidate) => !unread.includes(candidate)).map((candidate) => candidate.officialUrl);
    return { candidates: ready, considered, exhausted: queue.length === 0, stalled: considered.length === 0 && unread.length > 0 };
  };
}

/** 묶음마다 기준선 주소를 묶음 크기만큼만 연다 — LLM에 넘기지 못할 페이지를 미리 열지 않는다 */
const sitemapReader =
  (source: ArrivalSource, store: SeenStore, now: Date): BacklogReader =>
  async (size, until) => {
    const pagesUntil = () => Math.min(Date.now() + BACKFILL_PAGES_BUDGET_MS, until);
    const { collected, opened, pending } = await collectSitemapBacklog(source, store, size, pagesUntil());
    const { ready, unread } = await fillThinBodies(await excludeExisting(filterByRules(collected, now).backlog), pagesUntil());
    const waiting = new Set(unread.map((candidate) => candidate.officialUrl));
    const considered = collected.map((raw) => raw.url).filter((url) => !waiting.has(url));
    return { candidates: ready, considered, exhausted: pending === 0 && unread.length === 0, stalled: opened === 0 && pending > 0 };
  };

/** 일시적인 탈락 — 판정이 끝난 것이 아니라서 다음에 다시 본다 */
const RETRYABLE: readonly ValidationRejectReason[] = ["noResponse", "overLimit"];

export type BackfillOptions = {
  /** LLM에 넘길 향수 수 (기본: 한 묶음) */
  limit?: number;
  deadline: number;
  /** true면 저장·기록 없이 사이트마다 한 묶음만 판정해 결과를 돌려준다 */
  dryRun?: boolean;
};

export type BackfillResult = {
  sources: { host: string; judged: number; saved: number; rejected: Partial<Record<ValidationRejectReason, number>>; done: boolean; error?: string }[];
  judged: number;
  saved: number;
  durationMs: number;
  preview?: DescribedArrival[];
};

type Lane = { source: ArrivalSource; row: BackfillResult["sources"][number]; read?: BacklogReader; open: boolean };

export async function runBackfill({ limit = BACKFILL_BATCH_SIZE, deadline, dryRun = false }: BackfillOptions): Promise<BackfillResult> {
  const startedAt = Date.now();
  const now = new Date(startedAt);
  const store = dryRun ? readOnlySeenStore : seenStore;
  const result: BackfillResult = { sources: [], judged: 0, saved: 0, durationMs: 0, ...(dryRun && { preview: [] }) };
  const canStartBatch = () => result.judged < limit && Date.now() + BACKFILL_BATCH_BUDGET_MS < deadline;

  const lanes: Lane[] = (await loadBackfillSources()).slice(0, BACKFILL_BRANDS_PER_RUN).map((source) => ({
    source,
    row: { host: source.host, judged: 0, saved: 0, rejected: {}, done: false },
    open: true,
  }));
  result.sources = lanes.map((lane) => lane.row);

  while (canStartBatch()) {
    const active = lanes.filter((lane) => lane.open);
    if (active.length === 0) break;
    // 묶음 하나를 브랜드마다 나눠 채운다 (10건 ÷ 5곳 = 2건씩). 읽기는 LLM·저장에 쓸 시간을 남기고 멈춘다
    const share = Math.max(1, Math.floor(Math.min(limit - result.judged, BACKFILL_BATCH_SIZE) / active.length));
    const readUntil = deadline - BACKFILL_BATCH_BUDGET_MS;

    const taken: { lane: Lane; batch: Batch }[] = [];
    for (const lane of active) {
      if (Date.now() >= readUntil) break;
      try {
        lane.read ??= lane.source.kind === "SHOPIFY" ? await shopifyReader(lane.source, store, now, readUntil) : sitemapReader(lane.source, store, now);
        taken.push({ lane, batch: await lane.read(share, readUntil) });
      } catch (e) {
        // 한 사이트가 읽히지 않아도 다른 브랜드는 진행한다 — 이 사이트는 다음 실행에서 다시 시도한다
        lane.open = false;
        lane.row.error = e instanceof Error ? e.message : String(e);
        console.error(`[arrivals] backfill failed: ${lane.source.host} — ${lane.row.error}`);
      }
    }
    if (taken.length === 0) break;

    const { accepted, rejected } = await describeArrivals(taken.flatMap(({ batch }) => batch.candidates));
    result.preview?.push(...accepted);

    for (const { lane, batch } of taken) {
      const mine = new Set(batch.considered);
      const laneAccepted = accepted.filter((item) => mine.has(item.candidate.officialUrl));
      const laneRejected = rejected.filter((item) => mine.has(item.officialUrl));
      const { saved } = dryRun ? { saved: 0 } : await saveAsFragrances(laneAccepted);

      // 저장된 것과 다시 볼 것을 뺀 나머지는 판정이 끝났다 — 주소를 기록해 다시 LLM에 넘기지 않는다
      const retry = laneRejected.filter((item) => RETRYABLE.includes(item.reason)).map((item) => item.officialUrl);
      const open = new Set([...laneAccepted.map((item) => item.candidate.officialUrl), ...retry]);
      const finished = batch.considered.filter((url) => !open.has(url));
      await store.save(lane.source.id, {
        added: finished.map((url) => ({ url, perfume: false, firstSeenAt: UNKNOWN_FIRST_SEEN })), // SHOPIFY: 기록이 없어 새로 만든다
        marked: finished.map((url) => ({ url, perfume: false })), // SITEMAP: 이미 있는 기록을 고친다
        baseline: false,
      });

      lane.row.judged += batch.candidates.length;
      lane.row.saved += saved;
      for (const { reason } of laneRejected) lane.row.rejected[reason] = (lane.row.rejected[reason] ?? 0) + 1;
      result.judged += batch.candidates.length;
      result.saved += saved;

      if (batch.exhausted && retry.length === 0) {
        lane.row.done = true;
        if (!dryRun) await markBackfilled(lane.source.id, now);
      }
      if (batch.exhausted || batch.stalled) lane.open = false;
    }
    if (dryRun) break;
  }

  result.durationMs = Date.now() - startedAt;
  console.log("[arrivals] backfill run", JSON.stringify({ ...result, preview: undefined, dryRun }));
  return result;
}
