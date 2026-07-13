import { apiFetch } from "@/src/app/utils/apiFetch";

export type ChatMember = {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
    role: string | null;
};

type GetUsersResponse = {
    users: ChatMember[];
    message?: string;
};

const getUsers = async () => {
    return apiFetch<GetUsersResponse>(`/api/chatMember`, {
        defaultErrorMessage: "채팅 멤버를 찾지 못했습니다.",
    });
}

export default getUsers;