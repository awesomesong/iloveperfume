import { HiChevronRight } from 'react-icons/hi2';
import { buildCoupangSearchUrl, buildNaverSearchUrl } from '@/src/app/lib/scan/naverShopping';

interface Props {
  /** 향수 이름 (영문 원문) */
  name: string;
  /** 한글 이름 — 있으면 검색어로 우선 사용 */
  koreanName?: string | null;
  /** 수집된 향수의 출처 주소(브랜드 공식 제품 페이지 또는 출시 기사) — 있으면 맨 위에 행을 둔다 */
  officialUrl?: string | null;
  /** 출처 주소가 공식 사이트가 아니라 언론의 출시 기사일 때 true */
  officialUrlIsArticle?: boolean;
}

/** http(s) 주소만 링크로 쓴다 */
function toHttpUrl(value?: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

/**
 * 구매처 목록 — 판매처별 검색 결과로 보내는 링크 목록.
 * 출처 주소(officialUrl)가 있는 향수는 그 링크를 맨 위에 둔다 — 공식 제품 페이지면 "공식 사이트에서 보기",
 * 출시 기사면 "출시 기사 보기"(기사를 공식 사이트라고 적지 않는다).
 * 스캔 결과·향수 상세 공용. 외부 호출이 없어 로딩·오류 상태가 없다.
 * 구분선 대신 옅은 배경 행 + 간격으로 나눈다. 배경: ADR-0003
 *
 * 행 배경은 --color-accent-pale (design-system 4-1 "구매처 행"에 대비 기록):
 *   글자 primary 라이트 14.31:1 / 다크 10.51:1, secondary 라이트 6.31:1 / 다크 5.68:1 — AA 충족.
 *   페이지 배경과의 차이는 1.10~1.19:1로 장식 수준 — 링크 식별은 판매처 이름·화살표 글자가 담당.
 *
 * 올리브영은 백화점 브랜드(샤넬 등)를 팔지 않아 검색 결과가 비는 경우가 많아 넣지 않았다.
 */
export default function ShopLinkCard({ name, koreanName, officialUrl, officialUrlIsArticle = false }: Props) {
  const officialHref = toHttpUrl(officialUrl);
  const officialLabel = officialUrlIsArticle ? '출시 기사 보기' : '공식 사이트에서 보기';
  const shops = [
    ...(officialHref ? [{ label: officialLabel, action: '바로가기', href: officialHref }] : []),
    { label: '네이버 쇼핑', action: '가격 비교', href: buildNaverSearchUrl(name, koreanName) },
    { label: '쿠팡', action: '검색', href: buildCoupangSearchUrl(name, koreanName) },
  ];

  return (
    <section aria-labelledby="shop-links-title">
      <h3 id="shop-links-title" className="text-[15px] font-semibold text-fg-primary mb-3">
        구매처
      </h3>

      <ul className="flex flex-col gap-1.5">
        {shops.map((shop) => (
          <li key={shop.label}>
            <a
              href={shop.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center justify-between gap-3 min-h-12 px-4 py-3 rounded-[10px] bg-[var(--color-accent-pale)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
            >
              <span className="text-[15px] text-fg-primary group-hover:underline underline-offset-4">
                {shop.label}
                <span className="sr-only"> {shop.action} (새 창에서 열림)</span>
              </span>
              <span className="flex items-center gap-0.5 text-[13px] text-fg-secondary" aria-hidden>
                {shop.action}
                <HiChevronRight className="size-3.5" />
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
