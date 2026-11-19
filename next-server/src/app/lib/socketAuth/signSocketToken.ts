// 서버 전용 — 소켓 서버 연결용 토큰 서명 (node:crypto를 쓰므로 클라이언트 번들에 들어가면 빌드가 실패한다)
//
// 토큰 형식: base64url(JSON {sub, exp}) + "." + base64url(HMAC-SHA256(secret, 앞부분))
//   - sub: userId
//   - exp: 만료 시각 (unix 초)
// 검증 쪽 구현: socket-server/socketAuth.js의 verifySocketToken (호환 테스트: socket-server/test/socketAuth.test.js).
// 형식을 바꾸면 server.js와 socket-server/scripts/ws-audit.js의 signToken도 같이 바꿔야 한다.
import { createHmac } from "node:crypto";

/** 핸드셰이크까지만 살아 있으면 되므로 짧게 둔다. 재연결 때마다 새로 발급받는다. */
export const SOCKET_TOKEN_TTL_SECONDS = 5 * 60;

export function signSocketToken(userId: string, secret: string, now: number = Date.now()): string {
  const payload = {
    sub: userId,
    exp: Math.floor(now / 1000) + SOCKET_TOKEN_TTL_SECONDS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}
