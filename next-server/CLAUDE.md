# Scent Memories — next-server

Next.js 15 (App Router) · React 19 · TS · Prisma · NextAuth · Cloudinary · Socket.io. Dev: `npm run dev` (포트 3001).

레포: `next-server/`(이 패키지) + `socket-server/`(Fly.io). 경로 alias `@/*` → 패키지 루트.

---

## 어디에 뭐가 있나

- `prisma/db.ts` — PrismaClient 싱글톤. **항상 `import prisma from "@/prisma/db"`** (`new PrismaClient()` 금지).
- `src/middleware.ts` — 로그인 필수 페이지 `matcher`. 보호할 페이지 추가 시 여기만.
- `src/app/lib/session.ts` — `getCurrentUser()`. 보호 API에서 사용.
- `src/app/(main)/` · `(chat)/` — 라우트 그룹.
- `src/app/api/<feature>/route.ts` — route handler. Prisma·OpenAI 쓰면 `export const runtime = "nodejs"`.
- `src/app/lib/<feature>/` — 서버 비즈니스 로직.

---

## UI 작업 필수 절차 (반드시 순서대로)

**UI·색상·컴포넌트·스타일 관련 작업이면 아래 순서를 무조건 따른다.**

1. **`docs/design-system.md` 전체를 Read한다** — 토큰, 금지 패턴, WCAG 대비율 목록 확인
2. 사용할 색상이 design-system.md에 정의된 CSS 변수인지 확인한다
3. 새 색상을 추가할 경우 WCAG 대비율(4.5:1 이상)을 계산하고 `4-1` 표에 기록한다
4. 작업 후 `npm run lint`로 위반 여부를 확인한다

> design-system.md를 읽지 않고 UI를 수정하면 안 된다. 읽었는지 확인이 안 되면 먼저 읽어라.

---

## 규칙 (어기면 깨짐)

- **DB 스키마 변경**: `prisma/schema.prisma` 수정 → `prisma migrate dev` → `prisma generate`. 마이그레이션 없이 새 컬럼 의존 코드 추가 금지.
- **API 에러 응답**: `{ message: string }` + status. 클라는 `toast.error(message)`로 표시.
- **환경변수 누락**: 서버에서만 읽고, 누락 시 500 + 서버 로그. 클라이언트 노출 금지.
- **UI 토큰**: 색·버튼·로딩·아이콘·폼 전부 [docs/design-system.md](docs/design-system.md)의 토큰만 사용. 하드코딩 hex / HeroUI 기본 색(`color="primary"`, `bg-default-100`) / UI 텍스트 안 이모지 / 즉석 spinner 금지.

---

## 피처별 문서

- 향수 스캔(`/scan`): [src/app/api/scan/README.md](src/app/api/scan/README.md) — 만지기 전 필독.
- 의사결정 기록: [docs/decisions/](docs/decisions/) — ADR-0001(가격 소스), ADR-0002(Vision 2-pass).

---

## Figma MCP 토큰 절감 규칙

**Figma 관련 작업 시 아래 순서를 반드시 따른다.**

1. `get_screenshot` 먼저 — 시각적 구조 파악 (텍스트 JSON 없이)
2. 토큰/변수 확인은 `get_variable_defs` — `get_design_context` 대신
3. `get_design_context`는 **node_id 필수 지정** — 파일 전체 범위 호출 금지
4. `docs/design-system.md`에 이미 문서화된 토큰은 Figma 재조회 금지
5. 반복 작업은 `/figma-component`, `/figma-tokens`, `/figma-screen` slash command 사용

> Slash commands: `.claude/commands/` 에 위치. `/figma-component`, `/figma-tokens`, `/figma-screen`
