'use client';
import { useEffect, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { getNotices } from '@/src/app/lib/getNotices';
import { noticeListKey } from "@/src/app/lib/react-query/noticeCache";
import { NEWS_CATEGORIES, NEWS_CATEGORY_LABEL } from "@/src/app/lib/news/categories";
import type { NoticeListFilter } from "@/src/app/types/notice";
import { useInView } from "react-intersection-observer";
import NoticeCard from "./NoticeCard";
import NoticeCardSkeleton from "./skeleton/NoticeCardSkeleton";
import CircularProgress from "./CircularProgress";
import StatusMessage from "./StatusMessage";
import TextTabs, { textTabId, type TextTabItem } from "./TextTabs";

const FILTERS: TextTabItem<NoticeListFilter>[] = [
    { value: "ALL", label: "전체" },
    ...NEWS_CATEGORIES.map((category) => ({
        value: category,
        label: NEWS_CATEGORY_LABEL[category],
    })),
];

const TAB_PREFIX = "news";
const PANEL_ID = "news-tabpanel";

const Notices = () => {
    const [filter, setFilter] = useState<NoticeListFilter>("ALL");

    const {
        data,
        status,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        error,
    } = useInfiniteQuery({
        queryKey: noticeListKey(filter),
        queryFn: getNotices,
        initialPageParam: '',
        getNextPageParam: (lastPage) => lastPage?.at(-1)?.id,
        staleTime: 2 * 60_000,
        gcTime: 5 * 60_000,
        refetchOnMount: false,
        refetchOnReconnect: true,
        refetchOnWindowFocus: true,
    });

    const { ref, inView } = useInView({ threshold: 0, rootMargin: '100px' });

    useEffect(() => {
        if (inView && hasNextPage && !isFetchingNextPage) fetchNextPage();
    }, [inView, hasNextPage, fetchNextPage, isFetchingNextPage]);

    const notices = data?.pages.flat() ?? [];

    return (
        <>
            <TextTabs
                items={FILTERS}
                value={filter}
                onChange={setFilter}
                ariaLabel="뉴스 분류"
                idPrefix={TAB_PREFIX}
                panelId={PANEL_ID}
            />
            <div role="tabpanel" id={PANEL_ID} aria-labelledby={textTabId(TAB_PREFIX, filter)}>
                {status === 'error' ? (
                    <StatusMessage error={error ?? undefined} />
                ) : status === 'pending' ? (
                    <NoticeCardSkeleton />
                ) : notices.length === 0 ? (
                    <StatusMessage fallbackMessage="아직 등록된 향수 뉴스가 없습니다." />
                ) : (
                    <>
                        <ul className="news-list">
                            {notices.map((notice) => (
                                <NoticeCard key={notice.id} notice={notice} />
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
}

export default Notices;
