'use client';
import { memo, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import BottlePreview from "./BottlePreview";
import BlendResultCard from "./BlendResultCard";
import BlendShareButton from "./BlendShareButton";
import ScentPyramid from "./ScentPyramid";
import BlendStepActions from "./BlendStepActions";
import { FragranceCardSkeleton } from "@/src/app/components/FragranceSkeleton";
import StatusMessage from "@/src/app/components/StatusMessage";
import { fetchBlendRecommendations } from "@/src/app/lib/blend/fetchBlendRecommendations";
import { BLEND_RECOMMENDATION_LIMIT } from "@/src/app/lib/blend/blendRecommendation";
import { allNoteIds, type LayerNotes } from "@/src/app/lib/blend/scentNotes";

type Props = {
    bottleId: string;
    colorId: string;
    notes: LayerNotes;
    onBack: () => void;
    onRestart: () => void;
    /** 제목 영역 — 부모가 만든 요소를 그대로 받는다 */
    children: ReactNode;
};

/**
 * 결과 — 내가 만든 병과 고른 향, 그리고 비슷한 실제 향수(최대 4개).
 * 같은 향 조합은 react-query가 기억해 두어, 이전으로 갔다 와도 다시 요청하지 않는다.
 */
const BlendResult = ({ bottleId, colorId, notes, onBack, onRestart, children }: Props) => {
    // 비슷한 향수 찾기는 층과 상관없이 고른 향 전체로 한다
    const noteIds = useMemo(() => allNoteIds(notes), [notes]);
    const { data, status, error } = useQuery({
        queryKey: ["blend-recommend", noteIds],
        queryFn: () => fetchBlendRecommendations(noteIds),
        staleTime: 5 * 60_000,
    });

    return (
        <section className="blend-result">
            {children}
            <div className="blend-result__aside">
                <div className="blend-result__summary">
                    <BottlePreview bottleId={bottleId} colorId={colorId} />
                    <div className="blend-result__notes">
                        <ScentPyramid notes={notes} />
                    </div>
                </div>
                <div className="blend-result__actions">
                    <BlendShareButton bottleId={bottleId} colorId={colorId} notes={notes} />
                    <BlendStepActions
                        secondaryLabel="이전"
                        onSecondary={onBack}
                        nextLabel="다시 만들기"
                        nextVariant="ghostLavender"
                        onNext={onRestart}
                    />
                </div>
            </div>
            <div className="blend-result__list">
                {status === "error" ? (
                    <StatusMessage error={error} />
                ) : status === "pending" ? (
                    <div className="fragrance-list" aria-hidden>
                        {Array.from({ length: BLEND_RECOMMENDATION_LIMIT }, (_, index) => (
                            <FragranceCardSkeleton key={index} />
                        ))}
                    </div>
                ) : data.length === 0 ? (
                    <StatusMessage fallbackMessage="비슷한 향수를 찾지 못했어요." />
                ) : (
                    <ul className="fragrance-list">
                        {data.map((recommendation) => (
                            <BlendResultCard key={recommendation.slug} recommendation={recommendation} />
                        ))}
                    </ul>
                )}
            </div>
        </section>
    );
};

export default memo(BlendResult);
