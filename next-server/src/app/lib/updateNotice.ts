import { apiFetch } from "@/src/app/utils/apiFetch";
import { UpdateNoticeRequest, UpdateNoticeResponse } from "@/src/app/types/notice";

/**
 * 블로그 글 수정 API
 */
export const updateNotice = async (id: string, data: UpdateNoticeRequest): Promise<UpdateNoticeResponse> => {
  const responseData = await apiFetch<{ updateNotice: UpdateNoticeResponse["updateNotice"] }>(`/api/notice/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
    errorMessagesByStatus: { 403: "해당 글을 수정할 권한이 없습니다." },
    defaultErrorMessage: "공지사항 수정 중 오류가 발생했습니다.",
  });

  return {
    success: true,
    updateNotice: responseData.updateNotice,
    message: "글이 수정되었습니다.",
  };
};
