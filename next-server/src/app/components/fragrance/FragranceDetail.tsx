'use client';

import { useQuery, skipToken } from '@tanstack/react-query';

import FragranceMotionWrapper from '@/src/app/components/FragranceMotionWrapper';
import FragranceReviewSection from '@/src/app/components/FragranceReviewSection';
import ShopLinkCard from '@/src/app/components/scan/ShopLinkCard';
import { fragranceDetailKey } from '@/src/app/lib/react-query/fragranceCache';
import type { FragranceWithAuthor } from '@/src/app/types/fragrance';

import FragranceActionBarClient from './FragranceActionBarClient';
import FragranceAuthorMetaClient from './FragranceAuthorMetaClient';
import FragranceHeroClient from './FragranceHeroClient';

type Props = {
  slug: string;
  fragrance: FragranceWithAuthor;
  /** 네이버 쇼핑 검색어용 한글 이름 (서버에서 조회, 없으면 영문 이름 사용) */
  koreanName?: string | null;
};

export default function FragranceDetail({ slug, fragrance: initialFragrance, koreanName }: Props) {
  // 서버(SSG/ISR)에서 내려준 fragrance를 initialData로 두고,
  // FormFragrance가 수정 후 setQueryData(fragranceDetailKey(slug), ...)로 채워둔
  // react-query 캐시가 있으면 그 값을 그대로 읽어 화면에 반영한다.
  // 자체적으로 fetch 하지 않으므로 queryFn 없이 enabled: false 로 캐시 리더 역할만 수행.
  const { data } = useQuery<{ fragrance: FragranceWithAuthor }>({
    queryKey: fragranceDetailKey(slug),
    queryFn: skipToken,
    initialData: { fragrance: initialFragrance },
    staleTime: Infinity,
  });

  const fragrance = data?.fragrance ?? initialFragrance;
  const title = `${fragrance.brand} ${fragrance.name}`.trim();
  // 수정 직후 캐시의 이름이 서버가 내려준 이름과 다르면 한글 이름이 맞지 않으므로 쓰지 않는다
  const shopKoreanName = fragrance.name === initialFragrance.name ? koreanName : null;
  const authorImage =
    fragrance.author?.profileImage ?? fragrance.author?.image ?? null;

  return (
    <div className="fragrance-detail-layout">
      <FragranceActionBarClient
        fragranceId={fragrance.id}
        slug={slug}
        brand={fragrance.brand ?? ''}
        name={fragrance.name ?? ''}
        authorEmail={fragrance.author?.email ?? null}
      />

      {fragrance.images?.length > 0 && (
        <>
          <div className="fragrance-form-layout">
            <div className="fragrance-form-left">
              <FragranceHeroClient images={fragrance.images} alt={title} />
            </div>

            <div className="fragrance-form-right">
              {(fragrance.brand || fragrance.author?.name) && (
                <div className="flex flex-col">
                  {fragrance.brand && (
                    <h2 className="text-top">
                      <span className="text-gradient-ilp">
                        {fragrance.brand} · {fragrance.name}
                      </span>
                    </h2>
                  )}

                  {fragrance.author?.name && (
                    <FragranceAuthorMetaClient
                      authorName={fragrance.author.name}
                      authorImage={authorImage}
                      className="w-auto"
                    />
                  )}
                </div>
              )}

              {fragrance.description && (
                <div
                  className="fragrance-info text-bottom text-[13px] md:text-[14px] leading-[1.8] text-[var(--color-text-secondary)] font-light tracking-wide"
                  dangerouslySetInnerHTML={{ __html: fragrance.description }}
                />
              )}

              {fragrance.notes && (
                <FragranceMotionWrapper delay={0}>
                  <div className="pt-8 border-t border-[var(--color-card-border)]">
                    <h3 className="text-gradient-ilp text-sm font-bold tracking-[0.2em] uppercase text-[var(--color-text-secondary)] mb-4">
                      노트 상세 정보
                    </h3>
                    <div
                      className="text-[13px] md:text-[14px] leading-[1.7] text-[var(--color-text-secondary)] font-light whitespace-pre-wrap"
                      dangerouslySetInnerHTML={{
                        __html: fragrance.notes.replaceAll('\\n', '\n'),
                      }}
                    />
                  </div>
                </FragranceMotionWrapper>
              )}

              {/* 구매처 — 네이버 쇼핑·쿠팡 검색 링크 (스캔 결과와 같은 컴포넌트) */}
              <div className="pt-8 border-t border-[var(--color-card-border)]">
                <ShopLinkCard
                  name={fragrance.name}
                  koreanName={shopKoreanName}
                />
              </div>
            </div>
          </div>
        </>
      )}

      <FragranceReviewSection fragranceName={title} fragranceSlug={slug} />
    </div>
  );
}
