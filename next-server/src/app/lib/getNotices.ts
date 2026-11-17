import { apiFetch } from "@/src/app/utils/apiFetch";
import type { Notice, NoticeListFilter } from "@/src/app/types/notice";

type GetNoticesParams = {
  pageParam: string;
  queryKey: readonly unknown[];
};

type GetNoticesResponse = {
  noticePosts: Notice[];
};

/** queryKey: ["notices", filter] — filter는 "ALL" | 카테고리 */
export const getNotices = async ({ pageParam, queryKey }: GetNoticesParams) => {
  const filter = (queryKey[1] ?? "ALL") as NoticeListFilter;

  const params = new URLSearchParams();
  if (pageParam) params.set("cursor", pageParam);
  if (filter !== "ALL") params.set("category", filter);

  const query = params.toString();
  const { noticePosts } = await apiFetch<GetNoticesResponse>(
    `/api/notice${query ? `?${query}` : ""}`,
    { defaultErrorMessage: "향수 뉴스를 불러오지 못했습니다." },
  );

  return noticePosts;
};
