import { apiFetch } from "@/src/app/utils/apiFetch";

export interface FragranceAnalysis {
    isFragrance: boolean;
    brand: string;
    name: string;
    slug: string;
    description: string;
    notes: string;
}

export async function analyzeFragranceImage(imageUrl: string): Promise<FragranceAnalysis> {
    const { result } = await apiFetch<{ result: FragranceAnalysis }>('/api/fragrance/analyze', {
        method: 'POST',
        body: JSON.stringify({ imageUrl }),
        defaultErrorMessage: "AI 분석 중 오류가 발생했습니다.",
    });
    return result;
}
