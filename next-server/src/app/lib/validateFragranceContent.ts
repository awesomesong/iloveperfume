import { apiFetch } from "@/src/app/utils/apiFetch";

export async function validateFragranceContent(description: string, notes: string): Promise<boolean> {
    const data = await apiFetch<{ isFragrance: boolean }>('/api/fragrance/validate-content', {
        method: 'POST',
        body: JSON.stringify({ description, notes }),
        defaultErrorMessage: "콘텐츠 검증 중 오류가 발생했습니다.",
    });
    return data.isFragrance === true;
}
