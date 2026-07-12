import { apiFetch } from "@/src/app/utils/apiFetch";
import type { DeleteConversationSuccessResponse } from "../types/conversation";

/**
 * 대화방 삭제 API 호출
 * @param conversationId - 삭제할 대화방 ID
 * @returns 삭제 성공 시 응답 데이터. 실패 시 Error를 throw.
 */
export const deleteConversation = async (conversationId: string): Promise<DeleteConversationSuccessResponse> => {
  return apiFetch<DeleteConversationSuccessResponse>(`/api/conversations/${conversationId}`, {
    method: "DELETE",
    defaultErrorMessage: "대화방 삭제 중 오류가 발생했습니다.",
  });
};
