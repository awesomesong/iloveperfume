import prisma from "@/prisma/db";
import { buildQueries, collectNews } from "./collectNews";
import { filterCandidates } from "./filterCandidates";
import { selectAndSummarize } from "./selectAndSummarize";
import { fetchOgImage } from "./fetchImage";
import { saveAsNotices } from "./saveAsNotices";
import type { PipelineResult, SelectedNews } from "./types";

type RunOptions = {
  /** true면 저장하지 않고 선별 결과만 돌려준다 (검색어·프롬프트 조정용) */
  dryRun?: boolean;
};

/**
 * 향수 뉴스 파이프라인: 수집 → 규칙 필터 → LLM 선별·요약 → 검증 → 저장(바로 공개).
 * 실행 순서는 코드가 정하고, LLM은 선별·요약 단계에서만 판단한다.
 * 사람 검수 단계가 없으므로 게시 품질은 규칙 필터와 validateSelection 기준(config.ts)이 결정한다.
 */
export async function runNewsPipeline(
  options: RunOptions = {},
): Promise<PipelineResult & { preview?: SelectedNews[] }> {
  const startedAt = Date.now();
  const queries = await buildQueries();
  const collected = await collectNews(queries);
  const candidates = await filterCandidates(collected);

  let selected: SelectedNews[] = [];
  if (candidates.length > 0) {
    const recent = await prisma.notice.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { title: true },
    });
    selected = await selectAndSummarize(candidates, recent.map((n) => n.title));
  }

  // 최종 선별된(최대 5건) 기사만 원문에서 og:image를 최선형으로 가져온다 — 실패해도 null로 계속 진행
  if (selected.length > 0) {
    const images = await Promise.allSettled(
      selected.map((item) => fetchOgImage(item.candidate.url)),
    );
    selected = selected.map((item, i) => {
      const result = images[i];
      return { ...item, image: result.status === "fulfilled" ? result.value : null };
    });
  }

  const saved = options.dryRun
    ? { published: 0, skippedDuplicate: 0 }
    : await saveAsNotices(selected);

  const result: PipelineResult = {
    queries: queries.length,
    collected: collected.length,
    candidates: candidates.length,
    selected: selected.length,
    published: saved.published,
    skippedDuplicate: saved.skippedDuplicate,
    durationMs: Date.now() - startedAt,
  };

  // 실행 기록 — "오늘 왜 안 올라왔는지"를 Vercel 로그에서 추적할 수 있게 남긴다
  console.log("[news] pipeline run", JSON.stringify({ ...result, dryRun: !!options.dryRun }));

  return options.dryRun ? { ...result, preview: selected } : result;
}
