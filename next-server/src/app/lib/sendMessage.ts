import { FieldValues } from "react-hook-form";
import { apiFetch } from "@/src/app/utils/apiFetch";
import type { FullMessageType } from "@/src/app/types/conversation";

type sendMessageProps = {
    conversationId: string;
    data?: FieldValues;
    image?: string;
    messageId: string;
}

type SendMessageResponse = {
    newMessage: FullMessageType;
};

export const sendMessage = async ({ conversationId, data, image, messageId }: sendMessageProps) => {
    const inferredType: "text" | "image" = image ? 'image' : 'text';
    const messageType = (data as { type?: "text" | "image" | "system" })?.type || inferredType;
    return apiFetch<SendMessageResponse>(`/api/messages`, {
        method: 'POST',
        body: JSON.stringify({
            ...data,
            image,
            conversationId,
            messageId,
            type: messageType,
        }),
        defaultErrorMessage: "메시지 전송 실패",
    });
}