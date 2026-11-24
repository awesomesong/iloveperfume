import type { Fragrance, FragranceReview, FragranceSource } from '@prisma/client';
import type { InfiniteData } from '@tanstack/react-query';

export type FragranceType = Fragrance;

/** 등록 경로 — USER: 회원이 직접 등록, AI_AGENT: 신제품 수집 파이프라인 */
export const FRAGRANCE_SOURCES = ['USER', 'AI_AGENT'] as const satisfies readonly FragranceSource[];

export const isFragranceSource = (value: unknown): value is FragranceSource =>
  typeof value === 'string' && (FRAGRANCE_SOURCES as readonly string[]).includes(value);

/** 공식 사이트에 처음 등장한 뒤 이 기간까지 "신제품"으로 본다 — 수집 파이프라인·목록 탭·카드 표시가 함께 쓴다 */
export const NEW_ARRIVAL_DAYS = 60;

export const newArrivalSince = (now: number = Date.now()) => new Date(now - NEW_ARRIVAL_DAYS * 24 * 60 * 60 * 1000);

/** 신제품인지 — 기존 향수 채우기로 들어온 예전 향수와 사용자 등록 향수는 아니다 */
export const isNewArrival = (fragrance: { firstSeenAt?: Date | string | null }, now?: number) =>
  !!fragrance.firstSeenAt && new Date(fragrance.firstSeenAt) >= newArrivalSince(now);

/** /fragrance 목록 탭 — "ALL"은 출처 구분 없이 전체 */
export type FragranceListFilter = 'ALL' | FragranceSource;

export type FragranceAuthor = {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  profileImage?: string | null;
  role?: string | null;
};

export type FragranceWithAuthor = Fragrance & {
  author?: FragranceAuthor | null;
};

export type CreateFragranceRequest = {
  brand: string;
  name: string;
  images: string[];
  description: string;
  notes: string;
};

export type UpdateFragranceRequest = Partial<CreateFragranceRequest>;

export type CreateFragranceResponse = {
  success: boolean;
  newFragrance?: FragranceWithAuthor;
  message?: string;
};

export type UpdateFragranceResponse = {
  success: boolean;
  updatedFragrance?: FragranceWithAuthor;
  message?: string;
};

export type FragranceReviewType = FragranceReview & {
  author: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    profileImage?: string | null;
    role?: string | null;
  };
};

export type FragranceReviewPage = [
  { reviews: FragranceReviewType[] },
  { reviewsCount: number },
];

export type FragranceReviewsDataProps = InfiniteData<FragranceReviewPage>;

export type FragranceReviewPayload = {
  fragranceSlug: string;
  review: FragranceReviewType;
};

export type FragranceReviewDeletedPayload = {
  fragranceSlug: string;
  reviewId: string;
};
