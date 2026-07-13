import type { QueryFunctionContext } from "@tanstack/react-query";
import { fragranceReviewsKey } from "@/src/app/lib/react-query/reviewsCache";
import type { ReviewPage } from "@/src/app/lib/react-query/reviewsCache";
import type { FragranceReviewType } from "@/src/app/types/fragrance";
import { apiFetch } from "@/src/app/utils/apiFetch";

type GetFragranceReviewsResponse = {
  reviews: FragranceReviewType[];
  reviewsCount: number;
};

export const getFragranceReviews = async ({
  queryKey,
  pageParam,
}: QueryFunctionContext<ReturnType<typeof fragranceReviewsKey>, string>): Promise<ReviewPage> => {
  const [_key, id] = queryKey;
  const cursor = pageParam ?? null;

  const { reviews, reviewsCount } = await apiFetch<GetFragranceReviewsResponse>(
    `/api/fragrance/${id}/reviews?cursor=${cursor}`,
    {
      next: { tags: [_key] },
      defaultErrorMessage: "리뷰를 찾지 못했습니다.",
    },
  );

  return [{ reviews }, { reviewsCount }] as ReviewPage;
};
