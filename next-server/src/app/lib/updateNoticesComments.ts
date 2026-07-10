import { apiFetch } from "@/src/app/utils/apiFetch";
import { UpdateCommentResponse } from "@/src/app/types/comments";

type Props = {
    noticeId: string;
    commentId: string;
    text: string;
}

export const updateNoticesComments = async ({ noticeId, commentId, text }: Props) => {
    return apiFetch<UpdateCommentResponse>(`/api/notice/comments/${noticeId}/${commentId}`, {
        method: 'PUT',
        body: JSON.stringify({ text }),
        defaultErrorMessage: "댓글 수정에 실패했습니다.",
    });
}
