const crypto = require("crypto");

/**
 * 내부 전달 엔드포인트(POST /internal/emit)의 인증·검증 로직.
 * 소켓 서버에 의존하지 않는 순수 함수만 둔다 — 테스트: socket-server/test/internalEmit.test.js
 *
 * Next API가 DB에 저장한 뒤 이 엔드포인트로 "누구에게 무엇을 보낼지"를 알려준다.
 * 수신자는 요청 본문(= Next가 DB에서 계산한 값)에서만 정하고, 소켓 클라이언트가 보낸 값은 쓰지 않는다.
 * 요청 형식을 바꾸면 next-server/src/app/lib/socketServer/emitSocketEvents.ts도 같이 바꿀 것.
 */

// 한 요청에 담을 수 있는 이벤트·수신자 수 상한 (정상 요청은 이벤트 1~2개, 수신자는 대화방 인원 수)
const MAX_EVENTS = 10;
const MAX_USER_IDS = 500;
const MAX_ID_LENGTH = 200;

// 전체 접속자에게 보내는 이벤트 (공지·댓글·리뷰). 이 목록에 없는 이름은 거부한다
const BROADCAST_EVENTS = new Set([
  "notice:deleted",
  "notice:comment:new",
  "notice:comment:updated",
  "notice:comment:deleted",
  "fragrance:review:new",
  "fragrance:review:updated",
  "fragrance:review:deleted",
]);

// 지정한 사용자들의 개인 룸으로 보내는 이벤트
const USER_EVENTS = new Set(["conversation:new", "read:state"]);

const ROOM_EVENT_TYPES = new Set(["member.left", "room.deleted"]);

/**
 * x-webhook-secret 헤더 검사. 길이가 달라도 시간 차이가 나지 않도록 해시끼리 비교한다.
 * @returns {"ok" | "unauthorized" | "misconfigured"}
 */
function checkWebhookSecret(given, expected) {
  if (!expected) return "misconfigured";
  if (typeof given !== "string" || !given) return "unauthorized";
  const a = crypto.createHash("sha256").update(given).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(a, b) ? "ok" : "unauthorized";
}

const isId = (v) => typeof v === "string" && v.length > 0 && v.length <= MAX_ID_LENGTH;
const isPlainObject = (v) => !!v && typeof v === "object" && !Array.isArray(v);

/** 사용자 ID 목록 검증 + 중복 제거. 형식이 틀리면 null */
function toUserIds(value, { allowEmpty = false } = {}) {
  if (!Array.isArray(value) || value.length > MAX_USER_IDS) return null;
  if (!value.every(isId)) return null;
  const ids = [...new Set(value)];
  if (!allowEmpty && ids.length === 0) return null;
  return ids;
}

/**
 * 이벤트 하나를 검증해 서버가 그대로 쓸 수 있는 형태로 돌려준다. 형식이 틀리면 { error }.
 *
 * 지원 형식:
 * - { kind: "message", message: { id, conversationId, ... }, userIds }
 *     → 참여자별 receive:conversation (오프라인이면 큐), 시스템 메시지가 아니면 receive:message
 * - { kind: "room.event", conversationId, type: "member.left" | "room.deleted", userId?, remainingUserIds?, userIds }
 *     → userIds에게 room.event (rev는 소켓 서버가 매긴다)
 * - { kind: "users", event: "conversation:new" | "read:state", payload, userIds }
 * - { kind: "broadcast", event: <BROADCAST_EVENTS>, payload, exceptUserIds? }
 */
function validateEvent(evt) {
  if (!isPlainObject(evt)) return { error: "event must be an object" };

  switch (evt.kind) {
    case "message": {
      const message = evt.message;
      if (!isPlainObject(message)) return { error: "message must be an object" };
      if (!isId(message.id) || !isId(message.conversationId)) return { error: "message id/conversationId required" };
      const userIds = toUserIds(evt.userIds);
      if (!userIds) return { error: "userIds invalid" };
      return { event: { kind: "message", message, userIds } };
    }
    case "room.event": {
      if (!isId(evt.conversationId)) return { error: "conversationId required" };
      if (!ROOM_EVENT_TYPES.has(evt.type)) return { error: "unknown room event type" };
      const userIds = toUserIds(evt.userIds);
      if (!userIds) return { error: "userIds invalid" };
      if (evt.type === "member.left") {
        if (!isId(evt.userId)) return { error: "userId required for member.left" };
        const remainingUserIds = toUserIds(evt.remainingUserIds ?? [], { allowEmpty: true });
        if (!remainingUserIds) return { error: "remainingUserIds invalid" };
        return {
          event: { kind: "room.event", conversationId: evt.conversationId, type: evt.type, userId: evt.userId, remainingUserIds, userIds },
        };
      }
      return {
        event: {
          kind: "room.event",
          conversationId: evt.conversationId,
          type: evt.type,
          userId: isId(evt.userId) ? evt.userId : undefined,
          userIds,
        },
      };
    }
    case "users": {
      if (!USER_EVENTS.has(evt.event)) return { error: "unknown user event" };
      if (!isPlainObject(evt.payload)) return { error: "payload must be an object" };
      const userIds = toUserIds(evt.userIds);
      if (!userIds) return { error: "userIds invalid" };
      return { event: { kind: "users", event: evt.event, payload: evt.payload, userIds } };
    }
    case "broadcast": {
      if (!BROADCAST_EVENTS.has(evt.event)) return { error: "unknown broadcast event" };
      if (!isPlainObject(evt.payload)) return { error: "payload must be an object" };
      const exceptUserIds = toUserIds(evt.exceptUserIds ?? [], { allowEmpty: true });
      if (!exceptUserIds) return { error: "exceptUserIds invalid" };
      return { event: { kind: "broadcast", event: evt.event, payload: evt.payload, exceptUserIds } };
    }
    default:
      return { error: "unknown kind" };
  }
}

/**
 * 요청 본문 { events: [...] } 검증. 하나라도 틀리면 전체를 거부한다(일부만 보내지 않음).
 * @returns {{ ok: true, events: object[] } | { ok: false, error: string }}
 */
function validateEmitRequest(body) {
  if (!isPlainObject(body)) return { ok: false, error: "body must be an object" };
  const { events } = body;
  if (!Array.isArray(events) || events.length === 0) return { ok: false, error: "events required" };
  if (events.length > MAX_EVENTS) return { ok: false, error: "too many events" };
  const out = [];
  for (let i = 0; i < events.length; i++) {
    const res = validateEvent(events[i]);
    if (res.error) return { ok: false, error: `events[${i}]: ${res.error}` };
    out.push(res.event);
  }
  return { ok: true, events: out };
}

/** room.event 리비전: 단조 증가 + 대략적 시간 반영 */
function nextRoomRev(last, now = Date.now()) {
  return Math.max((last ?? 0) + 1, now);
}

/** room.event로 클라이언트에 보내는 페이로드 (기존 리스너 형식과 같다) */
function buildRoomEventPayload(evt, rev, now = Date.now()) {
  return {
    conversationId: evt.conversationId,
    type: evt.type,
    userId: evt.userId,
    ts: now,
    rev,
    ...(evt.type === "member.left" && { recipients: evt.remainingUserIds }),
  };
}

module.exports = {
  checkWebhookSecret,
  validateEmitRequest,
  nextRoomRev,
  buildRoomEventPayload,
  BROADCAST_EVENTS,
  USER_EVENTS,
  MAX_EVENTS,
  MAX_USER_IDS,
};
