import type { BlendRecommendation } from "./blendRecommendation";

const FAILED_MESSAGE = "추천 향수를 가져오지 못했어요.";

/** 고른 향으로 비슷한 실제 향수를 가져온다 (POST /api/blend/recommend) */
export async function fetchBlendRecommendations(noteIds: readonly string[]): Promise<BlendRecommendation[]> {
    // 연결이 끊기면 fetch가 영문 메시지("Failed to fetch")로 실패한다 — 화면에는 한국어 문구를 보여준다
    const response = await fetch("/api/blend/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteIds }),
    }).catch(() => {
        throw new Error(`${FAILED_MESSAGE} 인터넷 연결을 확인해 주세요.`);
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !Array.isArray(data?.fragrances)) {
        throw new Error(data?.message ?? FAILED_MESSAGE);
    }
    return data.fragrances;
}
