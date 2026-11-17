'use client';

/**
 * 향수 뉴스 상세 페이지 로딩 스켈레톤.
 * 실제 콘텐츠(news/[id]/page.tsx)와 동일한 클래스 구조 사용.
 * 색상은 FragranceSkeleton과 동일(skeleton-pulse, skeleton-bg, skeleton-bg-muted 등).
 */
export function NoticeDetailSkeleton() {
  return (
    <>
      <div className="detail-action-bar skeleton-pulse">
        <div className="h-8 w-16 rounded-full skeleton-bg-muted" />
      </div>
      {/* 썸네일 — 지금은 대부분 기사에 이미지가 붙어서, 이미지 없는 쪽보다 있는 쪽에 맞춘다 */}
      <div className="notice-detail__thumb skeleton-pulse" aria-hidden>
        <div className="w-full h-80 rounded-xl skeleton-bg-muted" />
      </div>
      <div className="skeleton-pulse mb-2">
        <span className="block h-4 w-20 rounded skeleton-bg-muted" aria-hidden />
      </div>
      <h1 className="notice-detail__title">
        <span className="block h-7 w-3/4 rounded-lg skeleton-bg" aria-hidden />
      </h1>
      <div className="flex flex-wrap items-center gap-2 notice-detail__meta skeleton-pulse">
        <span className="h-3 w-16 rounded-full skeleton-bg-muted" aria-hidden />
        <span className="h-3 w-14 rounded-full skeleton-bg-muted" aria-hidden />
        <span className="h-3 w-12 rounded-full skeleton-bg-muted" aria-hidden />
        <span className="h-3 w-10 rounded-full skeleton-bg-muted" aria-hidden />
      </div>
      <article className="notice-article mt-4 min-w-0 break-words text-sm" aria-hidden>
        <div className="skeleton-pulse space-y-2">
          <div className="h-3 w-full rounded-full skeleton-bg-muted-80" />
          <div className="h-3 w-11/12 rounded-full skeleton-bg-muted-80" />
          <div className="h-3 w-full rounded-full skeleton-bg-muted-80" />
          <div className="h-3 w-2/3 rounded-full skeleton-bg-muted-80" />
        </div>
      </article>
      <div className="my-4 skeleton-pulse" aria-hidden>
        <div className="w-full h-10 border-b skeleton-border skeleton-bg-muted-70 rounded-lg" />
      </div>
    </>
  );
}

export default NoticeDetailSkeleton;
