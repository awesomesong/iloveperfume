# 향수 뉴스 파이프라인 (`/news`)

`/news`는 사용자가 글을 쓰는 게시판이 아니라, 스케줄러가 수집한 향수 뉴스를 보여주는 페이지다.
글은 `/api/cron/perfume-news`만 생성한다.

## 흐름

```
Vercel Cron (vercel.json, 매일 00:00 UTC = 09:00 KST)
  └─ GET /api/cron/perfume-news          Authorization: Bearer CRON_SECRET
       1. buildQueries        고정 검색어 + DB 등록 수 상위 브랜드
       2. collectNews         네이버 뉴스 검색 API (sort=date)
       3. filterCandidates    48시간 이내 · 등록된 언론매체(TRUSTED_DOMAINS) 화이트리스트만 통과 · 제외 키워드 · URL/제목 중복 · DB에 있는 URL 제외
       4. selectAndSummarize  OpenAI 1회 호출 — 선별 + 제목·요약(JSON)
       5. validateSelection   id 대조 · 카테고리 · 관련도 · 길이 · 브랜드당 1건 · 최대 5건
       6. fetchOgImage        선별된 기사(최대 5건)에 한해 원문 og:image를 최선형으로 가져옴 — 실패해도 null로 계속 진행
       7. saveAsNotices       Notice 저장 — 바로 공개 (sourceUrl unique → 중복 실행에도 안전)
```

실행 순서는 코드가 정하고 LLM은 4번에서만 판단한다(에이전트 루프가 아닌 고정 파이프라인).
비용·실행 시간이 일정하고, LLM이 URL·매체명·발행일을 만들지 않으므로 출처가 틀릴 수 없다.

## 파일

| 위치 | 역할 |
|------|------|
| `src/app/lib/news/config.ts` | 검색어, 제외 키워드, 기준 점수 등 운영 값 — **조정은 여기서** |
| `src/app/lib/news/*.ts` | 단계별 로직 (`filterByRules`, `validateSelection`은 순수 함수) |
| `src/app/api/cron/perfume-news/route.ts` | 크론 진입점 |
| `src/app/api/notice/route.ts` | 목록 조회 (`?category=`) — 공개된 글만 |
| `src/app/api/notice/[id]/route.ts` | 상세 조회, 관리자 `PATCH { status }` (내리기/다시 게시) |

## 환경변수

| 이름 | 설명 |
|------|------|
| `CRON_SECRET` | 크론 엔드포인트 보호용 비밀값. `openssl rand -hex 32`로 생성해 Vercel에 등록 |
| `NAVER_NEWS_CLIENT_ID/SECRET` | 선택. 없으면 `NAVER_SHOPPING_CLIENT_ID/SECRET` 사용 |
| `OPENAI_API_KEY` | 기존 값 사용 |

## 글 상태

사람 검수 단계는 없다. 필터(3)와 검증(5)을 통과한 글은 저장과 동시에 공개된다.
게시 기준을 조정하려면 `config.ts`의 `MIN_RELEVANCE`, `EXCLUDE_KEYWORDS`, `BLOCKED_DOMAINS`, `TRUSTED_DOMAINS`, `MAX_PUBLISH_PER_RUN`을 바꾼다.

- `PUBLISHED`: 공개 (기본값).
- `HIDDEN`: 잘못 올라온 글을 관리자(`User.role = 'admin'`)가 상세 화면에서 사후에 내린 글. 행을 지우지 않는 이유는 `sourceUrl`이 남아 있어야 같은 기사가 다시 올라오지 않기 때문이다.

## 수동 실행

```bash
# 저장 없이 선별 결과만 확인 (검색어·프롬프트 조정용)
curl -H "Authorization: Bearer $CRON_SECRET" "http://localhost:3001/api/cron/perfume-news?dryRun=1"

# 실제 저장
curl -H "Authorization: Bearer $CRON_SECRET" "http://localhost:3001/api/cron/perfume-news"
```

운영 주소로 호출할 때는 `https://www.iloveperfume.co.kr`을 쓴다(`www` 없는 주소는 리다이렉트된다).

## DB 마이그레이션 (최초 1회)

이 프로젝트는 마이그레이션 이력 없이 운영해 왔으므로, 먼저 현재 스키마를 베이스라인으로 기록한 뒤 변경을 적용한다.
`migrate dev`는 운영 DB 초기화를 제안할 수 있으니 쓰지 않는다.

```bash
cd next-server

# 1) 베이스라인: 변경 전 스키마를 0_init으로 기록한다 (DB에는 아무것도 실행하지 않음)
mkdir -p prisma/migrations/0_init
git show main:next-server/prisma/schema.prisma > /tmp/schema.before.prisma
npx prisma migrate diff --from-empty --to-schema-datamodel /tmp/schema.before.prisma --script \
  > prisma/migrations/0_init/migration.sql
npx prisma migrate resolve --applied 0_init

# 2) 변경 적용: 20261114000000_notice_news_pipeline, 20261114010000_notice_auto_publish
#    주의 — 기존 Notice 글과 그 댓글을 모두 삭제한다 (되돌릴 수 없음)
npx prisma migrate deploy
npx prisma generate
```

`0_init/migration.sql` 맨 위에 `CREATE EXTENSION IF NOT EXISTS vector;`를 추가해 두면
나중에 빈 DB에서 처음부터 마이그레이션을 재생할 때 `Fragrance.embedding` 컬럼에서 실패하지 않는다.

## 주의

- 기사 본문을 가져오지 않는다. 검색 API의 제목·발췌문으로 만든 요약과 원문 링크만 싣는다.
- 기사 이미지는 선별된 기사에 한해 원문의 og:image(없으면 twitter:image)를 최선형으로 가져와 그대로 링크한다(`fetchImage.ts`). 재호스팅·캐싱하지 않으므로 원문 이미지가 바뀌거나 사이트가 핫링크를 막으면(Referer 체크 등) 화면에서 조용히 빠진다 — 이미지는 있으면 좋고 없어도 되는 부가 정보다.
- 수집 대상은 `config.ts`의 `TRUSTED_DOMAINS`(= `SOURCE_NAME_BY_DOMAIN`에 등록된 매체)로 제한한다. 새 매체를 추가하려면 `SOURCE_NAME_BY_DOMAIN`에 도메인→매체명을 등록한다.
- `summary`는 일반 텍스트다. HTML을 저장하거나 `dangerouslySetInnerHTML`로 렌더링하지 않는다.
