const express = require("express");
const http = require("http");
const { verifySocketToken } = require("./socketAuth");
const {
  checkWebhookSecret,
  validateEmitRequest,
  nextRoomRev,
  buildRoomEventPayload,
} = require("./internalEmit");
const { Server } = require("socket.io");

// ✅ 메시지 큐 저장소 (Connection State Recovery 대신)
const messageQueue = new Map(); // userId -> [{ message, timestamp, conversationId }]

// ✅ 메시지 큐 TTL (24시간)
const MESSAGE_QUEUE_TTL = 24 * 60 * 60 * 1000;

// ✅ 메시지 큐잉 헬퍼 함수
const addToQueue = (userId, message, conversationId) => {
  if (!messageQueue.has(userId)) {
    messageQueue.set(userId, []);
  }
  const queue = messageQueue.get(userId);
  const now = Date.now();
  queue.push({
    message,
    timestamp: now,
    conversationId
  });
  // 큐 크기 제한 (최대 50개)
  if (queue.length > 50) {
    queue.shift();
  }
  console.log(`📦 Message queued for user ${userId}: ${queue.length} messages in queue`);
};

const getQueuedMessages = (userId) => {
  const now = Date.now();
  const queue = (messageQueue.get(userId) || []).filter(
    (item) => now - item.timestamp < MESSAGE_QUEUE_TTL
  );
  if (queue.length === 0) {
    messageQueue.delete(userId);
  } else {
    messageQueue.set(userId, queue);
  }
  console.log(`📤 Delivering ${queue.length} queued messages to user ${userId}`);
  return queue;
};

const clearQueue = (userId) => {
  messageQueue.delete(userId);
  console.log(`🗑️ Queue cleared for user ${userId}`);
};

// ✅ 사용자 정보를 담는 Map (socketId -> { socketId, userId })
// Map을 사용하여 O(1) 추가/삭제/검색 성능 향상
const onlineUsersMap = new Map(); // socketId -> { socketId, userId }

// ✅ userId로 빠른 검색을 위한 역인덱스 Map (userId -> Set<socketId>)
// O(1) 검색 성능을 위해 추가
const userIdToSocketsMap = new Map(); // userId -> Set<socketId>

// ✅ 온라인 사용자 스냅샷 생성 유틸 (userId만 — 이메일은 보내지 않는다)
function getOnlineSnapshot() {
  return Array.from(userIdToSocketsMap.keys()).map((userId) => ({ userId }));
}

// ✅ 프로세스 전역 리비전 Map (다중 탭/인스턴스 대비)
const globalRoomRev = new Map();

// ✅ 방별 소켓 캐시 (member.left 때 나간 사용자의 소켓을 방에서 빼기 위함) - 유저당 소켓 여러 개 고려
// roomId -> (userId -> Set<socketId>)
// 대화방 룸으로는 더 이상 메시지를 보내지 않는다 (receive:message도 개인 룸으로 보냄).
const roomMembers = new Map();

/** 헬퍼 함수들 */
// 유저 고정 룸 이름 생성 (개인 알림용)
const userRoom = (userId) => `user:${userId}`;

function joinRoomMember(roomId, userId, socketId) {
  if (!roomMembers.has(roomId)) roomMembers.set(roomId, new Map());
  const byUser = roomMembers.get(roomId);
  if (!byUser.has(userId)) byUser.set(userId, new Set());
  byUser.get(userId).add(socketId);
}

function leaveRoomMember(roomId, userId, socketId) {
  const byUser = roomMembers.get(roomId);
  if (!byUser) return;
  if (byUser.has(userId)) {
    const set = byUser.get(userId);
    set.delete(socketId);
    if (set.size === 0) byUser.delete(userId);
  }
  if (byUser.size === 0) roomMembers.delete(roomId);
}

// join:room/leave:room으로 다룰 수 있는 방 이름 (개인 룸 user:<id>는 제외)
function isConversationRoomId(roomId) {
  return typeof roomId === "string" && roomId.length > 0 && roomId.length <= 200 && !roomId.startsWith("user:");
}

function isUserOnline(userId) {
  const set = userIdToSocketsMap.get(userId);
  return !!set && set.size > 0;
}

/**
 * 사용자 소켓을 onlineUsersMap에 추가합니다.
 * 동일한 socketId가 이미 존재하면 추가하지 않습니다.
 * @param {string} socketId - 현재 접속한 소켓의 ID
 * @param {string} userId - 사용자의 고유 ID (연결 인증에서 확인된 값)
 */
const addUser = (socketId, userId) => {
  if (!socketId || !userId) return;

  // 같은 소켓이 이미 있으면 스킵
  if (onlineUsersMap.has(socketId)) {
    console.log(`ℹ️ User ${userId} with socket ${socketId} already exists. Skipping add.`);
    return;
  }

  onlineUsersMap.set(socketId, { socketId, userId });
  
  // ✅ 역인덱스 업데이트: userId -> Set<socketId>
  if (!userIdToSocketsMap.has(userId)) {
    userIdToSocketsMap.set(userId, new Set());
  }
  userIdToSocketsMap.get(userId).add(socketId);
  
  console.log(`✅ User ${userId} added with socket ${socketId}. Total online: ${onlineUsersMap.size}`);
};

/**
 * 사용자 소켓을 onlineUsersMap에서 제거합니다.
 * @param {string} socketId - 연결 해제된 소켓의 ID
 * @returns {{userId: string|null, isLastSocket: boolean}} - 해당 소켓의 userId, 그리고 해당 사용자의 마지막 소켓인지 여부
 */
const removeUser = (socketId) => {
  const leavingUser = onlineUsersMap.get(socketId);
  
  if (!leavingUser) {
    console.log(`⚠️ Socket ${socketId} not found in onlineUsersMap for removal.`);
    return null;
  }

  onlineUsersMap.delete(socketId);

  // ✅ 역인덱스 업데이트: userId -> Set<socketId>
  const socketSet = userIdToSocketsMap.get(leavingUser.userId);
  if (socketSet) {
    socketSet.delete(socketId);
    // Set이 비면 Map에서도 제거
    if (socketSet.size === 0) {
      userIdToSocketsMap.delete(leavingUser.userId);
    }
  }

  // ✅ O(1)로 동일한 userId를 가진 다른 소켓이 남아있는지 확인
  const isLastSocket = !userIdToSocketsMap.has(leavingUser.userId);

  console.log(`🗑️ Socket ${socketId} for ${leavingUser.userId} removed. Total online: ${onlineUsersMap.size}`);

  return {
    userId: leavingUser.userId,
    isLastSocket: isLastSocket,
  };
};



const app = express();
const httpServer = http.createServer(app);

// ✅ UTF-8 인코딩 설정 (한글 깨짐 방지)
httpServer.setTimeout(120000);
require("dotenv").config();

// ✅ 연결 인증 설정
// - SOCKET_AUTH_SECRET: Next(/api/socket/token)와 같은 값. 토큰 서명 검증용.
// - SOCKET_AUTH_REQUIRED: "true"면 토큰 없는 연결을 거부한다.
//   그 외에는 배포 전환 기간용 호환 모드 — 토큰 없는 구버전 클라이언트는 auth.userId로 연결을 허용한다.
//   토큰이 있는데 검증에 실패한 연결은 모드와 상관없이 항상 거부한다.
// 전환 순서: 소켓 서버 배포(호환 모드) → Next 배포 → SOCKET_AUTH_REQUIRED=true
const SOCKET_AUTH_SECRET = process.env.SOCKET_AUTH_SECRET || "";
const SOCKET_AUTH_REQUIRED = process.env.SOCKET_AUTH_REQUIRED === "true";

if (!SOCKET_AUTH_SECRET) {
  if (SOCKET_AUTH_REQUIRED) {
    console.error("[auth] SOCKET_AUTH_SECRET 미설정 + SOCKET_AUTH_REQUIRED=true — 모든 소켓 연결을 거부합니다.");
  } else {
    console.warn("[auth] SOCKET_AUTH_SECRET 미설정 — 토큰 검증 없이 호환 모드(auth.userId)로만 동작합니다.");
  }
} else {
  console.log(`[auth] 연결 인증 활성화 (토큰 필수: ${SOCKET_AUTH_REQUIRED})`);
}

// 설정 오류 로그가 연결마다 쌓이지 않도록 1분에 한 번만 남긴다.
let lastAuthConfigErrorAt = 0;

// 허용 도메인 정리
const allowedOrigins = (process.env.CLIENT_ORIGIN || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

// 끝 슬래시 정규화된 허용 도메인 캐시 (서버 시작 시 1회만 계산)
const normalizedAllowedOrigins = allowedOrigins.map(orig => orig.replace(/\/$/, ''));

const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      
      // origin 끝 슬래시 정규화
      const normalizedOrigin = origin.replace(/\/$/, '');
      
      if (normalizedAllowedOrigins.includes(normalizedOrigin)) {
        callback(null, true);
      } else {
        console.log("Blocked origin:", origin);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
  },
  // ✅ Socket.IO v4만 사용 (EIO3 비활성화)
  allowEIO3: false,
  // 연결 상태 감지를 위한 heartbeat/ping 설정
  pingInterval: 25000, // 서버가 클라이언트에 ping을 보내는 간격(ms)
  pingTimeout: 30000,  // ping 후 pong이 오지 않으면 연결 끊기까지 대기 시간(ms) — pingInterval보다 크게 설정
  transports: ["websocket"], // polling 폴백 없이 WebSocket 전용 사용 (Fly.io 환경에서 안정적)
});

// Express REST 엔드포인트용 CORS 헤더 미들웨어
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  if (!origin) {
    next();
    return;
  }
  
  // origin 끝 슬래시 정규화
  const normalizedOrigin = origin.replace(/\/$/, '');
  
  if (normalizedAllowedOrigins.includes(normalizedOrigin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Vary', 'Origin');
  }
  
  next();
});

app.get("/", (req, res) => {
  res.status(200).send("Socket Server is OK");
});

  // ✅ HTTP POST로 새 사용자 등록 알림 받기 (웹훅 보안 포함)
  app.post('/api/user-registered', express.json(), (req, res) => {
    // 웹훅 보안 체크 (받은 값은 로그에 남기지 않는다)
    const secretCheck = checkWebhookSecret(req.get('x-webhook-secret'), process.env.WEBHOOK_SECRET);

    if (secretCheck === 'misconfigured') {
      console.warn('[Socket Server] WEBHOOK_SECRET 환경변수가 설정되지 않음');
      return res.status(500).json({ ok: false, message: '서버 설정 오류' });
    }

    if (secretCheck !== 'ok') {
      console.warn('[Socket Server] 웹훅 인증 실패 (/api/user-registered)');
      return res.status(401).json({ ok: false, message: '인증 실패' });
    }
    
    // useremail은 받아도 쓰지 않는다 (전체 브로드캐스트에 이메일을 싣지 않음)
    const { userId, name, image, createdAt } = req.body;

    console.log(`[Socket Server] HTTP POST로 새 사용자 등록 알림 수신:`, {
      userId,
      name,
      createdAt,
      totalOnlineUsers: onlineUsersMap.size
    });

    // 모든 온라인 사용자에게 새 사용자 등록 알림
    io.emit("registered:user", {
      userId,
      name,
      image: image ?? null,
      createdAt
    });
  
    console.log(`[Socket Server] 새 사용자 등록 알림 전송 완료: ${name}`);
    
    res.status(200).json({ ok: true, message: '알림 전송 완료' });
});

// ✅ 내부 전달 엔드포인트 — Next API가 DB에 저장한 뒤 호출한다 (브라우저는 호출하지 않음)
// 수신자·내용은 요청 본문(Next가 DB에서 계산한 값)으로만 정한다. 형식: internalEmit.js
// 로그에는 이벤트 종류와 수신자 수만 남긴다 (본문·시크릿 제외).
function deliverInternalEvent(evt) {
  switch (evt.kind) {
    case "message": {
      const { message, userIds } = evt;
      const onlineRooms = [];
      let queued = 0;
      for (const uid of userIds) {
        if (isUserOnline(uid)) {
          onlineRooms.push(userRoom(uid));
        } else {
          // 오프라인: 재접속(online:user) 때 전달할 큐에 저장
          addToQueue(uid, message, message.conversationId);
          queued++;
        }
      }
      // 대화방 리스트 갱신용 — 보낸 사람의 모든 탭 포함 (보낸 탭은 클라이언트가 id로 중복 제거)
      if (onlineRooms.length) io.to(onlineRooms).emit("receive:conversation", message);
      // 실시간 메시지(읽음 처리 트리거) — 개인 룸으로 보내고 클라이언트가 conversationId로 거른다
      if (message.type !== "system") io.to(userIds.map(userRoom)).emit("receive:message", message);
      return `message conv=${message.conversationId} to=${userIds.length} queued=${queued}`;
    }
    case "room.event": {
      const { conversationId, type, userId, userIds } = evt;
      const rev = nextRoomRev(globalRoomRev.get(conversationId));
      globalRoomRev.set(conversationId, rev);
      io.to(userIds.map(userRoom)).emit("room.event", buildRoomEventPayload(evt, rev));

      // 이벤트 타입별 서버 주도 정리
      if (type === "member.left") {
        // 나간 사용자의 소켓만 방에서 퇴장
        const byUser = roomMembers.get(conversationId);
        const socketIds = byUser?.get(userId);
        if (socketIds && socketIds.size) {
          for (const sid of socketIds) {
            const s = io.sockets.sockets.get(sid);
            if (s) {
              try { s.leave(conversationId); } catch {}
              s.data.joinedRooms?.delete(conversationId);
            }
          }
          byUser.delete(userId);
          if (byUser.size === 0) roomMembers.delete(conversationId);
        }
      } else if (type === "room.deleted") {
        // 모든 소켓을 해당 방에서 퇴장시키고 캐시도 삭제
        io.in(conversationId).socketsLeave(conversationId);
        roomMembers.delete(conversationId);
        globalRoomRev.delete(conversationId);
      }
      return `room.event ${type} conv=${conversationId} to=${userIds.length}`;
    }
    case "users": {
      io.to(evt.userIds.map(userRoom)).emit(evt.event, evt.payload);
      return `${evt.event} to=${evt.userIds.length}`;
    }
    case "broadcast": {
      const target = evt.exceptUserIds.length ? io.except(evt.exceptUserIds.map(userRoom)) : io;
      target.emit(evt.event, evt.payload);
      return `${evt.event} broadcast`;
    }
    default:
      return null;
  }
}

// 본문을 읽기 전에 시크릿부터 확인한다
function requireInternalSecret(req, res, next) {
  const secretCheck = checkWebhookSecret(req.get('x-webhook-secret'), process.env.WEBHOOK_SECRET);
  if (secretCheck === 'misconfigured') {
    console.error('[internal/emit] WEBHOOK_SECRET 미설정 — 요청 거부');
    return res.status(500).json({ ok: false, message: '서버 설정 오류' });
  }
  if (secretCheck !== 'ok') {
    console.warn('[internal/emit] 인증 실패');
    return res.status(401).json({ ok: false, message: '인증 실패' });
  }
  return next();
}

app.post('/internal/emit', requireInternalSecret, express.json({ limit: '1mb' }), (req, res) => {
  const parsed = validateEmitRequest(req.body);
  if (!parsed.ok) {
    console.warn(`[internal/emit] 잘못된 요청: ${parsed.error}`);
    return res.status(400).json({ ok: false, message: parsed.error });
  }

  // 요청 안의 순서대로 보낸다 (예: conversation:new → 첫 메시지)
  const summary = [];
  for (const evt of parsed.events) {
    try {
      const line = deliverInternalEvent(evt);
      if (line) summary.push(line);
    } catch (e) {
      console.error(`[internal/emit] 전달 실패 (${evt.kind}):`, e?.message || e);
    }
  }
  console.log(`[internal/emit] ${summary.join(' | ')}`);
  return res.status(200).json({ ok: true, delivered: summary.length });
});

// express.json 파싱 실패(깨진 JSON·용량 초과)는 본문 없이 400으로 응답한다
app.use((err, req, res, next) => {
  if (err && (err.type === 'entity.parse.failed' || err.type === 'entity.too.large')) {
    return res.status(400).json({ ok: false, message: '잘못된 요청 본문' });
  }
  return next(err);
});

// CORS preflight OPTIONS 요청 처리
app.options('*', (req, res) => {
  const origin = req.headers.origin;

  if (!origin) return res.sendStatus(200); // !origin 케이스 안전 처리

  // origin 끝 슬래시 정규화
  const normalizedOrigin = origin.replace(/\/$/, '');

  if (normalizedAllowedOrigins.includes(normalizedOrigin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 
      'Content-Type, Authorization, X-Requested-With, Accept, Origin, x-webhook-secret');
    res.header('Access-Control-Allow-Credentials', 'true');
    return res.sendStatus(200);
  }

  return res.sendStatus(403);
});

// ✅ 연결 인증 미들웨어 — socket.data.userId는 여기서만 정한다.
// 이후 핸들러는 handshake.auth나 이벤트 페이로드의 userId·email을 신원으로 쓰지 않는다.
io.use((socket, next) => {
  const auth = socket.handshake.auth || {};
  const token = typeof auth.token === "string" ? auth.token : "";

  if (SOCKET_AUTH_REQUIRED && !SOCKET_AUTH_SECRET) {
    const now = Date.now();
    if (now - lastAuthConfigErrorAt > 60_000) {
      lastAuthConfigErrorAt = now;
      console.error("[auth] SOCKET_AUTH_SECRET 미설정 — 연결 거부 중");
    }
    return next(new Error("unauthorized"));
  }

  // 토큰이 있으면 반드시 검증한다 (비밀값이 없는 호환 모드에서는 검증할 수 없으므로 아래 호환 경로로)
  if (token && SOCKET_AUTH_SECRET) {
    const userId = verifySocketToken(token, SOCKET_AUTH_SECRET);
    if (!userId) {
      console.log(`[auth] 잘못된 토큰으로 연결 거부 (socket ${socket.id})`);
      return next(new Error("unauthorized"));
    }
    socket.data.userId = userId;
    socket.data.authVia = "token";
    return next();
  }

  if (SOCKET_AUTH_REQUIRED) {
    return next(new Error("unauthorized"));
  }

  // 호환 모드: 토큰을 보내지 않는 구버전 클라이언트 (SOCKET_AUTH_REQUIRED=true 전환 후 제거)
  const legacyUserId = String(auth.userId || "");
  if (!legacyUserId) {
    // 로그인한 클라이언트만 연결하므로 신원 없는 연결은 받지 않는다
    return next(new Error("unauthorized"));
  }
  console.log(`[auth] 토큰 없는 호환 연결 (socket ${socket.id})`);
  socket.data.userId = legacyUserId;
  socket.data.authVia = "legacy";
  return next();
});

io.on("connection", (socket) => {
  // 🧩 신원은 인증 미들웨어가 정한 값만 사용
  const authUserId = socket.data.userId;

  // ✅ 소켓이 참여한 방들을 안전하게 추적
  socket.data.joinedRooms = new Set();

  // ✅ 유저 고정 룸 조인 (개인 알림용)
  socket.join(userRoom(authUserId));
  socket.data.joinedRooms.add(userRoom(authUserId));
  console.log(`User ${authUserId} joined personal room: ${userRoom(authUserId)}`);

  // 연결 시 한 번: 현재 io의 소켓 목록과 비교하여 stale socket 엔트리 정리
  try {
    const activeSocketIds = new Set([...io.sockets.sockets.keys()]);
    const before = onlineUsersMap.size;
    for (const [socketId, user] of onlineUsersMap.entries()) {
      if (!activeSocketIds.has(socketId) || !user.userId) {
        onlineUsersMap.delete(socketId);
        // ✅ 역인덱스도 같이 정리
        if (user.userId) {
          const socketSet = userIdToSocketsMap.get(user.userId);
          if (socketSet) {
            socketSet.delete(socketId);
            if (socketSet.size === 0) {
              userIdToSocketsMap.delete(user.userId);
            }
          }
        }
      }
    }
    const after = onlineUsersMap.size;
    if (before !== after) {
      console.log(`🧹 Pruned stale socket entries: ${before - after} removed. Active: ${after}`);
    }
  } catch (e) {
    console.log("Prune on connection failed:", e);
  }

  // ✅ 새로 접속한 소켓에만 1회 스냅샷 전송 (인증된 소켓만 여기까지 온다)
  socket.emit("get:onlineUsers", getOnlineSnapshot());

  // ✅ 접속 상태 등록 — 서버가 이미 사용자를 알므로 online:user를 기다리지 않는다
  {
    const alreadyOnline = userIdToSocketsMap.has(authUserId) && userIdToSocketsMap.get(authUserId).size > 0;
    addUser(socket.id, authUserId);
    if (!alreadyOnline) {
      console.log(`[Socket Server] 첫 온라인 - 델타 전송: ${authUserId}`);
      io.emit("online:user", { userId: authUserId });
    }
  }

  // 클라이언트가 연결 후 보내는 신호 — 큐된 메시지 전달용. 페이로드의 userId·email은 무시한다.
  // (접속 상태 등록은 연결 시 이미 끝났으므로 여기서는 중복 없이 처리됨)
  socket.on("online:user", () => {
    const uid = socket.data.userId;
    if (!uid) return;

    // ✅ 개인 룸 조인 (연결 시 이미 조인했으면 스킵)
    {
      const room = userRoom(uid);
      if (!socket.data.joinedRooms?.has(room)) {
        socket.join(room);
        socket.data.joinedRooms.add(room);
        console.log(`User ${uid} joined personal room: ${room} (via online:user)`);
      }
      
      // ✅ 큐된 메시지 전달
      const queuedMessages = getQueuedMessages(uid);
      queuedMessages.forEach(({ message, conversationId }) => {
        // 1) 대화방 리스트 업데이트용 (모든 메시지)
        socket.emit("receive:conversation", message);
        
        // 2) 실시간 메시지는 현재 join한 방만 전송
        if (message?.type !== "system") {
          // 현재 join한 방 목록 확인
          const isJoined = socket.data.joinedRooms.has(conversationId);
          if (isJoined) {
            socket.emit("receive:message", message);
          }
        }
      });
      
      // 큐 정리
      if (queuedMessages.length > 0) {
        clearQueue(uid);
      }
    }

    // ✅ 해당 유저가 이미 온라인인지 체크 (O(1)) — 보통 연결 시 등록되어 있으므로 스킵된다
    const alreadyOnline = userIdToSocketsMap.has(uid) && userIdToSocketsMap.get(uid).size > 0;

    addUser(socket.id, uid);

    // ✅ 이 유저가 "처음" 온라인 상태가 되었을 때만 델타 전송
    if (!alreadyOnline) {
      console.log(`[Socket Server] 첫 온라인 - 델타 전송: ${uid}`);
      io.emit("online:user", { userId: uid });
    } else {
      console.log(`[Socket Server] 이미 온라인 - 델타 스킵: ${uid}`);
    }
  });

  // 🚫 클라이언트가 보내던 중계 이벤트(send:message, conversation:new, read:state, room.event,
  //    notice:*, fragrance:review:*)는 받지 않는다. 각 API가 저장 후 /internal/emit으로 보낸다.

  // 사용자가 채팅방에 입장할 때 (room에 join)
  // 대화방 룸으로는 아무 이벤트도 보내지 않으므로(메시지·읽음·방 이벤트는 개인 룸으로 보냄) 멤버 확인은 하지 않는다.
  // join:success는 클라이언트의 입장 시 읽음 처리 신호로만 쓰인다.
  // 개인 룸(user:<id>)은 인증된 본인만 들어가야 하므로 이름으로 막는다.
  socket.on("join:room", (roomId) => {
    if (!isConversationRoomId(roomId)) return;
    // 🧱 필수 가드: userId가 없으면 join 무시
    if (!socket.data?.userId) {
      console.log(`[join:room] missing userId for socket ${socket.id}, ignoring.`);
      return;
    }
    
    socket.join(roomId);
    
    // ✅ 멤버 캐시 업데이트 (소켓 기준)
    joinRoomMember(roomId, socket.data.userId, socket.id);
    socket.data.joinedRooms.add(roomId);
    
    console.log(`User ${socket.data.userId} joined room ${roomId}`);
    
    // ✅ join:success 이벤트 전송 (클라이언트에서 방 입장 완료 확인용)
    socket.emit("join:success", roomId);
    console.log(`[join:success] sent to ${socket.data.userId} for room ${roomId}`);
  });

  // 사용자가 채팅방에서 나갈 때 (room에서 leave)
  socket.on("leave:room", (roomId) => {
    if (!isConversationRoomId(roomId)) return;
    if (!socket.data?.userId) return;        // ← 가드 추가
    socket.leave(roomId);
    
    // ✅ 멤버 캐시 업데이트 (소켓 기준)
    leaveRoomMember(roomId, socket.data.userId, socket.id);
    socket.data.joinedRooms.delete(roomId);
    
    console.log(`User ${socket.data.userId} (Socket: ${socket.id}) left room: ${roomId}`);
  });


  // 소켓 연결 해제 시
  socket.on("disconnect", () => {
    try {
      // ✅ 안전한 방 추적으로 정리 (socket.rooms가 비어있을 수 있음)
      const joinedRooms = [...(socket.data.joinedRooms ?? [])];
      if (joinedRooms.length > 0) {
        console.log(`ℹ️ Disconnect cleanup for ${socket.id}, rooms tracked:`, joinedRooms);
      }
      
      // ✅ 소켓을 해당 방들에서 강제로 탈퇴 (Socket.IO도 자동 정리하지만 명시적으로)
      if (joinedRooms.length) {
        for (const roomId of joinedRooms) {
          try { socket.leave(roomId); } catch {}
          if (socket.data?.userId) {
            leaveRoomMember(roomId, socket.data.userId, socket.id);
          }
        }
      }
    } catch (e) {
      console.log("Room cleanup inspection failed:", e);
    }
    // socket.data에 저장된 userId 정보를 가져옵니다.
    const disconnectedUserId = socket?.data?.userId;

    // onlineUsersList에서 소켓을 제거하고, 해당 사용자의 마지막 소켓인지 확인합니다.
    const result = removeUser(socket.id); // removeUser 함수는 이미 isLastSocket을 반환합니다.

    // ✅ 델타만 전송 (전체 스냅샷 브로드캐스트 제거)
    if (result && result.isLastSocket) {
      console.log(
        `📤 ${disconnectedUserId} fully disconnected.`,
      );
      io.emit("leave:user", { userId: result.userId }); // removeUser 반환값 사용 (socket.data 미설정 대비)
    } else if (result) {
        console.log(`ℹ️ Socket ${socket.id} for ${disconnectedUserId} disconnected, but other sessions remain.`);
    } else {
        console.log(`⚠️ Disconnected socket ${socket.id} not found in user list.`);
    }
  });

});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`> Server running on PORT ${PORT}`);
});
