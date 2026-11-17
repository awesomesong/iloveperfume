import { NextRequest, NextResponse, after } from "next/server";
import { getCurrentUser } from "@/src/app/lib/session";
import prisma from "@/prisma/db";
import { randomUUID } from "crypto";
import { validatePrompt } from "@/src/app/utils/aiPolicy";
import { OPENAI_TEXT_MODEL } from "@/src/app/lib/ai/models";

export const runtime = "nodejs";
// 클라이언트(useAIStream)가 60초에 abort하므로 그 이상 유지할 필요가 없다
export const maxDuration = 60;

// OPTIONS 요청 처리
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Cross-Origin-Embedder-Policy": "unsafe-none",
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Resource-Policy": "cross-origin",
    },
  });
}

// 상수 정의
const CONSTANTS = {
  // 대화 기록 글자 예산. 시작값이며 "[ai/stream] usage" 로그(prompt/cached 토큰)를 보고 조정한다
  HISTORY_CHAR_BUDGET: 20_000,
  HISTORY_MIN_MESSAGES: 2, // 예산을 넘겨도 최신 2개는 항상 포함
  HISTORY_QUERY_LIMIT: 100, // 기록 조회 상한
  STREAM_TIMEOUT: 30000, // 30초 (응답 헤더까지)
  UPSTREAM_DEADLINE: 55000, // 헤더+본문 전체 상한 (maxDuration 60초보다 짧게)
  RATE_LIMIT_WINDOW: 60000, // 1분
  RATE_LIMIT_MAX_REQUESTS: 10,
} as const;

// 에러가 아닌 메시지 조건. isError는 nullable이라 { not: true }를 쓰면 NULL 행까지 빠진다
const NOT_ERROR = { OR: [{ isError: false }, { isError: null }] };

// === 설정 ===
const WINDOW_MS = CONSTANTS.RATE_LIMIT_WINDOW; // 예: 60_000 (1분)
const MAX_REQUESTS = CONSTANTS.RATE_LIMIT_MAX_REQUESTS; // 예: 10/분

// 스윕(청소) 주기와 유휴 TTL
const SWEEP_INTERVAL_MS = 60_000; // 1분에 한 번만 시도
const IDLE_TTL_MS = WINDOW_MS * 5; // 5분간 활동 없으면 제거

// === 상태 ===
const rateLimitMap = new Map<string, number[]>(); // userId -> 타임스탬프 배열
let lastSweepAt = 0;

function checkRateLimit(userId: string, now = Date.now()): boolean {
  const windowStart = now - WINDOW_MS;
  const list = rateLimitMap.get(userId) ?? [];

  // 1) 슬라이딩 윈도우: in-place compaction (새 배열 생성 X)
  let w = 0;
  for (let r = 0; r < list.length; r++) {
    const t = list[r];
    if (t > windowStart) list[w++] = t; // 유효한 것만 앞으로 복사
  }
  list.length = w; // 뒤쪽은 잘라내기

  // 2) 제한 체크
  if (list.length >= MAX_REQUESTS) return false;

  // 3) 현재 요청 기록
  list.push(now);
  rateLimitMap.set(userId, list);

  // 4) 가끔만 유휴 사용자 스윕 (시간 게이트 + 낮은 확률)
  maybeSweep(now);

  return true;
}

/** 일정 간격(시간 게이트)으로만, 낮은 확률로 스윕 실행 */
function maybeSweep(now: number) {
  if (now - lastSweepAt < SWEEP_INTERVAL_MS) return;
  if (Math.random() >= 0.2) return; // 과도 실행 방지(20%만)
  lastSweepAt = now;
  sweepIdle(now);
}

/** 마지막 활동이 오래된 사용자 삭제 (메모리 정리) */
function sweepIdle(now: number) {
  const idleCutoff = now - IDLE_TTL_MS;
  for (const [userId, list] of rateLimitMap) {
    const last = list[list.length - 1]; // 마지막 활동 시각
    if (!last || last < idleCutoff) {
      rateLimitMap.delete(userId);
    }
  }
}

// AI Agent별 시스템 프롬프트 정의 (안전/주제 제한 포함)
const AI_AGENT_PROMPTS = {
  assistant: `당신은 친근하고 도움이 되는 향수 AI 어시스턴트입니다.
다음 정책을 반드시 준수하세요:
- 대화 주제는 향수(브랜드, 제품, 역사, 제조, 원재료, 향,구입방법) 관련으로 제한합니다.
- 향수와 무관한 주제 요청에는 정중히 사양하고, 대화를 향수 관련 주제로 유도하세요.
- 불법/위험 행위, 노골적 성적 내용, 혐오/폭력적 발언, 개인정보 요구 등 부적절한 요청은 거절하고 안전 가이드를 제시하세요.
- 한국어로 답변하세요. 이전 대화 맥락을 유지하세요.`,
} as const;

// 입력 검증 함수
function validateInput(
  message: unknown,
  conversationId: unknown,
): { isValid: boolean; error?: string } {
  if (typeof message !== "string" || !message.trim()) {
    return { isValid: false, error: "메시지가 비어있습니다." };
  }

  if (typeof conversationId !== "string" || !conversationId.trim()) {
    return { isValid: false, error: "대화 ID가 필요합니다." };
  }

  return { isValid: true };
}

// 선택적 ID 파라미터(messageId 등): 없거나(null/undefined) 문자열이어야 한다
function isOptionalId(value: unknown): value is string | null | undefined {
  return value == null || typeof value === "string";
}

// 대화 기록을 가져오는 함수
// 개수가 아니라 글자 예산으로 자른다: 입력 단가($0.10/1M 토큰)에서는 기록 수만 토큰도 요청당 1센트 미만이고,
// 기록이 뒤로만 늘어나면 프롬프트 앞부분이 유지돼 이전 턴은 캐시 단가로 읽힌다
// (개수 기준 슬라이딩 윈도우는 매 턴 앞부분이 바뀐다).
type HistoryMessage = {
  body: string | null;
  isAIResponse: boolean | null;
  createdAt: Date;
};

type ConversationHistory = {
  messages: HistoryMessage[];
  chars: number;
  truncated: boolean; // 예산 또는 조회 상한에 걸려 과거 메시지가 빠졌는지
};

async function getConversationHistory(
  conversationId: string,
  currentMessage: string,
  userMessageCreatedAt?: Date,
  existingAIMessageId?: string,
): Promise<ConversationHistory> {
  try {
    const rows = await prisma.message.findMany({
      where: {
        conversationId: conversationId,
        type: "text",
        ...NOT_ERROR,
        // 현재 질문은 이미 저장돼 있다 → 그 이전 메시지만 사용 (재시도 시 이후 대화도 제외)
        ...(userMessageCreatedAt ? { createdAt: { lt: userMessageCreatedAt } } : {}),
        ...(existingAIMessageId ? { id: { not: existingAIMessageId } } : {}),
      },
      orderBy: {
        createdAt: "desc",
      },
      take: CONSTANTS.HISTORY_QUERY_LIMIT,
      select: {
        body: true,
        isAIResponse: true,
        createdAt: true,
      },
    });

    let truncated = rows.length >= CONSTANTS.HISTORY_QUERY_LIMIT;

    // 질문 메시지를 특정하지 못한 경우: 방금 저장된 현재 질문이 맨 끝에 있으면 뺀다 (중복 전송 방지)
    if (
      !userMessageCreatedAt &&
      rows[0] &&
      !rows[0].isAIResponse &&
      rows[0].body?.trim() === currentMessage.trim()
    ) {
      rows.shift();
    }

    // 최신 → 과거 순으로 예산만큼 담는다
    const kept: HistoryMessage[] = [];
    let chars = 0;
    for (const row of rows) {
      if (!row.body?.trim()) continue;
      if (
        kept.length >= CONSTANTS.HISTORY_MIN_MESSAGES &&
        chars + row.body.length > CONSTANTS.HISTORY_CHAR_BUDGET
      ) {
        truncated = true;
        break;
      }
      kept.push(row);
      chars += row.body.length;
    }

    return { messages: kept.reverse(), chars, truncated };
  } catch (error) {
    console.error("대화 기록 가져오기 오류:", error);
    return { messages: [], chars: 0, truncated: false };
  }
}

// 대화 컨텍스트를 포함한 메시지 배열 생성
function buildConversationContext(messages: HistoryMessage[], currentMessage: string) {
  const contextMessages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }> = [
      {
        role: "system",
        content: AI_AGENT_PROMPTS.assistant,
      },
    ];

  // 이전 대화 기록 추가
  for (const msg of messages) {
    contextMessages.push({
      role: msg.isAIResponse ? "assistant" : "user",
      content: msg.body ?? "",
    });
  }

  // 현재 메시지 추가
  contextMessages.push({
    role: "user",
    content: currentMessage,
  });

  return contextMessages;
}

// 스트리밍 처리에 필요한 요청 정보
type StreamContext = {
  conversationId: string;
  userId: string;
  messageId?: string;
  existingAIMessageId?: string;
  userMessageCreatedAt?: Date; // 답변 대상 사용자 메시지 시각 (이 대화방에서 찾은 경우만)
  history: { count: number; chars: number; truncated: boolean };
};

// 클라이언트 연결 상태 (ReadableStream의 cancel()과 공유)
type ClientState = { gone: boolean };

// OpenAI usage 청크에서 로그에 쓰는 필드
type OpenAIUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  prompt_tokens_details?: { cached_tokens?: number };
  completion_tokens_details?: { reasoning_tokens?: number };
};

// 토큰 상한(finish_reason: "length")에서 잘린 답변 끝에 붙이는 안내
const LENGTH_NOTICE =
  '\n\n(답변이 길어 여기서 끊겼습니다. 이어서 보려면 "계속"이라고 입력해 주세요.)';

// AI 메시지 createdAt: 사용자 메시지 +1ms (못 찾으면 현재 시각)
function getAIMessageCreatedAt(ctx: StreamContext) {
  return ctx.userMessageCreatedAt
    ? new Date(ctx.userMessageCreatedAt.getTime() + 1)
    : new Date();
}

// 같은 질문에 달린 "다른" AI 행의 조건. 한 질문의 AI 답변 자리는 질문 시각 +1ms 하나이고,
// 재시도는 대상 ID(existingAIMessageId)도 함께 가리킨다. 이 대화방의 AI 메시지로 한정하므로
// 클라이언트가 보낸 ID로 다른 방·사용자 메시지를 건드릴 수 없다.
// 연결이 끊긴 원 요청과 재시도가 각자 끝까지 저장하면 한 질문에 행이 둘 생기므로, 저장 전에 이 조건으로 정리한다
function otherAnswersWhere(ctx: StreamContext, ownId: string, createdAt: Date) {
  const targets = [
    ...(ctx.existingAIMessageId ? [{ id: ctx.existingAIMessageId }] : []),
    ...(ctx.userMessageCreatedAt ? [{ createdAt }] : []),
  ];
  // 질문을 특정하지 못했고 재시도도 아니면 정리할 대상이 없다
  if (targets.length === 0) return null;
  return {
    conversationId: ctx.conversationId,
    isAIResponse: true,
    id: { not: ownId },
    OR: targets,
  };
}

async function hasValidAnswer(others: NonNullable<ReturnType<typeof otherAnswersWhere>>) {
  return (await prisma.message.count({ where: { AND: [others, NOT_ERROR] } })) > 0;
}

// 에러 메시지 저장
// 클라이언트가 보낸 messageId로 저장한다 → 클라이언트의 실패 메시지와 같은 메시지가 되어
// 재시도(existingAIMessageId) 때 함께 정리된다. 같은 ID가 이미 있으면 P2002로 실패하고 기존 행은 그대로 둔다
async function saveAIErrorMessage(ctx: StreamContext, body: string) {
  try {
    const id = ctx.messageId ?? randomUUID();
    const createdAt = getAIMessageCreatedAt(ctx);
    const others = otherAnswersWhere(ctx, id, createdAt);

    if (others) {
      // 같은 질문에 정상 답변이 이미 있으면 에러 행을 덧붙이지 않는다 (정상 답변은 지우지 않는다)
      if (await hasValidAnswer(others)) return;
      // 이전 에러 행은 대체한다
      await prisma.message.deleteMany({ where: { ...others, isError: true } });
    }

    await prisma.message.create({
      data: {
        id,
        body,
        type: "text",
        conversation: { connect: { id: ctx.conversationId } },
        sender: { connect: { id: ctx.userId } },
        isAIResponse: true, // 에러 메시지도 AI 메시지로 간주
        isError: true, // 에러 상태 표시
        createdAt,
      },
    });
  } catch (error) {
    console.error("AI 에러 메시지 저장 오류:", error);
  }
}

// 스트리밍 응답 처리 함수
async function handleStreamingResponse(
  upstream: { response: Response; clearDeadline: () => void },
  controller: ReadableStreamDefaultController<Uint8Array>,
  client: ClientState,
  ctx: StreamContext,
) {
  const { conversationId, userId, messageId, existingAIMessageId } = ctx;
  const reader = upstream.response.body?.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const result: {
    text: string;
    finishReason: string | null;
    usage: OpenAIUsage | null;
  } = { text: "", finishReason: null, usage: null };

  // 클라이언트가 떠나면 enqueue가 throw한다 → 전송만 멈추고, 업스트림은 끝까지 읽어 답변을 저장한다
  const send = (text: string) => {
    if (client.gone) return;
    try {
      controller.enqueue(encoder.encode(text));
    } catch {
      client.gone = true;
    }
  };

  if (!reader) {
    upstream.clearDeadline();
    // 스트리밍을 시작할 수 없는 경우 에러 메시지 저장
    await saveAIErrorMessage(ctx, "AI 응답을 생성할 수 없습니다. 다시 시도해주세요.");
    try {
      controller.close();
    } catch {
      // 이미 닫힌 경우 무시
    }
    return;
  }

  // OpenAI SSE 한 줄 처리 ([DONE]이면 true)
  const handleLine = (line: string): boolean => {
    if (!line.startsWith("data: ")) return false;
    const data = line.slice(6).trim();
    if (data === "[DONE]") return true;

    try {
      const parsed = JSON.parse(data);
      // include_usage: 마지막 청크는 choices가 빈 배열이고 usage만 담겨 온다
      if (parsed.usage) result.usage = parsed.usage;
      const choice = parsed.choices?.[0];
      if (choice?.finish_reason) result.finishReason = choice.finish_reason;

      const content = choice?.delta?.content;
      if (content) {
        result.text += content;
        send(`data: ${JSON.stringify({ content })}\n\n`);
      }
    } catch (e) {
      // JSON 파싱 오류는 스트리밍 중 정상적인 상황이므로 무시
      console.debug("스트리밍 데이터 파싱 오류:", e);
    }
    return false;
  };

  try {
    // ✅ 모바일 사파리: 버퍼를 사용하여 스트림 안정성 향상
    let buffer = "";
    let isStreamingComplete = false;
    while (!isStreamingComplete) {
      const { done, value } = await reader.read();

      if (done) {
        // ✅ 스트림 완료 시 남은 버퍼 처리
        for (const line of buffer.split(/\r?\n/)) {
          if (handleLine(line)) break;
        }
        break;
      }

      if (!value) continue;

      // ✅ 버퍼에 추가하여 라인 단위로 처리
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (handleLine(line)) {
          isStreamingComplete = true;
          break;
        }
      }
    }
    upstream.clearDeadline();

    // 토큰 상한에서 잘린 답변: 안내 문구를 스트림과 저장 본문 모두에 붙인다
    if (result.finishReason === "length" && result.text.trim()) {
      result.text += LENGTH_NOTICE;
      send(`data: ${JSON.stringify({ content: LENGTH_NOTICE })}\n\n`);
    }
    const fullResponse = result.text;

    // 사용량 로그 (메시지 본문은 남기지 않는다) — HISTORY_CHAR_BUDGET 조정 근거
    console.info("[ai/stream] usage", {
      conversationId,
      historyMessages: ctx.history.count,
      historyChars: ctx.history.chars,
      historyTruncated: ctx.history.truncated,
      promptTokens: result.usage?.prompt_tokens ?? null,
      cachedTokens: result.usage?.prompt_tokens_details?.cached_tokens ?? null,
      completionTokens: result.usage?.completion_tokens ?? null,
      reasoningTokens: result.usage?.completion_tokens_details?.reasoning_tokens ?? null,
      finishReason: result.finishReason,
      clientDisconnected: client.gone,
    });

    // 스트리밍 완료 후 AI 메시지를 데이터베이스에 저장 또는 업데이트
    if (fullResponse.trim()) {
      try {
        // 사용자 메시지 +1ms
        const aiCreatedAt = getAIMessageCreatedAt(ctx);
        const savedMessageId = messageId || randomUUID();
        const others = otherAnswersWhere(ctx, savedMessageId, aiCreatedAt);

        if (others) {
          // 연결이 끊긴 원 요청: 그 사이 재시도가 이미 답을 저장했다면 사용자가 본 그 답을 유지한다
          if (client.gone && !existingAIMessageId && (await hasValidAnswer(others))) return;

          // 같은 질문의 다른 AI 행(재시도 대상, 이전 에러 행)을 지워 질문 하나에 답변 하나만 남긴다
          try {
            // 조건에 맞는 메시지가 없으면 0건 삭제로 끝난다 (이미 삭제되었거나 로컬에만 있던 실패 메시지)
            await prisma.message.deleteMany({ where: others });
          } catch (error) {
            console.error("기존 AI 메시지 삭제 오류:", error);
            // 삭제 실패해도 계속 진행
          }
        }

        // 같은 ID의 AI 메시지가 이 대화방에 있으면 업데이트, 없으면 생성
        const updated = messageId
          ? await prisma.message.updateMany({
              where: { id: messageId, conversationId, isAIResponse: true },
              data: {
                body: fullResponse.trim(),
                isError: false,
                createdAt: aiCreatedAt,
              },
            })
          : { count: 0 };

        if (updated.count === 0) {
          // (같은 ID가 다른 범위에 이미 있으면 P2002로 실패 → 덮어쓰지 않음)
          await prisma.message.create({
            data: {
              id: savedMessageId,
              body: fullResponse.trim(),
              type: "text",
              conversation: { connect: { id: conversationId } },
              sender: { connect: { id: userId } },
              isAIResponse: true,
              createdAt: aiCreatedAt,
            },
          });
        }

        // ✅ AI 메시지 저장 후 conversation.lastMessageAt 업데이트 (대화방 목록 반영용)
        // 같은 자리(U+1ms)의 행을 교체한 경우 lastMessageAt이 aiCreatedAt과 같으므로 lte 사용
        await prisma.conversation.updateMany({
          where: { id: conversationId, lastMessageAt: { lte: aiCreatedAt } },
          data: { lastMessageAt: aiCreatedAt, lastMessageId: savedMessageId },
        });

        // ✅ 스트림 마지막에 메타데이터 전송 (클라이언트가 createdAt 업데이트하도록)
        // ✅ 모바일 사파리: 메타데이터 전송 보장 (DONE 전에 전송)
        const metadata = JSON.stringify({
          type: 'metadata',
          messageId: savedMessageId,
          createdAt: aiCreatedAt.toISOString(),
        });
        send(`\n\n[METADATA]${metadata}\n\n`);
      } catch (error) {
        console.error("AI 메시지 저장 오류:", error);
        // ✅ 메시지 저장 실패 시에도 메타데이터 전송 (클라이언트에 알림)
        const errorMetadata = JSON.stringify({
          type: 'metadata',
          messageId: messageId || randomUUID(),
          createdAt: new Date().toISOString(),
          error: true,
        });
        send(`\n\n[METADATA]${errorMetadata}\n\n`);
      }
    } else {
      // ✅ 응답이 비어있어도 메타데이터 전송 (클라이언트에 알림)
      console.warn("AI 응답이 비어있습니다.");
      const emptyMetadata = JSON.stringify({
        type: 'metadata',
        messageId: messageId || randomUUID(),
        createdAt: new Date().toISOString(),
        empty: true,
      });
      send(`\n\n[METADATA]${emptyMetadata}\n\n`);
    }

    // ✅ DONE 신호 전송 (스트림 완료 알림)
    send(`data: [DONE]\n\n`);
  } catch (error) {
    // 업스트림 읽기 실패(전체 상한 초과로 인한 abort 포함). 클라이언트 이탈은 여기로 오지 않는다
    console.error("스트리밍 처리 오류:", error);

    // 스트리밍 중 오류 발생 시 에러 메시지 저장
    await saveAIErrorMessage(ctx, "AI 응답 생성 중 오류가 발생했습니다. 다시 시도해주세요.");

    try {
      controller.error(error);
    } catch {
      // 이미 닫힌 경우 무시
    }
  } finally {
    upstream.clearDeadline();
    try {
      reader.releaseLock();
    } catch {
      // 이미 해제된 경우 무시
    }
    try {
      controller.close();
    } catch {
      // 이미 닫힌 경우 무시
    }
  }
}

// OpenAI API 호출 함수
type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

async function callOpenAI(apiKey: string, contextMessages: ChatMessage[]) {
  const requestBody = {
    model: OPENAI_TEXT_MODEL,
    messages: contextMessages,
    stream: true,
    // 마지막 청크로 토큰 사용량을 받는다 (usage 로그용)
    stream_options: { include_usage: true },
    // 추론 모델: 채팅 응답 속도를 위해 추론을 끈다 (추론 토큰도 출력 토큰으로 과금됨)
    reasoning_effort: "none",
    temperature: 0.7,
    // 이 모델은 max_tokens를 400으로 거부한다 → max_completion_tokens 사용
    max_completion_tokens: 1000,
  };

  const controller = new AbortController();
  const startedAt = Date.now();
  const timeoutId = setTimeout(() => controller.abort(), CONSTANTS.STREAM_TIMEOUT);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "User-Agent": "iloveperfume-ai-assistant/1.0",
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
      // CORS 및 CSP 관련 설정 추가
      mode: "cors",
      credentials: "omit",
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API 오류:", response.status, errorText);
      throw new Error(`AI 서비스 오류: ${response.status}`);
    }

    // 헤더를 받은 뒤 본문이 멈추는 경우에 대비해, 전체 상한까지 남은 시간으로 abort를 다시 건다
    const deadlineId = setTimeout(
      () => controller.abort(),
      Math.max(0, CONSTANTS.UPSTREAM_DEADLINE - (Date.now() - startedAt)),
    );

    return { response, clearDeadline: () => clearTimeout(deadlineId) };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("AI 응답 시간 초과");
    }
    throw error;
  }
}

export async function POST(req: NextRequest) {
  // 2. 요청 데이터 파싱 및 검증 (먼저 수행)
  let requestData;
  try {
    requestData = await req.json();
  } catch {
    return NextResponse.json({ message: "잘못된 요청 형식입니다." }, { status: 400 });
  }
  if (!requestData || typeof requestData !== "object") {
    return NextResponse.json({ message: "잘못된 요청 형식입니다." }, { status: 400 });
  }

  try {
    // 1. 사용자 인증 확인
    const user = await getCurrentUser();

    if (!user?.id || !user?.email) {
      return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
    }

    const { message, conversationId } = requestData;
    // 2-1. 레이트 리미트 체크
    if (!checkRateLimit(user.id)) {
      return NextResponse.json(
        { message: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
        { status: 429 },
      );
    }

    // 3. 입력 검증
    const validation = validateInput(message, conversationId);
    if (!validation.isValid) {
      return NextResponse.json({ message: validation.error }, { status: 400 });
    }

    // 3-0. 선택적 ID 파라미터 타입 검증 (빈 값은 "없음"으로 취급)
    if (
      !isOptionalId(requestData.messageId) ||
      !isOptionalId(requestData.existingAIMessageId) ||
      !isOptionalId(requestData.userMessageId)
    ) {
      return NextResponse.json({ message: "메시지 ID가 유효하지 않습니다." }, { status: 400 });
    }
    const messageId: string | undefined = requestData.messageId || undefined;
    const existingAIMessageId: string | undefined = requestData.existingAIMessageId || undefined;
    const userMessageId: string | undefined = requestData.userMessageId || undefined;

    // 3-1. 길이 제한 + 주제/안전성 검열 (공용 정책 — 클라이언트 입력 검증과 같은 함수)
    const topicCheck = validatePrompt(message);
    if (!topicCheck.isValid) {
      return NextResponse.json(
        { message: topicCheck.error || "요청이 정책을 위반했습니다." },
        { status: 400 },
      );
    }

    // 4. API 키 확인
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("OpenAI API 키가 설정되지 않았습니다.");

      // ✅ API 키가 없어도 사용자 메시지는 이미 저장되었으므로 추가 저장하지 않음
      return NextResponse.json(
        { message: "AI 서비스를 사용할 수 없습니다." },
        { status: 500 },
      );
    }

    // 5. 대화방 권한 확인: 존재 + 참여자 + AI 채팅방을 한 쿼리로
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, userIds: { has: user.id }, isAIChat: true },
      select: { id: true },
    });
    if (!conversation) {
      return NextResponse.json(
        { message: "대화방을 찾을 수 없거나 참여자가 아닙니다." },
        { status: 403 },
      );
    }

    // 5-1. messageId가 이미 존재한다면 이 대화방의 AI 메시지여야 한다
    // (다른 대화방/사용자 메시지를 AI 응답으로 덮어쓰지 못하도록 OpenAI 호출 전에 거절)
    if (messageId) {
      const existingMessage = await prisma.message.findUnique({
        where: { id: messageId },
        select: { conversationId: true, isAIResponse: true },
      });
      if (
        existingMessage &&
        !(existingMessage.conversationId === conversationId && existingMessage.isAIResponse === true)
      ) {
        return NextResponse.json({ message: "메시지 ID가 유효하지 않습니다." }, { status: 400 });
      }
    }

    // 5-2. 답변 대상 사용자 메시지 (이 대화방 것만): 기록의 기준점이자 AI 메시지 createdAt(+1ms)의 기준
    let userMessageCreatedAt: Date | undefined;
    if (userMessageId) {
      const userMsg = await prisma.message.findFirst({
        where: { id: userMessageId, conversationId },
        select: { createdAt: true },
      });
      userMessageCreatedAt = userMsg?.createdAt;
    }

    // 6. 대화 컨텍스트 준비
    const conversationHistory = await getConversationHistory(
      conversationId,
      message,
      userMessageCreatedAt,
      existingAIMessageId,
    );
    const contextMessages = buildConversationContext(
      conversationHistory.messages,
      message,
    );

    // 7. OpenAI API 호출
    const upstream = await callOpenAI(apiKey, contextMessages);

    // 8. 스트리밍 응답 생성
    const client: ClientState = { gone: false };
    let streamDone: Promise<void> = Promise.resolve();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        streamDone = handleStreamingResponse(upstream, controller, client, {
          conversationId,
          userId: user.id,
          messageId,
          existingAIMessageId,
          userMessageCreatedAt,
          history: {
            count: conversationHistory.messages.length,
            chars: conversationHistory.chars,
            truncated: conversationHistory.truncated,
          },
        }).catch((error) => {
          console.error("스트리밍 처리 오류:", error);
        });
      },
      // 클라이언트가 연결을 끊은 경우: 전송만 멈추고 답변 저장은 계속한다
      cancel() {
        client.gone = true;
      },
    });

    // 응답이 닫힌 뒤에도(클라이언트 이탈 포함) 저장이 끝날 때까지 함수 실행을 유지한다
    try {
      after(streamDone);
    } catch (error) {
      console.error("after 등록 오류:", error);
    }

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no", // Nginx 프록시에서 버퍼링 비활성화
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Cross-Origin-Embedder-Policy": "unsafe-none",
        "Cross-Origin-Opener-Policy": "same-origin",
        "Cross-Origin-Resource-Policy": "cross-origin",
      },
    });
  } catch (error) {
    console.error("스트리밍 API 오류:", error);

    // ✅ 에러 발생 시 사용자 메시지 저장은 이미 정상적인 경우에 수행되었으므로 중복 저장하지 않음
    // 에러 타입에 따른 적절한 응답
    if (error instanceof Error) {
      if (error.message.includes('AI 응답 시간 초과')) {
        return NextResponse.json(
          { message: "AI 응답 시간이 초과되었습니다. 다시 시도해주세요." },
          { status: 408 },
        );
      }
      if (error.message.includes("AI 서비스 오류")) {
        return NextResponse.json({ message: error.message }, { status: 503 });
      }
    }

    return NextResponse.json({ message: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}