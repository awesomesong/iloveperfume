'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { HiArrowUp, HiSparkles } from 'react-icons/hi2';
import { createConversationWithFirstMessage } from '@/src/app/lib/createConversationWithFirstMessage';
import {
  conversationKey,
  messagesKey,
  normalizeMessage,
  upsertConversationWithFirstMessage,
} from '@/src/app/lib/react-query/chatCache';
import type { FullConversationType, ConversationMessagePreview } from '@/src/app/types/conversation';
import { startTransition } from 'react';

const SUGGESTIONS = [
  '초보자한테 맞는 향수 추천해줘',
  '플로럴이랑 우디 계열 차이가 뭐야?',
  '여름에 어울리는 향수 알려줘',
];

const AI_GREETING = '안녕하세요! 향수에 대해 궁금한 점이 있으시면 편하게 물어보세요.';

export default function HomeAIChatInput() {
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingMessage, setPendingMessage] = useState('');
  const [dotCount, setDotCount] = useState(0);
  const [shown, setShown] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setShown(true); },
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!loading) { setDotCount(0); return; }
    const id = setInterval(() => setDotCount((p) => (p + 1) % 4), 500);
    return () => clearInterval(id);
  }, [loading]);

  const submit = async (message: string) => {
    const trimmed = message.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setPendingMessage(trimmed);
    setValue('');
    try {
      const messageId = crypto.randomUUID();
      let convData: Awaited<ReturnType<typeof createConversationWithFirstMessage>>;
      try {
        // reuseExisting: true → 서버에서 기존 방 재사용 or 새로 생성을 1번 요청으로 처리
        convData = await createConversationWithFirstMessage({
          aiAgentType: 'assistant',
          message: trimmed,
          messageId,
          reuseExisting: true,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '';
        if (msg.includes('401') || msg.includes('로그인')) {
          sessionStorage.setItem('ilp:pendingChatMessage', trimmed);
          router.push(`/auth/signin?callbackUrl=${encodeURIComponent('/chat-redirect')}`);
          return;
        }
        throw err;
      }

      const { conversation: conv, newMessage } = convData;
      if (!conv?.id) throw new Error('대화방 생성 실패');

      // 기존 방이 있으면 메시지 없이 바로 이동
      if (conv.existingConversation) {
        startTransition(() => {
          router.push(`/conversations/${conv.id}`);
        });
        return;
      }

      // 새로 만든 방: DraftForm과 동일하게 캐시 미리 채우기 → 전환 시 스피너 없음
      const convForCache = {
        id: conv.id,
        name: conv.name ?? null,
        isGroup: conv.isGroup ?? false,
        isAIChat: conv.isAIChat ?? false,
        aiAgentType: conv.aiAgentType ?? null,
        userIds: conv.userIds ?? [],
        users: conv.users ?? [],
        lastMessageAt: conv.lastMessageAt ?? undefined,
      };
      queryClient.setQueryData(conversationKey(conv.id), { conversation: convForCache });
      queryClient.setQueryData(messagesKey(conv.id), {
        pages: [{ messages: [normalizeMessage(newMessage)], nextCursor: null, seenUsersForLastMessage: [] }],
        pageParams: [null],
      });
      upsertConversationWithFirstMessage(
        queryClient,
        convForCache as Partial<FullConversationType> & { id: string },
        newMessage as unknown as ConversationMessagePreview,
      );

      // AIChatForm이 마운트되면 이 값을 읽어 AI 스트림을 자동 시작
      sessionStorage.setItem('ilp:pendingAI', JSON.stringify({
        conversationId: conv.id,
        userMessage: trimmed,
        userMessageId: messageId,
      }));

      startTransition(() => {
        router.push(`/conversations/${conv.id}`);
      });
    } catch {
      alert('오류가 발생했어요. 다시 시도해주세요.');
    } finally {
      setLoading(false);
      setPendingMessage('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit(value);
    }
  };

  return (
    <div
      ref={containerRef}
      className="w-full max-w-md rounded-2xl overflow-hidden flex flex-col"
      style={{
        background: 'var(--color-card-bg)',
        border: '1px solid var(--color-card-border)',
        boxShadow: '0 4px 24px var(--color-shadow-soft)',
        opacity: shown ? 1 : 0,
        transform: shown ? 'translateY(0)' : 'translateY(12px)',
        transition: 'opacity 0.5s ease, transform 0.5s ease',
      }}
    >
      {/* 헤더 */}
      <div
        className="flex items-center gap-3 px-4 py-3"
        style={{ borderBottom: '1px solid var(--color-card-border)' }}
      >
        <div
          className="relative shrink-0 size-8 rounded-full flex items-center justify-center"
          style={{ background: 'var(--color-accent)' }}
        >
          <HiSparkles className="size-4 text-white" aria-hidden />
          <span
            className="absolute bottom-0 right-0 size-2.5 rounded-full"
            style={{ background: '#4ade80', border: '2px solid var(--color-card-bg)' }}
            aria-hidden
          />
        </div>
        <span className="text-sm font-semibold leading-none" style={{ color: 'var(--color-text-primary)' }}>
          향수 AI 어시스턴트
        </span>
      </div>

      {/* 메시지 영역 */}
      <div className="flex flex-col gap-3 px-4 py-4">
        {/* AI 말풍선 */}
        <div
          className="flex items-end gap-2"
          style={{
            opacity: shown ? 1 : 0,
            transform: shown ? 'translateY(0)' : 'translateY(6px)',
            transition: 'opacity 0.4s ease 0.15s, transform 0.4s ease 0.15s',
          }}
        >
          <div
            className="shrink-0 size-6 rounded-full flex items-center justify-center"
            style={{ background: 'var(--color-accent)' }}
            aria-hidden
          >
            <HiSparkles className="size-3 text-white" />
          </div>
          <div
            className="rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-sm leading-relaxed"
            style={{
              background: 'var(--color-accent-pale)',
              border: '1px solid var(--color-accent-border)',
              color: 'var(--color-text-primary)',
              maxWidth: 'calc(100% - 2rem)',
            }}
          >
            {AI_GREETING}
          </div>
        </div>

        {/* 추천 질문 칩 */}
        {!loading && (
          <div
            className="flex flex-wrap gap-2 pl-8"
            style={{
              opacity: shown ? 1 : 0,
              transform: shown ? 'translateY(0)' : 'translateY(6px)',
              transition: 'opacity 0.4s ease 0.28s, transform 0.4s ease 0.28s',
            }}
          >
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => submit(s)}
                className="rounded-full px-3 py-1.5 text-xs transition-opacity hover:opacity-70 text-left"
                style={{
                  background: 'var(--color-card-bg)',
                  border: '1px solid var(--color-card-border)',
                  color: 'var(--color-text-primary)',
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* 로딩 중: 사용자 메시지 + AI 응답 대기 말풍선 */}
        {loading && pendingMessage && (
          <>
            {/* 사용자 말풍선 */}
            <div className="flex items-end justify-end">
              <div
                className="rounded-2xl rounded-br-sm px-3.5 py-2.5 text-sm leading-relaxed"
                style={{
                  background: 'var(--color-accent)',
                  color: '#fff',
                  maxWidth: 'calc(100% - 2rem)',
                }}
              >
                {pendingMessage}
              </div>
            </div>

            {/* AI 대기 말풍선 */}
            <div className="flex items-end gap-2">
              <div
                className="shrink-0 size-6 rounded-full flex items-center justify-center"
                style={{ background: 'var(--color-accent)' }}
                aria-hidden
              >
                <HiSparkles className="size-3 text-white" />
              </div>
              <div
                className="rounded-2xl rounded-bl-sm px-3.5 py-2.5"
                style={{
                  background: 'var(--color-accent-pale)',
                  border: '1px solid var(--color-accent-border)',
                }}
              >
                <div className="flex items-center gap-1">
                  <HiSparkles className="size-3.5 text-amber-500 animate-pulse" aria-hidden />
                  <span className="text-amber-500 font-medium text-sm">{'.'.repeat(dotCount)}</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 입력창 */}
      <div
        className="flex items-end gap-2 px-3 py-3"
        style={{ borderTop: '1px solid var(--color-card-border)' }}
      >
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
          }}
          onKeyDown={handleKeyDown}
          placeholder="메시지를 입력하세요"
          disabled={loading}
          className="flex-1 resize-none bg-transparent text-sm leading-relaxed outline-none placeholder:text-secondary"
          style={{
            color: 'var(--color-text-primary)',
            minHeight: '24px',
            maxHeight: '120px',
          }}
        />
        <button
          type="button"
          onClick={() => submit(value)}
          disabled={!value.trim() || loading}
          className="shrink-0 rounded-xl p-2 transition-opacity disabled:opacity-30"
          style={{ background: 'var(--color-accent)', color: '#fff' }}
          aria-label="전송"
        >
          {loading ? (
            <span
              className="block size-4 rounded-full border-2 border-white/30 border-t-white animate-spin"
              aria-hidden
            />
          ) : (
            <HiArrowUp className="size-4" aria-hidden />
          )}
        </button>
      </div>
    </div>
  );
}
