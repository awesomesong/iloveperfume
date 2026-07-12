import { apiFetch } from "@/src/app/utils/apiFetch";
import { DeleteCommentResponse } from "@/src/app/types/comments";

type Props = {
    noticeId: string;
    commentId: string;
}

export const deleteNoticesComments = async ({ noticeId, commentId }: Props) => {
    return apiFetch<DeleteCommentResponse>(`/api/notice/comments/${noticeId}/${commentId}`, {
        method: 'DELETE',
        defaultErrorMessage: "댓글 삭제에 실패했습니다.",
    });
}
