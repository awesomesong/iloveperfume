import { apiFetch } from "@/src/app/utils/apiFetch";
import type { IUserList } from "@/src/app/types/common";

type GetUsersResponse = {
    users: IUserList[];
    message?: string;
};

const getUsers = async () => {
    return apiFetch<GetUsersResponse>(`/api/chatMember`, {
        defaultErrorMessage: "채팅 멤버를 찾지 못했습니다.",
    });
}

export default getUsers;