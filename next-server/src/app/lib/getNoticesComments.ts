import type { QueryFunctionContext } from "@tanstack/react-query";
import { noticesCommentsKey } from "./react-query/noticeCache";
import type { CommentPage, CommentType } from "@/src/app/types/comments";
import { apiFetch } from "@/src/app/utils/apiFetch";

type GetNoticesCommentsResponse = {
  comments: CommentType[];
  commentsCount: number;
};

export const getNoticesComments = async ({
  queryKey,
  pageParam,
}: QueryFunctionContext<ReturnType<typeof noticesCommentsKey>, string>): Promise<CommentPage> => {
  const [_key, noticeId] = queryKey;
  const cursor = pageParam ?? null;

  const { comments, commentsCount } = await apiFetch<GetNoticesCommentsResponse>(
    `/api/notice/comments/${noticeId}?cursor=${cursor}`,
    {
      next: { tags: [_key] },
      defaultErrorMessage: "해당 글의 댓글을 찾지 못했습니다.",
    },
  );

  return [{ comments }, { commentsCount }] as CommentPage;
};
