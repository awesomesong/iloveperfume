import { apiFetch } from "@/src/app/utils/apiFetch";
import { CreateCommentResponse } from "@/src/app/types/comments";

type Props = {
    noticeId: string;
    comment: string;
}

export const createNoticesComments = async ({noticeId, comment}: Props) => {
    return apiFetch<CreateCommentResponse>(`/api/notice/comments/${noticeId}`, {
        method: 'POST',
        body: JSON.stringify({
            text: comment,
        }),
        defaultErrorMessage: "댓글 등록에 실패했습니다.",
    });
}
