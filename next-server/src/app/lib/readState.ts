import { apiFetch } from "@/src/app/utils/apiFetch";

type ReadStateProps = {
  conversationId: string;
  seenUntilMs: number;
  lastMessageId?: string;
  includeSeenUsers?: boolean; // ✅ 단순화: boolean만 사용
};

type ReadStateResponse = {
  conversationId: string;
  lastMessageId: string | null;
  readCount: number;
  messageSenderId: string | null;
  seenUsers?: { id: string; name: string | null; image: string | null }[];
};

export const readState = async ({
  conversationId,
  seenUntilMs,
  lastMessageId,
  includeSeenUsers = false  // ✅ 기본값을 false로 변경 (가벼운 응답)
}: ReadStateProps) => {
  const url = new URL(`/api/conversations/${conversationId}/read-state`, window.location.origin);

  // ✅ includeSeenUsers가 true일 때만 쿼리 파라미터 추가
  if (includeSeenUsers) {
    url.searchParams.set('includeSeenUsers', 'true');
  }

  return apiFetch<ReadStateResponse>(url.toString(), {
    method: 'PATCH',
    body: JSON.stringify({ seenUntilMs, lastMessageId }),
    defaultErrorMessage: "read-state failed",
  });
};
