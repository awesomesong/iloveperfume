// 향수 뉴스 카테고리 — 클라이언트/서버 공용 (서버 전용 모듈 import 금지)

export const NEWS_CATEGORIES = ["RELEASE", "BRAND", "TREND", "INTERVIEW"] as const;
export type NewsCategory = (typeof NEWS_CATEGORIES)[number];

export const NOTICE_STATUSES = ["PUBLISHED", "HIDDEN"] as const;
export type NoticeStatus = (typeof NOTICE_STATUSES)[number];

export const NEWS_CATEGORY_LABEL: Record<NewsCategory, string> = {
  RELEASE: "신제품",
  BRAND: "브랜드",
  TREND: "트렌드",
  INTERVIEW: "인터뷰",
};

export const isNewsCategory = (value: unknown): value is NewsCategory =>
  typeof value === "string" && (NEWS_CATEGORIES as readonly string[]).includes(value);

export const isNoticeStatus = (value: unknown): value is NoticeStatus =>
  typeof value === "string" && (NOTICE_STATUSES as readonly string[]).includes(value);
