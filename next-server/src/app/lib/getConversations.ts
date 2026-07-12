import { apiFetch } from "@/src/app/utils/apiFetch";
import type { ConversationListResponse } from "@/src/app/types/conversation";

const getConversations = async () => {
  return apiFetch<ConversationListResponse>(`/api/conversations`, {
    defaultErrorMessage: "대화방을 불러오는 중 오류가 발생하였습니다.",
  });
};

export default getConversations;
