import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/src/app/lib/cronAuth";
import { runNewsPipeline } from "@/src/app/lib/news/runPipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/**
 * 실행 시간 상한(초). 넘으면 Vercel이 함수를 강제 종료한다 — 무한정 걸리는 실행을 끊는 안전장치다.
 * 평소 실행: 네이버 수집 ~10초 + OpenAI 최대 40초 + og:image 최대 5초 + DB 저장 ≈ 최악 55초.
 * 60초는 네이버 재시도·타임아웃이 겹치면 넘을 수 있어 여유를 두고 120초로 잡았다.
 * Fluid compute 기준 Hobby 최대 300초, Pro 최대 800초 (vercel.com/docs/functions/configuring-functions/duration).
 */
export const maxDuration = 120;

/**
 * 향수 뉴스 수집 크론 엔드포인트.
 * - 스케줄: vercel.json (매일 1회)
 * - 수동 실행: curl -H "Authorization: Bearer $CRON_SECRET" <origin>/api/cron/perfume-news
 * - 저장 없이 결과만 확인: ?dryRun=1
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron/perfume-news] CRON_SECRET missing");
    return NextResponse.json({ message: "서버 설정 오류입니다." }, { status: 500 });
  }
  if (!isCronAuthorized(req, secret)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";

  try {
    const result = await runNewsPipeline({ dryRun });
    return NextResponse.json(result, { status: 200 });
  } catch (e) {
    console.error("[cron/perfume-news] error:", e);
    return NextResponse.json({ message: "향수 뉴스 수집 중 오류가 발생했습니다." }, { status: 500 });
  }
}
