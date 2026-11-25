// 접속 상태(presence) 추적·묶어 보내기 단위 테스트 (Node 내장 테스트 러너, 의존성 없음)
// 실행: cd socket-server && npm test
const test = require("node:test");
const assert = require("node:assert/strict");
const { createPresence, PRESENCE_FLUSH_MS } = require("../presence");

// 타이머를 손으로 돌리는 테스트용 presence
function setup() {
  const sent = [];
  const timers = [];
  const p = createPresence({
    onFlush: (d) => sent.push(d),
    setTimer: (fn, ms) => {
      const t = { fn, ms, cleared: false };
      timers.push(t);
      return t;
    },
    clearTimer: (t) => {
      t.cleared = true;
    },
  });
  const fire = () => {
    const pending = timers.filter((t) => !t.cleared && !t.fired);
    for (const t of pending) {
      t.fired = true;
      t.fn();
    }
    return pending.length;
  };
  return { p, sent, timers, fire };
}
const sortDelta = (d) => ({ online: [...d.online].sort(), offline: [...d.offline].sort() });

test("flush 주기는 1초", () => {
  assert.equal(PRESENCE_FLUSH_MS, 1000);
  const { p, timers } = setup();
  p.add("s1", "a");
  assert.equal(timers[0].ms, 1000);
});

test("첫 소켓 연결만 상태 변경 — 같은 사용자의 두 번째 탭은 delta를 만들지 않는다", () => {
  const { p, sent, fire } = setup();
  assert.equal(p.add("s1", "a"), true);
  assert.equal(p.add("s2", "a"), false);
  assert.equal(p.add("s2", "a"), false); // 같은 소켓 중복 등록 무시
  fire();
  assert.deepEqual(sent, [{ online: ["a"], offline: [] }]);
  assert.equal(p.socketCount, 2);
  assert.equal(p.userCount, 1);

  // 탭 하나만 닫으면 여전히 온라인 — delta 없음
  assert.deepEqual(p.remove("s1"), { userId: "a", isLastSocket: false });
  assert.equal(fire(), 0);
  assert.equal(sent.length, 1);

  // 마지막 탭이 닫히면 offline
  assert.deepEqual(p.remove("s2"), { userId: "a", isLastSocket: true });
  fire();
  assert.deepEqual(sent[1], { online: [], offline: ["a"] });
  assert.equal(p.remove("s2"), null);
});

test("창 안의 여러 변경을 delta 하나로 묶는다 (타이머는 창마다 하나)", () => {
  const { p, sent, timers, fire } = setup();
  for (let i = 0; i < 50; i++) p.add(`s${i}`, `u${i}`);
  assert.equal(timers.length, 1);
  fire();
  assert.equal(sent.length, 1);
  assert.equal(sent[0].online.length, 50);
  assert.deepEqual(sent[0].offline, []);
});

test("창 안에서 켜졌다 꺼진 사용자도 현재 상태(offline)로 반드시 포함된다", () => {
  const { p, sent, fire } = setup();
  p.add("s1", "a");
  p.add("s2", "b");
  p.remove("s1"); // a는 창 안에서 켜졌다 꺼짐
  fire();
  assert.deepEqual(sortDelta(sent[0]), { online: ["b"], offline: ["a"] });
});

test("창 안에서 꺼졌다 다시 켜진 사용자는 online으로 포함된다", () => {
  const { p, sent, fire } = setup();
  p.add("s1", "a");
  fire();
  p.remove("s1");
  p.add("s9", "a"); // 새 탭으로 재접속
  fire();
  assert.deepEqual(sent[1], { online: ["a"], offline: [] });
});

test("빈 delta는 보내지 않는다", () => {
  const { p, sent } = setup();
  assert.equal(p.flush(), null);
  assert.equal(sent.length, 0);
  p.add("s1", "a");
  p.flush();
  assert.equal(p.flush(), null); // 이미 비움
  assert.equal(sent.length, 1);
});

test("flush 후 다음 변경은 새 타이머를 잡는다 (1초에 최대 한 번)", () => {
  const { p, sent, timers, fire } = setup();
  p.add("s1", "a");
  fire();
  p.add("s2", "b");
  assert.equal(timers.filter((t) => !t.fired && !t.cleared).length, 1);
  fire();
  assert.deepEqual(sent.map((d) => d.online), [["a"], ["b"]]);
});

test("스냅샷은 userId만 담는다", () => {
  const { p } = setup();
  p.add("s1", "a");
  p.add("s2", "a");
  p.add("s3", "b");
  assert.deepEqual(p.snapshot(), [{ userId: "a" }, { userId: "b" }]);
  assert.equal(p.isOnline("a"), true);
  assert.equal(p.isOnline("zzz"), false);
});

test("prune: 살아 있지 않은 소켓을 지우고 offline delta를 만든다", () => {
  const { p, sent, fire } = setup();
  p.add("s1", "a");
  p.add("s2", "b");
  fire();
  assert.equal(p.prune(new Set(["s2"])), 1);
  fire();
  assert.deepEqual(sent[1], { online: [], offline: ["a"] });
  assert.equal(p.userCount, 1);
});

test("잘못된 입력은 무시한다", () => {
  const { p } = setup();
  assert.equal(p.add("", "a"), false);
  assert.equal(p.add("s1", ""), false);
  assert.equal(p.remove("nope"), null);
  assert.equal(p.socketCount, 0);
  assert.equal(p.pendingCount, 0);
});

test("기본 타이머로도 동작한다 (실제 setTimeout)", async () => {
  const sent = [];
  const p = createPresence({ onFlush: (d) => sent.push(d), flushMs: 20 });
  p.add("s1", "a");
  p.add("s2", "b");
  p.remove("s2");
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(sent.length, 1);
  assert.deepEqual(sortDelta(sent[0]), { online: ["a"], offline: ["b"] });
});
