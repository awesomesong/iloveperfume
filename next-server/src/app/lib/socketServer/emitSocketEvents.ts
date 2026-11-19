import { after } from "next/server";
import { getSocketServerUrl } from "./socketServerUrl";

/**
 * 서버 전용: API가 DB에 저장한 뒤 소켓 서버(/internal/emit)에 "누구에게 무엇을 보낼지" 알린다.
 * 브라우저는 소켓으로 메시지·이벤트를 중계하지 않는다 — 수신자는 항상 여기서 DB 기준으로 정한다.
 *
 * - 인증: x-webhook-secret = WEBHOOK_SECRET (소켓 서버와 같은 값, /api/user-registered와 공유)
 * - 실패해도 사용자 요청은 실패시키지 않는다 (저장은 이미 끝났고, 실시간 전달만 빠진다). 로그에 본문은 남기지 않는다.
 * - 요청 형식: socket-server/internalEmit.js (형식을 바꾸면 같이 바꿀 것)
 */

const EMIT_TIMEOUT_MS = 2_000;

/** 메시지를 받는 쪽(클라이언트)이 기대하는 형태 — api/messages 응답의 newMessage와 같다 */
export type SocketMessagePayload = {
  id: string;
  conversationId: string;
  body: string | null;
  image: string | null;
  type: string | null;
  createdAt: Date | string;
  serverCreatedAtMs: number;
  sender: { id: string; name: string | null; email: string | null; image: string | null };
  conversation: { isGroup: boolean; userIds: string[] };
  isAIResponse: boolean;
  isError: boolean;
  /** 보낸 탭의 낙관적 메시지 ID (서버 ID와 같게 저장하지만 기존 클라이언트 호환을 위해 같이 보낸다) */
  clientMessageId?: string;
};

export type SocketEmitEvent =
  | { kind: "message"; message: SocketMessagePayload; userIds: string[] }
  | {
      kind: "room.event";
      conversationId: string;
      type: "member.left" | "room.deleted";
      userId?: string;
      remainingUserIds?: string[];
      userIds: string[];
    }
  | { kind: "users"; event: "conversation:new" | "read:state"; payload: Record<string, unknown>; userIds: string[] }
  | {
      kind: "broadcast";
      event:
        | "notice:deleted"
        | "notice:comment:new"
        | "notice:comment:updated"
        | "notice:comment:deleted"
        | "fragrance:review:new"
        | "fragrance:review:updated"
        | "fragrance:review:deleted";
      payload: Record<string, unknown>;
      /** 보낸 사람(이미 화면에 반영함)은 제외 */
      exceptUserIds?: string[];
    };

let warnedMissingSecret = false;

const describe = (events: SocketEmitEvent[]) =>
  events.map((e) => (e.kind === "users" || e.kind === "broadcast" ? e.event : e.kind)).join(",");

/**
 * 소켓 서버로 바로 전송한다. 절대 throw하지 않는다.
 * 이미 after() 안에서 실행 중일 때(예: AI 스트림 저장 뒤) await해서 쓴다.
 */
export async function sendSocketEvents(events: SocketEmitEvent[]): Promise<void> {
  if (events.length === 0) return;

  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) {
    if (!warnedMissingSecret) {
      warnedMissingSecret = true;
      console.error("[socket-emit] WEBHOOK_SECRET 미설정 — 실시간 전달을 건너뜁니다.");
    }
    return;
  }

  try {
    const res = await fetch(`${getSocketServerUrl()}/internal/emit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-webhook-secret": secret },
      body: JSON.stringify({ events }),
      signal: AbortSignal.timeout(EMIT_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) {
      // 404: 소켓 서버가 아직 이전 버전(배포 순서가 엇갈린 짧은 기간) — 실시간 전달만 빠진다
      console.warn(`[socket-emit] 전달 실패 status=${res.status} events=${describe(events)}`);
    }
  } catch (e) {
    const reason = e instanceof Error ? e.name : "unknown";
    console.warn(`[socket-emit] 전달 실패 (${reason}) events=${describe(events)}`);
  }
}

/**
 * 응답을 보낸 뒤(after) 소켓 서버로 전송한다. route handler 안에서 호출한다.
 * 사용자 요청의 응답 시간에는 영향을 주지 않는다.
 */
export function queueSocketEvents(events: SocketEmitEvent[]): void {
  if (events.length === 0) return;
  try {
    after(() => sendSocketEvents(events));
  } catch {
    // 요청 범위 밖에서 호출된 경우: 기다리지 않고 바로 보낸다
    void sendSocketEvents(events);
  }
}

/** 새 메시지 → 참여자 전원(보낸 사람의 다른 탭 포함)에게 */
export function messageEvent(message: SocketMessagePayload, userIds: string[]): SocketEmitEvent {
  return { kind: "message", message, userIds };
}
