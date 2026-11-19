// 내부 전달 엔드포인트(/internal/emit) 인증·검증 단위 테스트 (Node 내장 테스트 러너, 의존성 없음)
// 실행: cd socket-server && npm test
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  checkWebhookSecret,
  validateEmitRequest,
  nextRoomRev,
  buildRoomEventPayload,
  MAX_EVENTS,
  MAX_USER_IDS,
} = require("../internalEmit");

const SECRET = "s".repeat(64);

// ── 시크릿 ────────────────────────────────────────────────────────────────
test("시크릿이 같으면 ok", () => {
  assert.equal(checkWebhookSecret(SECRET, SECRET), "ok");
});

test("시크릿이 다르거나 길이가 달라도 unauthorized (예외 없이)", () => {
  assert.equal(checkWebhookSecret(SECRET + "x", SECRET), "unauthorized");
  assert.equal(checkWebhookSecret("short", SECRET), "unauthorized");
  assert.equal(checkWebhookSecret(SECRET.toUpperCase(), SECRET), "unauthorized");
});

test("시크릿 헤더가 없으면 unauthorized", () => {
  assert.equal(checkWebhookSecret(undefined, SECRET), "unauthorized");
  assert.equal(checkWebhookSecret("", SECRET), "unauthorized");
  assert.equal(checkWebhookSecret(["a"], SECRET), "unauthorized");
});

test("서버에 시크릿이 없으면 어떤 값이든 misconfigured (빈 값끼리 통과하지 않음)", () => {
  assert.equal(checkWebhookSecret("", ""), "misconfigured");
  assert.equal(checkWebhookSecret("anything", undefined), "misconfigured");
});

// ── 요청 본문 검증 ─────────────────────────────────────────────────────────
const message = (over = {}) => ({ id: "m1", conversationId: "c1", body: "hi", type: "text", ...over });

test("정상 message 이벤트를 통과시키고 수신자 중복을 제거한다", () => {
  const res = validateEmitRequest({ events: [{ kind: "message", message: message(), userIds: ["a", "b", "a"] }] });
  assert.equal(res.ok, true);
  assert.deepEqual(res.events[0].userIds, ["a", "b"]);
  assert.equal(res.events[0].message.id, "m1");
});

test("본문 형식이 틀리면 거부한다", () => {
  for (const body of [null, "x", [], {}, { events: [] }, { events: "x" }]) {
    assert.equal(validateEmitRequest(body).ok, false, JSON.stringify(body));
  }
});

test("message: id/conversationId/수신자가 없으면 거부한다", () => {
  const bad = [
    { kind: "message", message: message({ id: "" }), userIds: ["a"] },
    { kind: "message", message: message({ conversationId: 1 }), userIds: ["a"] },
    { kind: "message", message: message(), userIds: [] },
    { kind: "message", message: message(), userIds: ["a", 3] },
    { kind: "message", message: message() },
    { kind: "message", message: "text", userIds: ["a"] },
  ];
  for (const evt of bad) assert.equal(validateEmitRequest({ events: [evt] }).ok, false, JSON.stringify(evt));
});

test("알 수 없는 kind/이벤트 이름은 거부한다 (임의 이벤트 중계 불가)", () => {
  const bad = [
    { kind: "send:message", message: message(), userIds: ["a"] },
    { kind: "users", event: "receive:message", payload: {}, userIds: ["a"] },
    { kind: "users", event: "room.event", payload: {}, userIds: ["a"] },
    { kind: "broadcast", event: "receive:conversation", payload: {} },
    { kind: "broadcast", event: "online:user", payload: {} },
  ];
  for (const evt of bad) assert.equal(validateEmitRequest({ events: [evt] }).ok, false, JSON.stringify(evt));
});

test("users/broadcast: 허용된 이벤트만 통과, payload는 객체여야 한다", () => {
  assert.equal(validateEmitRequest({ events: [{ kind: "users", event: "read:state", payload: { conversationId: "c1" }, userIds: ["a"] }] }).ok, true);
  assert.equal(validateEmitRequest({ events: [{ kind: "users", event: "conversation:new", payload: [], userIds: ["a"] }] }).ok, false);
  const b = validateEmitRequest({ events: [{ kind: "broadcast", event: "notice:deleted", payload: { noticeId: "n1" }, exceptUserIds: ["a"] }] });
  assert.equal(b.ok, true);
  assert.deepEqual(b.events[0].exceptUserIds, ["a"]);
  // exceptUserIds 생략 가능
  const b2 = validateEmitRequest({ events: [{ kind: "broadcast", event: "fragrance:review:new", payload: {} }] });
  assert.deepEqual(b2.events[0].exceptUserIds, []);
});

test("room.event: member.left는 userId 필수, 타입은 두 가지만", () => {
  const ok = validateEmitRequest({
    events: [{ kind: "room.event", conversationId: "c1", type: "member.left", userId: "a", remainingUserIds: ["b"], userIds: ["a", "b"] }],
  });
  assert.equal(ok.ok, true);
  assert.equal(validateEmitRequest({ events: [{ kind: "room.event", conversationId: "c1", type: "member.left", userIds: ["b"] }] }).ok, false);
  assert.equal(validateEmitRequest({ events: [{ kind: "room.event", conversationId: "c1", type: "room.renamed", userIds: ["b"] }] }).ok, false);
  assert.equal(validateEmitRequest({ events: [{ kind: "room.event", conversationId: "c1", type: "room.deleted", userIds: ["b"] }] }).ok, true);
});

test("이벤트 하나라도 틀리면 전체를 거부한다", () => {
  const res = validateEmitRequest({
    events: [
      { kind: "message", message: message(), userIds: ["a"] },
      { kind: "broadcast", event: "nope", payload: {} },
    ],
  });
  assert.equal(res.ok, false);
  assert.match(res.error, /events\[1\]/);
});

test("이벤트 수·수신자 수 상한", () => {
  const evt = { kind: "message", message: message(), userIds: ["a"] };
  assert.equal(validateEmitRequest({ events: Array(MAX_EVENTS).fill(evt) }).ok, true);
  assert.equal(validateEmitRequest({ events: Array(MAX_EVENTS + 1).fill(evt) }).ok, false);
  const many = Array.from({ length: MAX_USER_IDS + 1 }, (_, i) => `u${i}`);
  assert.equal(validateEmitRequest({ events: [{ ...evt, userIds: many }] }).ok, false);
  assert.equal(validateEmitRequest({ events: [{ ...evt, userIds: ["x".repeat(201)] }] }).ok, false);
});

// ── room.event 페이로드 ────────────────────────────────────────────────────
test("rev는 단조 증가한다", () => {
  assert.equal(nextRoomRev(undefined, 1000), 1000);
  assert.equal(nextRoomRev(5000, 1000), 5001);
  assert.equal(nextRoomRev(999, 1000), 1000);
});

test("room.event 페이로드는 기존 리스너 형식 그대로 (member.left만 recipients 포함)", () => {
  const left = buildRoomEventPayload(
    { conversationId: "c1", type: "member.left", userId: "a", remainingUserIds: ["b"] },
    7,
    100,
  );
  assert.deepEqual(left, { conversationId: "c1", type: "member.left", userId: "a", ts: 100, rev: 7, recipients: ["b"] });
  const deleted = buildRoomEventPayload({ conversationId: "c1", type: "room.deleted", userId: "a" }, 8, 100);
  assert.deepEqual(deleted, { conversationId: "c1", type: "room.deleted", userId: "a", ts: 100, rev: 8 });
});
