import type { BlendRecommendation } from "./blendRecommendation";

/** 고른 향으로 비슷한 실제 향수를 가져온다 (POST /api/blend/recommend) */
export async function fetchBlendRecommendations(noteIds: readonly string[]): Promise<BlendRecommendation[]> {
    const response = await fetch("/api/blend/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteIds }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
        throw new Error(data?.message ?? "추천 향수를 가져오지 못했어요.");
    }
    return data.fragrances;
}
