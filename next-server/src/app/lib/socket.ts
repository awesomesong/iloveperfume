"use client";
import { io, type Socket } from "socket.io-client";

const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL ||
  "https://socket-server-muddy-shadow-6983.fly.dev";

const TOKEN_FETCH_TIMEOUT_MS = 8_000;
// 서버가 연결을 거부했을 때의 재시도 간격 (아래 io() 옵션의 reconnectionDelay/Max와 같은 값)
const RETRY_DELAY_MS = 500;
const RETRY_DELAY_MAX_MS = 5_000;

declare global {
  var __socket__: Socket | undefined;
}

type TokenResult = { token: string | null; status: number };

/** 소켓 서버 연결용 단기 토큰 발급 (/api/socket/token). 실패하면 token: null */
async function fetchSocketToken(): Promise<TokenResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TOKEN_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch("/api/socket/token", {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    });
    if (!res.ok) return { token: null, status: res.status };
    const data = (await res.json()) as { token?: unknown };
    return { token: typeof data.token === "string" ? data.token : null, status: res.status };
  } catch {
    return { token: null, status: 0 };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 토큰 payload의 sub(userId)를 꺼낸다. 서명 검증은 하지 않는다(서버가 함).
 * 배포 전환 기간에 토큰을 모르는 구버전 소켓 서버도 개인 룸에 넣어 주도록 userId를 같이 보내기 위한 용도.
 * 새 소켓 서버는 토큰이 있으면 이 값을 무시한다. SOCKET_AUTH_REQUIRED=true 전환 후 제거.
 */
function readTokenSubject(token: string): string | undefined {
  try {
    const body = token.split(".")[0] ?? "";
    const base64 = body.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(base64)) as { sub?: unknown };
    return typeof payload.sub === "string" ? payload.sub : undefined;
  } catch {
    return undefined;
  }
}

export const getSocket = (): Socket => {
  if (globalThis.__socket__) return globalThis.__socket__;

  // 마지막 토큰 요청 결과 — 401(로그아웃)이면 거부 후 재시도하지 않는다
  let lastTokenStatus = 0;
  let retryAttempt = 0;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;

  const socket = io(SOCKET_URL, {
    autoConnect: false,
    transports: ["websocket"],
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: RETRY_DELAY_MS,
    reconnectionDelayMax: RETRY_DELAY_MAX_MS,
    timeout: 10_000,
    // (재)연결할 때마다 호출된다 — 매번 새 토큰을 받아 handshake.auth로 보낸다.
    // 토큰을 못 받으면 빈 auth로 보내고, 서버가 거부하면 아래 connect_error에서 재시도한다.
    auth: (cb) => {
      void fetchSocketToken().then(({ token, status }) => {
        lastTokenStatus = status;
        if (!token) {
          cb({});
          return;
        }
        const userId = readTokenSubject(token);
        cb(userId ? { token, userId } : { token });
      });
    },
  });

  socket.on("connect", () => {
    retryAttempt = 0;
    lastTokenStatus = 0;
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = undefined;
    }
  });

  // 서버 미들웨어가 연결을 거부하면 socket.io는 자동 재연결하지 않는다(socket.active === false).
  // 네트워크 오류 등 저수준 실패는 socket.io가 reconnectionDelay 설정대로 알아서 재시도한다.
  socket.on("connect_error", () => {
    if (socket.active) return;
    // 로그아웃 상태 — 세션이 바뀌면 socketContext가 다시 연결한다
    if (lastTokenStatus === 401) return;
    if (retryTimer) clearTimeout(retryTimer);
    const base = Math.min(RETRY_DELAY_MS * 2 ** retryAttempt, RETRY_DELAY_MAX_MS);
    const delay = base / 2 + Math.random() * (base / 2);
    retryAttempt += 1;
    retryTimer = setTimeout(() => {
      retryTimer = undefined;
      if (!socket.connected && !socket.active) socket.connect();
    }, delay);
  });

  // 파이어폭스 대응: 연결 실패 시 소켓 재생성 (재연결은 socket.io가 계속 시도함)
  socket.io.on("reconnect_failed", () => {
    if (globalThis.__socket__) {
      globalThis.__socket__.close();
      delete globalThis.__socket__;
    }
  });

  globalThis.__socket__ = socket;
  return socket;
};
