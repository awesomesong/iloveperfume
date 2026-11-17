import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/src/app/lib/cronAuth";
import { runArrivalsPipeline } from "@/src/app/lib/arrivals/runPipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 향수 신제품 수집 크론 엔드포인트.
 * - 스케줄: vercel.json (매일 1회)
 * - 수동 실행: curl -H "Authorization: Bearer $CRON_SECRET" <origin>/api/cron/perfume-arrivals
 * - 저장 없이 결과만 확인: ?dryRun=1
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron/perfume-arrivals] CRON_SECRET missing");
    return NextResponse.json({ message: "서버 설정 오류입니다." }, { status: 500 });
  }
  if (!isCronAuthorized(req, secret)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";

  try {
    const result = await runArrivalsPipeline({ dryRun });
    return NextResponse.json(result, { status: 200 });
  } catch (e) {
    console.error("[cron/perfume-arrivals] error:", e);
    return NextResponse.json({ message: "향수 신제품 수집 중 오류가 발생했습니다." }, { status: 500 });
  }
}
