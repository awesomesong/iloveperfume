'use client';

import type { CSSProperties } from 'react';
import clsx from 'clsx';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { HiArrowRight, HiLockClosed } from 'react-icons/hi2';
import HomeImageUpload from '@/src/app/components/scan/HomeImageUpload';
import HomeAIChatInput from '@/src/app/components/main/HomeAIChatInput';

/* ──────────────────────────────────────────────
   상수
────────────────────────────────────────────── */
const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

const BROWSER_SHADOW = [
  '0 20px 48px rgba(0,0,0,0.28)',
  '0 8px 16px rgba(0,0,0,0.16)',
  'inset 0 1.5px 0 rgba(255,255,255,0.1)',
  'inset 0 -1px 0 rgba(0,0,0,0.4)',
].join(', ');

const PHONE_GRADIENT = 'linear-gradient(148deg, #2c2a28 0%, #1a1816 18%, #0f0e0c 45%, #161412 70%, #222020 88%, #1c1a18 100%)';
const PHONE_SIDE_BUMP = 'linear-gradient(180deg, #2e2c2a 0%, #1a1816 50%, #222020 100%)';

const FEATURES = [
  {
    tag: 'AI Chat',
    showChatInput: true,
    headline: '향수에 대해 궁금한 점을 AI에게 물어보세요',
    steps: [
      { label: 'AI 채팅방에 들어가요', desc: '향수 AI 어시스턴트와 1:1로 대화할 수 있어요' },
      { label: '궁금한 것을 편하게 물어보세요', desc: '"향수를 처음 사려는데 뭐가 좋을까요?" 친구한테 묻듯이 편하게 적어보세요' },
      { label: '향수와 관련된 질문에 답해드려요', desc: '향수 추천부터 향의 계열, 브랜드 스토리까지 궁금한 점을 자유롭게 물어보세요' },
    ],
    badges: ['GPT-4o', 'Streaming', 'Socket.io'],
    cta: '채팅 시작하기',
    href: '/conversations/new?aiAgentType=assistant',
    image: '/image/notice/chat/conversation_ai/chat_ai_mobile04.png',
    webImage: '/image/notice/chat/conversation_ai/chat_ai_web04.png',
    imageAlt: 'AI 향수 추천 채팅 화면',
    flip: false,
    phoneAspectRatio: '780 / 1227',
    layout: 'default' as const,
  },
  {
    tag: 'AI Vision',
    showChatInput: false,
    headline: '카메라로 찍거나 사진을 올리면 상품 정보와 구매 링크를 바로 알려드려요',
    steps: [
      { label: '카메라로 찍거나 사진을 올려주세요', desc: '향수병에 적힌 브랜드나 제품명이 잘 보이게 찍어주세요' },
      { label: 'AI가 향수를 분석해요', desc: '향수병에 적힌 텍스트를 인식해서 어떤 제품인지 찾아드려요' },
      { label: '상품 정보와 구매 링크를 확인하세요', desc: '향수 상세 정보와 구매할 수 있는 링크를 바로 보여드려요' },
    ],
    badges: ['GPT-4o Vision', '2-pass 분석', 'Cloudinary'],
    cta: '지금 스캔하기',
    href: '/scan',
    image: '/showcase/scan.png',
    webImage: '/showcase/scan_web.png',
    imageAlt: '향수 스캔 화면',
    flip: true,
    phoneAspectRatio: '9 / 19.5',
    layout: 'vision' as const,
  },
  {
    tag: 'AI Auto-fill',
    showChatInput: false,
    headline: '향수 사진을 올리면 AI가 브랜드, 이름, 설명, 노트를 자동으로 분석해서 직접 검색하지 않아도 바로 기록할 수 있어요',
    steps: [
      { label: '향수 사진을 올려주세요', desc: '첫 번째 이미지를 AI가 자동으로 분석해요' },
      { label: 'AI가 정보를 자동으로 채워줘요', desc: '브랜드, 이름, 설명, 노트까지 한 번에 입력돼요' },
      { label: '확인하고 바로 기록해요', desc: '수정 후 저장하면 향수 컬렉션에 공개 등록돼요' },
    ],
    badges: ['GPT-4o Vision', 'Auto-fill', 'Prisma ORM'],
    cta: '향수 등록하기',
    href: '/fragrance/create',
    image: '/showcase/create.png',
    webImage: '/image/notice/fragrance/fragrance_create_web01.png',
    imageAlt: '향수 자동 등록 화면',
    flip: false,
    phoneAspectRatio: '9 / 19.5',
    layout: 'default' as const,
  },
] as const;

type Feature = (typeof FEATURES)[number];

/* ──────────────────────────────────────────────
   PC 브라우저 목업 프레임
────────────────────────────────────────────── */
const BROWSER_DOTS = ['#ff5f57', '#febc2e', '#28c840'] as const;

interface BrowserFrameProps {
  src: string;
  alt: string;
  priority?: boolean;
}

function BrowserFrame({ src, alt, priority = false }: BrowserFrameProps) {
  return (
    <div
      style={{
        borderRadius: '14px',
        background: 'linear-gradient(160deg, #282624 0%, #1a1816 40%, #0f0e0c 100%)',
        boxShadow: BROWSER_SHADOW,
        padding: '1.5px',
      }}
    >
      <div className="overflow-hidden" style={{ borderRadius: '13px', background: '#0f0e0c' }}>
        {/* 툴바 */}
        <div
          className="flex items-center"
          style={{
            height: '36px',
            background: 'linear-gradient(180deg, #201e1c 0%, #181614 100%)',
            padding: '0 14px', gap: '10px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div className="flex gap-[5px]">
            {BROWSER_DOTS.map((color) => (
              <div key={color} style={{ width: '9px', height: '9px', borderRadius: '50%', background: color, boxShadow: `0 0 4px ${color}66` }} />
            ))}
          </div>
          <div className="flex-1 flex items-center justify-center gap-[5px]" style={{ height: '20px', borderRadius: '5px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'rgba(80,200,120,0.7)' }} />
            <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.02em' }}>iloveperfume.co.kr</span>
          </div>
          <div className="flex gap-1">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} style={{ width: '14px', height: '14px', borderRadius: '3px', background: 'rgba(255,255,255,0.07)' }} />
            ))}
          </div>
        </div>
        {/* 화면 */}
        <div className="relative overflow-hidden" style={{ aspectRatio: '16 / 10', background: '#0a0908' }}>
          <Image
            src={src}
            alt={alt}
            fill
            className="object-cover object-top"
            sizes="(max-width: 1024px) 0px, (max-width: 1280px) 380px, 460px"
            priority={priority}
          />
          <div aria-hidden className="absolute bottom-0 left-0 right-0 pointer-events-none z-[5]" style={{ height: '30%', background: 'linear-gradient(to bottom, transparent, rgba(10,9,8,0.85))' }} />
          <div aria-hidden className="absolute inset-0 pointer-events-none z-[6]" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 25%, transparent 50%)' }} />
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────
   폰 프레임 (사이드 범프 공통)
────────────────────────────────────────────── */
const SIDE_BUMPS = [
  { side: 'left', top: '14.5%', height: '3.5%', borderRadius: '3px 0 0 3px' },
  { side: 'left', top: '21%',   height: '6.5%', borderRadius: '3px 0 0 3px' },
  { side: 'left', top: '30%',   height: '6.5%', borderRadius: '3px 0 0 3px' },
  { side: 'right', top: '24%',  height: '12%',  borderRadius: '0 3px 3px 0' },
] as const;

const PHONE_VARIANTS = {
  default: {
    bumpWidth: '4px',
    statusBarHeight: '20px',
    statusPillTop: '4px',
    statusPillHeight: '10px',
    outerPadding: '4px',
    shadow: '0 18px 44px rgba(0,0,0,0.32), 0 6px 14px rgba(0,0,0,0.2), inset 0 2px 0 rgba(255,255,255,0.12)',
    innerShadow: 'inset 0 0 0 0.5px rgba(255,255,255,0.06)',
    glowBottom: '-24px',
    glowSize: '48px',
    glowLR: '-12%',
    imageSizes: '(max-width: 1024px) 220px, (max-width: 1280px) 160px, 190px',
    floatY: [0, -10, 0] as number[],
    glassOverlay: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 22%, transparent 48%)',
    className: 'relative shrink-0',
    containerStyle: { width: 'clamp(130px, 16vw, 190px)' } as CSSProperties,
  },
  standalone: {
    bumpWidth: '5px',
    statusBarHeight: '24px',
    statusPillTop: '5px',
    statusPillHeight: '12px',
    outerPadding: '4.5px',
    shadow: '0 20px 48px rgba(0,0,0,0.36), 0 6px 16px rgba(0,0,0,0.22), inset 0 2px 0 rgba(255,255,255,0.12)',
    innerShadow: undefined,
    glowBottom: '-28px',
    glowSize: '56px',
    glowLR: '-10%',
    imageSizes: '(max-width: 768px) 280px, 220px',
    floatY: [0, -11, 0] as number[],
    glassOverlay: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 48%)',
    className: 'relative mx-auto shrink-0 w-full',
    containerStyle: undefined as CSSProperties | undefined,
  },
} as const;

interface PhoneFrameProps {
  src: string;
  alt: string;
  aspectRatio?: string;
  variant?: keyof typeof PHONE_VARIANTS;
  priority?: boolean;
}

function PhoneFrame({ src, alt, aspectRatio = '9 / 19.5', variant = 'default', priority = false }: PhoneFrameProps) {
  const v = PHONE_VARIANTS[variant];

  return (
    <motion.div
      className={v.className}
      style={v.containerStyle}
      animate={{ y: v.floatY }}
      transition={{ duration: 5.2, repeat: Infinity, ease: 'easeInOut' }}
    >
      <div aria-hidden className="absolute rounded-full z-[-1]" style={{ bottom: v.glowBottom, left: v.glowLR, right: v.glowLR, height: v.glowSize, background: 'rgba(180,170,160,0.12)', filter: 'blur(32px)' }} />
      <div style={{ borderRadius: '1.5rem', padding: v.outerPadding, background: PHONE_GRADIENT, boxShadow: v.shadow }}>
        <div style={{ borderRadius: '1.2rem', padding: '1.5px', background: '#0c0b0a', boxShadow: v.innerShadow }}>
          <div className="relative overflow-hidden flex flex-col" style={{ borderRadius: '1.1rem', background: '#0a0908' }}>
            {/* 상태바 */}
            <div aria-hidden className="relative shrink-0 z-[12]" style={{ height: v.statusBarHeight, background: '#0a0908' }}>
              <div aria-hidden style={{ position: 'absolute', top: v.statusPillTop, left: '50%', transform: 'translateX(-50%)', width: '22%', height: v.statusPillHeight, background: '#1a1a18', borderRadius: '99px' }} />
            </div>
            {/* 이미지 */}
            <div className="relative" style={{ width: '100%', aspectRatio }}>
              <Image src={src} alt={alt} fill className="object-cover object-top" sizes={v.imageSizes} priority={priority} />
            </div>
            <div aria-hidden className="absolute inset-0 z-10 pointer-events-none" style={{ background: v.glassOverlay }} />
          </div>
        </div>
      </div>
      {SIDE_BUMPS.map(({ side, top, height, borderRadius }) => (
        <div
          key={`${side}-${top}`}
          aria-hidden
          style={{
            position: 'absolute',
            [side]: `-${v.bumpWidth}`,
            top,
            width: v.bumpWidth,
            height,
            background: PHONE_SIDE_BUMP,
            borderRadius,
          }}
        />
      ))}
    </motion.div>
  );
}

/* ──────────────────────────────────────────────
   목업 그룹 (브라우저 + 폰)
────────────────────────────────────────────── */
interface MockupGroupProps {
  src: string;
  webSrc: string;
  alt: string;
  flip: boolean;
  phoneAspectRatio?: string;
  priority?: boolean;
}

function MockupGroup({ src, webSrc, alt, flip, phoneAspectRatio, priority = false }: MockupGroupProps) {
  return (
    <>
      {/* 모바일: 폰만 */}
      <div className="flex justify-center lg:hidden">
        <motion.div
          initial={{ opacity: 0, y: 48 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.8, ease: EASE_OUT }}
          style={{ width: 'clamp(220px, 55vw, 280px)' }}
        >
          <PhoneFrame src={src} alt={alt} aspectRatio={phoneAspectRatio} variant="standalone" priority={priority} />
        </motion.div>
      </div>

      {/* PC: 브라우저(PC 스크린샷) + 폰(모바일 스크린샷) */}
      <div
        className="hidden lg:flex w-full lg:w-[52%] xl:w-[48%] shrink-0 items-end justify-center"
        style={{ minHeight: '380px' }}
      >
        <motion.div
          className="relative w-full"
          initial={{ opacity: 0, y: 48 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.85, ease: EASE_OUT }}
        >
          {/* 브라우저 프레임 */}
          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 6.4, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
            style={{ paddingBottom: '60px' }}
          >
            <BrowserFrame src={webSrc} alt={alt} priority={priority} />
          </motion.div>

          {/* 폰 프레임 */}
          <div
            className="absolute bottom-0 z-10"
            style={{
              [flip ? 'left' : 'right']: '0px',
              transform: flip ? 'translateX(-10%)' : 'translateX(10%)',
            }}
          >
            <PhoneFrame src={src} alt={alt} aspectRatio={phoneAspectRatio} priority={priority} />
          </div>

          {/* 배경 glow */}
          <div aria-hidden className="absolute z-[-1]" style={{ bottom: '10%', left: '50%', transform: 'translateX(-50%)', width: '60%', height: '40px', background: 'radial-gradient(ellipse, rgba(90,55,160,0.25) 0%, transparent 70%)', filter: 'blur(24px)' }} />
        </motion.div>
      </div>
    </>
  );
}

/* ──────────────────────────────────────────────
   단계 안내 — 타임라인 스타일
────────────────────────────────────────────── */
interface StepListProps {
  steps: readonly { label: string; desc: string }[];
}

function StepList({ steps }: StepListProps) {
  return (
    <ol className="relative flex flex-col">
      {/* 연결선 (장식) */}
      <div
        aria-hidden
        className="absolute left-[7px] top-3 bottom-3 w-px"
        style={{ background: 'var(--color-accent-border)' }}
      />
      {steps.map(({ label, desc }, i) => (
        <motion.li
          key={label}
          className="relative flex items-start gap-4 pb-7 last:pb-0"
          initial={{ opacity: 0, x: -10 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: '-20px' }}
          transition={{ duration: 0.45, delay: i * 0.08, ease: EASE_OUT }}
        >
          {/* 원형 마커 — 장식용 */}
          <div
            aria-hidden
            className="relative z-10 shrink-0 mt-[5px] size-[15px] rounded-full"
            style={{
              background: 'var(--color-accent-pale)',
              border: '1.5px solid var(--color-accent-border)',
            }}
          />

          <div className="flex flex-col gap-1 min-w-0">
            {/* 14px, text-primary: 13.86:1 ✅ */}
            <span
              className="font-medium text-sm leading-snug"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {label}
            </span>
            {/* 14px, text-secondary: 6.71:1 ✅ */}
            <span className="text-sm leading-relaxed text-secondary">
              {desc}
            </span>
          </div>
        </motion.li>
      ))}
    </ol>
  );
}

/* ──────────────────────────────────────────────
   모바일 섹션 헤더
────────────────────────────────────────────── */
interface MobileSectionHeaderProps {
  sectionNum: string;
  tag: string;
}

function MobileSectionHeader({ sectionNum, tag }: MobileSectionHeaderProps) {
  return (
    <div className="flex items-center gap-3 mb-6 lg:hidden">
      <span className="text-[10px] font-bold tracking-[0.16em] text-[var(--color-accent)] uppercase opacity-50">{sectionNum}</span>
      <span className="text-[10px] font-semibold tracking-[0.14em] uppercase px-2.5 py-1 rounded-full border border-[var(--color-accent-border)] text-[var(--color-text-secondary)]">{tag}</span>
    </div>
  );
}

/* ──────────────────────────────────────────────
   개별 쇼케이스 섹션 (default layout)
────────────────────────────────────────────── */
interface SectionProps {
  feature: Feature;
  priority?: boolean;
}

function ShowcaseSection({ feature, priority = false }: SectionProps) {
  const { tag, headline, steps, badges, cta, href, image, webImage, imageAlt, flip, phoneAspectRatio, showChatInput } = feature;

  return (
    <div
      className={clsx(
        'flex flex-col items-center gap-10 lg:gap-12 xl:gap-16',
        flip ? 'lg:flex-row-reverse' : 'lg:flex-row',
      )}
    >
      <MockupGroup src={image} webSrc={webImage} alt={imageAlt} flip={flip} phoneAspectRatio={phoneAspectRatio} priority={priority} />

      <motion.div
        className="flex-1 flex flex-col gap-8 min-w-0"
        initial={{ opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.7, delay: 0.18, ease: EASE_OUT }}
      >
        {/* 태그 — 모바일은 섹션 헤더에서 표시하므로 숨김 */}
        <span className="hidden lg:inline text-xs font-semibold tracking-[0.16em] uppercase text-secondary dark:text-accent">
          {tag}
        </span>

        {/* 헤드라인 */}
        <h2
          className="font-pretendard font-normal text-fg-primary leading-[1.3] tracking-[-0.01em]"
          style={{ fontSize: 'clamp(1.35rem, 2.6vw, 2rem)' }}
        >
          {headline}
        </h2>

        <StepList steps={steps} />

        {/* 기술 스택 — 12px, text-secondary 6.71:1 ✅ */}
        <div className="flex flex-wrap gap-2" aria-label="사용 기술">
          {badges.map((badge) => (
            <span key={badge} className="footer-stack-badge">{badge}</span>
          ))}
        </div>

        {/* CTA */}
        <div className="flex flex-col gap-3">
          {showChatInput ? (
            <HomeAIChatInput />
          ) : (
            <Link href={href} className="action-btn self-start">
              {cta}
              <HiArrowRight className="size-3.5 shrink-0" aria-hidden />
            </Link>
          )}
          <p className="flex items-baseline gap-1 text-xs text-secondary">
            <HiLockClosed className="size-3 shrink-0" aria-hidden />
            로그인 후 이용할 수 있어요
          </p>
        </div>
      </motion.div>
    </div>
  );
}

/* ──────────────────────────────────────────────
   AI Vision 레이아웃 (vision layout)
────────────────────────────────────────────── */
function VisionSection({ feature, priority = false }: SectionProps) {
  return (
    <div className="flex flex-col lg:flex-row items-start gap-12 lg:gap-16 xl:gap-20">
      {/* 왼쪽: 기능 설명 — 스크롤 시 sticky */}
      <motion.div
        className="flex-1 flex flex-col justify-center gap-8 min-w-0 lg:sticky lg:top-24"
        initial={{ opacity: 0, x: -24 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.7, ease: EASE_OUT }}
      >
        <span className="hidden lg:inline self-start text-[0.6rem] font-semibold tracking-[0.14em] uppercase px-3 py-1 rounded-full border border-black/20 dark:border-white/20 text-black/60 dark:text-white/60">
          {feature.tag}
        </span>

        <h2
          className="font-pretendard font-normal text-fg-primary leading-[1.3] tracking-[-0.01em]"
          style={{ fontSize: 'clamp(1.35rem, 2.6vw, 2rem)' }}
        >
          {feature.headline}
        </h2>

        <StepList steps={feature.steps} />

        <div className="flex flex-wrap gap-2" aria-label="사용 기술">
          {feature.badges.map((badge) => (
            <span key={badge} className="footer-stack-badge">{badge}</span>
          ))}
        </div>
      </motion.div>

      {/* 오른쪽: 목업 이미지 + 체험 UI */}
      <motion.div
        className="w-full lg:w-[52%] shrink-0 flex flex-col gap-8"
        initial={{ opacity: 0, x: 24 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.75, delay: 0.1, ease: EASE_OUT }}
      >
        {/* 브라우저 + 폰 목업 — 나란히, 겹침 없이 */}
        <div className="relative">
          <div style={{ paddingRight: '18%' }}>
            <BrowserFrame src={feature.webImage} alt={feature.imageAlt} priority={priority} />
          </div>
          <div
            className="absolute bottom-0 right-0 z-10"
            style={{ width: 'clamp(110px, 26%, 160px)' }}
          >
            <PhoneFrame
              src={feature.image}
              alt={feature.imageAlt}
              aspectRatio={feature.phoneAspectRatio}
              variant="standalone"
              priority={priority}
            />
          </div>
        </div>

        {/* 구분선 */}
        <div className="h-px bg-black/8 dark:bg-white/8" />

        {/* 체험 카드 */}
        <div
          className="rounded-[20px] sm:rounded-[24px] p-3 sm:p-5 md:p-8"
          style={{
            background: 'var(--color-card-bg)',
            border: '1px solid var(--color-card-border)',
            boxShadow: '0 2px 16px var(--color-shadow-soft)',
          }}
        >
          <HomeImageUpload />
        </div>
      </motion.div>
    </div>
  );
}

/* ──────────────────────────────────────────────
   메인 export
────────────────────────────────────────────── */
export default function FeatureShowcase() {
  return (
    <section
      className="w-full px-4 md:px-8 pb-20 md:pb-28 max-w-[1440px] mx-auto"
      aria-label="기능 소개"
    >
      <motion.div
        className="text-center pt-28 pb-16 min-[480px]:py-16 md:py-24 flex flex-col items-center gap-5"
        initial={{ opacity: 0, y: 22 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, ease: EASE_OUT }}
      >
        <p className="text-xs tracking-[0.18em] font-medium text-secondary uppercase">I Love Perfume</p>
        <h2
          className="font-pretendard font-semibold tracking-[-0.02em] text-gradient-scent"
          style={{ fontSize: 'clamp(1.45rem, 3vw, 2.1rem)', lineHeight: 1.25 }}
        >
          향수를 처음 시작하는 분들을 위한 AI 향수 가이드
        </h2>
        <div className="flex flex-col gap-1 leading-relaxed text-secondary text-center" style={{ fontSize: 'clamp(0.875rem, 1.4vw, 1rem)' }}>
          <p>AI 어시스턴트가 취향에 꼭 맞는 향수를 추천해드려요.</p>
          <p>향수를 스캔하면 제품 정보와 구매처를 바로 알려드려요.</p>
          <p>사진 한 장으로 향수 정보를 자동으로 등록할 수 있어요.</p>
        </div>
      </motion.div>

      <div className="flex flex-col">
        {FEATURES.map((feature, i) => {
          const sectionNum = String(i + 1).padStart(2, '0');
          const isVision = feature.layout === 'vision';

          return (
            <div key={feature.href} id={isVision ? 'scan' : undefined}>
              <div className={clsx(
                'pt-5 pb-7 lg:rounded-none rounded-2xl lg:border-0 border border-[var(--color-accent-border)] lg:bg-transparent bg-[var(--color-card-bg)] px-4 lg:px-0 mb-4 lg:mb-0',
                isVision ? 'lg:py-24' : 'lg:py-12',
              )}>
                <MobileSectionHeader sectionNum={sectionNum} tag={feature.tag} />
                {isVision
                  ? <VisionSection feature={feature} priority={i === 0} />
                  : <ShowcaseSection feature={feature} priority={i === 0} />
                }
              </div>

              {i < FEATURES.length - 1 && (
                <div className="hidden lg:block h-px w-16 mx-auto rounded-full opacity-30" style={{ background: 'var(--color-accent-border)' }} aria-hidden />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
