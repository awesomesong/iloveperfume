import { apiFetch } from "@/src/app/utils/apiFetch";
import type { NoticeStatus } from "@/src/app/lib/news/categories";

type UpdateNoticeStatusResponse = {
  message: string;
  notice: { id: string; status: NoticeStatus };
};

/** 관리자 전용: 향수 뉴스 내리기(HIDDEN) / 다시 게시(PUBLISHED) */
export const updateNoticeStatus = async (id: string, status: NoticeStatus) => {
  return apiFetch<UpdateNoticeStatusResponse>(`/api/notice/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
    errorMessagesByStatus: { 403: "관리자만 변경할 수 있습니다." },
    defaultErrorMessage: "상태를 변경하지 못했습니다.",
  });
};
