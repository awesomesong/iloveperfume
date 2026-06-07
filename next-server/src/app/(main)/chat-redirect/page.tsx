'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { HiSparkles } from 'react-icons/hi2';
import { startTransition } from 'react';
import { createConversationWithFirstMessage } from '@/src/app/lib/createConversationWithFirstMessage';
import {
  conversationKey,
  messagesKey,
  normalizeMessage,
  upsertConversationWithFirstMessage,
} from '@/src/app/lib/react-query/chatCache';
import type { FullConversationType, ConversationMessagePreview } from '@/src/app/types/conversation';

export default function ChatRedirectPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const hasRunRef = useRef(false);

  useEffect(() => {
    if (hasRunRef.current) return;
    hasRunRef.current = true;

    const pending = sessionStorage.getItem('ilp:pendingChatMessage');
    if (!pending) {
      router.replace('/');
      return;
    }
    sessionStorage.removeItem('ilp:pendingChatMessage');

    (async () => {
      try {
        const messageId = crypto.randomUUID();
        const convData = await createConversationWithFirstMessage({
          aiAgentType: 'assistant',
          message: pending,
          messageId,
          reuseExisting: true,
        });

        const { conversation: conv, newMessage } = convData;
        if (!conv?.id) throw new Error('대화방 생성 실패');

        if (conv.existingConversation) {
          startTransition(() => router.replace(`/conversations/${conv.id}`));
          return;
        }

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

        sessionStorage.setItem('ilp:pendingAI', JSON.stringify({
          conversationId: conv.id,
          userMessage: pending,
          userMessageId: messageId,
        }));

        startTransition(() => router.replace(`/conversations/${conv.id}`));
      } catch {
        router.replace('/');
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <div
        className="size-12 rounded-full flex items-center justify-center"
        style={{ background: 'var(--color-accent)' }}
      >
        <HiSparkles className="size-6 text-white animate-pulse" />
      </div>
      <p className="text-sm text-secondary">채팅방을 만드는 중이에요...</p>
    </div>
  );
}
