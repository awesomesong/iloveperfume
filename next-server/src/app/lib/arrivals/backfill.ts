import { BACKFILL_BATCH_BUDGET_MS, BACKFILL_BATCH_SIZE, BACKFILL_PAGES_BUDGET_MS } from "./config";
import { collectShopify, collectSitemapBacklog, type SeenStore } from "./collectArrivals";
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
 * 한 번 판정한 향수는 주소를 기록해 다시 LLM에 넘기지 않는다. 사이트 하나를 다 채우면 backfilledAt을 적고 다음 사이트로 간다.
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
type BacklogReader = (size: number) => Promise<Batch>;

/** 상품 목록은 한 번만 읽고 묶음 크기만큼씩 꺼낸다 (사이트에 추가 요청 없음) */
async function shopifyReader(source: ArrivalSource, store: SeenStore, now: Date, deadline: number): Promise<BacklogReader> {
  const { backlog } = filterByRules(await collectShopify(source, deadline), now);
  const finished = new Set((await store.load(source.id)).filter((entry) => entry.perfume === false).map((entry) => entry.url));
  const queue = (await excludeExisting(backlog)).filter((candidate) => !finished.has(candidate.officialUrl));
  return async (size) => {
    const candidates = queue.splice(0, size);
    return { candidates, considered: candidates.map((c) => c.officialUrl), exhausted: queue.length === 0, stalled: false };
  };
}

/** 묶음마다 기준선 주소를 묶음 크기만큼만 연다 — LLM에 넘기지 못할 페이지를 미리 열지 않는다 */
const sitemapReader =
  (source: ArrivalSource, store: SeenStore, now: Date): BacklogReader =>
  async (size) => {
    const { collected, opened, pending } = await collectSitemapBacklog(source, store, size, Date.now() + BACKFILL_PAGES_BUDGET_MS);
    const candidates = await excludeExisting(filterByRules(collected, now).backlog);
    return { candidates, considered: collected.map((raw) => raw.url), exhausted: pending === 0, stalled: opened === 0 && pending > 0 };
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

export async function runBackfill({ limit = BACKFILL_BATCH_SIZE, deadline, dryRun = false }: BackfillOptions): Promise<BackfillResult> {
  const startedAt = Date.now();
  const now = new Date(startedAt);
  const store = dryRun ? readOnlySeenStore : seenStore;
  const result: BackfillResult = { sources: [], judged: 0, saved: 0, durationMs: 0, ...(dryRun && { preview: [] }) };
  const canStartBatch = () => result.judged < limit && Date.now() + BACKFILL_BATCH_BUDGET_MS < deadline;

  for (const source of await loadBackfillSources()) {
    if (!canStartBatch()) break;
    const row: BackfillResult["sources"][number] = { host: source.host, judged: 0, saved: 0, rejected: {}, done: false };
    result.sources.push(row);
    try {
      const read = source.kind === "SHOPIFY" ? await shopifyReader(source, store, now, deadline) : sitemapReader(source, store, now);
      while (canStartBatch()) {
        const batch = await read(Math.min(limit - result.judged, BACKFILL_BATCH_SIZE));
        const { accepted, rejected } = await describeArrivals(batch.candidates);
        const { saved } = dryRun ? { saved: 0 } : await saveAsFragrances(accepted);
        result.preview?.push(...accepted);

        // 저장된 것과 다시 볼 것을 뺀 나머지는 판정이 끝났다 — 주소를 기록해 다시 LLM에 넘기지 않는다
        const retry = rejected.filter((item) => RETRYABLE.includes(item.reason)).map((item) => item.officialUrl);
        const open = new Set([...accepted.map((item) => item.candidate.officialUrl), ...retry]);
        const finished = batch.considered.filter((url) => !open.has(url));
        await store.save(source.id, {
          added: finished.map((url) => ({ url, perfume: false, firstSeenAt: UNKNOWN_FIRST_SEEN })), // SHOPIFY: 기록이 없어 새로 만든다
          marked: finished.map((url) => ({ url, perfume: false })), // SITEMAP: 이미 있는 기록을 고친다
          baseline: false,
        });

        row.judged += batch.candidates.length;
        row.saved += saved;
        for (const { reason } of rejected) row.rejected[reason] = (row.rejected[reason] ?? 0) + 1;
        result.judged += batch.candidates.length;
        result.saved += saved;

        if (batch.exhausted && retry.length === 0) {
          row.done = true;
          if (!dryRun) await markBackfilled(source.id, now);
        }
        if (batch.exhausted || batch.stalled || dryRun) break;
      }
    } catch (e) {
      // 한 사이트가 읽히지 않아도 다음 사이트로 간다 — 이 사이트는 다음 실행에서 다시 시도한다
      row.error = e instanceof Error ? e.message : String(e);
      console.error(`[arrivals] backfill failed: ${source.host} — ${row.error}`);
    }
  }

  result.durationMs = Date.now() - startedAt;
  console.log("[arrivals] backfill run", JSON.stringify({ ...result, preview: undefined, dryRun }));
  return result;
}
