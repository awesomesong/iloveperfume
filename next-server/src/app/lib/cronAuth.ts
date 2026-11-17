import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

/** Authorization: Bearer <CRON_SECRET> 검증 (Vercel Cron이 자동으로 붙여 보낸다) */
export function isCronAuthorized(req: NextRequest, secret: string): boolean {
  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
