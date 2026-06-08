# I Love Perfume — Design System

> **UI 작업 규칙**: 이 문서의 토큰·컴포넌트만 사용. 즉흥 hex 색상·즉석 스피너·이모지 버튼 텍스트 금지.  
> 브랜드 팔레트: **딥 플럼 + 퍼플 + 더스티로즈 그라데이션 / 아이보리 베이스**

---

## 1. 색 토큰 (CSS 변수 — 라이트/다크 자동 전환)

> `globals.css` `:root` / `.dark` 블록에 정의됨. 직접 hex 쓰지 말고 변수만 참조.

### 1-1. 텍스트

| 역할 | CSS 변수 | Tailwind |
|------|----------|---------|
| 본문 제목·강조 | `var(--color-text-primary)` | `text-fg-primary` |
| 보조·설명 | `var(--color-text-secondary)` | `text-fg-secondary` / `text-secondary` (글로벌 클래스) |

**실제 값**

| | 라이트 | 다크 |
|--|--------|------|
| primary | `#1a1a2e` | `#f0ece6` |
| secondary | `#52526e` | `#b0a8a0` |

> **WCAG AA 확인값** — primary: 라이트 15:1 / 다크 14:1 ✅ · secondary: 라이트 7:1 / 다크 8.9:1 ✅

---

### 1-2. 배경

| 역할 | CSS 변수 | Tailwind/클래스 |
|------|----------|----------------|
| 페이지 배경 | `var(--bg-page)` | `bg-default` |
| 페이지 배경 반전 | `var(--bg-page-reverse)` | `bg-default-reverse` |
| 카드 배경 | `var(--color-card-bg)` | — |
| 아이보리 | `var(--color-ivory)` | `bg-ivory` |

**실제 값**

| | 라이트 | 다크 |
|--|--------|------|
| page | `#f7f5f2` | `#111110` |
| card-bg | `#fffcfa` | `#1a1a18` |
| ivory | `#fffcfa` | `#fffcfa` |

---

### 1-3. 브랜드 포인트 (액센트 계열)

| 역할 | CSS 변수 | Tailwind |
|------|----------|---------|
| 메인 포인트 | `var(--color-accent)` | `text-accent` |
| 밝은 포인트 | `var(--color-accent-light)` | `text-accent-light` |
| 흐린 포인트 | `var(--color-accent-muted)` | `text-accent-muted` |
| 연한 배경 | `var(--color-accent-pale)` | — |
| 보더 | `var(--color-accent-border)` | — |

---

### 1-4. 기타

| 역할 | CSS 변수 |
|------|----------|
| 카드 보더 | `var(--color-card-border)` |
| 소프트 그림자 | `var(--color-shadow-soft)` |
| 호버 그림자 | `var(--color-shadow-hover)` |
| 헤더 배경 | `var(--header-bg)` |
| 안 읽은 배지 | `--unread-badge-bg` / `--unread-badge-text` |

### 1-5. 채팅 도메인 전용

| 역할 | CSS 변수 | 라이트 | 다크 |
|------|----------|--------|------|
| 내 메시지 말풍선 | `--chat-bubble-own` | `var(--color-accent-pale)` = `#eaeaf8` (인디고 틴트) | `#252540` (다크 인디고) |
| AI 메시지 말풍선 | `--chat-bubble-ai` | `var(--color-card-bg)` = `#fffcfa` + 카드 보더 | `var(--color-card-bg)` + 카드 보더 |
| 상대방 말풍선 | `--chat-bubble-other` | `var(--color-card-bg)` = `#fffcfa` + 카드 보더 | `var(--color-card-bg)` + 카드 보더 |

> **구분 원칙**: 내 메시지(own)는 인디고 틴트로 강조, AI·상대방은 카드 배경(뉴트럴)으로 통일. 아바타 위치(좌/우)로 추가 구분.
| 그룹 멤버 배지 텍스트 | `--chat-badge-group-text` | `#4a4238` | `#e6e2da` |
| 그룹 멤버 배지 배경 | `--chat-badge-group-bg` | `#f0ede8` | `#3d3835` |
| 그룹 멤버 배지 보더 | `--chat-badge-group-border` | `#ddd6cc` | `#5c5650` |

**아이콘 색상 규칙 (사이드바·채팅 헤더·입력 폼)**

```tsx
// SVG fill 대신 반드시 className으로 색상 지정
// text-[var(--color-text-primary)] — 라이트 #1a1a2e / 다크 #f0ece6 (자동 전환)
<HiChevronLeft size={32} className="text-[var(--color-text-primary)]" />
<HiPhoto size={30} className="text-[var(--color-text-primary)]" />

// ❌ fill="url(#ilp-nav-gradient)" 사용 금지 — 그라데이션 제거됨
```

> 아이콘 색상은 메인 페이지 버튼·텍스트와 동일한 `var(--color-text-primary)` 사용 — 라이트/다크 자동 전환.

---

## 2. 텍스트·배경 색상 클래스 (솔리드 — 그라데이션 없음)

> 그라데이션은 제거됨. 모든 텍스트·배경은 솔리드 색상만 사용.

### 2-1. 텍스트 색상 클래스

| 클래스 | 용도 | 라이트 색 | 다크 색 |
|--------|------|-----------|---------|
| `text-gradient-scent` | **페이지 대표 제목** (H2 강조 헤딩) | `#2d2040` | `#f5f0e8` |
| `text-gradient-ilp` | 카드 제목·서브 타이틀·강조 인라인 | `var(--color-text-primary)` | `var(--color-text-primary)` |
| `text-gradient-logo` | 로고 전용 (`AnimatedLogo`) | `#2a2840` | `#f0ece6` |
| `text-gradient-memories` | 채팅·메모리 사이드바 제목 | `#6b5b95` | `#c8b4ff` |

> 클래스 이름은 유지 (기존 컴포넌트 호환). **`-webkit-text-fill-color: currentColor`** 로 동작.  
> `text-gradient-scent`는 반드시 `page-title-gradient`와 함께 사용 — 폰트 사이즈·자간 자동 적용.

```tsx
// 페이지 H2 제목 표준 패턴
<h2 className="text-gradient-scent page-title-gradient">향수 컬렉션</h2>
```

### 2-2. 배경 색상 클래스

| 클래스 | 용도 | 색상 |
|--------|------|------|
| `bg-gradient-ilp` | 아이콘·배지 배경 | `var(--color-lavender)` |
| `bg-gradient-ilp-avatar` | 아바타 배경 | 라이트: `var(--color-lavender)` / 다크: `#5c4a7a` |
| `line-gradient-deco` | 섹션 구분 가로선 | `var(--color-lavender-border)` |
| `footer-deco-line` | 푸터 상단 구분선 | `var(--color-card-border)` |
| `product-fragrance-divider` | 향수 섹션 내 구분선 | `var(--color-lavender-border)` |
| `ilp-deco-line` | 히어로 섹션 브랜드명 하단 장식선 | `var(--color-lavender-border)` |

### 2-3. 버튼 색상 (Button.tsx `variant="ilp"`)

```
배경: bg-[#1a1825]  dark:bg-[#f0ece6]
텍스트: text-white  dark:text-[#1a1825]
```

라이트 대비: 흰 텍스트 on `#1a1825` → **17.5:1** ✅  
다크 대비: `#1a1825` on `#f0ece6` → **14.8:1** ✅

### 2-4. CTA 카드 버튼 배경 (ScanClient 등)

```tsx
// ✅ 솔리드 카드 배경 패턴
style={{
  background: 'var(--color-lavender-pale)',
  border: '1px solid var(--color-lavender-border)',
  boxShadow: '0 2px 12px var(--color-shadow-soft)',
}}
// 텍스트: className="text-text-primary" / "text-secondary"
```

---

## 3. 버튼

**항상 `Button` 컴포넌트를 import해서 사용. 직접 `<button>` 스타일링 금지 (`.action-btn` 제외).**

```tsx
import Button, { FormSubmitActions } from "@/src/app/components/Button";
```

### 3-1. variant 일람

| variant | 용도 | 스타일 |
|---------|------|--------|
| `"ilp"` | **주요 CTA** (제출·분석·등록) | 다크 솔리드 배경, 흰 텍스트 |
| `"ghostLavender"` | **보조 CTA** (취소·다시선택·뒤로) | 투명 배경, 뉴트럴 보더·텍스트 |

**실제 색상 (Button.tsx)**

```
ilp 배경:     bg-[#1a1825]  dark:bg-[#f0ece6]
ilp 텍스트:   text-white    dark:text-[#1a1825]

ghost 텍스트: var(--color-text-primary)  (라이트 #1a1a2e / 다크 #f0ece6)
ghost 보더:   라이트 rgba(60,58,52,0.65)  /  다크 rgba(176,168,160,0.60)
ghost hover 보더: 라이트 rgba(60,58,52,0.90)  /  다크 rgba(200,195,188,0.45)
```

**WCAG 대비** — ilp 흰 텍스트 on `#1a1825`: **17.5:1** ✅ / ghost 텍스트 라이트: 17.5:1 / 다크: 14.3:1 ✅

### 3-2. size prop

| size | 높이 | 용도 |
|------|------|------|
| 기본 (없음) | h-9~h-10 | 폼·페이지 주요 버튼 |
| `"md"` | h-8 | 인라인 폼 버튼 |
| `"sm"` | h-[26px] | 리스트 행 내 컴팩트 버튼 |

### 3-3. 폼 하단 패턴 (FormSubmitActions)

```tsx
<FormSubmitActions
  submitLabel={<>저장</>}
  cancelLabel="취소"
  onCancel={() => router.back()}
/>
// → flex row: [ilp 버튼 flex-1] [ghostLavender 버튼]
```

### 3-4. 페이지 내 액션 버튼 (.action-btn)

라우트 액션(목록·수정·삭제 등) 전용 CSS 클래스. `Button` 컴포넌트가 아님.

```tsx
<Link href="/fragrance/create" className="action-btn">
  향수 등록하기
  <HiArrowRight className="size-3.5 shrink-0" aria-hidden />
</Link>
// 작은 버튼: className="action-btn action-btn--sm"
```

> 배경: `var(--color-text-primary)`, 텍스트: `var(--bg-page)` — 라이트/다크 자동 반전

---

## 4. 접근성 (WCAG AA 기준 — 4.5:1 이상)

> **규칙: 새 배경색을 추가할 때마다 반드시 텍스트 대비율을 계산하고 아래 표에 기록.**  
> 미검증 색상은 코드에 추가 금지.

### 4-0. 검증 방법

```js
function getLuminance(hex) {
  const r = parseInt(hex.slice(1,3),16)/255;
  const g = parseInt(hex.slice(3,5),16)/255;
  const b = parseInt(hex.slice(5,7),16)/255;
  const lin = v => v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4);
  return 0.2126*lin(r) + 0.7152*lin(g) + 0.0722*lin(b);
}
function contrast(hex1, hex2) {
  const l1 = getLuminance(hex1), l2 = getLuminance(hex2);
  const [light, dark] = l1 > l2 ? [l1,l2] : [l2,l1];
  return ((light+0.05)/(dark+0.05)).toFixed(2);
}
// 기준: 일반 텍스트 ≥ 4.5:1 / 굵은 텍스트·아이콘 ≥ 3:1
```

### 4-1. 검증된 색상 대비 목록

#### 기본 텍스트 (text-primary / text-secondary)

| 배경 | 텍스트 | 대비율 | 기준 |
|------|--------|--------|------|
| 라이트 page `#f7f5f2` | primary `#1a1a2e` | 15:1 | ✅ AA |
| 라이트 page `#f7f5f2` | secondary `#52526e` | 7:1 | ✅ AA |
| 다크 page `#1c1c1a` | primary `#f0ece6` | 14:1 | ✅ AA |
| 다크 page `#1c1c1a` | secondary `#b0a8a0` | 8.9:1 | ✅ AA |

#### 버튼

| 배경 | 텍스트 | 대비율 | 기준 |
|------|--------|--------|------|
| ilp 라이트 `#1a1825` | `white` | 17.5:1 | ✅ AA |
| ilp 다크 `#f0ece6` | `#1a1825` | 14.8:1 | ✅ AA |

#### 채팅 말풍선

| 배경 | 텍스트 | 대비율 | 기준 |
|------|--------|--------|------|
| 라이트 own `#eaeaf8` | primary `#1a1a2e` | 14.31:1 | ✅ AA |
| 라이트 other/ai `#fffcfa` | primary `#1a1a2e` | 16.70:1 | ✅ AA |
| 다크 own `#252540` | primary `#f0ece6` | 12.59:1 | ✅ AA |
| 다크 other/ai `#1a1a18` | primary `#f0ece6` | 14.81:1 | ✅ AA |

#### 채팅 UI 아이콘·버튼

| 배경 | 텍스트/아이콘 | 대비율 | 기준 |
|------|--------------|--------|------|
| 전송버튼 라이트 `#3d3d8f` | `white` | 9.28:1 | ✅ AA |
| 전송버튼 다크 `#c8c0b6` | `#1c1c1a` | 9.49:1 | ✅ AA |
| 그룹아이콘 다크 `#5c4a7a` | `white` | 7.73:1 | ✅ AA |

---

### 다크 오버레이(카메라·미리보기 등) 위 텍스트 규칙

```
어두운 오버레이(rgba(0,0,0,0.7+)) 위에서:
  흰 텍스트:     text-white/55 이상  (≥5.7:1)
  아이콘 장식:   text-white/30 허용  (aria-hidden)

밝은 그라데이션(--gradient-add-btn) 위에서:
  텍스트:  rgba(45,32,64,0.90)   ≥11.6:1 ✅
  부제목:  rgba(45,32,64,0.68)   ≥5.4:1  ✅
  흰 텍스트 금지 ❌
```

### opacity 텍스트 최소값

| 배경 | white/N | black/N | 기준 |
|------|---------|---------|------|
| 검은 배경(`#111110`) | `/45` 이상 | — | AA ≥4.5:1 |
| 아이보리(`#fffcfa`) | — | `/60` 이상 | AA ≥4.5:1 |

### 버튼·링크 텍스트

- opacity 기반 색 대신 `text-text-primary` / `text-secondary` 사용
- `text-black/40`, `text-white/40` 이하 → 4.5:1 미달, 사용 금지 (장식 아이콘 `aria-hidden` 제외)

---

## 5. 컴포넌트 레퍼런스

| 용도 | 컴포넌트 |
|------|---------|
| 아바타 (로고 그라데이션) | `ILPUserAvatar` from `@/src/app/components/ILPUserAvatar` |
| 이미지 (fallback 포함) | `FallbackNextImage` — blob URL은 `<img>` 직접 |
| 이미지 슬라이더 | `ImageSlider` |
| 풀스크린 로딩 | `<PointsLoading loadingMessage="..." />` |
| 모달 제목 | `.modal-title` (text-gradient-ilp 포함) |
| 모달 설명 | `.modal-description` |
| 입력 필드 | `TextField` from `@/src/app/components/TextField` |
| 토스트 | `toast.error('...해주세요')` / `toast.success('...했어요')` |
| 테마 토글 | `ThemeSwitch` |
| 안 읽은 배지 | `.unread-badge` |

---

## 6. 레이아웃 패턴

| 패턴 | 코드 |
|------|------|
| 페이지 컨테이너 | `max-w-[1440px] mx-auto w-full px-4 md:px-8` |
| 페이지 헤더 | `.product-fragrance-header-layout` + `flex justify-between items-center` |
| 카드 그리드 | `.layout-card` (1→2→3→4열) |
| 공지 그리드 | `.notice-grid` |
| 히어로 높이 | `calc(100dvh - var(--header-height))` — `--header-height: 56px` |
| 섹션 패딩 | `py-16 md:py-24` |
| 섹션 간격 | `gap-8` ~ `gap-16` |

---

## 7. 카드 토큰

```css
border-radius:  18px  (rounded-[18px] 또는 rounded-2xl)
background:     var(--color-card-bg)
border:         1px solid var(--color-card-border)
shadow rest:    0 2px 12px var(--color-shadow-soft)
shadow hover:   0 16px 40px var(--color-shadow-hover), 0 0 0 1px var(--color-lavender-border)
```

기존 클래스 그대로 재사용: `.notice-card` / `.product-fragrance-card`

---

## 8. 페이지 템플릿

### Server Page

```tsx
export const metadata: Metadata = { title: 'Foo' };
export default function FooPage() {
  return (
    <div className="content-wrap flex-col gap-4 max-w-[1440px] mx-auto w-full">
      <div className="product-fragrance-header-layout">
        <div className="flex flex-row justify-between items-center">
          <h2 className="text-gradient-scent page-title-gradient">Foo</h2>
        </div>
      </div>
      {/* 본문 */}
    </div>
  );
}
```

### Client Form Page

```tsx
'use client';
import Button, { FormSubmitActions } from "@/src/app/components/Button";
import TextField from "@/src/app/components/TextField";
import PointsLoading from "@/src/app/components/PointsLoading";

{isLoading && <PointsLoading loadingMessage="저장 중..." />}
<form className="flex flex-col gap-6">
  <TextField name="name" label="이름" />
  <FormSubmitActions submitLabel="저장" onCancel={() => router.back()} />
</form>
```

### 미리보기 + 분석 패턴 (스캔 영역 등)

```tsx
{/* 이미지 박스 — 항상 어두운 고정 배경 */}
<div className="relative w-full overflow-hidden rounded-2xl" style={{ aspectRatio: '4/3' }}>
  <img src={url} alt="..." className="absolute inset-0 w-full h-full"
    style={{ objectFit: 'contain', background: '#0a0a0a' }} />
</div>

{/* 컨트롤 — 반드시 박스 밖, 카드 배경 위에 렌더 */}
<div className="mt-3 flex flex-col gap-2.5">
  <p className="text-[11px] text-center text-secondary">안내 문구</p>
  <div className="flex gap-2">
    <Button variant="ilp" onClick={onAnalyze} className="flex-1">분석하기</Button>
    <Button variant="ghostLavender" onClick={onReset}>다시 선택</Button>
  </div>
</div>
```

> **핵심**: 버튼을 어두운 오버레이 안에 절대 배치하지 않음 — ghostLavender의 어두운 텍스트가 검은 배경에서 보이지 않음.

---

## 9. 금지 패턴 (PR 전 체크리스트)

- [ ] `bg-[#...]` / `text-[#...]` 하드코딩 hex 직접 사용
- [ ] `color="primary"` 등 HeroUI 기본 색 Button에 사용
- [ ] `bg-default-100`, `text-foreground/XX`, `border-default-200` 사용
- [ ] 배경·텍스트에 그라데이션 사용 (`bg-gradient-to-*`, `linear-gradient`, `background-clip: text`)
- [ ] `text-black/40` 또는 `text-white/40` 이하 opacity 텍스트 (비장식 요소)
- [ ] 버튼·링크 텍스트에 이모지 삽입
- [ ] 즉석 `animate-spin` spinner (PointsLoading 사용)
- [ ] ghostLavender 버튼을 어두운 오버레이 안에 절대 배치
- [ ] `text-stone-*` `text-neutral-*` 등 임의 Tailwind 색 사용 (디자인 토큰 사용)
- [ ] 페이지 대표 H2 제목에 `text-gradient-scent` 미적용
- [ ] 채팅·사이드바 아이콘에 `fill="url(#ilp-nav-gradient)"` 사용 (`className="text-[var(--color-text-primary)]"` 사용)
- [ ] 채팅 말풍선에 하드코딩 hex 사용 (`var(--chat-bubble-own/ai/other)` 사용)
- [ ] 새 배경색 추가 시 WCAG 대비율 미검증 (4-0 검증 함수로 확인 후 4-1 표에 기록)

하나라도 해당하면 수정.
