// join:room 제한 단위 테스트 (Node 내장 테스트 러너, 의존성 없음)
// 실행: cd socket-server && npm test
const test = require("node:test");
const assert = require("node:assert/strict");
const { createJoinLimiter, JOIN_WINDOW_MS, JOIN_MAX_REQUESTS, JOIN_MAX_ROOMS } = require("../joinLimiter");

const req = (now, over = {}) => ({ roomCount: 0, alreadyJoined: false, now, ...over });

test("기본값: 10초에 30회, 대화방 100개", () => {
  assert.equal(JOIN_WINDOW_MS, 10_000);
  assert.equal(JOIN_MAX_REQUESTS, 30);
  assert.equal(JOIN_MAX_ROOMS, 100);
});

test("10초 안에 30회까지 허용, 31번째부터 무시하고 경고는 창마다 1번", () => {
  const lim = createJoinLimiter();
  for (let i = 0; i < 30; i++) assert.deepEqual(lim.check(req(1000 + i)), { ok: true }, `#${i + 1}`);
  assert.deepEqual(lim.check(req(2000)), { ok: false, reason: "rate", warn: true });
  for (let i = 0; i < 10; i++) assert.deepEqual(lim.check(req(3000 + i)), { ok: false, reason: "rate", warn: false });
});

test("창이 지나면 다시 허용하고 경고도 다시 1번 남긴다", () => {
  const lim = createJoinLimiter();
  for (let i = 0; i < 31; i++) lim.check(req(0));
  assert.equal(lim.check(req(9_999)).ok, false); // 아직 같은 창
  assert.deepEqual(lim.check(req(10_000)), { ok: true }); // 새 창
  for (let i = 0; i < 29; i++) lim.check(req(10_001));
  assert.deepEqual(lim.check(req(10_002)), { ok: false, reason: "rate", warn: true });
});

test("대화방 100개에서 새 방은 무시, 이미 들어간 방은 허용", () => {
  const lim = createJoinLimiter();
  assert.deepEqual(lim.check(req(0, { roomCount: 99 })), { ok: true });
  assert.deepEqual(lim.check(req(0, { roomCount: 100 })), { ok: false, reason: "rooms", warn: true });
  assert.deepEqual(lim.check(req(0, { roomCount: 100 })), { ok: false, reason: "rooms", warn: false }); // 경고는 소켓당 1번
  assert.deepEqual(lim.check(req(0, { roomCount: 100, alreadyJoined: true })), { ok: true });
});

test("무시된 요청도 횟수에 센다 (방 개수 초과 요청으로 속도 제한을 우회할 수 없음)", () => {
  const lim = createJoinLimiter();
  for (let i = 0; i < 30; i++) lim.check(req(0, { roomCount: 100 }));
  assert.equal(lim.check(req(0, { alreadyJoined: true })).reason, "rate");
});

test("소켓마다 따로 센다", () => {
  const a = createJoinLimiter();
  const b = createJoinLimiter();
  for (let i = 0; i < 31; i++) a.check(req(0));
  assert.deepEqual(b.check(req(0)), { ok: true });
});

test("설정값을 바꿀 수 있다", () => {
  const lim = createJoinLimiter({ windowMs: 100, maxRequests: 2, maxRooms: 1 });
  assert.equal(lim.check(req(0)).ok, true);
  assert.equal(lim.check(req(0, { roomCount: 1 })).reason, "rooms");
  assert.equal(lim.check(req(0)).reason, "rate");
  assert.equal(lim.check(req(100)).ok, true);
});
