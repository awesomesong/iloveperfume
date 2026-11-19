/** 서버(추천 로직)와 브라우저(결과 화면)가 함께 쓰는 타입·값 — prisma를 불러오지 않는다 */

export type BlendRecommendation = {
    slug: string;
    brand: string;
    name: string;
    image: string | null;
    /** 고른 향 중 이 향수에 들어 있는 향 (고른 순서) */
    matchedNoteIds: string[];
    /** 고른 향의 계열 중 이 향수에도 있는 계열 — 같은 향이 없을 때 이유로 쓴다 */
    matchedFamilyIds: string[];
};

/** 결과로 보여줄 향수 수 — 모바일 2열·데스크톱 4열에 빈칸 없이 맞는다 */
export const BLEND_RECOMMENDATION_LIMIT = 4;
