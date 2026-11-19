# 향수 뉴스 파이프라인 (`/news`)

`/news`는 사용자가 글을 쓰는 게시판이 아니라, 스케줄러가 수집한 향수 뉴스를 보여주는 페이지다.
글은 `/api/cron/perfume-news`만 생성한다.

## 흐름

```
Vercel Cron (vercel.json, 매일 00:00 UTC = 09:00 KST)
  └─ GET /api/cron/perfume-news          Authorization: Bearer CRON_SECRET
       1. buildQueries        고정 검색어(BASE_QUERIES) + 브랜드 검색어("{브랜드} 향수", PERFUME_BRANDS) — 49개
       2. collectNews         네이버 뉴스 검색 API (sort=date, display=100) — 페이지 끝이 48시간 안이면 다음 페이지(최대 3)
                              · 동시 3개 · 요청 간격 150ms · 429/5xx 재시도 2회 · URL 정규화(해시·utm_*·ref/from=naver 제거) 후 URL 중복 제거
       3. filterCandidates    48시간 이내 · 검증된 매체만 통과(TRUSTED_DOMAINS 화이트리스트 또는 네이버 뉴스 제휴 매체 인링크)
                              · 차단 도메인 · 제외 키워드 · 향수 기사 판별(perfumeArticle.ts) · URL 중복
                              · 같은 소식 중복(이번 실행의 다른 후보 + 최근 3일 게시 글 제목과 비교, dedupe.ts) · DB에 있는 URL 제외
       4. selectAndSummarize  OpenAI 1회 호출 — 선별 + 제목·요약(JSON)
       5. validateSelection   id 대조 · 카테고리 · 관련도 · 길이 · 같은 소식 중복 안전망(LLM 제목 vs 최근 3일 글·이번 선별분)
                              · 이번 실행에서 브랜드당 1건 · 최근 3일 같은 브랜드 글과는 낮은 기준(0.3)으로 같은 소식 판별 · 최대 5건
       6. fetchOgImage        선별된 기사(최대 5건)에 한해 원문 og:image를 최선형으로 가져옴 — 실패해도 null로 계속 진행
       7. saveAsNotices       Notice 저장 — 바로 공개 (sourceUrl unique → 중복 실행에도 안전)
```

실행 순서는 코드가 정하고 LLM은 4번에서만 판단한다(에이전트 루프가 아닌 고정 파이프라인).
비용·실행 시간이 일정하고, LLM이 URL·매체명·발행일을 만들지 않으므로 출처가 틀릴 수 없다.

## 파일

| 위치 | 역할 |
|------|------|
| `src/app/lib/news/config.ts` | 검색어, 제외 키워드, 기준 점수 등 운영 값 — **조정은 여기서** |
| `src/app/lib/news/*.ts` | 단계별 로직 (`filterByRules`, `isPerfumeArticle`, `validateSelection`은 순수 함수) |
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

수집(2) 조정 값 — 2026-11 실측 기준:

- `BASE_QUERIES`: 네이버 검색은 단어 AND 검색이라 짧은 검색어("향수 브랜드")가 긴 검색어("향수 브랜드 론칭")를 포함한다.
- 브랜드 검색어(`PERFUME_BRANDS`의 `"{name} 향수"`): 한때 48시간 창에서 새 기사를 거의 못 찾는다고 뺐다가 다시 넣었다.
  14일 실측에서 브랜드 검색어 35개가 찾은 기사 252건 중 29건은 고정 검색어에 없었고, 그중 샤넬 뷰티×정국 향수 3종 화보(17개 매체)·
  메종 마르지엘라 향수 커버 인터뷰·메종 프란시스 커정 포토월처럼 제목에 "향수"가 없는 큰 브랜드 향수 기사가 있었다.
  대부분 1페이지에서 끝나 호출이 크게 늘지 않는다(2026-11 실측: 검색어 49개 7.3초).
- `NAVER_MIN_INTERVAL_MS`(150): 요청 시작 간격. 검색어 49개를 동시 3개로만 보내면 응답이 빨라 초당 10건을 넘겨 429가 났다(재시도 후에도 2개 실패). 150ms면 실패 없이 7초대.
- `PER_QUERY_DISPLAY`(100): 20건이면 기사가 많은 검색어("향수 출시")는 최신 20건이 33시간만 덮어 창 안 기사를 놓쳤다. 100건이면 한 번 호출로 48시간을 덮는다.
- `NAVER_MAX_PAGES_PER_QUERY`(3): 기사가 더 몰리는 날을 위한 상한. 페이지 끝이 창 밖이면 그 자리에서 멈춘다.
- `NAVER_CONCURRENCY`(3), `NAVER_RETRY_DELAYS_MS`([500, 1000]): 검색어를 한꺼번에 보내면 429(Rate limit exceeded)로 결과가 빠졌다. 재시도 후에도 실패한 검색어는 실행 기록의 `failedQueries`에 남는다.
  크론 `maxDuration`은 120초(최악 실행 약 55초의 두 배 여유)이고 OpenAI 호출이 최대 40초라 수집은 15초 안쪽으로 유지한다 — 브랜드를 많이 늘리면 실행 시간을 다시 잰다.
- 매체 신뢰: 검색 결과의 `link`가 네이버 뉴스 인링크(`n.news.naver.com` 등)면 네이버 뉴스 제휴 매체로 보고 화이트리스트에 없어도 통과시킨다(`NewsCandidate.naverPartner`). `BLOCKED_DOMAINS`가 우선한다. 매체명을 한글로 보이려면 `SOURCE_NAME_BY_DOMAIN`에 등록한다(등록하면 화이트리스트에도 들어간다).
- URL 정규화 전에 저장된 `sourceUrl`에는 추적용 파라미터가 남아 있어 DB URL 대조에 걸리지 않는다. 48시간 창 + 최근 3일 글 제목 유사도 비교가 대신 막는다.

향수 기사 판별(`perfumeArticle.ts`)은 3단계에서 제외 키워드 바로 다음, 중복 판별보다 먼저 한다(무관한 기사가 중복 연결에 끼지 않게).
네이버 검색은 본문 어딘가에 "향수"만 있어도 걸린다. 2026-11 실측에서 규칙 필터를 통과한 25건 중 향수 기사는 제목에 향수 용어가 있는 6건뿐이었고,
나머지 19건은 발췌문에 "향수"가 한 번 — 매장·유통사 기사의 판매 품목 나열이거나 "어린 시절의 향수를 자극" 같은 추억의 뜻이었다.

통과 조건(하나만 맞으면 된다, 추억 뜻의 "향수"는 세지 않는다):

1. 제목에 향수 용어나 향수 제품명이 있다.
2. 제목에 향수 전문 브랜드(`kind: "house"`)가 있다 — "킬리안 파리, 홀리데이 캠페인 공개".
3. 제목에 패션·화장품 브랜드(`kind: "fashion"`)가 있고 발췌문에 향수 용어나 제품명이 1번 이상 있다 — "샤넬 뷰티 글로벌 앰배서더 정국, 보그 코리아 12월호 6종 커버" + 발췌문 "샤넬의 향수 3종과".
4. 발췌문에 향수 용어가 2번(`MIN_DESCRIPTION_PERFUME_MENTIONS`) 이상 있다.

- `PERFUME_TERM_PATTERN`: 향수 용어(향수·퍼퓸·퍼퓨머·perfume·fragrance·프래그런스·오 드 퍼퓸/뚜왈렛/코롱·코롱·조향).
- `PERFUME_PRODUCT_NAMES`: 유명 향수 제품명(N°5·미스 디올·쟈도르·소바쥬·블루 드 샤넬·코코 마드모아젤·블랙 오피움 등). 제목·3번 조건에서 향수 용어로 친다.
  4번 조건에서는 세지 않는다 — "디올 향수 '소바쥬'의 광고 모델"(조니 뎁 기사)처럼 용어와 제품명이 붙은 곁가지 언급이 2회로 세어졌다.
  "굿걸"·"샹스"·"리브르"처럼 다른 뜻으로 흔한 이름은 넣지 않는다.
- `NOSTALGIA_PATTERN`: 추억·그리움 뜻의 "향수"("시절의 향수", "13년 전 향수", "향수를 자극/불러일으키다", "향수 어린", "추억과 향수" 등). 따옴표를 지운 뒤 맞춰 보고, 맞은 "향수"는 세지 않는다. "향수를 넘어"·"옛 향수"는 향수 뜻으로도 쓰여 넣지 않았다.
- `MIN_DESCRIPTION_PERFUME_MENTIONS`(2): 제목에 용어·브랜드가 없으면 발췌문에 이 횟수 이상 나와야 통과. 1회는 대부분 곁가지 언급이었다. 향수 기사가 빠지면 내리고, 무관한 기사가 또 들어오면 올린다.
- `PERFUME_BRANDS`: 브랜드 표 하나로 검색어와 제목 판별을 함께 관리한다.
  - `name`: 검색어용 한글 이름. 네이버는 단어 AND 검색이라 "조르지오 아르마니"보다 "아르마니"가 넓다.
  - `aliases`: 제목 판별용 표기(소문자 + 글자·숫자만, 한글 변형·영문). 2글자 이상, 흔한 단어와 겹치지 않는 것만. 비어 있으면 검색어 전용("크리드"는 영화 제목과 겹친다).
  - `excludes`: 별칭을 품은 다른 말을 비교 전에 지운다("불가리아", "킬리안 음바페").
  - `kind`: `"house"`(향수 전문 — 킬리안·딥티크·조말론·바이레도·르라보·메종 프란시스 커정·산타마리아노벨라 등)는 제목만으로 통과,
    `"fashion"`(샤넬·디올·에르메스·구찌·입생로랑·루이비통·랑콤 등, 핸드크림·바디도 파는 탬버린즈·논픽션 포함)은 발췌문에 향수 언급이 있어야 통과.
  - 14일 실측(기사 896건): 통과 237 → 289건. 브랜드 검색어로만 잡힌 29건 중 샤넬×정국 화보 18건·마르지엘라 향수 커버·커정 행사는 통과,
    제목에 브랜드가 없는 6건(조니 뎁·오만과 편견 일기·버버리 칼럼 등)은 탈락. 새로 통과한 52건 중 20건가량은 패션 기사
    (루이비통 키스 해링 컬렉션·로에베 협업 컬렉션·구찌 가격 인하·디올/불가리 CEO — 발췌문에 판매 품목으로 "향수" 한 번)라 LLM 선별(4단계)이 거른다.

같은 소식 중복 판별(`dedupe.ts`)은 제목 글자 바이그램의 IDF 가중 코사인 유사도를 쓴다.
IDF는 이번 실행에 수집한 기사 전체에서 계산하므로 흔한 단어(향수·출시·컬렉션)는 가볍고 브랜드·제품명 같은 고유명사는 무겁다.
매체마다 제목 표현이 달라도 고유명사가 겹치면 같은 소식으로 본다. 프롬프트의 "recentTitles와 같은 소식 제외" 지시는 LLM이 놓칠 때가 있어 코드로 3단계·5단계에서 두 번 막는다.

- `DUPLICATE_SIMILARITY_THRESHOLD`(0.5): 이 값 이상이면 중복. 실데이터 측정 기준 같은 소식 0.5~1.0, 다른 소식 최대 ~0.45. 다른 소식이 빠지면 올리고, 같은 소식이 또 올라오면 내린다.
- `DUPLICATE_LOOKBACK_DAYS`(3): 이 기간 안에 만든 글(HIDDEN 포함)과 비교한다. 후보가 48시간 창이라 같은 소식이 연속 2~3회 실행에 걸쳐 나올 수 있다.
- `SAME_BRAND_SIMILARITY_THRESHOLD`(0.3): 5단계에서 LLM이 고른 기사의 브랜드가 최근 3일 글 제목에 있으면, **그 글**과의 제목 유사도가 이 값 이상일 때만 뺀다.
  예전에는 최근 글 제목에 브랜드만 있어도 뺐는데, 그러면 사흘 안에 나온 다른 샤넬 소식(신제품 다음 날의 화보)까지 막혔다.
  같은 브랜드면 다른 표현의 같은 소식일 가능성이 높아 0.5보다 낮게 둔다. 14일 실측(같은 브랜드 제목 쌍): 같은 소식 691쌍 중 74%가 0.3 이상,
  다른 소식 800쌍 중 1.3%만 0.3 이상(최대 0.37). "샤넬 뷰티, 정국과 향수 3종 화보 공개" vs "정국, 샤넬 향수 3종 담은 보그 코리아 12월호 커버" 0.33(같은 소식),
  "디올, 성수 향수 팝업 오픈" vs "디올 소바쥬 엘릭서 국내 출시" 0.22(다른 소식). 이번 실행 안에서는 여전히 브랜드당 1건만 싣는다.

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
- 수집 대상은 `config.ts`의 `TRUSTED_DOMAINS`(= `SOURCE_NAME_BY_DOMAIN`에 등록된 매체)와 네이버 뉴스 제휴 매체로 제한한다. 새 매체를 추가하려면 `SOURCE_NAME_BY_DOMAIN`에 도메인→매체명을 등록한다.
- `summary`는 일반 텍스트다. HTML을 저장하거나 `dangerouslySetInnerHTML`로 렌더링하지 않는다.
