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

/**
 * 소켓으로 보내는 메시지 (receive:conversation) — 클라이언트가 실제로 읽는 필드만 담는다.
 * - id·conversationId·type·createdAt: 캐시 병합·정렬·중복 제거 (chatCache의 normalizeMessage / upsertMessageSortedInCache)
 * - body·image·sender.name·sender.image: 말풍선·아바타(MessageView)와 목록 미리보기(bumpConversationOnNewMessage)
 * - sender.id: 내 메시지 판별(MessageView isOwn, SocketState·Body), 안 읽은 수 계산
 * - conversation.isGroup: 그룹 읽음 표시·읽은 사용자 요청(Body processReadState)
 * - conversation.userIds: 참여자 판별(Body liveUsersKey → MessageView의 나간 사용자 표시)
 * - isAIResponse: AI 답변이면 true (없으면 false로 본다)
 * 보내지 않는 것: 발신자 이메일(화면에 안 씀), serverCreatedAtMs(createdAt에서 계산), isError(소켓 경로에서 읽지 않음),
 *   clientMessageId(메시지 id가 이미 낙관적 id와 같다)
 */
export type SocketMessagePayload = {
  id: string;
  conversationId: string;
  type: string | null;
  createdAt: Date | string;
  body: string | null;
  /** 이미지 메시지일 때만 */
  image?: string | null;
  sender: { id: string; name: string | null; image: string | null };
  conversation: { isGroup: boolean; userIds: string[] };
  isAIResponse?: true;
};

/** DB에서 읽은 메시지 (select 결과). 필요한 필드만 골라 SocketMessagePayload로 만든다 */
export type SocketMessageSource = {
  id: string;
  conversationId: string;
  type: string | null;
  createdAt: Date | string;
  body: string | null;
  image?: string | null;
  isAIResponse?: boolean | null;
  sender: { id: string; name: string | null; image: string | null };
};

export function toSocketMessage(
  message: SocketMessageSource,
  conversation: { isGroup: boolean; userIds: string[] },
): SocketMessagePayload {
  return {
    id: message.id,
    conversationId: message.conversationId,
    type: message.type,
    createdAt: message.createdAt,
    body: message.body,
    ...(message.type === "image" ? { image: message.image ?? null } : {}),
    sender: { id: message.sender.id, name: message.sender.name, image: message.sender.image },
    conversation: { isGroup: conversation.isGroup, userIds: conversation.userIds },
    ...(message.isAIResponse ? { isAIResponse: true as const } : {}),
  };
}

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

/**
 * 새 메시지 → 참여자 전원(보낸 사람의 다른 탭 포함)에게 receive:conversation으로.
 * conversation.userIds는 받는 사람(userIds)과 다를 수 있다 (예: 나가기 시스템 메시지는 남은 사람 기준).
 */
export function messageEvent(
  message: SocketMessageSource,
  conversation: { isGroup: boolean; userIds: string[] },
  userIds: string[],
): SocketEmitEvent {
  return { kind: "message", message: toSocketMessage(message, conversation), userIds };
}
