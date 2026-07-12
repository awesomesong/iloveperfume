import { apiFetch } from "@/src/app/utils/apiFetch";
import { CreateFragranceRequest, CreateFragranceResponse } from "@/src/app/types/fragrance";

export const createFragrance = async (data: CreateFragranceRequest): Promise<CreateFragranceResponse> => {
    const responseData = await apiFetch<{ newFragrance: CreateFragranceResponse["newFragrance"] }>('/api/fragrance', {
        method: 'POST',
        body: JSON.stringify(data),
        defaultErrorMessage: "향수 등록 중 오류가 발생했습니다.",
    });

    return {
        success: true,
        newFragrance: responseData.newFragrance,
        message: "향수가 등록되었습니다.",
    };
};
