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
| primary | `#1a1a2e` | `#f0ece6` ✅ |
| secondary | `#52526e` | `#b0a8a0` ✅ |

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
| page | `#f7f5f2` | `#111110` ✅ |
| card-bg | `#fffcfa` | `#1a1a18` ✅ |
| ivory | `#fffcfa` | `#fffcfa` |

---

### 1-3. 브랜드 포인트 (액센트 계열)

| 역할 | CSS 변수 | Tailwind | 라이트 | 다크 |
|------|----------|---------|--------|------|
| 메인 포인트 | `var(--color-accent)` | `text-accent` | `#3d3d8f` (딥 인디고) | `#7a80cc` (미디엄 인디고) |
| 밝은 포인트 | `var(--color-accent-light)` | `text-accent-light` | `#5555aa` | `#9da4e0` |
| 흐린 포인트 | `var(--color-accent-muted)` | `text-accent-muted` | `#6868a8` | `#5c64a4` |
| 연한 배경 | `var(--color-accent-pale)` | — | `#eaeaf8` | `#222228` |
| 보더 | `var(--color-accent-border)` | — | `#c0c0e0` | `rgba(122,128,204,0.45)` |

---

### 1-4. 기타

| 역할 | CSS 변수 |
|------|----------|
| 카드 보더 | `var(--color-card-border)` |
| 소프트 그림자 | `var(--color-shadow-soft)` |
| 호버 그림자 | `var(--color-shadow-hover)` |
| 헤더 배경 | `var(--header-bg)` |
| 안 읽은 배지 | `--unread-badge-bg` / `--unread-badge-text` |
| 사이드바 hover/active | `--color-sidebar-state-bg` | 라이트 `var(--color-accent-pale)` = `#eaeaf8` / 다크 `rgba(61,61,143,0.30)` (인디고 틴트) |

> **사이드바 active 구분 원칙**: 인디고 틴트 배경 + `box-shadow: inset 3px 0 0 var(--color-accent)` 좌측 바로 명확히 표시.

### 1-5. 채팅 도메인 전용

| 역할 | CSS 변수 | 라이트 | 다크 |
|------|----------|--------|------|
| 내 메시지 말풍선 | `--chat-bubble-own` | `#7a80cc` (미디엄 인디고) | `#5c64a4` (다크 인디고) |
| AI 메시지 말풍선 | `--chat-bubble-ai` | `var(--color-card-bg)` + 카드 보더 + shadow-sm | `var(--color-card-bg)` + 카드 보더 + shadow-sm |
| 상대방 말풍선 | `--chat-bubble-other` | `var(--color-card-bg)` + 카드 보더 + shadow-sm | `var(--color-card-bg)` + 카드 보더 + shadow-sm |

> **구분 원칙**: 내 메시지(own)는 미디엄 인디고로 배경 대비 3:1 이상 확보. AI·상대방은 카드 배경 + border + shadow-sm으로 시각적 구분.
| 그룹 멤버 배지 텍스트 | `--chat-badge-group-text` | `#4a4238` | `#e0e0e0` |
| 그룹 멤버 배지 배경 | `--chat-badge-group-bg` | `#f0ede8` | `#303030` |
| 그룹 멤버 배지 보더 | `--chat-badge-group-border` | `#ddd6cc` | `#484848` |

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
| `bg-gradient-ilp-avatar` | 아바타 배경 | 라이트: `var(--color-lavender)` / 다크: `#4455b8` |
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
| 다크 page `#111110` | primary `#f0ece6` | 15.3:1 | ✅ AA |
| 다크 page `#111110` | secondary `#b0a8a0` | 9.9:1 | ✅ AA |

#### 버튼

| 배경 | 텍스트 | 대비율 | 기준 |
|------|--------|--------|------|
| ilp 라이트 `#1a1825` | `white` | 17.5:1 | ✅ AA |
| ilp 다크 `#f0ece6` | `#1a1825` | 14.8:1 | ✅ AA |

#### 공통 카드 border

> 카드 컴포넌트 어디에나 재사용. 라이트 → `card-border`, 다크 → `accent-border`(인디고).

| 모드 | 토큰 | 값 |
|------|------|----|
| 라이트 | `--color-card-border` | `#dcdcf0` |
| 다크 | `--color-accent-border` | `rgba(122,128,204,0.45)` |

#### 공통 배지

> 배지·필터 pill 등 인라인 레이블에 재사용하는 3가지 variant.

| variant | 모드 | 배경 | 텍스트 | 대비율 | 용도 예시 |
|---------|------|------|--------|--------|-----------|
| **hero** | 라이트 | 인디고 그라데이션 `#3d3d8f` | `white` | 9.28:1 ✅ | 최저가·주요 CTA 배지 |
| **hero** | 다크 | 인디고 그라데이션 `#3d3d8f` | `white` | 10.2:1 ✅ | 최저가·주요 CTA 배지 |
| **filled** | 라이트 | `--color-accent-pale` `#eaeaf8` | `--color-text-primary` `#1a1a2e` | 15:1 ✅ | 활성 필터·강조 배지 |
| **filled** | 다크 | `--color-accent-light` `#9da4e0` | `#1a1a18` | 7.95:1 ✅ | 활성 필터·정품 매칭 |
| **outline** | 라이트 | transparent | `--color-accent-muted` `#6868a8` + `accent-border` | 5.2:1 ✅ | 비활성 필터·보조 배지 |
| **outline** | 다크 | transparent | `--color-accent-light` `#9da4e0` + `accent-border` | 6.36:1 ✅ | 비활성 필터·보조 배지 |

#### 채팅 말풍선

| 배경 | 텍스트 | 대비율 | 기준 |
|------|--------|--------|------|
| 라이트 own `#7a80cc` | primary `#1a1a2e` | 4.70:1 | ✅ AA |
| 라이트 own `#7a80cc` | page bg `#f7f5f2` | 3.33:1 | ✅ UI구분 |
| 라이트 other/ai `#fffcfa` | primary `#1a1a2e` | 16.70:1 | ✅ AA |
| 다크 own `#5c64a4` | primary `#f0ece6` | 4.68:1 | ✅ AA |
| 다크 own `#5c64a4` | page bg `#111110` | 3.53:1 | ✅ UI구분 |
| 다크 other/ai `#1a1a18` | primary `#f0ece6` | 14.81:1 | ✅ AA |

#### 사이드바 활성 상태

| 배경 | 대상 | 대비율 | 비고 |
|------|------|--------|------|
| 라이트 active `#eaeaf8` | page `#f7f5f2` | 1.10:1 | 좌측 바 8.35:1로 WCAG 충족 |
| 라이트 active `#eaeaf8` | text `#1a1a2e` | 14.31:1 | ✅ AA |
| 다크 active `rgba(61,61,143,0.30)` ≈ `#222238` | page `#111110` | 1.32:1 | 좌측 바 4.90:1로 WCAG 충족 |
| 다크 active `rgba(61,61,143,0.30)` ≈ `#222238` | text `#f0ece6` | 12.5:1 | ✅ AA |
| 좌측 바 라이트 `#3d3d8f` | page `#f7f5f2` | 8.35:1 | ✅ 주 인디케이터 |
| 좌측 바 다크 `#7a80cc` | page `#111110` | 4.90:1 | ✅ 주 인디케이터 |
| `--color-accent-interactive` 다크 `#7a80cc` | page `#111110` | 4.90:1 | ✅ AA |
| `--color-accent-interactive` 라이트 `#3d3d8f` | page `#f7f5f2` | 8.35:1 | ✅ AA |

> **다크 사이드바 제약**: 인디고 틴트 배경(1.32:1)은 page와 구분이 약하나, 좌측 바 `--color-accent`(4.90:1)가 WCAG 1.4.11 주 인디케이터 역할.

#### 드랍다운 메뉴 (ilp-select__menu)

| 배경 | 텍스트 | 대비율 | 기준 |
|------|--------|--------|------|
| 라이트 `#eaeaf8` (accent-pale) | `#2d2040` | 14.3:1 | ✅ AA |
| 다크 `#e8e8f8` | `#2d2040` | 13.7:1 | ✅ AA |

#### 채팅 UI 아이콘·버튼

| 배경 | 텍스트/아이콘 | 대비율 | 기준 |
|------|--------------|--------|------|
| 전송버튼 라이트 `#3d3d8f` | `white` | 9.28:1 | ✅ AA |
| 전송버튼 다크 `#7a80cc` | `#111110` | 4.90:1 | ✅ AA |
| 그룹아이콘 다크 `#4455b8` | `white` | 7.52:1 | ✅ AA |

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
border:         1px solid var(--color-card-border)        /* 라이트 */
border:         1px solid var(--color-accent-border)      /* 다크 — .dark 오버라이드 */
shadow rest:    0 2px 12px var(--color-shadow-soft)
shadow hover:   0 16px 40px var(--color-shadow-hover), 0 0 0 1px var(--color-accent-border)
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
