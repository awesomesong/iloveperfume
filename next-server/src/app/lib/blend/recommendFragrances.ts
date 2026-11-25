import prisma from "@/prisma/db";
import { FAMILY_ID_BY_NOTE_ID, findScentNoteIds } from "./findScentNotes";
import { BLEND_RECOMMENDATION_LIMIT, type BlendRecommendation } from "./blendRecommendation";

/**
 * 고른 향으로 DB 향수를 고른다.
 * 순위: 겹치는 향 수 → 겹치는 계열 수 → 향수 노트 중 고른 향의 비율(군더더기가 적은 향수 우선).
 * 겹치는 향도 계열도 없는 향수는 뺀다.
 */
export async function recommendFragrances(noteIds: readonly string[]): Promise<BlendRecommendation[]> {
    const selectedFamilies = [...new Set(noteIds.map((id) => FAMILY_ID_BY_NOTE_ID.get(id)).filter(Boolean))] as string[];

    const fragrances = await prisma.fragrance.findMany({
        where: { notes: { not: null } },
        select: { slug: true, brand: true, name: true, images: true, notes: true },
    });

    return fragrances
        .map((fragrance) => {
            const found = findScentNoteIds(fragrance.notes ?? "");
            const foundFamilies = new Set([...found].map((id) => FAMILY_ID_BY_NOTE_ID.get(id)));
            const matchedNoteIds = noteIds.filter((id) => found.has(id));
            const matchedFamilyIds = selectedFamilies.filter((id) => foundFamilies.has(id));
            return {
                recommendation: {
                    slug: fragrance.slug,
                    brand: fragrance.brand,
                    name: fragrance.name,
                    image: fragrance.images[0] ?? null,
                    matchedNoteIds,
                    matchedFamilyIds,
                },
                focus: found.size > 0 ? matchedNoteIds.length / found.size : 0,
            };
        })
        .filter(({ recommendation }) => recommendation.matchedFamilyIds.length > 0)
        .sort(
            (a, b) =>
                b.recommendation.matchedNoteIds.length - a.recommendation.matchedNoteIds.length ||
                b.recommendation.matchedFamilyIds.length - a.recommendation.matchedFamilyIds.length ||
                b.focus - a.focus,
        )
        .slice(0, BLEND_RECOMMENDATION_LIMIT)
        .map(({ recommendation }) => recommendation);
}
