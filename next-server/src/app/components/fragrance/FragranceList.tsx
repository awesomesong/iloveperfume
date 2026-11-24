'use client';
import { memo, useEffect, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useInView } from "react-intersection-observer";
import { getFragrances } from "@/src/app/lib/getFragrances";
import { fragranceListKeyBySource } from "@/src/app/lib/react-query/fragranceCache";
import { isNewArrival, type FragranceListFilter, type FragranceWithAuthor } from "@/src/app/types/fragrance";
import CircularProgress from "@/src/app/components/CircularProgress";
import FragranceCard from "@/src/app/components/fragrance/FragranceCard";
import { FragranceCardSkeleton } from "@/src/app/components/FragranceSkeleton";
import StatusMessage from "@/src/app/components/StatusMessage";
import TextTabs, { textTabId, type TextTabItem } from "@/src/app/components/TextTabs";

const FILTERS: TextTabItem<FragranceListFilter>[] = [
    { value: "ALL", label: "전체" },
    { value: "AI_AGENT", label: "신제품" },
    { value: "USER", label: "직접 등록" },
];

const EMPTY_MESSAGE: Record<FragranceListFilter, string> = {
    ALL: "아직 등록된 향수가 없습니다.",
    AI_AGENT: "아직 수집된 신제품이 없습니다.",
    USER: "아직 직접 등록된 향수가 없습니다.",
};

const TAB_PREFIX = "fragrance";
const PANEL_ID = "fragrance-tabpanel";

/** 목록 카드 — 처음 등장한 지 얼마 안 된 수집 향수에만 "신제품" 줄을 덧붙인다 */
const FragranceListCard = memo(function FragranceListCard({ fragrance }: { fragrance: FragranceWithAuthor }) {
    return (
        <FragranceCard
            slug={fragrance.slug}
            brand={fragrance.brand}
            name={fragrance.name}
            image={fragrance.images?.[0]}
        >
            {isNewArrival(fragrance) && (
                <p className="meta-line justify-center mt-2">
                    <span>신제품</span>
                </p>
            )}
        </FragranceCard>
    );
});

/**
 * 향수 목록(/fragrance) — 글자형 탭(전체 / 신제품 / 직접 등록) + 카드 그리드 + 무한 스크롤.
 * 구성은 향수 뉴스 목록(Notices)과 같고, 탭 값이 GET /api/fragrance의 source 필터로 이어진다.
 */
const FragranceList = () => {
    const [filter, setFilter] = useState<FragranceListFilter>("ALL");

    const {
        data,
        status,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        error,
    } = useInfiniteQuery({
        queryKey: fragranceListKeyBySource(filter),
        queryFn: getFragrances,
        initialPageParam: '',
        getNextPageParam: (lastPage) => lastPage?.at(-1)?.id ?? undefined,
        staleTime: 2 * 60_000,
        gcTime: 5 * 60_000,
        refetchOnReconnect: true,
        refetchOnWindowFocus: true,
    });

    const { ref, inView } = useInView({ threshold: 0, rootMargin: '100px' });

    useEffect(() => {
        if (inView && hasNextPage && !isFetchingNextPage) fetchNextPage();
    }, [inView, hasNextPage, fetchNextPage, isFetchingNextPage]);

    const fragrances = data?.pages.flat() ?? [];

    return (
        <>
            <TextTabs
                items={FILTERS}
                value={filter}
                onChange={setFilter}
                ariaLabel="향수 분류"
                idPrefix={TAB_PREFIX}
                panelId={PANEL_ID}
            />
            <div role="tabpanel" id={PANEL_ID} aria-labelledby={textTabId(TAB_PREFIX, filter)}>
                {status === 'error' ? (
                    <StatusMessage error={error ?? undefined} />
                ) : status === 'pending' ? (
                    <div className="fragrance-list" aria-hidden>
                        {Array.from({ length: 12 }).map((_, i) => (
                            <FragranceCardSkeleton key={i} />
                        ))}
                    </div>
                ) : fragrances.length === 0 ? (
                    <StatusMessage fallbackMessage={EMPTY_MESSAGE[filter]} />
                ) : (
                    <>
                        <ul className="fragrance-list">
                            {fragrances.map((fragrance) => (
                                <FragranceListCard key={fragrance.id} fragrance={fragrance} />
                            ))}
                        </ul>
                        <div ref={ref} className="min-h-[56px] flex items-start justify-center pt-4">
                            {isFetchingNextPage && (
                                <CircularProgress aria-label="로딩중" />
                            )}
                        </div>
                    </>
                )}
            </div>
        </>
    );
};

export default FragranceList;
