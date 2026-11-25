import { COLLECT_BUDGET_MS, MAINTENANCE_BUDGET_MS, MAINTENANCE_START_LIMIT_MS, THIN_BODY_BUDGET_MS } from "./config";
import { collectArrivals, fillThinBodies } from "./collectArrivals";
import { excludeExisting, filterByRules, pickForRun } from "./filterArrivals";
import { describeArrivals } from "./describeArrivals";
import { maintainSources, type MaintenanceResult } from "./maintainSources";
import { collectLaunchNews, settleNews, type NewsCollectResult } from "./newsArrivals";
import { saveAsFragrances } from "./saveAsFragrances";
import {
  loadNewsBrands,
  loadSourcesForRun,
  newsStore,
  readOnlySeenStore,
  recordArticles,
  recordCollectRun,
  seenStore,
} from "./sourceStore";
import type { ArrivalPipelineResult, DescribedArrival } from "./types";

type RunOptions = {
  /** true면 저장하지 않고 선별 결과만 돌려준다 (규칙·프롬프트 조정용). 등록부도 바꾸지 않는다 */
  dryRun?: boolean;
};

/**
 * 향수 신제품 파이프라인: 수집 대상 불러오기 → 수집(공식 사이트 + 공식 사이트를 읽을 수 없는 브랜드의 출시 기사)
 * → 규칙 필터 → DB 중복 제외 → LLM 판정·작성 → 검증 → 저장(바로 공개)
 * → 남는 시간에 수집 대상 관리 한 단계(브랜드 찾기·공식 사이트 찾기·사이트 판정).
 * 실행 순서는 코드가 정하고, LLM은 향수 판정과 소개문 작성만 한다. 브랜드·공식 URL·이미지는 공식 사이트에서 가져온다.
 * 사람 검수 단계가 없으므로 검증에 실패한 제품은 저장하지 않고 버린다.
 */
export async function runArrivalsPipeline(
  options: RunOptions = {},
): Promise<ArrivalPipelineResult & { preview?: DescribedArrival[] }> {
  const startedAt = Date.now();
  const now = new Date(startedAt);

  const [sources, newsBrands] = await Promise.all([loadSourcesForRun(), loadNewsBrands(now)]);
  const [{ collected, failed }, news] = await Promise.all([
    collectArrivals(sources, options.dryRun ? readOnlySeenStore : seenStore, now),
    // 출시 기사는 덤이다 — 실패해도 공식 사이트 수집은 그대로 진행한다
    collectLaunchNews(newsBrands, newsStore, now, startedAt + COLLECT_BUDGET_MS).catch((e): NewsCollectResult => {
      console.error("[arrivals] launch news failed:", e);
      return { candidates: [], handled: [], stats: { brands: newsBrands.length, launchArticles: 0, read: 0 } };
    }),
  ]);
  if (!options.dryRun) await recordCollectRun(sources, failed, now);

  const rules = filterByRules(collected, now);
  const fresh = await excludeExisting(rules.kept);
  const { ready } = await fillThinBodies(pickForRun(fresh, now), Date.now() + THIN_BODY_BUDGET_MS);
  const candidates = [...ready, ...news.candidates];
  const validation = await describeArrivals(candidates);
  const { rejected } = validation;

  // 기사에서 온 후보는 향수 이름이 이제 정해졌으므로 여기서 중복을 확인한다
  const fromNews = await settleNews(news.candidates, validation);
  const described = [...validation.accepted.filter((item) => !item.candidate.article), ...fromNews.toSave];

  const stored = options.dryRun ? { saved: 0, skippedDuplicate: 0 } : await saveAsFragrances(described);
  if (!options.dryRun) await recordArticles([...news.handled, ...fromNews.outcomes]);

  // 수집 대상 관리는 덤이다 — 시간이 남을 때만 하고, 실패해도 수집 결과에는 영향을 주지 않는다
  let maintenance: MaintenanceResult | { error: string } | null = null;
  if (!options.dryRun && Date.now() - startedAt < MAINTENANCE_START_LIMIT_MS) {
    try {
      maintenance = await maintainSources({ deadline: Date.now() + MAINTENANCE_BUDGET_MS, now });
    } catch (e) {
      maintenance = { error: e instanceof Error ? e.message : String(e) };
      console.error("[arrivals] maintenance failed:", e);
    }
  }

  const result: ArrivalPipelineResult = {
    sources: sources.length,
    failedSources: failed.length,
    collected: collected.length,
    afterRules: rules.kept.length,
    newsCandidates: news.candidates.length,
    candidates: candidates.length,
    described: described.length,
    saved: stored.saved,
    skippedDuplicate: stored.skippedDuplicate,
    durationMs: Date.now() - startedAt,
  };

  // 실행 기록 — "왜 안 올라왔는지"를 Vercel 로그에서 단계별 탈락 수로 추적할 수 있게 남긴다
  console.log(
    "[arrivals] pipeline run",
    JSON.stringify({
      ...result,
      dryRun: !!options.dryRun,
      failed: failed.map(({ source, reason }) => ({ host: source.host, reason })),
      droppedByRules: rules.dropped,
      mergedVariants: rules.mergedVariants,
      droppedExisting: rules.kept.length - fresh.length,
      deferredToNextRun: fresh.length - (candidates.length - news.candidates.length),
      news: { ...news.stats, unreadable: news.handled.length, described: fromNews.toSave.length },
      rejectedByValidation: rejected,
      maintenance,
    }),
  );

  return options.dryRun ? { ...result, preview: described } : result;
}
