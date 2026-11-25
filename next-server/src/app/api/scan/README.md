# `/scan` — 카메라 향수 식별 & 구매처 링크

> 사진 → AI OCR로 brand·name 추출 → 자체 갤러리 매칭 → 결과 + 네이버 쇼핑 검색 링크.
> **프로젝트 전반 규칙**: [next-server/CLAUDE.md](../../../../CLAUDE.md) (UI 토큰·버튼·아이콘 규칙 등 먼저 읽기)
> **이 문서**: 코드와 함께 갱신되는 살아있는 구현 문서. 의사결정 배경은 [docs/decisions/](../../../../docs/decisions/).

---

## 파일 맵

| 영역 | 경로 |
|---|---|
| 진입 페이지 | [src/app/(main)/scan/page.tsx](../../(main)/scan/page.tsx) |
| 클라이언트 stage 머신 | [src/app/components/scan/ScanClient.tsx](../../components/scan/ScanClient.tsx) (idle → previewing → analyzing → result) |
| 카메라 / 파일 fallback | `components/scan/CameraCapture.tsx`, `FileUploadFallback.tsx` |
| 결과 UI | `components/scan/ScanResult.tsx`, `ShopLinkCard.tsx`, `SimilarGallery.tsx`, `ScanSaveNotice.tsx`(저장 안내 한 줄) |
| 내 스캔 기록 | `components/scan/MyScanList.tsx` — 프로필(`/profile`)에서 `userEmail`로 조회하는 서버 컴포넌트, 사진 격자(design-system 6-4) |
| API: 분석 | [api/scan/analyze/route.ts](analyze/route.ts) — `POST /api/scan/analyze` |
| API: 저장 | [api/scan/save/[scanId]/route.ts](save/[scanId]/route.ts) — `POST /api/scan/save/:scanId` (로그인 필수) |
| API: 유사 향수 | [api/scan/similar/[scanId]/route.ts](similar/[scanId]/route.ts) — `GET /api/scan/similar/:scanId` (갤러리 DB 기반) |
| 비즈니스 로직 | [src/app/lib/scan/](../../lib/scan/) — `visionAnalyze`, `enrichInfo`, `findMatch`, `findSimilarFragrances`, `naverShopping`(링크 생성), `koreanName`, `transliterate`, `rateLimit` |
| 데이터 모델 | `ScanResult` ([prisma/schema.prisma](../../../../prisma/schema.prisma)) |

---

## 흐름 1 — `POST /api/scan/analyze`

1. 레이트 리밋 (분당 5회/IP, in-memory) — `rateLimit.ts`
2. multipart 수신 → Cloudinary 업로드 (unsigned preset)
3. **Vision OCR** (`visionAnalyze.ts`): `brand/name/concentration/size` 분리 추출
   - 1차 `detail="low"` → 결손 시 2차 `detail="high"` 재시도 (비용 최적화, [ADR-0002](../../../../docs/decisions/0002-vision-two-pass-ocr.md))
   - `gpt-4o` 거부 시 `gpt-4o-mini` fallback
   - 부향률을 name으로 잡으면 안전망 차단
4. **자체 갤러리 매칭** (`findMatch.ts`): brand alias(한/영) + token 양방향 매칭
   - 게이트: `nameRaw ≥ 50`, `total ≥ 70`
5. **24h 캐시 조회**: 같은 `brand+name`의 이전 `ScanResult` 있으면 `description/notes` 재사용
6. description/notes 우선순위: **curated DB > 캐시 > `enrichInfo`** (gpt-4o-mini, 텍스트 LLM)
7. `ScanResult` 저장(한글 이름 음역과 병렬) → `scanId` 반환

## 흐름 2 — 구매처 링크 (API 없음)

네이버 쇼핑 검색 API가 2026-07-31에 종료되어 가격·판매처를 받아오지 않는다. 대신 향수 이름으로 **네이버 쇼핑 검색 페이지 주소**를 만들어 링크로 보낸다 ([ADR-0003](../../../../docs/decisions/0003-naver-shopping-link-only.md)).

1. 분석 시 `ensureKoreanName()`으로 한글 이름을 음역해 `FragranceKoreanName`에 저장 (`koreanName.ts`, 향수당 1회)
2. 결과 페이지(서버)가 `getCachedKoreanName()`으로 읽어 `ScanResult`에 전달
3. `ShopLinkCard`가 `buildNaverSearchUrl(name, koreanName)`으로 링크 생성 — 한글 이름 우선, 없으면 영문 이름 + "향수"
4. 갤러리 유사 향수(`GET /api/scan/similar/:scanId`)도 항목마다 `koreanName`을 붙여 카드에 같은 링크를 건다

`naverShopping.ts`는 외부 호출이 없는 순수 함수라 클라이언트 컴포넌트에서도 import할 수 있다.

## 흐름 3 — 내 스캔 기록 (새 테이블 없음)

`ScanResult.userEmail` 한 칸으로 주인을 구분한다. 로그인하고 찍으면 분석 때 채워지고, 로그인 없이 찍으면 비어 있다.

1. 결과 페이지(서버)가 보는 사람과 `userEmail`을 비교해 `none`(주인 없음) / `mine` / `other`를 넘긴다 — 이메일은 화면으로 내려보내지 않는다
2. `ScanSaveNotice`가 이미지 아래 한 줄로 안내한다
   - 주인 없음 + 비로그인: "가입하고 저장하기" → `/auth/register?callbackUrl=결과 주소`. 누른 스캔 id를 `sessionStorage`(`ilp:pendingScanSave`)에 적어 두고, 가입하고 돌아오면 다시 누르지 않아도 저장한다
   - 주인 없음 + 로그인: "저장하기" 버튼
   - 내 기록: "기록 보기" → `/profile`
   - 다른 사람 기록: 아무것도 보여주지 않는다
3. `POST /api/scan/save/:scanId`는 `userEmail`이 비어 있을 때만 채운다(조건을 건 `updateMany` 한 번). 이미 주인이 있으면 409
4. 결과 페이지에 들어오기만 해서는 저장되지 않는다 — 버튼을 누른 경우만

스캔한 브라우저인지는 확인하지 않는다. 결과 주소를 아는 로그인 사용자는 주인 없는 스캔을 저장할 수 있다(주소가 추측 불가능하고 공유 버튼이 없어 받아들인 범위). 스캔 공유를 넣을 때 다시 판단한다.

---

## 데이터 모델

```prisma
model ScanResult {
  id          String   @id @default(cuid())
  brand       String              // Vision OCR 결과
  name        String              // Vision OCR 결과
  notes       String?             // enrichInfo 또는 curated DB
  description String?             // enrichInfo 또는 curated DB
  imageUrl    String              // Cloudinary URL
  matchedSlug String?             // 자체 갤러리 매칭 시
  prices      Json?               // 미사용 (가격 비교 종료 — ADR-0003). 제거 예정
  userEmail   String?             // 비로그인 가능 (nullable)
  tokensUsed  Int?
  createdAt   DateTime @default(now())

  @@index([brand, name])          // 캐시 조회용
  @@index([userEmail])
  @@index([createdAt(sort: Desc)])
}
```

`prices`·`naverRecoCache` 컬럼은 더 이상 읽거나 쓰지 않는다.

---

## 환경 변수

```env
OPENAI_API_KEY                        # Vision + enrichInfo + transliterate
CLOUDINARY_CLOUD_NAME
NEXT_PUBLIC_CLOUDINARY_CLOUD_PRESET   # unsigned preset
```

---

## ⚠️ 이 코드 만질 때 주의

- **`prisma/schema.prisma` 변경분이 아직 마이그레이션 미적용** (uncommitted). 새 컬럼 의존 코드 추가 시 `prisma migrate dev` 먼저.
- **네이버 쇼핑 데이터를 다시 받아오려 하지 말 것** — 검색 API는 종료됐고 페이지 수집은 약관 위반. 배경은 [ADR-0003](../../../../docs/decisions/0003-naver-shopping-link-only.md).
- **Vision 2-pass는 비용 최적화 핵심** — `needsHighResRetry()` 조건(name 길이 ≤5 등) 완화 시 평균 비용 급증. 변경 전 [ADR-0002](../../../../docs/decisions/0002-vision-two-pass-ocr.md) 참고.
- **UI 토큰**: 하드코딩 hex / HeroUI 기본 색 / 이모지 금지 — 자세한 건 [CLAUDE.md](../../../../CLAUDE.md) + [docs/design-system.md](../../../../docs/design-system.md).

---

## 미구현 (설계엔 있으나 빠진 것)

- 가격 비교 (네이버 쇼핑 API 종료로 내림 — 대체 소스 후보는 [ADR-0003](../../../../docs/decisions/0003-naver-shopping-link-only.md))
- 스캔 결과 공유 OG 카드
