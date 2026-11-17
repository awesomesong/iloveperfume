'use client';
import { use, useRef, useEffect, useState } from 'react';
import { HiArrowTopRightOnSquare } from 'react-icons/hi2';
import Comments from '@/src/app/components/Comments';
import FormComment from '@/src/app/components/FormComment';
import NoticeStatusActions from '@/src/app/components/NoticeStatusActions';
import NewsCategoryBadge from '@/src/app/components/NewsCategoryBadge';
import getNotice from '@/src/app/lib/getNotice';
import NoticeList from '@/src/app/components/NoticeList';
import dayjs from '@/src/app/utils/day';
import { formatNewsDateTime } from '@/src/app/utils/formatNewsTime';
import { formatNumber } from '@/src/app/utils/formatNumber';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { addNoticeViewCount } from '@/src/app/lib/addNoticeViewCount';
import { upsertNoticeCardById, noticeDetailKey } from '@/src/app/lib/react-query/noticeCache';
import type { NoticeDetailQueryData } from '@/src/app/types/notice';
import { NoticeDetailSkeleton } from '@/src/app/components/skeleton/NoticeDetailSkeleton';
import StatusMessage from '@/src/app/components/StatusMessage';

/** 원문 링크는 http(s)만 허용 (파이프라인에서도 검증하지만 렌더 직전에 한 번 더 확인) */
const isSafeExternalUrl = (url: string | undefined) =>
    !!url && /^https?:\/\//i.test(url);

const NoticeDetailPage = ({ params } : {
    params: Promise<{ id: string }> 
}) => { 
    const { id } = use(params);
    const [ viewCount, setViewCount] = useState(0);
    const [imageFailed, setImageFailed] = useState(false);
    const queryClient = useQueryClient();
    const { data: session } = useSession();
    const viewCountIncrementedRef = useRef(false);
    const isAdmin = session?.user?.role === 'admin';

    const { 
        data, 
        status,
        isSuccess,
    } = useQuery({
        queryKey: noticeDetailKey(id),
        queryFn: () => getNotice(id),
        staleTime: 3 * 60_000,        // ✅ 3분 캐시 유지 (적당한 수준)
        gcTime: 10 * 60_000,          // ✅ 10분 메모리 유지
        refetchOnMount: false,             // ✅ 마운트 시 재요청 안함
        refetchOnWindowFocus: true,        // ✅ 포커스 시 재요청 (사용자 활동 감지)
        refetchOnReconnect: true,         // ✅ 재연결 시 재요청 (네트워크 복구 시)
    });

    const notice = data?.notice;

    const { mutate: addNoticeViewCountMutaion } = useMutation({
        mutationFn: addNoticeViewCount,
        onMutate: async ({ id: noticeId }: { id: string }) => {
            await queryClient.cancelQueries({ queryKey: noticeDetailKey(noticeId), exact: true });

            const prevDetail = queryClient.getQueryData(noticeDetailKey(noticeId));
            const prevViewCount = viewCount || notice?.viewCount || 0;

            const next = prevViewCount + 1;
            setViewCount(next);
            try { upsertNoticeCardById(queryClient, { id: noticeId, viewCount: next }); } catch {}
            try {
                queryClient.setQueryData(noticeDetailKey(noticeId), (old: NoticeDetailQueryData) => {
                    if (!old?.notice) return old;
                    return { ...old, notice: { ...old.notice, viewCount: next } };
                });
            } catch {}

            return { prevDetail, prevViewCount } as const;
        },
        onError: (_err, { id: noticeId }, ctx) => {
            if (!ctx) return;
            if (ctx.prevDetail) queryClient.setQueryData(noticeDetailKey(noticeId), ctx.prevDetail);
            try { upsertNoticeCardById(queryClient, { id: noticeId, viewCount: ctx.prevViewCount }); } catch {}
            setViewCount(ctx.prevViewCount);
        },
    });

    useEffect(() => {
        if (!isSuccess || !notice) return;
        
        // ✅ 초기 렌더에서 서버 값 동기화 (1회만)
        if (notice.viewCount >= 0 && viewCount === 0) {
          setViewCount(notice.viewCount);
        }
        
        // ✅ 이미 증가 시도했으면 스킵
        if (viewCountIncrementedRef.current) return;

        // 공개된 글만 조회수 집계 (내린 글 제외)
        if (notice.status !== 'PUBLISHED') return;
        
        // 하루 1회만 증가 (로컬 스토리지 기준)
        const key = `vc:${id}`;
        const today = dayjs().format('YYYY-MM-DD');
        if (typeof window !== 'undefined') {
          const last = localStorage.getItem(key);
          if (last !== today) {
            viewCountIncrementedRef.current = true;
            addNoticeViewCountMutaion({ id });
            try { localStorage.setItem(key, today); } catch {}
          }
        }
    }, [isSuccess, id, notice, addNoticeViewCountMutaion, viewCount]);

    if (status === 'error') {
        return <StatusMessage fallbackMessage="향수 뉴스를 불러오는 중 오류가 발생했습니다." className="mt-10" />;
    }
    
    return (
        <div className="news-page w-full">
            {status === 'pending'
                ? (
                    <>
                        <NoticeDetailSkeleton />
                        <Comments noticeId={id} user={session?.user ?? undefined} />
                    </>
                )
                : notice 
                    ? (<>
                        <div className="detail-action-bar">
                            <NoticeList />
                            {isAdmin && (
                                <NoticeStatusActions
                                    noticeId={id}
                                    status={notice.status}
                                    noticeTitle={notice.title}
                                />
                            )}
                        </div>
                        {notice.status !== 'PUBLISHED' && (
                            <p role="status" className="notice-detail__notice">
                                내린 글입니다. 관리자에게만 보입니다.
                            </p>
                        )}
                        {notice.image?.[0] && !imageFailed && (
                            <div className="notice-detail__thumb">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={notice.image[0]}
                                    alt=""
                                    loading="lazy"
                                    onError={() => setImageFailed(true)}
                                />
                            </div>
                        )}
                        <p className="news-article__press">{notice.sourceName}</p>
                        <h1 className="notice-detail__title">{notice.title}</h1>
                        <div className="meta-line notice-detail__meta">
                          <NewsCategoryBadge category={notice.category} />
                          <time dateTime={dayjs(notice.publishedAt).toISOString()}>
                            입력 {formatNewsDateTime(notice.publishedAt)}
                          </time>
                          <span>조회 {formatNumber({ count: viewCount, type: "view" })}</span>
                          <span>댓글 {formatNumber({ count: notice._count?.comments ?? 0 })}</span>
                        </div>
                        <article className="notice-article mt-4 min-w-0 break-words text-sm">
                            <p className="notice-detail__summary">{notice.summary}</p>
                            <p className="notice-detail__disclaimer">
                                이 글은 기사 제목과 발췌문을 바탕으로 AI가 요약한 내용입니다. 정확한 내용은 원문에서 확인해 주세요.
                            </p>
                            {isSafeExternalUrl(notice.sourceUrl) && (
                                <a
                                    href={notice.sourceUrl}
                                    target="_blank"
                                    rel="noopener noreferrer nofollow"
                                    className="action-btn mt-4"
                                >
                                    {notice.sourceName} 원문 보기
                                    <HiArrowTopRightOnSquare className="size-3.5 shrink-0" aria-hidden />
                                    <span className="sr-only">(새 창에서 열림)</span>
                                </a>
                            )}
                        </article>
                        {session?.user && <FormComment noticeId={id} user={session.user} />}
                        <Comments noticeId={id} user={session?.user ?? undefined}/>
                    </>) 
                    : 
                    <StatusMessage fallbackMessage="해당 향수 뉴스를 찾을 수 없습니다." minHeight="min-h-screen" />
                }
        </div>
    )
}

export default NoticeDetailPage;
