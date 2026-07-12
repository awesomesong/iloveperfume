import { apiFetch } from "@/src/app/utils/apiFetch";
import { CreateReviewResponse } from "@/src/app/types/reviews";

interface Props {
  id: string;
  text: string;
}

export const createFragranceReviews = async ({ id, text }: Props) => {
  return apiFetch<CreateReviewResponse>(`/api/fragrance/${id}/reviews`, {
    method: "POST",
    body: JSON.stringify({ text }),
    defaultErrorMessage: "리뷰 등록에 실패했습니다.",
  });
};
