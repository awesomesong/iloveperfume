import { NextRequest, NextResponse } from "next/server";
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
  MAX_MESSAGE_LENGTH: 4000,
  MAX_HISTORY_MESSAGES: 8,
  STREAM_TIMEOUT: 30000, // 30초
  RATE_LIMIT_WINDOW: 60000, // 1분
  RATE_LIMIT_MAX_REQUESTS: 10,
} as const;

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

  if (message.length > CONSTANTS.MAX_MESSAGE_LENGTH) {
    return {
      isValid: false,
      error: `메시지가 너무 깁니다. (최대 ${CONSTANTS.MAX_MESSAGE_LENGTH}자)`,
    };
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

// 대화 기록을 가져오는 함수 (최적화)
async function getConversationHistory(
  conversationId: string,
  limit: number = CONSTANTS.MAX_HISTORY_MESSAGES,
) {
  try {
    const messages = await prisma.message.findMany({
      where: {
        conversationId: conversationId,
        type: "text",
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
      select: {
        body: true,
        isAIResponse: true,
        createdAt: true,
        sender: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    return messages.reverse();
  } catch (error) {
    console.error("대화 기록 가져오기 오류:", error);
    return [];
  }
}

// 대화 컨텍스트를 포함한 메시지 배열 생성 (최적화)
type HistoryMessage = {
  body: string | null;
  isAIResponse: boolean | null;
  createdAt: Date;
  sender?: { name: string | null; email: string | null } | null;
};

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

  // 이전 대화 기록 추가 (최대 8개 메시지)
  const recentMessages = messages.slice(-CONSTANTS.MAX_HISTORY_MESSAGES);

  for (const msg of recentMessages) {
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

// 스트리밍 응답 처리 함수
async function handleStreamingResponse(
  response: Response,
  controller: ReadableStreamDefaultController,
  conversationId: string,
  userId: string,
  messageId?: string,
  existingAIMessageId?: string,
  userMessageId?: string,
) {
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let fullResponse = "";
  let isStreamingComplete = false;

  if (!reader) {
    // 스트리밍을 시작할 수 없는 경우 에러 메시지 저장
    try {
      await prisma.message.create({
        data: {
          id: randomUUID(),
          body: "AI 응답을 생성할 수 없습니다. 다시 시도해주세요.",
          type: "text",
          conversation: { connect: { id: conversationId } },
          sender: { connect: { id: userId } },
          isAIResponse: true, // 에러 메시지도 AI 메시지로 간주
          isError: true, // 에러 상태 표시
        },
        select: {
          id: true,
          body: true,
          createdAt: true,
          conversationId: true,
          sender: {
            select: { id: true, name: true, email: true, image: true },
          },
          conversation: { select: { isGroup: true, userIds: true } },
        },
      });
    } catch (error) {
      console.error("AI 에러 메시지 저장 오류:", error);
    }
    controller.close();
    return;
  }

  try {
    // ✅ 모바일 사파리: 버퍼를 사용하여 스트림 안정성 향상
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        // ✅ 스트림 완료 시 남은 버퍼 처리
        if (buffer.trim()) {
          const lines = buffer.split(/\r?\n/);
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6).trim();
              if (data === "[DONE]") {
                isStreamingComplete = true;
              } else {
                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices?.[0]?.delta?.content;
                  if (content) {
                    fullResponse += content;
                    controller.enqueue(
                      new TextEncoder().encode(
                        `data: ${JSON.stringify({ content })}\n\n`,
                      ),
                    );
                  }
                } catch {
                  // 파싱 오류 무시
                }
              }
            }
          }
        }
        break;
      }

      if (!value) continue;

      // ✅ 버퍼에 추가하여 라인 단위로 처리
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) continue;

        if (line.startsWith("data: ")) {
          const data = line.slice(6).trim();

          if (data === "[DONE]") {
            isStreamingComplete = true;
            break;
          }

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;

            if (content) {
              fullResponse += content;
              controller.enqueue(
                new TextEncoder().encode(
                  `data: ${JSON.stringify({ content })}\n\n`,
                ),
              );
            }
          } catch (e) {
            // JSON 파싱 오류는 스트리밍 중 정상적인 상황이므로 무시
            console.debug("스트리밍 데이터 파싱 오류:", e);
          }
        }
      }

      if (isStreamingComplete) break;
    }

    // 스트리밍 완료 후 AI 메시지를 데이터베이스에 저장 또는 업데이트
    if (fullResponse.trim()) {
      try {
        // ✅ 재시도 시: 기존 AI 메시지 삭제 (DB에서)
        // 이 대화방의 AI 메시지일 때만 삭제 — 클라이언트가 보낸 ID를 그대로 믿지 않는다
        if (existingAIMessageId) {
          try {
            // 조건에 맞는 메시지가 없으면 0건 삭제로 끝난다 (이미 삭제되었거나 로컬에만 있던 실패 메시지)
            await prisma.message.deleteMany({
              where: {
                id: existingAIMessageId,
                conversationId,
                isAIResponse: true,
              },
            });
          } catch (error) {
            console.error("기존 AI 메시지 삭제 오류:", error);
            // 삭제 실패해도 계속 진행
          }
        }

        // 사용자 메시지 조회하여 +1ms 계산
        let aiCreatedAt = new Date();

        if (userMessageId) {
          const userMsg = await prisma.message.findFirst({
            where: { id: userMessageId, conversationId },
            select: { createdAt: true },
          });

          if (userMsg?.createdAt) {
            aiCreatedAt = new Date(userMsg.createdAt.getTime() + 1);
          }
        }

        // ✅ messageId가 있고 기존 메시지가 있으면 업데이트, 없으면 생성
        const savedMessageId = messageId || randomUUID();

        if (messageId) {
          // 기존 메시지 업데이트 (재시도 케이스) — 이 대화방의 AI 메시지로 한정
          const updated = await prisma.message.updateMany({
            where: { id: messageId, conversationId, isAIResponse: true },
            data: {
              body: fullResponse.trim(),
              isError: false,
              createdAt: aiCreatedAt,
            },
          });

          if (updated.count === 0) {
            // messageId로 새 메시지 생성
            // (같은 ID가 다른 범위에 이미 있으면 P2002로 실패 → 덮어쓰지 않음)
            await prisma.message.create({
              data: {
                id: messageId,
                body: fullResponse.trim(),
                type: "text",
                conversation: { connect: { id: conversationId } },
                sender: { connect: { id: userId } },
                isAIResponse: true,
                createdAt: aiCreatedAt,
              },
            });
          }
        } else {
          // messageId가 없으면 새 ID로 생성
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
        // 재생성 시: aiCreatedAt이 기존과 동일(U+1ms)할 수 있으므로 lte 사용
        const isRegenerate = Boolean(existingAIMessageId);
        await prisma.conversation.updateMany({
          where: { id: conversationId, lastMessageAt: isRegenerate ? { lte: aiCreatedAt } : { lt: aiCreatedAt } },
          data: { lastMessageAt: aiCreatedAt, lastMessageId: savedMessageId },
        });

        // ✅ 스트림 마지막에 메타데이터 전송 (클라이언트가 createdAt 업데이트하도록)
        // ✅ 모바일 사파리: 메타데이터 전송 보장 (DONE 전에 전송)
        const metadata = JSON.stringify({
          type: 'metadata',
          messageId: savedMessageId,
          createdAt: aiCreatedAt.toISOString(),
        });
        controller.enqueue(new TextEncoder().encode(`\n\n[METADATA]${metadata}\n\n`));
      } catch (error) {
        console.error("AI 메시지 저장 오류:", error);
        // ✅ 메시지 저장 실패 시에도 메타데이터 전송 시도 (클라이언트에 알림)
        try {
          const errorMessageId = messageId || randomUUID();
          const errorMetadata = JSON.stringify({
            type: 'metadata',
            messageId: errorMessageId,
            createdAt: new Date().toISOString(),
            error: true,
          });
          controller.enqueue(new TextEncoder().encode(`\n\n[METADATA]${errorMetadata}\n\n`));
        } catch (metaError) {
          console.error("메타데이터 전송 오류:", metaError);
        }
      }
    } else {
      // ✅ 응답이 비어있어도 메타데이터 전송 (클라이언트에 알림)
      console.warn("AI 응답이 비어있습니다.");
      try {
        const emptyMetadata = JSON.stringify({
          type: 'metadata',
          messageId: messageId || randomUUID(),
          createdAt: new Date().toISOString(),
          empty: true,
        });
        controller.enqueue(new TextEncoder().encode(`\n\n[METADATA]${emptyMetadata}\n\n`));
      } catch (metaError) {
        console.error("메타데이터 전송 오류:", metaError);
      }
    }

    // ✅ DONE 신호 전송 (스트림 완료 알림)
    controller.enqueue(new TextEncoder().encode(`data: [DONE]\n\n`));
  } catch (error) {
    console.error("스트리밍 처리 오류:", error);

    // 스트리밍 중 오류 발생 시 에러 메시지 저장
    try {
      await prisma.message.create({
        data: {
          id: randomUUID(),
          body: "AI 응답 생성 중 오류가 발생했습니다. 다시 시도해주세요.",
          type: "text",
          conversation: { connect: { id: conversationId } },
          sender: { connect: { id: userId } },
          isAIResponse: true, // 에러 메시지도 AI 메시지로 간주
          isError: true, // 에러 상태 표시
        },
        select: {
          id: true,
          body: true,
          createdAt: true,
          conversationId: true,
          sender: {
            select: { id: true, name: true, email: true, image: true },
          },
          conversation: { select: { isGroup: true, userIds: true } },
        },
      });
    } catch (saveError) {
      console.error("AI 에러 메시지 저장 오류:", saveError);
    }

    controller.error(error);
  } finally {
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
    // 추론 모델: 채팅 응답 속도를 위해 추론을 끈다 (추론 토큰도 출력 토큰으로 과금됨)
    reasoning_effort: "none",
    temperature: 0.7,
    // 이 모델은 max_tokens를 400으로 거부한다 → max_completion_tokens 사용
    max_completion_tokens: 1000,
  };

  const controller = new AbortController();
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

    return response;
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

    // 3-1. 주제/안전성 검열 (공용 정책)
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

    // 6. 대화 컨텍스트 준비
    const conversationHistory = await getConversationHistory(conversationId);
    const contextMessages = buildConversationContext(
      conversationHistory,
      message,
    );

    // 7. OpenAI API 호출
    const response = await callOpenAI(apiKey, contextMessages);

    // 8. 스트리밍 응답 생성
    const stream = new ReadableStream({
      async start(controller) {
        await handleStreamingResponse(
          response,
          controller,
          conversationId,
          user.id,
          messageId,
          existingAIMessageId,
          userMessageId,
        );
      },
    });

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