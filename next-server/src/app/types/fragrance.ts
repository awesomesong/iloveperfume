import type { Fragrance, FragranceReview, FragranceSource } from '@prisma/client';
import type { InfiniteData } from '@tanstack/react-query';

export type FragranceType = Fragrance;

/** 등록 경로 — USER: 회원이 직접 등록, AI_AGENT: 신제품 수집 파이프라인 */
export const FRAGRANCE_SOURCES = ['USER', 'AI_AGENT'] as const satisfies readonly FragranceSource[];

export const isFragranceSource = (value: unknown): value is FragranceSource =>
  typeof value === 'string' && (FRAGRANCE_SOURCES as readonly string[]).includes(value);

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
