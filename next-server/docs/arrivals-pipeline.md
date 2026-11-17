# 향수 신제품 수집 파이프라인

브랜드 공식 사이트에 새로 올라온 향수를 스케줄러가 수집해 `Fragrance`에 등록한다(`source = AI_AGENT`).
사용자가 직접 등록하는 흐름(`/fragrance/create`, `source = USER`)과 같은 테이블을 쓰고, 수집분은 `/api/cron/perfume-arrivals`만 생성한다.

## 흐름

```
Vercel Cron (vercel.json, 매일 01:00 UTC = 10:00 KST)
  └─ GET /api/cron/perfume-arrivals       Authorization: Bearer CRON_SECRET
       1. collectArrivals     브랜드 공식 사이트의 제품 피드(/products.json) — ARRIVAL_SOURCES에 등록된 브랜드만
       2. filterByRules       향수 유형 · 제외 단어/태그 · 묶음 구성 · 용량만 다른 중복 합치기 · 처음 등장한 날이 60일 이내 · 이미지 출처 · 소개문 길이
       3. excludeExisting     이미 있는 공식 URL · 다시 수집하지 않기로 한 URL(FragranceBlockedUrl) · 같은 브랜드+이름 제외
       4. describeArrivals    OpenAI 1회 호출 — 향수 단품 판정 + 한국어 소개·노트(JSON)
       5. validateDescriptions id 대조 · 향수 판정 · 확신도 · 이름이 피드 제목에 있는지 · 설명 길이/한국어 · 최대 10건
       6. saveAsFragrances    Fragrance 저장 — 바로 공개 (officialUrl unique → 중복 실행에도 안전)
```

실행 순서는 코드가 정하고 LLM은 4번에서만 판단한다(에이전트 루프가 아닌 고정 파이프라인).
브랜드명·공식 URL·이미지·날짜는 피드에서 코드가 가져오므로 LLM이 틀리게 만들 수 없다.
LLM이 쓰는 것은 이름 표기(피드 제목과 대조), 소개문, 노트뿐이다.

## 검증에 실패한 제품

사람 검수 단계는 없다. 2·5번을 통과하지 못한 제품은 저장하지 않고 버린다(검토 대기 상태도 없다).
버린 제품은 DB에 남지 않으므로, 피드에 있는 동안 다음 실행에서 다시 평가된다.
단계별 탈락 수와 5번의 탈락 사유는 실행마다 `[arrivals] pipeline run` 로그에 남는다.

잘못 올라온 향수는 관리자가 삭제한다. 삭제된 수집분의 `officialUrl`이 `FragranceBlockedUrl`에 기록되어 있으면 3번에서 걸러져 다시 수집되지 않는다(기록은 `DELETE /api/fragrance/[id]`가 맡는다).
제품은 맞고 내용만 틀린 경우에는 삭제하지 말고 수정한다(`officialUrl`이 남아 있어 다시 수집되지 않는다).

## 파일

| 위치 | 역할 |
|------|------|
| `src/app/lib/arrivals/config.ts` | 수집 대상 브랜드, 제외 단어·태그, 기간, 기준 점수 등 운영 값 — **조정은 여기서** |
| `src/app/lib/arrivals/*.ts` | 단계별 로직 (`filterByRules`, `pickForRun`, `validateDescriptions`는 순수 함수) |
| `src/app/api/cron/perfume-arrivals/route.ts` | 크론 진입점 |
| `src/app/lib/cronAuth.ts` | 크론 엔드포인트 공통 인증 (`perfume-news`와 함께 사용) |

## 수집 대상 브랜드

공식 사이트가 제품 목록을 `/products.json`으로 공개하는 브랜드만 등록할 수 있다(Shopify 스토어).
아래 규칙은 2026-11-17 기준 실제 피드를 보고 정했다.

| 브랜드 | 도메인 | 향수 단품 판별 |
|--------|--------|----------------|
| D.S. & DURGA | dsanddurga.com | product_type `Eau de Parfum`, `Perfume Oil` |
| VILHELM PARFUMERIE | vilhelmparfumerie.com | product_type `Eau de Parfum` |
| IMAGINARY AUTHORS | www.imaginaryauthors.com | product_type `Perfume` + 제목이 `- FRAGRANCE`로 끝남 (캔들·비누·머그도 같은 유형이라) |
| GOLDFIELD & BANKS | www.goldfieldandbanks.com | product_type `100ml` |
| NONFICTION | www.nonfiction.com | product_type `Parfum`, `Perfume` |
| DEDCOOL | dedcool.com | product_type `Fragrance` |
| MAISON LOUIS MARIE | www.maisonlouismarie.com | product_type `Personal fragrance` + 제목이 `Eau de Parfum -` / `Perfume Oil -`로 시작 |
| JULIETTE HAS A GUN | www.juliettehasagun.com | product_type `Eau de Parfum` (프랑스어 스토어 — 소개문이 짧아 대부분 길이 기준에서 걸러진다) |

등록하지 않은 브랜드와 이유:

- BORNTOSTANDOUT (borntostandout.com): 피드의 소개문이 비어 있다(84건 중 78건). 설명을 쓸 근거가 없다.
- BYREDO, LE LABO, DIPTYQUE, JO MALONE, AESOP, TAMBURINS: `/products.json`이 없거나(404) 자동 요청을 막는다(403).

브랜드를 추가하려면 `https://{도메인}/products.json?limit=250`을 직접 열어 향수 단품에 붙는 `product_type`을 확인한 뒤 `ARRIVAL_SOURCES`에 등록한다.
`brand`는 DB 관례대로 영문 대문자로 쓴다(피드의 `vendor`는 스토어마다 제각각이라 쓰지 않는다).

## "신제품" 판단

같은 향수가 용량·농도별로 여러 제품으로 올라오는 스토어가 많다. 제목에서 농도·용량 표기를 뺀 이름으로 묶고,
그 이름이 **피드에 처음 등장한 날**(세트·샘플·트래블 제품 제목까지 포함해 가장 이른 게시일)이 `WINDOW_DAYS`(60일) 안일 때만 신제품으로 본다.
그래서 예전 향수의 새 용량(예: Vilhelm `MORNING CHESS` 20 ML)은 수집하지 않는다.

기간을 늘리면 첫 실행에서 더 많은 향수가 들어오지만, 검증에 계속 실패하는 제품을 그만큼 오래 반복 평가한다.

## 환경변수

| 이름 | 설명 |
|------|------|
| `CRON_SECRET` | 크론 엔드포인트 보호용 비밀값 (뉴스 파이프라인과 같은 값) |
| `OPENAI_API_KEY` | 기존 값 사용 |

## 수동 실행

```bash
# 저장 없이 선별 결과만 확인 (브랜드 규칙·프롬프트 조정용)
curl -H "Authorization: Bearer $CRON_SECRET" "http://localhost:3001/api/cron/perfume-arrivals?dryRun=1"

# 실제 저장
curl -H "Authorization: Bearer $CRON_SECRET" "http://localhost:3001/api/cron/perfume-arrivals"
```

## DB 마이그레이션

`20261117000000_fragrance_arrivals` — `Fragrance.source`, `Fragrance.officialUrl`(unique), `FragranceBlockedUrl` 추가. 기존 행은 바뀌지 않는다.

```bash
cd next-server
npx prisma migrate deploy
npx prisma generate
```

## 주의

- 공식 사이트의 소개문을 그대로 싣지 않는다. 소개문을 근거로 쓴 한국어 요약과 공식 제품 페이지 링크만 싣는다.
- 이미지는 재호스팅하지 않고 공식 사이트의 이미지 주소(`cdn.shopify.com` 또는 브랜드 도메인)를 그대로 링크한다. 브랜드가 이미지를 바꾸거나 지우면 화면에서 빠진다.
- 상세 화면이 `description`·`notes`를 HTML로 렌더링하므로, 검증 단계에서 태그와 꺾쇠(`<`, `>`)를 모두 제거한다. 외부 데이터에서 온 글을 이 단계를 거치지 않고 저장하면 안 된다.
- 피드 요청에는 `Accept-Language`를 빈 값으로 보낸다. 이 헤더가 있으면 스토어가 요청 IP의 국가용 목록으로 줄여서 응답한다(DEDCOOL에서 확인).
- 수집된 향수에는 작성자가 없다(`authorEmail = null`). 수정·삭제는 관리자만 할 수 있다.
- 소개문에 향에 대한 설명이 없는 제품(예: Imaginary Authors의 일부 제품은 소개문이 소설 줄거리다)은 LLM 판정에서 걸러진다.
