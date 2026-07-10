import { apiFetch } from "@/src/app/utils/apiFetch";
import { UpdateReviewResponse } from "@/src/app/types/reviews";

interface Props {
  id: string;
  text: string;
}

export const updateFragranceReview = async ({ id, text }: Props) => {
  return apiFetch<UpdateReviewResponse>(`/api/fragrance/reviews/${id}`, {
    method: "PUT",
    body: JSON.stringify({ text }),
    defaultErrorMessage: "리뷰 수정에 실패했습니다.",
  });
};
