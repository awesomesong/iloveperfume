/**
 * 향수 뉴스 목록 스켈레톤 — NoticeCard와 같은 구조·클래스(news-list / news-item / news-item__thumb /
 * news-item__body)를 써서 레이아웃을 한 벌의 CSS로 관리한다. 색은 FragranceSkeleton과 동일(skeleton-bg / skeleton-bg-muted).
 * 썸네일 영역도 항상 그려준다 — 지금은 대부분 기사에 이미지가 붙어서, 이미지 없는 항목보다 있는 쪽에 맞추는 게 자연스럽다.
 */
const NoticeCardSkeleton = () => (
  <ul className="news-list" aria-hidden>
    {Array.from({ length: 5 }).map((_, i) => (
      <li key={i} className="news-item skeleton-pulse">
        <div className="news-item__link">
          <div className="news-item__thumb skeleton-bg-muted" />
          <div className="news-item__body">
            <span className="block h-3 w-28 rounded skeleton-bg-muted" />
            <span className="block h-6 w-3/4 rounded skeleton-bg" />
            <span className="block h-4 w-full rounded skeleton-bg-muted" />
            <span className="block h-4 w-5/6 rounded skeleton-bg-muted" />
            <span className="block h-4 w-1/2 rounded skeleton-bg-muted" />
            <span className="block h-3 w-24 rounded skeleton-bg-muted" />
          </div>
        </div>
      </li>
    ))}
  </ul>
);

export default NoticeCardSkeleton;
