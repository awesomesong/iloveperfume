import type { Conversation } from "@prisma/client";
import type { IUserList } from "@/src/app/types/common";
import { apiFetch } from "@/src/app/utils/apiFetch";

type GetConversationByIdResponse = {
    conversation: Conversation & { users: IUserList[] };
    message?: string;
};

const getConversationById = async (conversationId: string) => {
    return apiFetch<GetConversationByIdResponse>(`/api/conversations/${conversationId}`, {
        defaultErrorMessage: "대화방을 불러오지 못했습니다.",
    });
};

export default getConversationById;