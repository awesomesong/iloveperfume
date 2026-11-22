/**
 * join:room 제한 (소켓 하나당). 소켓 서버에 의존하지 않는다 — 테스트: socket-server/test/joinLimiter.test.js
 *
 * - 요청 속도: windowMs(10초) 창마다 maxRequests(30)회까지. 넘는 요청은 무시하고, 창마다 경고 로그 1줄만 남기도록
 *   첫 초과 때만 warn: true를 돌려준다. 무시된 요청도 횟수에 센다.
 * - 대화방 룸 개수: maxRooms(100)개까지(넘으면 무시, 경고 로그는 소켓당 1번만 warn: true). 이미 들어간 방을 다시 요청하는 것은 개수 제한에 걸리지 않는다
 *   (클라이언트가 같은 방에 다시 join해 join:success를 읽음 처리 신호로 쓴다).
 */

const JOIN_WINDOW_MS = 10_000;
const JOIN_MAX_REQUESTS = 30;
const JOIN_MAX_ROOMS = 100;

function createJoinLimiter({ windowMs = JOIN_WINDOW_MS, maxRequests = JOIN_MAX_REQUESTS, maxRooms = JOIN_MAX_ROOMS } = {}) {
  let windowStart = -Infinity;
  let count = 0;
  let warned = false;
  let roomsWarned = false;

  /**
   * @param {object} p
   * @param {number} p.roomCount       지금 들어가 있는 대화방 룸 수 (개인 룸 제외)
   * @param {boolean} p.alreadyJoined  요청한 방에 이미 들어가 있는지
   * @param {number} [p.now]
   * @returns {{ ok: true } | { ok: false, reason: "rate" | "rooms", warn: boolean }}
   */
  function check({ roomCount, alreadyJoined, now = Date.now() }) {
    if (now - windowStart >= windowMs) {
      windowStart = now;
      count = 0;
      warned = false;
    }
    count++;
    if (count > maxRequests) {
      const warn = !warned;
      warned = true;
      return { ok: false, reason: "rate", warn };
    }
    if (!alreadyJoined && roomCount >= maxRooms) {
      const warn = !roomsWarned;
      roomsWarned = true;
      return { ok: false, reason: "rooms", warn };
    }
    return { ok: true };
  }

  return { check };
}

module.exports = { createJoinLimiter, JOIN_WINDOW_MS, JOIN_MAX_REQUESTS, JOIN_MAX_ROOMS };
