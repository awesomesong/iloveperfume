'use client';

import { useEffect, useState } from 'react';
import { HiOutlineArrowRight } from 'react-icons/hi2';

type TrustBadge = 'verified_catalog' | 'department' | 'official' | 'beauty_store';
type NaverProductType = '1' | '2' | '3' | '4';

interface PriceItem {
  mall: string;
  price: number;
  url: string;
  title: string;
  size: string | null;
  pricePerMl?: number | null;
  trustScore?: number;
  badges?: TrustBadge[];
  productId?: string;
  productType?: NaverProductType;
}

interface Props {
  scanId: string;
}

interface ApiResponse {
  items?: PriceItem[];
  /** 네이버 쇼핑 자체 검색 페이지 URL (모든 브랜드 공통) */
  naverSearchUrl?: string;
  error?: string;
  query?: string;
  cachedAt?: string;
  fresh?: boolean;
}

/*
  신뢰 배지 — i-love-perfume 갤러리 무드 통일 + 가시성 확보.
  위계:
    - "최저가" (별도, 그라데이션) — 페이지 hero
    - "정품 매칭" — accent outline (주요 신뢰 신호, hero와 분리되면서도 또렷)
    - 나머지(백화점/공식몰/뷰티) — stone 단색 한 단계 진하게 (카드 배경에서 분명히 분리)
  '필수' 클래스로 적용되는 outline border 위해 verified_catalog는 별도 border 클래스 포함.
*/
const BADGE_META: Record<
  TrustBadge,
  { label: string; bg: string; text: string }
> = {
  /*
    배지 디자인 — 솔리드 라벤더 박스로 "한눈에 띄는 배지" 형태.
    다크모드 명도 반전 위계:
      - 정품 매칭: bg-accent (밝은 라벤더 #d4b8b0) + 어두운 글자 → 가장 두드러짐
      - 보조: bg-accent-pale (다크값 #2a1e1c 어두운 라벤더) + 밝은 라벤더 글자
      두 배지가 명도가 완전히 반대라 한눈에 시각적 분리.
    라이트모드:
      - 정품 매칭: accent-pale 솔리드 + 진한 보라 글자
      - 보조: accent-pale 60% (살짝 옅게) + 진한 보라 글자
  */
  /*
    배지 위계 — 구조 자체를 다르게 (filled vs outline)로 한눈에 분리.
    - 정품 매칭: filled accent (색감 있는 칠해진 박스) — 강조
    - 보조: outline ivory (차분한 outline 박스) — 보조
    웹접근성: 모두 WCAG AAA(7:1) 이상.
  */
  verified_catalog: {
    label: '정품 매칭',
    // 라이트: 옅은 라벤더 filled (보조 outline과 구조 차이로 분리)
    // 다크: 솔리드 밝은 라벤더 + 어두운 글자 — 명도 반전으로 보조(어두운 outline)와 한눈에 분리
    bg: 'bg-accent-pale dark:bg-accent',
    text: 'text-fg-primary dark:text-stone-900',
  },
  department: {
    label: '백화점·면세점',
    bg: 'bg-ivory dark:bg-[var(--color-ivory-soft)] border border-accent-border',
    text: 'text-fg-secondary',
  },
  official: {
    label: '공식몰',
    bg: 'bg-ivory dark:bg-[var(--color-ivory-soft)] border border-accent-border',
    text: 'text-fg-secondary',
  },
  beauty_store: {
    label: '뷰티 전문',
    bg: 'bg-ivory dark:bg-[var(--color-ivory-soft)] border border-accent-border',
    text: 'text-fg-secondary',
  },
};

/**
 * productType='2'(가격비교 카탈로그 상품)일 때만 "정품 매칭" 배지. productId만으로
 * 판단하면 일반 mall 상품(productType=1)에도 잘못 붙어서, 클릭 시 catalog 404 발생.
 */
function getDisplayBadges(item: PriceItem): TrustBadge[] {
  const result: TrustBadge[] = [];
  if (item.productType === '2') {
    result.push('verified_catalog');
  }
  if (item.badges) {
    for (const b of item.badges) {
      if (!result.includes(b)) result.push(b);
    }
  }
  return result;
}

export default function PriceCards({ scanId }: Props) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<PriceItem[]>([]);
  const [naverSearchUrl, setNaverSearchUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/scan/prices/${scanId}`);
        const data = (await res.json()) as ApiResponse;
        if (cancelled) return;
        if (data.items) {
          const SMALL_OZ_RE = /(?:^|[^\d])0\.\d{1,2}\s*(?:fl\.?\s*)?oz\b/i;
          const MIN_TRUSTED_SCORE = 20;
          setItems(
            data.items
              .filter((item) => !SMALL_OZ_RE.test(item.title))
              .sort((a, b) => {
                const aTier = (a.trustScore ?? 0) >= MIN_TRUSTED_SCORE ? 0 : 1;
                const bTier = (b.trustScore ?? 0) >= MIN_TRUSTED_SCORE ? 0 : 1;
                if (aTier !== bTier) return aTier - bTier;
                return a.price - b.price;
              }),
          );
        }
        if (data.naverSearchUrl) setNaverSearchUrl(data.naverSearchUrl);
        if (data.error) setError(data.error);
      } catch {
        if (!cancelled) setError('가격 조회 중 네트워크 오류가 발생했어요');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scanId]);

  if (loading) {
    return (
      <section className="flex flex-col gap-4 animate-pulse">
        {/* 헤더 */}
        <div className="flex items-baseline justify-between flex-wrap gap-2">
          <div className="h-3.5 w-28 rounded-full skeleton-price-bar" />
          <div className="h-3 w-24 rounded-full skeleton-price-bar-muted" />
        </div>

        {/* 설명 텍스트 */}
        <div className="flex flex-col gap-1.5">
          <div className="h-3 w-full rounded-full skeleton-price-bar-muted" />
          <div className="h-3 w-4/5 rounded-full skeleton-price-bar-muted" />
        </div>

        {/* 네이버 쇼핑 링크 카드 */}
        <div className="flex items-center justify-between gap-2 p-3 rounded-2xl border border-accent-border bg-ivory dark:bg-[var(--color-ivory-soft)]">
          <div className="flex flex-col gap-1.5 flex-1">
            <div className="h-3.5 w-40 rounded-full skeleton-price-bar" />
            <div className="h-3 w-52 rounded-full skeleton-price-bar-muted" />
          </div>
          <div className="size-4 rounded-full skeleton-price-bar-muted shrink-0" />
        </div>

        {/* 가격 카드 3개 */}
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex flex-col gap-2 p-3 rounded-2xl border border-accent-border bg-ivory dark:bg-[var(--color-ivory-soft)]"
            >
              {/* 배지 행 — 첫 번째 카드만 */}
              {i === 0 && (
                <div className="flex gap-1.5">
                  <div className="h-5 w-12 rounded-full skeleton-price-bar" />
                  <div className="h-5 w-16 rounded-full skeleton-price-bar-muted" />
                </div>
              )}
              <div className="flex items-center gap-3">
                <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                  <div className="h-3.5 w-4/5 rounded-full skeleton-price-bar" />
                  <div className="h-3 w-2/5 rounded-full skeleton-price-bar-muted" />
                </div>
                <div className="h-4 w-16 rounded-full skeleton-price-bar shrink-0" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl p-5 border border-accent-border bg-ivory dark:bg-[var(--color-ivory-soft)] text-center">
        <p className="text-sm text-fg-secondary mb-1">
          {error ?? '가격 정보를 찾지 못했어요.'}
        </p>
        {naverSearchUrl && (
          <a
            href={naverSearchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-accent hover:underline inline-flex items-center gap-1"
          >
            네이버 쇼핑에서 검색하기
            <HiOutlineArrowRight className="size-3" aria-hidden />
          </a>
        )}
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <h3 className="text-sm font-bold tracking-[0.2em] uppercase text-[var(--color-text-secondary)]">
          정품 최저가 비교
        </h3>
        <p className="text-xs text-fg-secondary">
          최저가순 · 네이버 쇼핑
        </p>
      </div>

      {/* 안내 문구 — 데이터 신뢰감 유지 + 가격 변동성을 시장 특성으로 프레임 */}
      <p className="text-[13px] text-fg-secondary leading-[1.7] font-light tracking-wide">
        네이버 쇼핑 기준 최신 가격 정보예요. 가격은 실시간으로 변동될 수 있으니 구매 전 판매처에서 한 번 더 확인해 주세요.
      </p>

      {/* 네이버 쇼핑 우회 링크 — 갤러리 무드 톤(stone + accent 포인트)으로 통일 */}
      {naverSearchUrl && (
        <a
          href={naverSearchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between gap-2 p-3 rounded-2xl border border-accent-border bg-ivory dark:bg-[var(--color-ivory-soft)] hover:border-accent dark:hover:border-accent hover:bg-accent-pale/40 dark:hover:bg-[var(--color-accent-pale)] transition-colors"
        >
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold text-fg-primary flex items-center gap-1.5">
              <span
                className="inline-block w-2 h-2 rounded-full bg-accent"
                aria-hidden
              />
              네이버 쇼핑에서 직접 검색하기
            </span>
            <span className="text-xs text-fg-secondary mt-0.5">
              공식 스토어를 직접 확인하고 싶을 때 이용해 주세요
            </span>
          </div>
          <HiOutlineArrowRight
            className="size-4 text-fg-secondary shrink-0"
            aria-hidden
          />
        </a>
      )}

      <div className="flex flex-col gap-2">
        {items.map((item, idx) => {
          const displayBadges = getDisplayBadges(item);
          return (
            <a
              key={`${item.mall}-${idx}`}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              /*
                다크모드에서 --color-card-bg(#f5edf0 밝은 라벤더) + --color-text-primary(밝은 라벤더)는
                "밝은 배경 + 밝은 글자"라 안 보임. stone 톤으로 명시적 색상 적용.
              */
              className="flex flex-col gap-2 p-3 rounded-2xl border border-accent-border bg-ivory dark:bg-[var(--color-ivory-soft)] hover:border-accent dark:hover:border-accent hover:bg-accent-pale/40 dark:hover:bg-[var(--color-accent-pale)] transition-colors"
            >
              {(idx === 0 || displayBadges.length > 0) && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {idx === 0 && (
                    /*
                      inline-flex items-center로 배지 안 글자 세로 가운데 정렬.
                      다크모드의 bg-gradient-ilp는 밝은 파스텔(#fff5f8/#f0e8e4/#ffe8b4)이라
                      text-white면 글자가 묻힘 — 다크에선 어두운 글자로 대비 확보.
                    */
                    <span className="inline-flex items-center bg-gradient-ilp text-white dark:text-[var(--color-text-primary)] text-xs font-medium tracking-[0.04em] leading-none px-3 py-1.5 rounded-full">
                      최저가
                    </span>
                  )}
                  {displayBadges.map((b) => {
                    const meta = BADGE_META[b];
                    return (
                      <span
                        key={b}
                        className={`inline-flex items-center ${meta.bg} ${meta.text} text-xs font-medium tracking-[0.04em] leading-none px-3 py-1.5 rounded-full`}
                      >
                        {meta.label}
                      </span>
                    );
                  })}
                </div>
              )}

              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-tight truncate text-fg-primary">
                    {item.title}
                  </p>
                  <p className="text-xs text-fg-secondary mt-0.5 flex items-center flex-wrap gap-1">
                    <span className="truncate">{item.mall}</span>
                    {item.size && (
                      <span className="px-2 py-0.5 rounded bg-accent-pale/40 dark:bg-accent/15 text-fg-secondary text-xs">
                        {item.size}
                      </span>
                    )}
                    {item.pricePerMl != null && (
                      <span className="text-fg-secondary text-xs">
                        ₩{item.pricePerMl.toLocaleString()}/ml
                      </span>
                    )}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-base font-bold text-fg-primary">
                    ₩{item.price.toLocaleString()}
                  </p>
                </div>
              </div>
            </a>
          );
        })}
      </div>

    </section>
  );
}
