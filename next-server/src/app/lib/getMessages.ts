import { apiFetch } from "@/src/app/utils/apiFetch";
import type { FullMessageType } from "@/src/app/types/conversation";

type getMessagesProps = {
    conversationId: string;
    pageParam: null | string;
}

type GetMessagesResponse = {
    messages: FullMessageType[];
    nextCursor?: string;
    message?: string;
    seenUsersForLastMessage?: Array<{ id: string; name: string | null; image: string | null }>;
};

const getMessages = async ({conversationId, pageParam} :getMessagesProps) => {
    const cursor =  pageParam !== null ? '?cursor='+pageParam : '';

    return apiFetch<GetMessagesResponse>(`/api/messages/${conversationId}${cursor}`, {
        defaultErrorMessage: "메시지를 불러오지 못했습니다.",
    });
};

export default getMessages;