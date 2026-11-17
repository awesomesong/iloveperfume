import type { CommentType } from "@/src/app/types/comments";
import type { NewsCategory, NoticeStatus } from "@/src/app/lib/news/categories";

// 댓글 작성자 (comments.ts, FormComment에서 사용)
export type Author = {
  name: string;
  email: string;
  image: string;
  id?: string;
  role?: string;
};

// 향수 뉴스 목록 카드
export interface Notice {
  id: string;
  title: string;
  summary: string;
  category: NewsCategory;
  status: NoticeStatus;
  sourceName: string;
  publishedAt: Date | string;
  image: string[];
  _count: {
    comments: number;
  };
  viewCount: number;
}

// 향수 뉴스 상세 (noticeDetailKey 쿼리 데이터)
export interface NoticeDetailData extends Notice {
  sourceUrl: string;
  createdAt: Date | string;
}

export type NoticeDetailQueryData =
  | {
      notice: NoticeDetailData | null;
    }
  | undefined;

/** 목록 필터: 전체 / 카테고리별 */
export type NoticeListFilter = "ALL" | NewsCategory;

export type NoticeIdProps = {
  noticeId: string;
};

// ===== Socket payload types for notice events =====
export type NoticeCommentNewPayload = {
  noticeId: string;
  senderId?: string;
  comment?: CommentType;
};
export type NoticeDeletedPayload = { noticeId: string };
