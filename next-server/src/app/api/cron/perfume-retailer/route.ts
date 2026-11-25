import { NextRequest } from "next/server";
import { GET as runArrivalsCron } from "../perfume-arrivals/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 공식 사이트를 읽을 수 없는 브랜드의 기존 향수 채우기 크론 진입점 (vercel.json, 매일 1회).
 * Vercel 크론 주소에는 쿼리스트링을 쓸 수 없어 따로 둔 주소일 뿐이고, 인증과 실행은 perfume-arrivals의 ?backfill=retailer와 같다.
 */
export function GET(req: NextRequest) {
  const url = new URL(req.url);
  url.searchParams.set("backfill", "retailer");
  return runArrivalsCron(new NextRequest(url, req));
}
