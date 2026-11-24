import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/src/app/lib/cronAuth";
import { runBackfill } from "@/src/app/lib/arrivals/backfill";
import { maintainSources, type MaintenanceStep } from "@/src/app/lib/arrivals/maintainSources";
import { runArrivalsPipeline } from "@/src/app/lib/arrivals/runPipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 향수 신제품 수집 크론 엔드포인트.
 * - 스케줄: vercel.json (매일 1회)
 * - 수동 실행: curl -H "Authorization: Bearer $CRON_SECRET" <origin>/api/cron/perfume-arrivals
 * - 저장 없이 결과만 확인: ?dryRun=1
 * - 수집 대상 관리만 따로 실행(수집은 하지 않음): ?maintain=discover|resolve|probe (&limit=처리할 수)
 *   평소에는 크론이 수집 뒤 남는 시간에 한 단계씩 하므로 필요 없다. 처음 채울 때나 한꺼번에 돌릴 때 쓴다.
 *   Vercel에서는 실행 시간 제한 안에서만 하고, 로컬에서는 넉넉히 돈다.
 * - 기존 향수 채우기(신제품 수집은 하지 않음): ?backfill=1 (&limit=LLM에 넘길 향수 수, &dryRun=1)
 *   크론은 /api/cron/perfume-backfill로 하루 한 묶음씩 하고, 처음 채울 때는 로컬에서 limit을 크게 주어 돌린다.
 */
const MAINTENANCE_STEPS: readonly MaintenanceStep[] = ["discover", "resolve", "probe"];
const MANUAL_MAINTENANCE_MS = process.env.VERCEL ? 50_000 : 10 * 60_000;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron/perfume-arrivals] CRON_SECRET missing");
    return NextResponse.json({ message: "서버 설정 오류입니다." }, { status: 500 });
  }
  if (!isCronAuthorized(req, secret)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const params = req.nextUrl.searchParams;
  const dryRun = params.get("dryRun") === "1";
  const step = MAINTENANCE_STEPS.find((name) => name === params.get("maintain"));
  if (params.has("maintain") && !step) {
    return NextResponse.json({ message: "maintain 값은 discover, resolve, probe 중 하나여야 합니다." }, { status: 400 });
  }
  const limit = Number(params.get("limit"));
  const manualLimit = Number.isInteger(limit) && limit > 0 ? limit : undefined;

  try {
    if (step) {
      const result = await maintainSources({
        step,
        deadline: Date.now() + MANUAL_MAINTENANCE_MS,
        limit: manualLimit,
      });
      return NextResponse.json(result, { status: 200 });
    }
    if (params.get("backfill") === "1") {
      const result = await runBackfill({ deadline: Date.now() + MANUAL_MAINTENANCE_MS, limit: manualLimit, dryRun });
      return NextResponse.json(result, { status: 200 });
    }
    const result = await runArrivalsPipeline({ dryRun });
    return NextResponse.json(result, { status: 200 });
  } catch (e) {
    console.error("[cron/perfume-arrivals] error:", e);
    return NextResponse.json({ message: "향수 신제품 수집 중 오류가 발생했습니다." }, { status: 500 });
  }
}
