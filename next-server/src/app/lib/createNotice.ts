import { apiFetch } from "@/src/app/utils/apiFetch";
import { CreateNoticeRequest, CreateNoticeResponse } from "@/src/app/types/notice";

/**
 * 새 블로그 글 작성 API
 */
export const createNotice = async (data: CreateNoticeRequest): Promise<CreateNoticeResponse> => {
  const responseData = await apiFetch<{ newNotice: CreateNoticeResponse["newNotice"] }>('/api/notice', {
    method: 'POST',
    body: JSON.stringify(data),
    defaultErrorMessage: "공지사항 작성 중 오류가 발생했습니다.",
  });

  return {
    success: true,
    newNotice: responseData.newNotice,
    message: "글이 작성되었습니다.",
  };
};
