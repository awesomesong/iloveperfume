// 소켓 서버 점검 스크립트 — 최적화 전/후 비교용 측정
//
// 로컬에 server.js를 띄워 아래 항목을 재현·측정한다. 운영 서버에는 접속하지 않는다.
//   1) 익명 연결이 온라인 사용자 이메일을 받는가 (인증된 사용자에게도 이메일이 가는가)
//   2) 사칭: 토큰 없는 연결(auth.userId만)·잘못된 비밀값·만료 토큰은 거부되는가,
//      M의 정상 토큰 + auth.userId="A"는 M으로 취급되는가, join:room("user:A")은 무시되는가
//   3) 소켓 클라이언트가 보낸 메시지·중계 이벤트(send:message, conversation:new, read:state, online:user,
//      notice:*, fragrance:review:*)가 다른 사용자에게 전달되는가 (아무것도 전달되지 않아야 함)
//   4) 대화방 멤버가 아닌 사용자가 room.deleted를 보낼 수 있는가
//   5) 응답 없는 연결(half-open)을 끊기까지 걸리는 시간 (ping 15s + timeout 10s → 최대 약 25초 + presence flush ≤1초)
//      서버는 큐로 복구하지 않는다 — 끊긴 동안의 메시지는 클라이언트가 재접속 때 DB에서 다시 불러온다.
//   6) 로그: 메시지 1건당 줄 수, 로그 전체에 본문·이메일·토큰·시크릿이 남는가
//   7) 내부 전달 엔드포인트(POST /internal/emit): 올바른 시크릿이면 지정한 사용자에게 receive:conversation 하나만
//      (receive:message 없음, 시스템 메시지 포함, 페이로드는 받은 그대로), 시크릿이 틀리거나 없으면 401
//   8) presence:delta: 변경을 1초 단위로 묶어 보내는가, 창 안에서 켜졌다 꺼진 사용자도 offline으로 오는가,
//      이전 이벤트(online:user/leave:user)는 오지 않는가
//   9) join:room 제한: 10초에 30회 초과 무시 + 경고 로그 1줄, 개인 룸 이름 거부
//  10) SOCKET_AUTH_SECRET이 없으면 시작 시 에러 로그 + 모든 연결 거부
//  11) presence 부하: N개 연결이 한꺼번에 붙을 때(이어서 절반이 한꺼번에 끊길 때) 받은 presence:delta 수·바이트,
//      이전 방식(소켓마다 즉시 online:user/leave:user)이었다면 받았을 이벤트 수, 스냅샷 바이트, 서버 RSS
//
// 서버는 SOCKET_AUTH_SECRET·WEBHOOK_SECRET(매번 새로 만든 임의 테스트 값)으로 띄운다.
// 정상 메시지는 Next API 대신 이 스크립트가 /internal/emit으로 직접 보낸다.
// 정상 사용자는 아래 signToken으로 직접 서명한 토큰을 쓴다.
//
// 실행 (레포 루트에서, next-server의 node_modules를 빌려 씀):
//   NODE_PATH=next-server/node_modules node socket-server/scripts/ws-audit.js
//   --quick           : 5번(half-open, 최대 약 30초 대기)을 건너뜀
//   --presence=200,1000 : 11번 연결 수 (기본 200,1000). --presence=0 이면 건너뜀
//   AUDIT_PORT (기본 4555): 점검 서버 포트. +1(비밀값 없는 서버), +2(부하 측정 서버)도 쓴다.
//
// 출력의 "pass"가 true면 해당 항목이 기대대로 동작한다.

const path = require("path");
const crypto = require("crypto");
const { spawn, execFileSync } = require("child_process");
const { io } = require("socket.io-client");

const PORT = Number(process.env.AUDIT_PORT || 4555);
const QUICK = process.argv.includes("--quick");
const PRESENCE_NS = (process.argv.find((a) => a.startsWith("--presence=")) || "--presence=200,1000")
  .slice("--presence=".length)
  .split(",")
  .map(Number)
  .filter((n) => n > 0);
const SECRET = crypto.randomBytes(32).toString("hex");
const WEBHOOK_SECRET = crypto.randomBytes(32).toString("hex");
const SERVER_JS = path.join(__dirname, "..", "server.js");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// next-server/src/app/lib/socketAuth/signSocketToken.ts와 같은 형식 — 형식을 바꾸면 같이 바꿀 것
const issuedTokens = [];
const signToken = (userId, { secret = SECRET, ttlSeconds = 300 } = {}) => {
  const body = Buffer.from(JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + ttlSeconds })).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  const token = `${body}.${sig}`;
  issuedTokens.push(token);
  return token;
};

// 서버를 띄우고 응답할 때까지 기다린다. stdout/stderr는 줄 단위로 모은다.
async function startServer(port, env) {
  const proc = spawn(process.execPath, [SERVER_JS], {
    env: { ...process.env, PORT: String(port), SOCKET_AUTH_SECRET: "", WEBHOOK_SECRET: "", ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const logLines = [];
  const onData = (buf) => logLines.push(...buf.toString().split("\n").filter(Boolean));
  proc.stdout.on("data", onData);
  proc.stderr.on("data", onData);
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(`http://localhost:${port}/`);
      if (r.ok) break;
    } catch {}
    await sleep(100);
  }
  return { proc, logLines, url: `http://localhost:${port}` };
}

const rssMB = (pid) => {
  try {
    return Math.round((Number(execFileSync("ps", ["-o", "rss=", "-p", String(pid)]).toString().trim()) / 1024) * 10) / 10;
  } catch {
    return null;
  }
};

// socket.io 웹소켓 프레임 크기 (이벤트 패킷 "42" + JSON 배열)
const packetBytes = (event, payload) => 2 + Buffer.byteLength(JSON.stringify([event, payload]));

const LEGACY_PRESENCE = ["online:user", "leave:user"];

// 연결 직후 오는 스냅샷·presence 이벤트를 놓치지 않도록 리스너를 먼저 건다. 거부되면 null.
const open = (url, auth) =>
  new Promise((resolve) => {
    const s = io(url, { transports: ["websocket"], auth, reconnection: false, forceNew: true });
    s.snapshot = null;
    s.snapshotBytes = 0;
    s.deltas = [];
    s.deltaBytes = 0;
    s.legacy = [];
    s.on("get:onlineUsers", (list) => {
      s.snapshot = list;
      s.snapshotBytes = packetBytes("get:onlineUsers", list);
    });
    s.on("presence:delta", (d) => {
      s.deltas.push(d);
      s.deltaBytes += packetBytes("presence:delta", d);
    });
    for (const ev of LEGACY_PRESENCE) s.on(ev, (u) => s.legacy.push([ev, u]));
    s.on("connect", () => resolve(s));
    s.on("connect_error", () => {
      s.close();
      resolve(null);
    });
  });

const emailsIn = (list) => (list || []).map((u) => u?.useremail).filter(Boolean);

// Next API가 하는 것처럼 내부 엔드포인트로 전달 요청. secret이 null이면 헤더 없이 보낸다.
const internalEmit = async (url, events, { secret = WEBHOOK_SECRET } = {}) => {
  const headers = { "Content-Type": "application/json" };
  if (secret !== null) headers["x-webhook-secret"] = secret;
  const res = await fetch(`${url}/internal/emit`, { method: "POST", headers, body: JSON.stringify({ events }) });
  return res.status;
};
const msg = (id, conversationId, body, userIds, extra = {}) => ({
  kind: "message",
  message: { id, conversationId, body, type: "text", sender: { id: userIds[0] }, conversation: { userIds }, ...extra },
  userIds,
});

// 2단계 이전에 클라이언트가 소켓으로 중계하던 이벤트 이름 (지금은 서버가 받지 않아야 함)
const RELAY_EVENTS = [
  "conversation:new",
  "read:state",
  "notice:deleted",
  "notice:comment:new",
  "notice:comment:updated",
  "notice:comment:deleted",
  "fragrance:review:new",
  "fragrance:review:updated",
  "fragrance:review:deleted",
];

// 받은 이벤트를 [이벤트명, 페이로드]로 모두 기록
const recordAll = (s) => {
  const log = [];
  s.onAny((ev, payload) => log.push([ev, payload]));
  return log;
};

// 이전 방식이었다면 받았을 presence 이벤트 수
// - 연결: k번째 사용자가 붙을 때 그때 붙어 있던 k개 소켓 전원에게 online:user → 1+2+…+N = N(N+1)/2 (상한 N×N)
// - 끊김: 남은 소켓 수가 M→M-L로 줄 때 k번째로 끊긴 사용자의 leave:user를 (M-k)개가 받음
const legacyConnectEvents = (n) => (n * (n + 1)) / 2;
const legacyLeaveEvents = (m, l) => {
  let sum = 0;
  for (let k = 1; k <= l; k++) sum += m - k;
  return sum;
};

async function presenceLoad(n) {
  const srv = await startServer(PORT + 2, { SOCKET_AUTH_SECRET: SECRET, WEBHOOK_SECRET });
  await sleep(300);
  const rssIdle = rssMB(srv.proc.pid);
  const tokens = Array.from({ length: n }, (_, i) => signToken(`load-${n}-${i}`));
  const t0 = Date.now();
  const sockets = await Promise.all(tokens.map((token) => open(srv.url, { token })));
  const connectMs = Date.now() - t0;
  const ok = sockets.filter(Boolean);
  await sleep(1500); // 마지막 flush 대기
  const rssConnected = rssMB(srv.proc.pid);

  const sum = (arr, f) => arr.reduce((a, s) => a + f(s), 0);
  const connectPhase = {
    deltaEvents: sum(ok, (s) => s.deltas.length),
    deltaBytes: sum(ok, (s) => s.deltaBytes),
    maxDeltasPerSocket: Math.max(...ok.map((s) => s.deltas.length)),
    legacyEventsReceived: sum(ok, (s) => s.legacy.length),
    snapshotBytesTotal: sum(ok, (s) => s.snapshotBytes),
  };
  // 마지막에 모든 소켓이 n명 전원을 온라인으로 보고 있는가 (스냅샷 + delta 적용 결과)
  const allConsistent = ok.every((s) => {
    const set = new Set((s.snapshot || []).map((u) => u.userId));
    for (const d of s.deltas) {
      d.online.forEach((id) => set.add(id));
      d.offline.forEach((id) => set.delete(id));
    }
    return set.size === n;
  });

  // 이전 방식 추정 바이트: online:user 패킷 크기 × 이벤트 수
  const avgLegacyPacket = packetBytes("online:user", { userId: `load-${n}-${Math.floor(n / 2)}` });
  const legacyConnect = legacyConnectEvents(n);

  // 절반이 한꺼번에 끊김
  ok.forEach((s) => {
    s.deltas = [];
    s.deltaBytes = 0;
  });
  const half = Math.floor(ok.length / 2);
  const leaving = ok.slice(0, half);
  const staying = ok.slice(half);
  leaving.forEach((s) => s.close());
  await sleep(1500);
  const leaveConsistentSample = staying[0]?.deltas.flatMap((d) => d.offline).length ?? 0;
  const leavePhase = {
    disconnected: half,
    deltaEvents: sum(staying, (s) => s.deltas.length),
    deltaBytes: sum(staying, (s) => s.deltaBytes),
    offlineIdsSeenBySample: leaveConsistentSample,
    legacyEventsReceived: sum(staying, (s) => s.legacy.length),
  };
  const legacyLeave = legacyLeaveEvents(ok.length, half);
  const avgLegacyLeavePacket = packetBytes("leave:user", { userId: `load-${n}-${Math.floor(n / 2)}` });

  staying.forEach((s) => s.close());
  await sleep(300);
  srv.proc.kill();

  return {
    connections: n,
    connected: ok.length,
    connectAllMs: connectMs,
    rssMB: { idle: rssIdle, connected: rssConnected },
    connect: {
      ...connectPhase,
      legacyEventsEstimate: legacyConnect,
      legacyEventsUpperBoundNxN: n * n,
      legacyBytesEstimate: legacyConnect * avgLegacyPacket,
      allSocketsSeeAllOnline: allConsistent,
    },
    halfDisconnect: {
      ...leavePhase,
      legacyEventsEstimate: legacyLeave,
      legacyBytesEstimate: legacyLeave * avgLegacyLeavePacket,
    },
    pass:
      ok.length === n &&
      allConsistent &&
      connectPhase.legacyEventsReceived === 0 &&
      leavePhase.legacyEventsReceived === 0 &&
      leaveConsistentSample === half,
  };
}

(async () => {
  const report = {};
  const main = await startServer(PORT, { SOCKET_AUTH_SECRET: SECRET, WEBHOOK_SECRET });
  const URL = main.url;
  const logLines = main.logLines;
  const allSockets = [];
  const track = (s) => {
    if (s) allSockets.push(s);
    return s;
  };

  try {
    // A는 구버전 클라이언트처럼 이메일도 같이 보낸다 — 서버가 이를 무시하고 다시 퍼뜨리지 않는지 확인
    const A = track(await open(URL, { token: signToken("A"), userId: "A", useremail: "alice@example.com" }));
    if (!A) throw new Error("서버 연결 실패 — 정상 토큰으로도 연결되지 않음");
    const aliceInbox = [];
    A.on("receive:conversation", (m) => aliceInbox.push(m?.body));
    const aliceRoomEvents = [];
    A.on("room.event", (e) => aliceRoomEvents.push(e));
    await sleep(200);

    // 1) 익명 연결 + 인증된 사용자가 받는 스냅샷·presence에 이메일이 있는가
    const anon = track(await open(URL, undefined));
    await sleep(300);
    const C = track(await open(URL, { token: signToken("C"), userId: "C" }));
    await sleep(1200); // presence flush
    const leakedEmails = emailsIn(anon?.snapshot);
    const authedEmails = [
      ...emailsIn(C?.snapshot),
      ...A.deltas.flatMap((d) => [...d.online, ...d.offline]).filter((id) => String(id).includes("@")),
    ];
    report.anonymousSeesEmails = {
      anonymousConnected: !!anon,
      leakedEmails,
      authenticatedSnapshot: C?.snapshot ?? null,
      emailsSentToAuthenticated: authedEmails,
      pass: !anon && leakedEmails.length === 0 && authedEmails.length === 0,
    };

    // 2) 사칭
    const fakeA = track(await open(URL, { useremail: "attacker@example.com", userId: "A" })); // 토큰 없음
    const wrongSecret = track(await open(URL, { token: signToken("A", { secret: "not-the-secret" }), userId: "A" }));
    const expired = track(await open(URL, { token: signToken("A", { ttlSeconds: -10 }), userId: "A" }));
    const M2 = track(await open(URL, { token: signToken("M"), userId: "A", useremail: "alice@example.com" })); // M 토큰 + A 사칭
    const fakeInbox = [];
    const m2Inbox = [];
    M2?.on("receive:conversation", (m) => m2Inbox.push(m?.body));
    M2?.emit("online:user", { useremail: "alice@example.com", userId: "A" }); // 핸들러 없음 — 무시돼야 함
    M2?.emit("join:room", "user:A"); // A의 개인 룸 — 무시돼야 함
    await sleep(200);

    // 정상 메시지 (Next API 역할): C→A 대화방은 C·A에게만, M 혼자 있는 방은 M에게만
    await internalEmit(URL, [msg("legit-1", "room-CA", "FOR-A-ONLY", ["C", "A"]), msg("legit-m", "room-M", "FOR-M", ["M"])]);
    await sleep(300);

    // 3) 위조 메시지·중계 이벤트 — 소켓 클라이언트가 보내는 것은 아무것도 전달되지 않아야 한다
    const M = track(await open(URL, { token: signToken("M"), userId: "M" }));
    M?.emit("online:user", {});
    await sleep(100);
    const aliceAll = recordAll(A);
    M?.emit("send:message", {
      newMessage: {
        id: "forged-1",
        conversationId: "no-such-room",
        body: "AUDIT-BODY-MARKER",
        sender: { name: "운영자" },
        conversation: { userIds: ["M", "A"] },
      },
    });
    M?.emit("conversation:new", { id: "forged-conv", users: [{ id: "A" }], name: "FORGED" });
    M?.emit("read:state", { conversationId: "room-CA", readerId: "C", messageSenderId: "A", seenUsers: [{ id: "C", name: "FORGED" }] });
    for (const ev of RELAY_EVENTS.slice(2)) M?.emit(ev, { noticeId: "n1", fragranceSlug: "f1", commentId: "c1", reviewId: "r1" });
    // 4) 비멤버의 room.deleted
    M?.emit("room.event", { conversationId: "any-room", type: "room.deleted", recipients: ["A"] });
    await sleep(400);

    const impersonatorGotA = [...fakeInbox, ...m2Inbox].filter((b) => b === "FOR-A-ONLY");
    report.impersonation = {
      tokenlessAuthUserIdConnected: !!fakeA,
      wrongSecretTokenConnected: !!wrongSecret,
      expiredTokenConnected: !!expired,
      tokenPlusAuthUserIdTreatedAs: m2Inbox.includes("FOR-M") ? "M" : m2Inbox.length ? "?" : "unknown",
      impersonatorReceived: impersonatorGotA,
      victimReceivedLegit: aliceInbox.includes("FOR-A-ONLY"),
      pass:
        !fakeA && !wrongSecret && !expired &&
        impersonatorGotA.length === 0 &&
        aliceInbox.includes("FOR-A-ONLY") &&
        m2Inbox.includes("FOR-M"),
    };
    const forgedToVictim = aliceAll.filter(([ev]) => ev === "receive:conversation" || ev === "receive:message");
    const relayedToVictim = aliceAll.filter(([ev]) => RELAY_EVENTS.includes(ev) || LEGACY_PRESENCE.includes(ev)).map(([ev]) => ev);
    report.forgedMessage = {
      victimReceived: forgedToVictim.map(([, m]) => m?.body),
      relayedEventsToVictim: relayedToVictim,
      pass: forgedToVictim.length === 0 && relayedToVictim.length === 0,
    };
    report.roomDeletedByStranger = { victimGotEvent: aliceRoomEvents.length > 0, pass: aliceRoomEvents.length === 0 };

    // 7) 내부 전달 엔드포인트
    {
      const cAll = recordAll(C);
      const mAll = recordAll(M);
      const aBefore = aliceAll.length;
      const linesBefore = logLines.length;

      const okStatus = await internalEmit(URL, [msg("int-1", "room-A", "INTERNAL-OK", ["A"])]);
      await sleep(300);
      const msgLogLines = logLines.slice(linesBefore);
      const aGot = aliceAll.slice(aBefore).map(([ev, p]) => `${ev}:${p?.body ?? ""}`);

      // 시스템 메시지도 receive:conversation 하나만, 최소 페이로드는 받은 그대로
      const aBeforeSys = aliceAll.length;
      const minimal = { id: "int-min", conversationId: "room-A", previewOnly: true };
      const sysStatus = await internalEmit(URL, [
        msg("int-sys", "room-A", "SYSTEM-MSG", ["A"], { type: "system" }),
        { kind: "message", message: minimal, userIds: ["A"] },
      ]);
      await sleep(300);
      const aGotSys = aliceAll.slice(aBeforeSys);
      const sysEvents = aGotSys.map(([ev, p]) => `${ev}:${p?.id}`);
      const minimalReceived = aGotSys.find(([ev, p]) => ev === "receive:conversation" && p?.id === "int-min")?.[1] ?? null;

      const bcStatus = await internalEmit(URL, [
        { kind: "broadcast", event: "notice:deleted", payload: { noticeId: "n-int" }, exceptUserIds: ["C"] },
        { kind: "room.event", conversationId: "room-A", type: "room.deleted", userIds: ["A"] },
      ]);
      await sleep(300);
      const aGotBroadcast = aliceAll.some(([ev, p]) => ev === "notice:deleted" && p?.noticeId === "n-int");
      const mGotBroadcast = mAll.some(([ev, p]) => ev === "notice:deleted" && p?.noticeId === "n-int");
      const cGotBroadcast = cAll.some(([ev]) => ev === "notice:deleted");
      const aRoomEvent = aliceAll.find(([ev]) => ev === "room.event")?.[1] ?? null;

      const aBeforeBad = aliceAll.length;
      const wrongStatus = await internalEmit(URL, [msg("int-bad-1", "room-A", "WRONG-SECRET", ["A"])], { secret: "nope" });
      const missingStatus = await internalEmit(URL, [msg("int-bad-2", "room-A", "NO-SECRET", ["A"])], { secret: null });
      const invalidStatus = await internalEmit(URL, [{ kind: "users", event: "receive:message", payload: {}, userIds: ["A"] }]);
      await sleep(300);
      const aGotAfterBad = aliceAll.slice(aBeforeBad).map(([ev]) => ev);
      const anyReceiveMessage = [...aliceAll, ...cAll, ...mAll].some(([ev]) => ev === "receive:message");

      report.internalEndpoint = {
        validStatus: okStatus,
        victimGot: aGot,
        systemAndMinimal: { status: sysStatus, events: sysEvents, minimalPayloadReceived: minimalReceived },
        receiveMessageSentAnywhere: anyReceiveMessage,
        othersGot: [...cAll, ...mAll].filter(([ev]) => ev.startsWith("receive:")).map(([ev, p]) => `${ev}:${p?.body ?? ""}`),
        broadcast: { status: bcStatus, a: aGotBroadcast, m: mGotBroadcast, exceptedC: cGotBroadcast },
        roomEvent: aRoomEvent,
        wrongSecretStatus: wrongStatus,
        missingSecretStatus: missingStatus,
        invalidEventStatus: invalidStatus,
        deliveredAfterRejected: aGotAfterBad,
        pass:
          okStatus === 200 &&
          aGot.length === 1 && aGot[0] === "receive:conversation:INTERNAL-OK" &&
          !anyReceiveMessage &&
          sysStatus === 200 &&
          sysEvents.join(",") === "receive:conversation:int-sys,receive:conversation:int-min" &&
          JSON.stringify(minimalReceived) === JSON.stringify(minimal) &&
          !cAll.some(([ev]) => ev.startsWith("receive:")) &&
          !mAll.some(([ev]) => ev.startsWith("receive:")) &&
          bcStatus === 200 && aGotBroadcast && mGotBroadcast && !cGotBroadcast &&
          aRoomEvent?.type === "room.deleted" && typeof aRoomEvent?.rev === "number" &&
          wrongStatus === 401 && missingStatus === 401 && invalidStatus === 400 &&
          aGotAfterBad.length === 0,
      };

      // room.event rev: 서버 전체 단일 카운터 — 다른 방이어도 계속 증가
      const revsBefore = aliceAll.length;
      await internalEmit(URL, [
        { kind: "room.event", conversationId: "room-X", type: "room.deleted", userIds: ["A"] },
        { kind: "room.event", conversationId: "room-Y", type: "member.left", userId: "Z", remainingUserIds: ["A"], userIds: ["A"] },
        { kind: "room.event", conversationId: "room-X", type: "room.deleted", userIds: ["A"] },
      ]);
      await sleep(300);
      const revs = [aRoomEvent?.rev, ...aliceAll.slice(revsBefore).filter(([ev]) => ev === "room.event").map(([, p]) => p.rev)];
      report.roomEventRev = {
        revs,
        pass: revs.length === 4 && revs.every((r, i) => typeof r === "number" && (i === 0 || r > revs[i - 1])),
      };

      // 6) 로그: 메시지 1건(내부 전달)당 줄 수와 본문 포함 여부
      report.logging = {
        linesPerMessage: msgLogLines.length,
        messageLogLines: msgLogLines,
        bodyInLogs: msgLogLines.some((l) => l.includes("INTERNAL-OK")),
        pass: msgLogLines.length <= 1 && !msgLogLines.some((l) => l.includes("INTERNAL-OK")),
      };
    }

    // 8) presence:delta 묶어 보내기
    {
      const watchStart = A.deltas.length;
      // P는 창 안에서 켜졌다 꺼짐, Q는 켜진 채 남음
      const P = await open(URL, { token: signToken("P") });
      const Q = track(await open(URL, { token: signToken("Q") }));
      P?.close();
      await sleep(1300);
      const after = A.deltas.slice(watchStart);
      const online = after.flatMap((d) => d.online);
      const offline = after.flatMap((d) => d.offline);
      const legacyAnywhere = allSockets.reduce((a, s) => a + s.legacy.length, 0);
      report.presenceDelta = {
        deltasReceivedByA: after,
        legacyOnlineLeaveEventsReceived: legacyAnywhere,
        qSnapshotIncludesSelf: !!Q?.snapshot?.some((u) => u.userId === "Q"),
        pass:
          after.length >= 1 &&
          online.includes("Q") && !offline.includes("Q") &&
          offline.includes("P") && !online.includes("P") &&
          legacyAnywhere === 0,
      };
    }

    // 9) join:room 제한
    {
      const J = track(await open(URL, { token: signToken("J") }));
      const successes = [];
      J.on("join:success", (r) => successes.push(r));
      const linesBefore = logLines.length;
      for (let i = 0; i < 40; i++) J.emit("join:room", `jroom-${i}`);
      J.emit("join:room", "user:A");
      await sleep(500);
      const joinLogs = logLines.slice(linesBefore).filter((l) => l.includes("[join:room]"));
      report.joinRoomLimit = {
        requested: 41,
        joinSuccess: successes.length,
        personalRoomAccepted: successes.includes("user:A"),
        warnLogLines: joinLogs.length,
        pass: successes.length === 30 && !successes.includes("user:A") && joinLogs.length === 1,
      };
    }

    // 5) half-open
    if (!QUICK) {
      const watch = track(await open(URL, { token: signToken("W") }));
      const B = await open(URL, { token: signToken("B") });
      await sleep(1300); // B online delta가 먼저 지나가게
      B.io.engine.transport.ws._socket.pause(); // 수신 중단 → pong 불가 (모바일 터널·네트워크 전환 흉내)
      const t0 = Date.now();
      for (let i = 1; i <= 3; i++) {
        await internalEmit(URL, [msg("b" + i, "room-MB", "to B " + i, ["M", "B"])]);
        await sleep(100);
      }
      process.stderr.write("half-open 감지 대기 중 (최대 약 30초)...\n");
      const detected = await new Promise((r) => {
        const onDelta = (d) => {
          if (d.offline.includes("B")) {
            watch.off("presence:delta", onDelta);
            r(true);
          }
        };
        watch.on("presence:delta", onDelta);
        setTimeout(() => r(false), 60_000);
      });
      const detectSeconds = Math.round((Date.now() - t0) / 100) / 10;
      B.close();
      report.halfOpen = {
        detected,
        detectSeconds,
        expectedMaxSeconds: "약 25 (ping 15 + timeout 10) + presence flush ≤ 1",
        sentWhileHalfOpen: 3,
        recovery: "서버는 큐로 복구하지 않음, 복구는 클라이언트 DB 재조회",
        pass: detected && detectSeconds <= 27,
      };
    }

    // 10) SOCKET_AUTH_SECRET 없이 띄운 서버
    {
      const noSecret = await startServer(PORT + 1, { WEBHOOK_SECRET });
      const s1 = await open(noSecret.url, { token: signToken("A") });
      const s2 = await open(noSecret.url, { userId: "A" });
      await sleep(200);
      s1?.close();
      s2?.close();
      const startupError = noSecret.logLines.some((l) => l.includes("SOCKET_AUTH_SECRET 미설정"));
      noSecret.proc.kill();
      report.authSecretMissing = {
        tokenConnected: !!s1,
        tokenlessConnected: !!s2,
        startupErrorLogged: startupError,
        pass: !s1 && !s2 && startupError,
      };
    }
  } catch (e) {
    report.error = String(e?.stack || e?.message || e);
  }

  allSockets.forEach((s) => s.close());
  await sleep(200);

  // 6) 로그 전체 점검: 토큰·시크릿·이메일·본문이 없는가
  {
    const secrets = [SECRET, WEBHOOK_SECRET, ...issuedTokens];
    const markers = ["alice@example.com", "attacker@example.com", "AUDIT-BODY-MARKER", "FOR-A-ONLY", "INTERNAL-OK", "SYSTEM-MSG", "to B "];
    const leakedSecretLines = main.logLines.filter((l) => secrets.some((s) => l.includes(s))).length;
    const leakedMarkers = markers.filter((m) => main.logLines.some((l) => l.includes(m)));
    const emitLines = main.logLines.filter((l) => l.startsWith("[internal/emit]") && !l.includes("인증 실패") && !l.includes("잘못된 요청"));
    if (report.logging) {
      report.logging.totalServerLogLines = main.logLines.length;
      report.logging.internalEmitLines = emitLines.length;
      report.logging.leakedSecretOrTokenLines = leakedSecretLines;
      report.logging.leakedBodyOrEmail = leakedMarkers;
      report.logging.allLines = leakedSecretLines === 0 ? main.logLines : "(비밀값 포함 — 출력 생략)";
      report.logging.pass = report.logging.pass && leakedSecretLines === 0 && leakedMarkers.length === 0;
    }
  }
  report.mainServerRssMB = rssMB(main.proc.pid);
  main.proc.kill();

  // 11) presence 부하
  if (PRESENCE_NS.length) {
    report.presenceLoad = [];
    for (const n of PRESENCE_NS) {
      process.stderr.write(`presence 부하 측정: ${n}개 연결...\n`);
      try {
        report.presenceLoad.push(await presenceLoad(n));
      } catch (e) {
        report.presenceLoad.push({ connections: n, error: String(e?.message || e) });
      }
    }
  }

  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
})();
