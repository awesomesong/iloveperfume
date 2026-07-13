import { apiFetch } from "@/src/app/utils/apiFetch";

type UserDetail = {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
    profileImage: string | null;
    role: string | null;
    provider: string | null;
    createdAt: string | Date;
    _count: { conversations: number; messages: number };
};

type GetUserResponse = {
    userInfo: UserDetail;
    message?: string;
};

const getUser = async () => {
    return apiFetch<GetUserResponse>(`/api/user`, {
        defaultErrorMessage: "사용자의 정보를 찾지 못했습니다.",
    });
}

export default getUser
