import { FragranceType } from "@/src/app/types/fragrance";
import { apiFetch } from "@/src/app/utils/apiFetch";

export const getFragrance = async (idOrSlug: string): Promise<{ fragrance: FragranceType }> => {
    return apiFetch(`/api/fragrance/${idOrSlug}`, {
        defaultErrorMessage: "향수 정보를 가져오는데 실패했습니다.",
    });
};
