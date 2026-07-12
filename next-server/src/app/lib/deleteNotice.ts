import { apiFetch } from "@/src/app/utils/apiFetch";
import { DeleteNoticeResponse } from "@/src/app/types/notice";

/**
 * 블로그 글 삭제 API
 */
export const deleteNotice = async (id: string): Promise<DeleteNoticeResponse> => {
  await apiFetch(`/api/notice/${id}`, {
    method: 'DELETE',
    errorMessagesByStatus: { 403: "해당 글을 삭제할 권한이 없습니다." },
    defaultErrorMessage: "공지사항 삭제 중 오류가 발생했습니다.",
  });

  return {
    success: true,
    message: "글이 삭제되었습니다.",
  };
};
