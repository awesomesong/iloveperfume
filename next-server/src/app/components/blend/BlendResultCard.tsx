import { memo } from "react";
import FragranceCard from "@/src/app/components/fragrance/FragranceCard";
import type { BlendRecommendation } from "@/src/app/lib/blend/blendRecommendation";
import { scentFamilyName, scentNoteName } from "@/src/app/lib/blend/scentNotes";

/**
 * 추천 향수 카드 — 목록 카드에 왜 골랐는지 한 줄을 더한다.
 * 겹친 향이 있으면 그 향 이름, 없으면 같은 계열 이름("스위트 계열").
 */
const BlendResultCard = ({ recommendation }: { recommendation: BlendRecommendation }) => {
    const { slug, brand, name, image, matchedNoteIds, matchedFamilyIds } = recommendation;
    const reasons =
        matchedNoteIds.length > 0
            ? matchedNoteIds.map(scentNoteName)
            : matchedFamilyIds.map((id) => `${scentFamilyName(id)} 계열`);

    return (
        <FragranceCard slug={slug} brand={brand} name={name} image={image}>
            {/* 가운뎃점 구분은 좁은 칸에서 "· 샌달우드"처럼 줄 앞에 걸려, 쉼표로 이어 어절 단위로 줄을 바꾼다 */}
            <p className="blend-result-card__reason">{reasons.join(", ")}</p>
        </FragranceCard>
    );
};

export default memo(BlendResultCard);
