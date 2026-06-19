'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { HiArrowRight } from 'react-icons/hi2';
import HomeImageUpload from '@/src/app/components/scan/HomeImageUpload';
import HomeAIChatInput from '@/src/app/components/main/HomeAIChatInput';

/* ──────────────────────────────────────────────
   데이터
────────────────────────────────────────────── */
const FEATURES = [
  {
    tag: 'AI Chat',
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
  },
  {
    tag: 'AI Vision',
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
  },
  {
    tag: 'AI Auto-fill',
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
  },
];

/* ──────────────────────────────────────────────
   PC 브라우저 목업 프레임
────────────────────────────────────────────── */
function BrowserFrame({ src, alt }: { src: string; alt: string }) {
  return (
    <div
      style={{
        borderRadius: '14px',
        background: 'linear-gradient(160deg, #282624 0%, #1a1816 40%, #0f0e0c 100%)',
        boxShadow: [
          '0 20px 48px rgba(0,0,0,0.28)',
          '0 8px 16px rgba(0,0,0,0.16)',
          'inset 0 1.5px 0 rgba(255,255,255,0.1)',
          'inset 0 -1px 0 rgba(0,0,0,0.4)',
        ].join(', '),
        padding: '1.5px',
      }}
    >
      <div style={{ borderRadius: '13px', overflow: 'hidden', background: '#0f0e0c' }}>
        {/* 툴바 */}
        <div
          style={{
            height: '36px',
            background: 'linear-gradient(180deg, #201e1c 0%, #181614 100%)',
            display: 'flex', alignItems: 'center', padding: '0 14px', gap: '10px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div style={{ display: 'flex', gap: '5px' }}>
            {(['#ff5f57', '#febc2e', '#28c840'] as const).map((color) => (
              <div key={color} style={{ width: '9px', height: '9px', borderRadius: '50%', background: color, boxShadow: `0 0 4px ${color}66` }} />
            ))}
          </div>
          <div style={{ flex: 1, height: '20px', borderRadius: '5px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'rgba(80,200,120,0.7)' }} />
            <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.02em' }}>iloveperfume.co.kr</span>
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            {[1, 2, 3].map((i) => (
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
          />
          <div aria-hidden style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '30%', background: 'linear-gradient(to bottom, transparent, rgba(10,9,8,0.85))', pointerEvents: 'none', zIndex: 5 }} />
          <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 25%, transparent 50%)', pointerEvents: 'none', zIndex: 6 }} />
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────
   폰 프레임
────────────────────────────────────────────── */
function PhoneFrame({ src, alt, aspectRatio = '9 / 19.5' }: { src: string; alt: string; aspectRatio?: string }) {
  return (
    <motion.div
      className="relative shrink-0"
      style={{ width: 'clamp(130px, 16vw, 190px)' }}
      animate={{ y: [0, -10, 0] }}
      transition={{ duration: 5.2, repeat: Infinity, ease: 'easeInOut' }}
    >
      <div aria-hidden style={{ position: 'absolute', bottom: '-24px', left: '-12%', right: '-12%', height: '48px', background: 'rgba(180,170,160,0.12)', filter: 'blur(32px)', borderRadius: '50%', zIndex: -1 }} />
      <div style={{ borderRadius: '1.5rem', padding: '4px', background: 'linear-gradient(148deg, #2c2a28 0%, #1a1816 18%, #0f0e0c 45%, #161412 70%, #222020 88%, #1c1a18 100%)', boxShadow: ['0 18px 44px rgba(0,0,0,0.32)', '0 6px 14px rgba(0,0,0,0.2)', 'inset 0 2px 0 rgba(255,255,255,0.12)'].join(', ') }}>
        <div style={{ borderRadius: '1.2rem', padding: '1.5px', background: '#0c0b0a', boxShadow: 'inset 0 0 0 0.5px rgba(255,255,255,0.06)' }}>
          <div className="relative overflow-hidden flex flex-col" style={{ borderRadius: '1.1rem', background: '#0a0908' }}>
            {/* 상태바 */}
            <div aria-hidden style={{ height: '20px', flexShrink: 0, background: '#0a0908', position: 'relative', zIndex: 12 }}>
              <div aria-hidden style={{ position: 'absolute', top: '4px', left: '50%', transform: 'translateX(-50%)', width: '22%', height: '10px', background: '#1a1a18', borderRadius: '99px' }} />
            </div>
            {/* 이미지 — 비율 그대로 */}
            <div className="relative" style={{ width: '100%', aspectRatio }}>
              <Image src={src} alt={alt} fill className="object-cover object-top" sizes="(max-width: 1024px) 220px, (max-width: 1280px) 160px, 190px" priority />
            </div>
            <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'none', background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 22%, transparent 48%)' }} />
          </div>
        </div>
      </div>
      <div aria-hidden style={{ position: 'absolute', left: '-4px', top: '14.5%', width: '4px', height: '3.5%', background: 'linear-gradient(180deg, #2e2c2a 0%, #1a1816 50%, #222020 100%)', borderRadius: '3px 0 0 3px' }} />
      <div aria-hidden style={{ position: 'absolute', left: '-4px', top: '21%', width: '4px', height: '6.5%', background: 'linear-gradient(180deg, #2e2c2a 0%, #1a1816 50%, #222020 100%)', borderRadius: '3px 0 0 3px' }} />
      <div aria-hidden style={{ position: 'absolute', left: '-4px', top: '30%', width: '4px', height: '6.5%', background: 'linear-gradient(180deg, #2e2c2a 0%, #1a1816 50%, #222020 100%)', borderRadius: '3px 0 0 3px' }} />
      <div aria-hidden style={{ position: 'absolute', right: '-4px', top: '24%', width: '4px', height: '12%', background: 'linear-gradient(180deg, #2e2c2a 0%, #1a1816 50%, #222020 100%)', borderRadius: '0 3px 3px 0' }} />
    </motion.div>
  );
}

/* ──────────────────────────────────────────────
   모바일 전용 폰 프레임 (스크린샷)
────────────────────────────────────────────── */
function PhoneFrameStandalone({ src, alt, aspectRatio = '9 / 19.5' }: { src: string; alt: string; aspectRatio?: string }) {
  return (
    <motion.div
      className="relative mx-auto shrink-0 w-full"
      animate={{ y: [0, -11, 0] }}
      transition={{ duration: 5.2, repeat: Infinity, ease: 'easeInOut' }}
    >
      <div aria-hidden style={{ position: 'absolute', bottom: '-28px', left: '-10%', right: '-10%', height: '56px', background: 'rgba(180,170,160,0.12)', filter: 'blur(36px)', borderRadius: '50%', zIndex: -1 }} />
      <div style={{ borderRadius: '1.5rem', padding: '4.5px', background: 'linear-gradient(148deg, #2c2a28 0%, #1a1816 18%, #0f0e0c 45%, #161412 70%, #222020 88%, #1c1a18 100%)', boxShadow: ['0 20px 48px rgba(0,0,0,0.36)', '0 6px 16px rgba(0,0,0,0.22)', 'inset 0 2px 0 rgba(255,255,255,0.12)'].join(', ') }}>
        <div style={{ borderRadius: '1.2rem', padding: '1.5px', background: '#0c0b0a' }}>
          <div className="relative overflow-hidden flex flex-col" style={{ borderRadius: '1.1rem', background: '#0a0908' }}>
            {/* 상태바 */}
            <div aria-hidden style={{ height: '24px', flexShrink: 0, background: '#0a0908', position: 'relative', zIndex: 12 }}>
              <div aria-hidden style={{ position: 'absolute', top: '5px', left: '50%', transform: 'translateX(-50%)', width: '22%', height: '12px', background: '#1a1a18', borderRadius: '99px' }} />
            </div>
            {/* 이미지 — 비율 그대로 */}
            <div className="relative" style={{ width: '100%', aspectRatio }}>
              <Image src={src} alt={alt} fill className="object-cover object-top" sizes="(max-width: 768px) 280px, 220px" priority />
            </div>
            <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'none', background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 48%)' }} />
          </div>
        </div>
      </div>
      <div aria-hidden style={{ position: 'absolute', left: '-5px', top: '14.5%', width: '5px', height: '3.5%', background: 'linear-gradient(180deg, #2e2c2a 0%, #1a1816 50%, #222020 100%)', borderRadius: '3px 0 0 3px' }} />
      <div aria-hidden style={{ position: 'absolute', left: '-5px', top: '21%', width: '5px', height: '6.5%', background: 'linear-gradient(180deg, #2e2c2a 0%, #1a1816 50%, #222020 100%)', borderRadius: '3px 0 0 3px' }} />
      <div aria-hidden style={{ position: 'absolute', left: '-5px', top: '30%', width: '5px', height: '6.5%', background: 'linear-gradient(180deg, #2e2c2a 0%, #1a1816 50%, #222020 100%)', borderRadius: '3px 0 0 3px' }} />
      <div aria-hidden style={{ position: 'absolute', right: '-5px', top: '24%', width: '5px', height: '12%', background: 'linear-gradient(180deg, #2e2c2a 0%, #1a1816 50%, #222020 100%)', borderRadius: '0 3px 3px 0' }} />
    </motion.div>
  );
}

/* ──────────────────────────────────────────────
   목업 그룹 (브라우저 + 폰)
────────────────────────────────────────────── */
function MockupGroup({ src, webSrc, alt, flip, phoneAspectRatio }: { src: string; webSrc: string; alt: string; flip: boolean; phoneAspectRatio?: string }) {
  return (
    <>
      {/* 모바일: 폰만 */}
      <div className="flex justify-center lg:hidden">
        <motion.div
          initial={{ opacity: 0, y: 48 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          style={{ width: 'clamp(220px, 55vw, 280px)' }}
        >
          <PhoneFrameStandalone src={src} alt={alt} aspectRatio={phoneAspectRatio} />
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
          transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* 브라우저 프레임 */}
          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 6.4, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
            style={{ paddingBottom: '60px' }}
          >
            <BrowserFrame src={webSrc} alt={alt} />
          </motion.div>

          {/* 폰 프레임 */}
          <div
            className="absolute bottom-0 z-10"
            style={{
              [flip ? 'left' : 'right']: '0px',
              transform: flip ? 'translateX(-10%)' : 'translateX(10%)',
            }}
          >
            <PhoneFrame src={src} alt={alt} aspectRatio={phoneAspectRatio} />
          </div>

          {/* 배경 glow */}
          <div aria-hidden style={{ position: 'absolute', bottom: '10%', left: '50%', transform: 'translateX(-50%)', width: '60%', height: '40px', background: 'radial-gradient(ellipse, rgba(90,55,160,0.25) 0%, transparent 70%)', filter: 'blur(24px)', zIndex: -1 }} />
        </motion.div>
      </div>
    </>
  );
}

/* ──────────────────────────────────────────────
   단계 안내 — 타임라인 스타일
────────────────────────────────────────────── */
function StepList({ steps }: { steps: { label: string; desc: string }[] }) {
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
          transition={{ duration: 0.45, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* 원형 마커 — 장식용, 숫자 없음 */}
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
   개별 쇼케이스 섹션
────────────────────────────────────────────── */
function ShowcaseSection({ feature }: { feature: (typeof FEATURES)[number] }) {
  const { tag, headline, steps, badges, cta, href, image, webImage, imageAlt, flip, phoneAspectRatio } = feature;

  return (
    <div
      className={[
        'flex flex-col items-center gap-10 lg:gap-12 xl:gap-16',
        flip ? 'lg:flex-row-reverse' : 'lg:flex-row',
      ].join(' ')}
    >
      <MockupGroup src={image} webSrc={webImage} alt={imageAlt} flip={flip} phoneAspectRatio={phoneAspectRatio} />

      <motion.div
        className="flex-1 flex flex-col gap-8 min-w-0"
        initial={{ opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.7, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* 태그 — 12px, text-secondary 6.71:1 ✅ / 다크: text-accent(#7a80cc) 4.9:1 ✅ — 모바일은 섹션 헤더에서 표시하므로 숨김 */}
        <span
          className="hidden lg:inline text-xs font-semibold tracking-[0.16em] uppercase text-secondary dark:text-accent"
        >
          {tag}
        </span>

        {/* 헤드라인 */}
        <h2
          className="font-pretendard font-normal text-fg-primary leading-[1.3] tracking-[-0.01em]"
          style={{ fontSize: 'clamp(1.35rem, 2.6vw, 2rem)' }}
        >
          {headline}
        </h2>

        {/* 스텝 */}
        <StepList steps={steps} />

        {/* 기술 스택 — 12px, text-secondary 6.71:1 ✅ */}
        <p className="text-xs text-secondary" aria-label="사용 기술">
          {badges.join(' · ')}
        </p>

        {/* CTA */}
        {tag === 'AI Chat' ? (
          <HomeAIChatInput />
        ) : (
          <Link href={href} className="action-btn self-start">
            {cta}
            <HiArrowRight className="size-3.5 shrink-0" aria-hidden />
          </Link>
        )}
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
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
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

      <div className="flex flex-col gap-0">
        {FEATURES.map((feature, i) => {
          const isVision = i === 1;
          const sectionNum = String(i + 1).padStart(2, '0');

          return (
            <div key={feature.href} id={isVision ? 'scan' : undefined}>
              {isVision ? (
                /* AI Vision — 설명(좌) + 목업·체험(우) */
                <div className="pt-5 pb-7 lg:py-24 lg:rounded-none rounded-2xl lg:border-0 border border-[var(--color-accent-border)] lg:bg-transparent bg-[var(--color-card-bg)] px-4 lg:px-0 mb-4 lg:mb-0">
                  {/* 모바일 섹션 헤더 */}
                  <div className="flex items-center gap-3 mb-6 lg:hidden">
                    <span className="text-[10px] font-bold tracking-[0.16em] text-[var(--color-accent)] uppercase opacity-50">{sectionNum}</span>
                    <span className="text-[10px] font-semibold tracking-[0.14em] uppercase px-2.5 py-1 rounded-full border border-[var(--color-accent-border)] text-[var(--color-text-secondary)]">{feature.tag}</span>
                  </div>
                  <div className="flex flex-col lg:flex-row items-start gap-12 lg:gap-16 xl:gap-20">

                    {/* 왼쪽: 기능 설명 — 스크롤 시 sticky */}
                    <motion.div
                      className="flex-1 flex flex-col justify-center gap-8 min-w-0 lg:sticky lg:top-24"
                      initial={{ opacity: 0, x: -24 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true, margin: '-60px' }}
                      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <span
                        className="hidden lg:inline self-start text-[0.6rem] font-semibold tracking-[0.14em] uppercase px-3 py-1 rounded-full border border-black/20 dark:border-white/20 text-black/60 dark:text-white/60"
                      >
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
                      transition={{ duration: 0.75, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
                    >
                      {/* 브라우저 + 폰 목업 — 나란히, 겹침 없이 */}
                      <div className="relative">
                        {/* 브라우저 프레임 — 오른쪽에 폰이 겹칠 공간 확보 */}
                        <div style={{ paddingRight: '18%' }}>
                          <BrowserFrame src={feature.webImage} alt={feature.imageAlt} />
                        </div>
                        {/* 폰 프레임 — 브라우저 오른쪽에 살짝 겹쳐서 올림 */}
                        <div
                          className="absolute bottom-0 right-0 z-10"
                          style={{ width: 'clamp(110px, 26%, 160px)' }}
                        >
                          <PhoneFrameStandalone
                            src={feature.image}
                            alt={feature.imageAlt}
                            aspectRatio={feature.phoneAspectRatio}
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
                </div>
              ) : (
                <div className="pt-5 pb-7 lg:py-12 lg:rounded-none rounded-2xl lg:border-0 border border-[var(--color-accent-border)] lg:bg-transparent bg-[var(--color-card-bg)] px-4 lg:px-0 mb-4 lg:mb-0">
                  {/* 모바일 섹션 헤더 */}
                  <div className="flex items-center gap-3 mb-6 lg:hidden">
                    <span className="text-[10px] font-bold tracking-[0.16em] text-[var(--color-accent)] uppercase opacity-50">{sectionNum}</span>
                    <span className="text-[10px] font-semibold tracking-[0.14em] uppercase px-2.5 py-1 rounded-full border border-[var(--color-accent-border)] text-[var(--color-text-secondary)]">{feature.tag}</span>
                  </div>
                  <ShowcaseSection feature={feature} />
                </div>
              )}

              {i < FEATURES.length - 1 && (
                <div className="hidden lg:block h-px w-16 mx-auto my-0 rounded-full opacity-30" style={{ background: 'var(--color-accent-border)' }} aria-hidden />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
