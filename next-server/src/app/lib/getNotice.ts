import { apiFetch } from "@/src/app/utils/apiFetch";
import type { NoticeDetailData } from "@/src/app/types/notice";

type GetNoticeResponse = {
    notice: NoticeDetailData | null;
};

const getNotice = async (id: string) => {
    return apiFetch<GetNoticeResponse>(`/api/notice/${id}`, {
        defaultErrorMessage: "해당 글을 불러오지 못했습니다.",
    });
};

export default getNotice;