// 소켓 서버 점검 스크립트 — 최적화 전/후 비교용 기준 측정
//
// 로컬에 server.js를 띄워 아래 항목을 재현·측정한다. 운영 서버에는 접속하지 않는다.
//   1) 익명 연결이 온라인 사용자 이메일을 받는가 (인증된 사용자에게도 이메일이 가는가)
//   2) handshake.auth.userId만으로 다른 사용자를 사칭할 수 있는가
//      - 토큰 없이 auth.userId="A"
//      - M의 정상 토큰 + auth.userId="A" (M으로 취급돼야 함)
//      - 잘못된 비밀값으로 서명한 토큰 / 만료된 토큰
//   3) 클라이언트가 보낸 conversation.userIds를 그대로 믿고 메시지를 전달하는가 (2단계에서 해결)
//   4) 대화방 멤버가 아닌 사용자가 room.deleted를 보낼 수 있는가 (2단계에서 해결)
//   5) 응답 없는 연결(half-open)을 끊기까지 걸리는 시간, 그 사이 보낸 메시지가 복구되는가
//   6) 메시지 1건당 서버 로그 줄 수, 로그에 메시지 본문이 남는가
//
// 서버는 SOCKET_AUTH_SECRET(임의 테스트 값) + SOCKET_AUTH_REQUIRED=true로 띄운다.
// 정상 사용자는 아래 signToken으로 직접 서명한 토큰을 쓴다. 일부는 auth.userId도 같이 보내는데,
// 새 서버는 이를 무시하고 인증 이전 서버에서는 기준값이 그대로 재현되게 하기 위함이다.
//
// 실행 (레포 루트에서, next-server의 node_modules를 빌려 씀):
//   NODE_PATH=next-server/node_modules node socket-server/scripts/ws-audit.js
//   --quick : 5번(약 55초 대기)을 건너뜀
//
// 출력의 "pass"가 true면 해당 문제가 해결된 상태다.

const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");
const { io } = require("socket.io-client");

const PORT = Number(process.env.AUDIT_PORT || 4555);
const URL = `http://localhost:${PORT}`;
const QUICK = process.argv.includes("--quick");
const SECRET = crypto.randomBytes(32).toString("hex");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// next-server/src/app/lib/socketAuth/signSocketToken.ts와 같은 형식 — 형식을 바꾸면 같이 바꿀 것
const signToken = (userId, { secret = SECRET, ttlSeconds = 300 } = {}) => {
  const body = Buffer.from(JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + ttlSeconds })).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
};

// 연결 직후 오는 스냅샷·presence 이벤트를 놓치지 않도록 리스너를 먼저 건다. 거부되면 null.
const open = (auth) =>
  new Promise((resolve) => {
    const s = io(URL, { transports: ["websocket"], auth, reconnection: false, forceNew: true });
    s.snapshot = null;
    s.presence = [];
    s.on("get:onlineUsers", (list) => { s.snapshot = list; });
    s.on("online:user", (u) => s.presence.push(u));
    s.on("leave:user", (u) => s.presence.push(u));
    s.on("connect", () => resolve(s));
    s.on("connect_error", () => { s.close(); resolve(null); });
  });

const emailsIn = (list) => (list || []).map((u) => u?.useremail).filter(Boolean);

(async () => {
  // stdout을 파이프로 연결해야 server.js의 process.stdout.setEncoding이 터지지 않는다.
  const server = spawn(process.execPath, [path.join(__dirname, "..", "server.js")], {
    env: { ...process.env, PORT: String(PORT), SOCKET_AUTH_SECRET: SECRET, SOCKET_AUTH_REQUIRED: "true" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const logLines = [];
  const onData = (buf) => logLines.push(...buf.toString().split("\n").filter(Boolean));
  server.stdout.on("data", onData);
  server.stderr.on("data", onData);
  await sleep(1500);

  const report = {};
  try {
    // A는 구버전 클라이언트처럼 이메일도 같이 보낸다 — 서버가 이를 무시하고 다시 퍼뜨리지 않는지 확인
    // (인증 이전 서버에 돌려도 기준값이 재현되도록)
    const A = await open({ token: signToken("A"), userId: "A", useremail: "alice@example.com" });
    if (!A) throw new Error("서버 연결 실패 — 정상 토큰으로도 연결되지 않음");
    A.emit("online:user", { useremail: "alice@example.com", userId: "A" });
    const aliceInbox = [];
    A.on("receive:conversation", (m) => aliceInbox.push(m?.body));
    const aliceRoomEvents = [];
    A.on("room.event", (e) => aliceRoomEvents.push(e));
    await sleep(200);

    // 1) 익명 연결 + 인증된 사용자가 받는 스냅샷·presence에 이메일이 있는가
    const anon = await open(undefined);
    await sleep(300);
    const C = await open({ token: signToken("C"), userId: "C" });
    await sleep(300);
    const leakedEmails = emailsIn(anon?.snapshot);
    const authedEmails = [...emailsIn(C?.snapshot), ...emailsIn(A.presence)];
    report.anonymousSeesEmails = {
      anonymousConnected: !!anon,
      leakedEmails,
      authenticatedSnapshot: C?.snapshot ?? null,
      emailsSentToAuthenticated: authedEmails,
      pass: leakedEmails.length === 0 && authedEmails.length === 0,
    };

    // 2) 사칭
    const fakeA = await open({ useremail: "attacker@example.com", userId: "A" }); // 토큰 없음
    const wrongSecret = await open({ token: signToken("A", { secret: "not-the-secret" }), userId: "A" });
    const expired = await open({ token: signToken("A", { ttlSeconds: -10 }), userId: "A" });
    const M2 = await open({ token: signToken("M"), userId: "A", useremail: "alice@example.com" }); // M 토큰 + A 사칭
    const fakeInbox = [];
    const m2Inbox = [];
    fakeA?.on("receive:conversation", (m) => fakeInbox.push(m?.body));
    wrongSecret?.on("receive:conversation", (m) => fakeInbox.push(m?.body));
    expired?.on("receive:conversation", (m) => fakeInbox.push(m?.body));
    M2?.on("receive:conversation", (m) => m2Inbox.push(m?.body));
    M2?.emit("online:user", { useremail: "alice@example.com", userId: "A" }); // 페이로드 사칭도 무시돼야 함
    await sleep(200);

    // 정상 사용자 C가 A에게 보낸 메시지 — A만 받아야 한다
    C?.emit("send:message", {
      newMessage: { id: "legit-1", conversationId: "room-CA", body: "FOR-A-ONLY", conversation: { userIds: ["C", "A"] } },
    });
    await sleep(300);

    // 3) 위조 메시지
    const M = await open({ token: signToken("M"), userId: "M" });
    M?.emit("online:user", {});
    await sleep(100);
    const linesBefore = logLines.length;
    M?.emit("send:message", {
      newMessage: {
        id: "forged-1",
        conversationId: "no-such-room",
        body: "AUDIT-BODY-MARKER",
        sender: { name: "운영자" },
        conversation: { userIds: ["M", "A"] },
      },
    });
    // 4) 비멤버의 room.deleted
    M?.emit("room.event", { conversationId: "any-room", type: "room.deleted", recipients: ["A"] });
    await sleep(400);
    const msgLogLines = logLines.slice(linesBefore);

    const impersonatorGotA = [...fakeInbox, ...m2Inbox].filter((b) => b === "FOR-A-ONLY");
    report.impersonation = {
      tokenlessAuthUserIdConnected: !!fakeA,
      wrongSecretTokenConnected: !!wrongSecret,
      expiredTokenConnected: !!expired,
      // M 토큰 + auth.userId="A": M의 다른 탭 몫(위조 메시지 사본)을 받으면 M으로 취급된 것
      tokenPlusAuthUserIdTreatedAs: m2Inbox.includes("AUDIT-BODY-MARKER") ? "M" : m2Inbox.length ? "?" : "unknown",
      impersonatorReceived: impersonatorGotA,
      victimReceivedLegit: aliceInbox.includes("FOR-A-ONLY"),
      pass:
        !fakeA && !wrongSecret && !expired &&
        impersonatorGotA.length === 0 &&
        aliceInbox.includes("FOR-A-ONLY") &&
        m2Inbox.includes("AUDIT-BODY-MARKER"),
    };
    const forgedToVictim = aliceInbox.filter((b) => b === "AUDIT-BODY-MARKER");
    report.forgedMessage = { victimReceived: forgedToVictim, pass: forgedToVictim.length === 0 };
    report.roomDeletedByStranger = { victimGotEvent: aliceRoomEvents.length > 0, pass: aliceRoomEvents.length === 0 };
    report.logging = {
      linesPerMessage: msgLogLines.filter((l) => !l.includes("room.event")).length,
      bodyInLogs: msgLogLines.some((l) => l.includes("AUDIT-BODY-MARKER")),
      pass: !msgLogLines.some((l) => l.includes("AUDIT-BODY-MARKER")),
    };

    // 5) half-open
    if (!QUICK) {
      const B = await open({ token: signToken("B") });
      B.emit("online:user", {});
      await sleep(200);
      B.io.engine.transport.ws._socket.pause(); // 수신 중단 → pong 불가 (모바일 터널·네트워크 전환 흉내)
      const t0 = Date.now();
      for (let i = 1; i <= 3; i++) {
        M.emit("send:message", {
          newMessage: { id: "b" + i, conversationId: "room-MB", body: "to B " + i, conversation: { userIds: ["M", "B"] } },
        });
        await sleep(100);
      }
      process.stderr.write("half-open 감지 대기 중 (최대 약 60초)...\n");
      await new Promise((r) => {
        const watch = io(URL, { transports: ["websocket"], reconnection: false, forceNew: true, auth: { token: signToken("W") } });
        watch.on("leave:user", (u) => {
          if (u?.userId === "B") { watch.close(); r(); }
        });
        setTimeout(() => { watch.close(); r(); }, 90_000);
      });
      const detectSeconds = Math.round((Date.now() - t0) / 1000);
      B.close();
      const B2 = await open({ token: signToken("B") });
      const recovered = [];
      B2.on("receive:conversation", (m) => recovered.push(m?.body));
      B2.emit("online:user", {});
      await sleep(500);
      report.halfOpen = {
        detectSeconds,
        sentWhileHalfOpen: 3,
        recoveredBySocket: recovered.length,
        note: "socket으로 복구 안 되면 클라이언트 재접속 시 DB 재조회로 복구돼야 함 (계획 문서 R1)",
      };
    }
  } catch (e) {
    report.error = String(e?.message || e);
  } finally {
    console.log(JSON.stringify(report, null, 2));
    server.kill();
    process.exit(0);
  }
})();
