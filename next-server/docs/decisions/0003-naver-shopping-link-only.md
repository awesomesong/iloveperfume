# ADR-0003: 가격 비교를 내리고 네이버 쇼핑 검색 링크로 전환

- **Status**: Accepted (2026-11-14) — [ADR-0001](0001-naver-only-price-source.md)을 대체
- **Context module**: [src/app/lib/scan/naverShopping.ts](../../src/app/lib/scan/naverShopping.ts), [src/app/components/scan/ShopLinkCard.tsx](../../src/app/components/scan/ShopLinkCard.tsx)
- **관련**: [구현 문서](../../src/app/api/scan/README.md)

## Context

- 네이버 개발자센터 검색 API의 **쇼핑·책·전문자료가 2026-07-31에 종료**됐다 (공지 32564). 기존 키도 유예 없이 차단되어 `shop.json` 호출이 `404 SE05`로 실패했다.
- 대체 창구인 NAVER API HUB에는 쇼핑 검색이 없다. 쇼핑 인사이트는 클릭 추이 통계라 상품·가격이 없다.
- 네이버 쇼핑 페이지 수집은 robots.txt와 약관으로 막혀 있어 선택지가 아니다.
- 그 결과 스캔 결과·향수 상세의 "정품 최저가 비교"는 항상 오류 박스를 보여줬고, "AI가 추천하는 비슷한 향수"는 결과 0건으로 화면에서 사라져 있었다.

## Decision

상품·가격을 받아와 그리는 기능을 내리고, **향수 이름으로 만든 네이버 쇼핑 검색 페이지 링크**로 보낸다.

- 구매처 섹션: `ShopLinkCard` — 링크 카드 1장 (스캔 결과·향수 상세 공용)
- 검색어: 한글 이름(`FragranceKoreanName` 캐시) 우선, 없으면 영문 이름 + "향수"
- 한글 이름 생성: 스캔 분석 시점과 향수 상세 페이지 생성 후(`after`)에 LLM 음역 → DB 저장
- "AI가 추천하는 비슷한 향수" 섹션 삭제. 갤러리 유사 향수 카드에 네이버 쇼핑 링크 추가

삭제: `/api/scan/prices/:scanId`, `/api/fragrance/:id/prices`, `/api/scan/similar/:scanId/naver`, `PriceCards`, `SimilarNaverReco`, `checkNaverAvailability`, `suggestSimilarFragrances`, `naverShopping.ts`의 API 호출·필터·신뢰 점수 로직.

## Consequences

**Good**
- 외부 호출이 없어 구매처 섹션에 로딩·오류 상태가 없다
- 스캔마다 일어나던 유사 향수 추천용 LLM 호출이 사라진다
- 네이버 API 키·한도·약관(검색 결과 가공 금지 등)에 묶이지 않는다

**Trade-off**
- 가격·판매처·정품 배지를 사이트 안에서 보여주지 못한다 — 사용자가 한 번 더 이동해야 한다
- 갤러리에 없는 향수는 유사 향수 추천에 나오지 않는다

**남은 정리**
- `ScanResult.prices`, `ScanResult.naverRecoCache`, `Fragrance.naverCache` 컬럼은 더 이상 쓰지 않는다. 마이그레이션으로 제거 가능
- `globals.css`의 `skeleton-price-bar*` 클래스와 [docs/skeleton-ui.md](../skeleton-ui.md)의 해당 설명은 사용처가 없다

**되돌리는 조건**
- 가격 비교가 다시 필요해지면 11번가 오픈 API(일반 키로 상품 조회 가능)를 우선 검토. 쿠팡 파트너스는 최종 승인(누적 판매 15만 원)과 낮은 호출 한도가 걸림돌
