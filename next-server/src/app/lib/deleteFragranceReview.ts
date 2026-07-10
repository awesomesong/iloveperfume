import { apiFetch } from "@/src/app/utils/apiFetch";
import { DeleteReviewResponse } from "@/src/app/types/reviews";

export const deleteFragranceReview = async (id: string) => {
  return apiFetch<DeleteReviewResponse>(`/api/fragrance/reviews/${id}`, {
    method: "DELETE",
    defaultErrorMessage: "리뷰 삭제에 실패했습니다.",
  });
};
