// 소켓 연결 토큰 검증 단위 테스트 (Node 내장 테스트 러너, 의존성 없음)
// 실행: cd socket-server && npm test
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { verifySocketToken } = require("../socketAuth");

const SECRET = "a".repeat(64);
const NOW = 1_800_000_000_000;

// 형식 그대로 직접 만드는 서명 (테스트용)
function sign(payload, secret = SECRET) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}
const validPayload = (over = {}) => ({ sub: "user-1", exp: Math.floor(NOW / 1000) + 300, ...over });

test("정상 토큰이면 userId를 돌려준다", () => {
  assert.equal(verifySocketToken(sign(validPayload()), SECRET, NOW), "user-1");
});

test("다른 비밀값으로 서명한 토큰은 거부한다", () => {
  assert.equal(verifySocketToken(sign(validPayload(), SECRET + "x"), SECRET, NOW), null);
});

test("payload를 바꾸면(다른 사용자로 위조) 거부한다", () => {
  const token = sign(validPayload());
  const forgedBody = Buffer.from(JSON.stringify(validPayload({ sub: "victim" }))).toString("base64url");
  assert.equal(verifySocketToken(`${forgedBody}.${token.split(".")[1]}`, SECRET, NOW), null);
});

test("만료된 토큰은 거부한다 (만료 시각과 같아도 거부)", () => {
  const exp = Math.floor(NOW / 1000);
  assert.equal(verifySocketToken(sign(validPayload({ exp })), SECRET, NOW), null);
  assert.equal(verifySocketToken(sign(validPayload({ exp: exp - 1 })), SECRET, NOW), null);
});

test("sub·exp가 없거나 타입이 틀리면 거부한다", () => {
  assert.equal(verifySocketToken(sign({ exp: Math.floor(NOW / 1000) + 300 }), SECRET, NOW), null);
  assert.equal(verifySocketToken(sign({ sub: "user-1" }), SECRET, NOW), null);
  assert.equal(verifySocketToken(sign(validPayload({ sub: 123 })), SECRET, NOW), null);
  assert.equal(verifySocketToken(sign(validPayload({ exp: "9999999999" })), SECRET, NOW), null);
});

test("형식이 깨진 토큰은 예외 없이 거부한다", () => {
  for (const bad of [undefined, null, 123, "", "abc", "a.b.c", ".sig", "body.", "!!!.???"]) {
    assert.equal(verifySocketToken(bad, SECRET, NOW), null, String(bad));
  }
  // 서명은 맞지만 body가 JSON이 아닌 경우
  const body = Buffer.from("not-json").toString("base64url");
  const sig = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  assert.equal(verifySocketToken(`${body}.${sig}`, SECRET, NOW), null);
});

test("비밀값이 비어 있으면 항상 거부한다", () => {
  assert.equal(verifySocketToken(sign(validPayload(), ""), "", NOW), null);
});

// 계약 테스트: Next의 실제 발급 함수(signSocketToken.ts)가 만든 토큰을 이 검증 함수가 받아들여야 한다.
// Node 22.18+는 .ts 파일의 타입을 제거하고 바로 import할 수 있다.
test("Next의 signSocketToken이 만든 토큰과 호환된다", async () => {
  const signerPath = path.join(__dirname, "../../next-server/src/app/lib/socketAuth/signSocketToken.ts");
  const { signSocketToken, SOCKET_TOKEN_TTL_SECONDS } = await import(pathToFileURL(signerPath).href);
  const token = signSocketToken("user-42", SECRET, NOW);
  assert.equal(verifySocketToken(token, SECRET, NOW), "user-42");
  // 유효시간이 지나면 거부
  assert.equal(verifySocketToken(token, SECRET, NOW + SOCKET_TOKEN_TTL_SECONDS * 1000), null);
  // 다른 비밀값이면 거부
  assert.equal(verifySocketToken(token, SECRET + "x", NOW), null);
});
