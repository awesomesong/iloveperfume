import { NextResponse } from "next/server";
import { getCurrentUser } from "@/src/app/lib/session";
import { signSocketToken } from "@/src/app/lib/socketAuth/signSocketToken";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * 소켓 서버 연결용 단기 토큰 발급.
 * 클라이언트(lib/socket.ts)가 (재)연결 때마다 호출해 handshake.auth.token으로 보낸다.
 * 소켓 서버는 이 토큰의 sub만 사용자 ID로 믿는다.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user?.id) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401, headers: NO_STORE });
  }

  const secret = process.env.SOCKET_AUTH_SECRET;
  if (!secret) {
    console.error("[GET /api/socket/token] SOCKET_AUTH_SECRET missing");
    return NextResponse.json({ message: "서버 설정 오류입니다." }, { status: 500, headers: NO_STORE });
  }

  const token = signSocketToken(user.id, secret);
  return NextResponse.json({ token }, { status: 200, headers: NO_STORE });
}
