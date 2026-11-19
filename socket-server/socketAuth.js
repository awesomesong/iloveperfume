const crypto = require("crypto");

/**
 * Next(/api/socket/token)가 발급한 토큰을 검증하고 userId를 돌려준다. 실패하면 null.
 * 토큰 형식: base64url(JSON {sub, exp}) + "." + base64url(HMAC-SHA256(secret, 앞부분))
 * 발급 쪽 구현: next-server/src/app/lib/socketAuth/signSocketToken.ts (형식을 바꾸면 같이 바꿀 것)
 * 테스트: socket-server/test/socketAuth.test.js
 */
function verifySocketToken(token, secret, now = Date.now()) {
  if (typeof token !== "string" || !secret) return null;
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const [body, sig] = parts;

  const expected = crypto.createHmac("sha256", secret).update(body).digest();
  let given;
  try {
    given = Buffer.from(sig, "base64url");
  } catch {
    return null;
  }
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;

  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  const sub = typeof payload?.sub === "string" ? payload.sub : "";
  const exp = typeof payload?.exp === "number" ? payload.exp : 0;
  if (!sub || exp * 1000 <= now) return null;
  return sub;
}

module.exports = { verifySocketToken };
