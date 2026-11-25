require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { verifySocketToken } = require("./socketAuth");
const {
  checkWebhookSecret,
  validateEmitRequest,
  nextRoomRev,
  buildRoomEventPayload,
} = require("./internalEmit");
const { createPresence, PRESENCE_FLUSH_MS } = require("./presence");
const { createJoinLimiter } = require("./joinLimiter");

// ✅ 로그 원칙: 정상 경로는 시작 1줄 + /internal/emit 요청당 1줄(종류·수신자 수)만.
// 인증 실패는 사유만, 그 외에는 에러만. 연결·해제·join·presence 같은 정상 이벤트는 SOCKET_DEBUG=1일 때만.
// 메시지 본문·이메일·시크릿·토큰은 어떤 경우에도 남기지 않는다.
const DEBUG = process.env.SOCKET_DEBUG === "1";
const debug = (...args) => {
  if (DEBUG) console.log("[debug]", ...args);
};

// 개인 룸 이름 (인증된 본인 소켓만 들어간다)
const userRoom = (userId) => `user:${userId}`;

// join:room/leave:room으로 다룰 수 있는 방 이름 (개인 룸 user:<id>는 제외)
function isConversationRoomId(roomId) {
  return typeof roomId === "string" && roomId.length > 0 && roomId.length <= 200 && !roomId.startsWith("user:");
}

// 소켓이 들어가 있는 대화방 룸 수 (자기 socket.id 룸과 개인 룸 제외)
function conversationRoomCount(socket) {
  let n = 0;
  for (const room of socket.rooms) {
    if (room !== socket.id && !room.startsWith("user:")) n++;
  }
  return n;
}

const app = express();
const httpServer = http.createServer(app);
httpServer.setTimeout(120000);

// ✅ 연결 인증 — 토큰 필수. SOCKET_AUTH_SECRET은 Next(/api/socket/token)와 같은 값.
// 비어 있으면 어떤 연결도 검증할 수 없으므로 전부 거부한다.
const SOCKET_AUTH_SECRET = process.env.SOCKET_AUTH_SECRET || "";
if (!SOCKET_AUTH_SECRET) {
  console.error("[auth] SOCKET_AUTH_SECRET 미설정 — 모든 소켓 연결을 거부합니다.");
}

// 인증 실패 로그: 사유만 남기고(토큰·userId 원문 제외), 같은 사유는 10초에 1줄로 묶는다
// (토큰 없는 구버전 탭이 재연결을 반복해도 로그가 쌓이지 않게).
const AUTH_LOG_INTERVAL_MS = 10_000;
const authFailLog = new Map(); // reason -> { lastAt, suppressed }
function logAuthFailure(reason) {
  const now = Date.now();
  const entry = authFailLog.get(reason) || { lastAt: 0, suppressed: 0 };
  if (now - entry.lastAt >= AUTH_LOG_INTERVAL_MS) {
    const extra = entry.suppressed ? ` (+${entry.suppressed}건 생략)` : "";
    console.warn(`[auth] 연결 거부: ${reason}${extra}`);
    entry.lastAt = now;
    entry.suppressed = 0;
  } else {
    entry.suppressed++;
  }
  authFailLog.set(reason, entry);
}

// 허용 도메인 (끝 슬래시 정규화, 시작 시 1회)
const normalizedAllowedOrigins = (process.env.CLIENT_ORIGIN || "")
  .split(",")
  .map((s) => s.trim().replace(/\/$/, ""))
  .filter(Boolean);

const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (normalizedAllowedOrigins.includes(origin.replace(/\/$/, ""))) {
        callback(null, true);
      } else {
        console.warn("Blocked origin:", origin);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
  },
  // ✅ Socket.IO v4만 사용 (EIO3 비활성화)
  allowEIO3: false,
  // 응답 없는 연결(half-open: 모바일 네트워크 전환·터널) 감지: 15초마다 ping, 10초 안에 pong이 없으면 끊는다.
  // 최악 약 25초(이전 25s+30s = 55초) 뒤 disconnect → presence offline. 끊긴 동안의 메시지는 클라이언트가 재접속 때 DB에서 다시 불러온다.
  pingInterval: 15000,
  pingTimeout: 10000,
  transports: ["websocket"], // polling 폴백 없이 WebSocket 전용 사용 (Fly.io 환경에서 안정적)
});

// ✅ 접속 상태 — 변경(첫 소켓 연결/마지막 소켓 끊김)을 모아 최대 1초에 한 번 presence:delta로 전체에 보낸다.
const presence = createPresence({
  flushMs: PRESENCE_FLUSH_MS,
  onFlush: (delta) => {
    io.emit("presence:delta", delta);
    debug(`presence:delta online=${delta.online.length} offline=${delta.offline.length}`);
  },
});

// disconnect를 놓친 소켓이 접속 상태에 남지 않도록 1분마다 실제 소켓 목록과 맞춘다 (연결마다 하지 않음)
setInterval(() => {
  try {
    const removed = presence.prune(new Set(io.sockets.sockets.keys()));
    if (removed) console.error(`[presence] disconnect 누락 소켓 ${removed}개 정리`);
  } catch (e) {
    console.error("[presence] 정리 실패:", e?.message || e);
  }
}, 60_000).unref();

// ✅ room.event 리비전 — 서버 전체 단일 카운터 (방별 Map 없음)
let lastRoomRev = 0;

// Express REST 엔드포인트용 CORS 헤더 미들웨어
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && normalizedAllowedOrigins.includes(origin.replace(/\/$/, ""))) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Vary", "Origin");
  }
  next();
});

app.get("/", (req, res) => {
  res.status(200).send("Socket Server is OK");
});

// ✅ HTTP POST로 새 사용자 등록 알림 받기 (웹훅 보안 포함)
app.post("/api/user-registered", express.json(), (req, res) => {
  // 웹훅 보안 체크 (받은 값은 로그에 남기지 않는다)
  const secretCheck = checkWebhookSecret(req.get("x-webhook-secret"), process.env.WEBHOOK_SECRET);

  if (secretCheck === "misconfigured") {
    console.error("[user-registered] WEBHOOK_SECRET 미설정 — 요청 거부");
    return res.status(500).json({ ok: false, message: "서버 설정 오류" });
  }
  if (secretCheck !== "ok") {
    console.warn("[user-registered] 인증 실패");
    return res.status(401).json({ ok: false, message: "인증 실패" });
  }

  // useremail은 받아도 쓰지 않는다 (전체 브로드캐스트에 이메일을 싣지 않음)
  const { userId, name, image, createdAt } = req.body;
  io.emit("registered:user", { userId, name, image: image ?? null, createdAt });
  debug("registered:user broadcast");

  res.status(200).json({ ok: true, message: "알림 전송 완료" });
});

// ✅ 내부 전달 엔드포인트 — Next API가 DB에 저장한 뒤 호출한다 (브라우저는 호출하지 않음)
// 수신자·내용은 요청 본문(Next가 DB에서 계산한 값)으로만 정한다. 형식: internalEmit.js
// 반환값은 로그 요약 (종류·수신자 수만 — 본문·ID 제외)
function deliverInternalEvent(evt) {
  switch (evt.kind) {
    case "message": {
      // 참여자 전원(보낸 사람의 다른 탭 포함)의 개인 룸으로 한 이벤트만 보낸다. 시스템 메시지도 같다.
      // 오프라인 사용자는 따로 보관하지 않는다 — 재접속 때 클라이언트가 DB에서 다시 불러온다.
      io.to(evt.userIds.map(userRoom)).emit("receive:conversation", evt.message);
      return `message to=${evt.userIds.length}`;
    }
    case "room.event": {
      const { conversationId, type, userId, userIds } = evt;
      lastRoomRev = nextRoomRev(lastRoomRev);
      io.to(userIds.map(userRoom)).emit("room.event", buildRoomEventPayload(evt, lastRoomRev));

      // 서버 쪽 정리: 대화방 룸에서 소켓을 뺀다 (대화방 룸으로 보내는 이벤트는 없지만 방 개수 제한에 쓰인다)
      if (type === "member.left" && userId) {
        io.in(userRoom(userId)).socketsLeave(conversationId); // 나간 사용자의 모든 탭
      } else if (type === "room.deleted") {
        io.in(conversationId).socketsLeave(conversationId);
      }
      return `room.event ${type} to=${userIds.length}`;
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
  const secretCheck = checkWebhookSecret(req.get("x-webhook-secret"), process.env.WEBHOOK_SECRET);
  if (secretCheck === "misconfigured") {
    console.error("[internal/emit] WEBHOOK_SECRET 미설정 — 요청 거부");
    return res.status(500).json({ ok: false, message: "서버 설정 오류" });
  }
  if (secretCheck !== "ok") {
    console.warn("[internal/emit] 인증 실패");
    return res.status(401).json({ ok: false, message: "인증 실패" });
  }
  return next();
}

app.post("/internal/emit", requireInternalSecret, express.json({ limit: "1mb" }), (req, res) => {
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
  console.log(`[internal/emit] ${summary.join(" | ")}`);
  return res.status(200).json({ ok: true, delivered: summary.length });
});

// express.json 파싱 실패(깨진 JSON·용량 초과)는 본문 없이 400으로 응답한다
app.use((err, req, res, next) => {
  if (err && (err.type === "entity.parse.failed" || err.type === "entity.too.large")) {
    return res.status(400).json({ ok: false, message: "잘못된 요청 본문" });
  }
  return next(err);
});

// CORS preflight OPTIONS 요청 처리
app.options("*", (req, res) => {
  const origin = req.headers.origin;
  if (!origin) return res.sendStatus(200);

  if (normalizedAllowedOrigins.includes(origin.replace(/\/$/, ""))) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Requested-With, Accept, Origin, x-webhook-secret",
    );
    res.header("Access-Control-Allow-Credentials", "true");
    return res.sendStatus(200);
  }
  return res.sendStatus(403);
});

// ✅ 연결 인증 미들웨어 — socket.data.userId는 여기서만 정한다.
// 토큰(auth.token)만 신원으로 쓴다. handshake.auth.userId·이메일, 이벤트 페이로드의 값은 쓰지 않는다.
io.use((socket, next) => {
  if (!SOCKET_AUTH_SECRET) {
    logAuthFailure("server_secret_missing");
    return next(new Error("unauthorized"));
  }
  const token = typeof socket.handshake.auth?.token === "string" ? socket.handshake.auth.token : "";
  if (!token) {
    logAuthFailure("missing_token");
    return next(new Error("unauthorized"));
  }
  const userId = verifySocketToken(token, SOCKET_AUTH_SECRET);
  if (!userId) {
    logAuthFailure("invalid_token"); // 서명 불일치·만료·형식 오류 (원문은 남기지 않음)
    return next(new Error("unauthorized"));
  }
  socket.data.userId = userId;
  return next();
});

io.on("connection", (socket) => {
  // 🧩 신원은 인증 미들웨어가 정한 값만 사용
  const userId = socket.data.userId;

  // ✅ 개인 룸 조인 + 접속 상태 등록 (클라이언트 신호를 기다리지 않는다)
  socket.join(userRoom(userId));
  presence.add(socket.id, userId);

  // ✅ 새로 접속한 소켓에만 1회 스냅샷 (자기 자신 포함). 이후 변경은 presence:delta로 받는다.
  socket.emit("get:onlineUsers", presence.snapshot());
  debug(`connect user=${userId} sockets=${presence.socketCount}`);

  // 🚫 클라이언트가 보내던 중계 이벤트(send:message, conversation:new, read:state, room.event,
  //    notice:*, fragrance:review:*)와 online:user는 받지 않는다. 각 API가 저장 후 /internal/emit으로 보낸다.

  // 채팅방 입장 — 대화방 룸으로는 아무 이벤트도 보내지 않으므로 멤버 확인은 하지 않는다.
  // join:success는 클라이언트의 입장 시 읽음 처리 신호로 쓰인다.
  // 개인 룸(user:<id>)은 인증된 본인만 들어가야 하므로 이름으로 막는다.
  const joinLimiter = createJoinLimiter();
  socket.on("join:room", (roomId) => {
    if (!isConversationRoomId(roomId)) return;
    const verdict = joinLimiter.check({
      roomCount: conversationRoomCount(socket),
      alreadyJoined: socket.rooms.has(roomId),
    });
    if (!verdict.ok) {
      if (verdict.warn) {
        console.warn(
          verdict.reason === "rate"
            ? "[join:room] 요청이 너무 많아 무시 (10초에 30회 초과)"
            : "[join:room] 소켓당 대화방 100개 초과 — 무시",
        );
      }
      return;
    }
    socket.join(roomId);
    socket.emit("join:success", roomId);
    debug(`join:room user=${userId}`);
  });

  // 채팅방 퇴장
  socket.on("leave:room", (roomId) => {
    if (!isConversationRoomId(roomId)) return;
    socket.leave(roomId);
  });

  // 연결 해제 — Socket.IO가 룸에서 자동으로 빼므로 접속 상태만 정리한다
  socket.on("disconnect", (reason) => {
    const result = presence.remove(socket.id);
    debug(`disconnect user=${userId} reason=${reason} last=${!!result?.isLastSocket}`);
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`> Server running on PORT ${PORT} (presence flush ${PRESENCE_FLUSH_MS}ms, ping 15s/10s)`);
});
