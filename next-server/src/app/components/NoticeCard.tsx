"use client";
import Link from "next/link";
import { memo, useState } from "react";
import { Notice } from "@/src/app/types/notice";
import { NEWS_CATEGORY_LABEL } from "@/src/app/lib/news/categories";
import dayjs from "@/src/app/utils/day";
import { formatNewsTime } from "@/src/app/utils/formatNewsTime";
import { formatNumber } from "@/src/app/utils/formatNumber";

/**
 * 향수 뉴스 목록의 한 항목 — 썸네일(있으면) + (분류·매체 → 제목 → 요약 → 시간·조회·댓글).
 * 구분선·그림자 없이 글자 위계와 여백만 쓴다. Notices의 <ul class="news-list"> 안에서 쓴다.
 * 썸네일은 next/image가 아니라 평범한 <img>를 쓴다 — 매체 도메인이 매번 달라 next.config.js의
 * remotePatterns 화이트리스트에 없고, 원문 이미지를 그대로 핫링크하므로 로드 실패를 정상 케이스로 다룬다.
 */
const NoticeCard = ({ notice }: { notice: Notice }) => {
  const commentCount = notice._count.comments;
  const thumbnail = notice.image?.[0];
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <li className="news-item">
      <Link href={`/news/${notice.id}`} className="news-item__link">
        {thumbnail && !imageFailed && (
          <div className="news-item__thumb">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={thumbnail}
              alt=""
              loading="lazy"
              onError={() => setImageFailed(true)}
            />
          </div>
        )}
        <div className="news-item__body">
          <p className="meta-line">
            <span>{NEWS_CATEGORY_LABEL[notice.category] ?? notice.category}</span>
            <span>{notice.sourceName}</span>
          </p>
          <h3 className="news-item__title line-clamp-2">{notice.title}</h3>
          <p className="news-item__summary line-clamp-3">{notice.summary}</p>
          <p className="meta-line">
            <time dateTime={dayjs(notice.publishedAt).toISOString()}>
              {formatNewsTime(notice.publishedAt)}
            </time>
            <span>조회 {formatNumber({ count: notice.viewCount, type: "view" })}</span>
            {commentCount > 0 && (
              <span>댓글 {formatNumber({ count: commentCount })}</span>
            )}
          </p>
        </div>
      </Link>
    </li>
  );
};

// 목록 캐시는 react-query가 바뀌지 않은 항목의 객체 참조를 유지하므로 기본 비교로 충분하다
export default memo(NoticeCard);
