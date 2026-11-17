import { ARRIVAL_SOURCES } from "./config";
import { collectArrivals } from "./collectArrivals";
import { excludeExisting, filterByRules, pickForRun } from "./filterArrivals";
import { describeArrivals } from "./describeArrivals";
import { saveAsFragrances } from "./saveAsFragrances";
import type { ArrivalPipelineResult, DescribedArrival } from "./types";

type RunOptions = {
  /** true면 저장하지 않고 선별 결과만 돌려준다 (브랜드 규칙·프롬프트 조정용) */
  dryRun?: boolean;
};

/**
 * 향수 신제품 파이프라인: 수집 → 규칙 필터 → DB 중복 제외 → LLM 판정·작성 → 검증 → 저장(바로 공개).
 * 실행 순서는 코드가 정하고, LLM은 향수 판정과 소개문 작성만 한다. 브랜드·공식 URL·이미지는 피드에서 가져온다.
 * 사람 검수 단계가 없으므로 검증에 실패한 제품은 저장하지 않고 버린다.
 */
export async function runArrivalsPipeline(
  options: RunOptions = {},
): Promise<ArrivalPipelineResult & { preview?: DescribedArrival[] }> {
  const startedAt = Date.now();

  const { collected, failedSources } = await collectArrivals();
  const rules = filterByRules(collected);
  const fresh = await excludeExisting(rules.kept);
  const candidates = pickForRun(fresh);
  const { accepted: described, rejected } = await describeArrivals(candidates);

  const stored = options.dryRun
    ? { saved: 0, skippedDuplicate: 0 }
    : await saveAsFragrances(described);

  const result: ArrivalPipelineResult = {
    sources: ARRIVAL_SOURCES.length,
    failedSources,
    collected: collected.length,
    afterRules: rules.kept.length,
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
      droppedByRules: rules.dropped,
      mergedVariants: rules.mergedVariants,
      droppedExisting: rules.kept.length - fresh.length,
      deferredToNextRun: fresh.length - candidates.length,
      rejectedByValidation: rejected,
    }),
  );

  return options.dryRun ? { ...result, preview: described } : result;
}
