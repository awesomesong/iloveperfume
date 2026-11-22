/**
 * 접속 상태(presence) 추적 + 변경 묶어 보내기.
 * 소켓 서버에 의존하지 않는다 — 테스트: socket-server/test/presence.test.js
 *
 * - 사용자당 소켓(탭) 여러 개를 센다. 첫 소켓이 붙거나 마지막 소켓이 끊길 때만 "상태가 바뀐" 것으로 본다.
 * - 바뀐 userId는 dirty 집합에 모았다가 flushMs마다 한 번 { online, offline }으로 보낸다.
 *   flush 시점의 현재 상태로 나누므로, 창 안에서 켜졌다 꺼진 사용자도 빠지지 않는다
 *   (그 사이 스냅샷을 받은 소켓이 잘못된 상태로 남지 않게).
 * - 빈 delta는 보내지 않는다.
 *
 * 이전 방식(소켓마다 즉시 전체에 online:user/leave:user)은 N명이 한꺼번에 재접속하면 약 N×N건이 나갔다.
 */

const PRESENCE_FLUSH_MS = 1000;

/**
 * @param {object} opts
 * @param {(delta: {online: string[], offline: string[]}) => void} opts.onFlush  delta를 보낼 함수 (서버에서는 io.emit)
 * @param {number} [opts.flushMs]
 * @param {Function} [opts.setTimer]   테스트용 (기본 setTimeout)
 * @param {Function} [opts.clearTimer] 테스트용 (기본 clearTimeout)
 */
function createPresence({ onFlush, flushMs = PRESENCE_FLUSH_MS, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  const socketToUser = new Map(); // socketId -> userId
  const userToSockets = new Map(); // userId -> Set<socketId>
  const dirty = new Set();
  let timer = null;

  function schedule() {
    if (timer) return;
    timer = setTimer(() => {
      timer = null;
      flush();
    }, flushMs);
    // 남은 flush 때문에 프로세스 종료가 막히지 않게
    if (timer && typeof timer.unref === "function") timer.unref();
  }

  function markDirty(userId) {
    dirty.add(userId);
    schedule();
  }

  /** @returns {boolean} 이 사용자의 첫 소켓이면 true */
  function add(socketId, userId) {
    if (!socketId || !userId || socketToUser.has(socketId)) return false;
    socketToUser.set(socketId, userId);
    let set = userToSockets.get(userId);
    const first = !set;
    if (!set) {
      set = new Set();
      userToSockets.set(userId, set);
    }
    set.add(socketId);
    if (first) markDirty(userId);
    return first;
  }

  /** @returns {{userId: string, isLastSocket: boolean} | null} */
  function remove(socketId) {
    const userId = socketToUser.get(socketId);
    if (!userId) return null;
    socketToUser.delete(socketId);
    const set = userToSockets.get(userId);
    let isLastSocket = true;
    if (set) {
      set.delete(socketId);
      isLastSocket = set.size === 0;
      if (isLastSocket) userToSockets.delete(userId);
    }
    if (isLastSocket) markDirty(userId);
    return { userId, isLastSocket };
  }

  /** 실제로 살아 있는 소켓 목록과 비교해 남은 항목을 지운다 (disconnect를 놓친 경우 대비, 주기적으로만 호출) */
  function prune(activeSocketIds) {
    let removed = 0;
    for (const socketId of [...socketToUser.keys()]) {
      if (!activeSocketIds.has(socketId)) {
        remove(socketId);
        removed++;
      }
    }
    return removed;
  }

  /** 지금까지 바뀐 사용자를 현재 상태 기준으로 나눠 돌려주고 dirty를 비운다. 바뀐 게 없으면 null */
  function takeDelta() {
    if (dirty.size === 0) return null;
    const online = [];
    const offline = [];
    for (const userId of dirty) {
      if (userToSockets.has(userId)) online.push(userId);
      else offline.push(userId);
    }
    dirty.clear();
    return { online, offline };
  }

  function flush() {
    if (timer) {
      clearTimer(timer);
      timer = null;
    }
    const delta = takeDelta();
    if (delta && onFlush) onFlush(delta);
    return delta;
  }

  return {
    add,
    remove,
    prune,
    flush,
    takeDelta,
    isOnline: (userId) => userToSockets.has(userId),
    /** 새 소켓에 보내는 스냅샷 (userId만 — 이메일은 보내지 않는다) */
    snapshot: () => Array.from(userToSockets.keys(), (userId) => ({ userId })),
    get userCount() {
      return userToSockets.size;
    },
    get socketCount() {
      return socketToUser.size;
    },
    get pendingCount() {
      return dirty.size;
    },
  };
}

module.exports = { createPresence, PRESENCE_FLUSH_MS };
