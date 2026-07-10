import { apiFetch } from "@/src/app/utils/apiFetch";
import { UpdateFragranceRequest, UpdateFragranceResponse } from "@/src/app/types/fragrance";

export const updateFragrance = async (id: string, data: UpdateFragranceRequest): Promise<UpdateFragranceResponse> => {
    const responseData = await apiFetch<{ updatedFragrance: UpdateFragranceResponse["updatedFragrance"] }>(`/api/fragrance/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
        defaultErrorMessage: "향수 수정 중 오류가 발생했습니다.",
    });

    return {
        success: true,
        updatedFragrance: responseData.updatedFragrance,
        message: "향수 정보가 수정되었습니다.",
    };
};
