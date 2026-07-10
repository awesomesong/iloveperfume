import { apiFetch } from "@/src/app/utils/apiFetch";

export type DeleteFragranceResponse = {
  success: boolean;
  message?: string;
};

export const deleteFragrance = async (id: string): Promise<DeleteFragranceResponse> => {
  await apiFetch(`/api/fragrance/${id}`, {
    method: 'DELETE',
    errorMessagesByStatus: { 403: "해당 향수를 삭제할 권한이 없습니다." },
    defaultErrorMessage: "향수 삭제 중 오류가 발생했습니다.",
  });

  return {
    success: true,
    message: "향수가 삭제되었습니다.",
  };
};
