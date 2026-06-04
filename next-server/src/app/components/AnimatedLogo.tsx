'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const chars = ['아', '이', '러', '브', '퍼', '퓸'];
// 왼쪽에서 오른쪽으로 순서대로 — 명조체엔 바운스보다 흐르는 느낌이 잘 맞음
const ENTER_DELAYS = chars.map((_, i) => i * 0.08);

export default function AnimatedLogo() {
  const [play, setPlay] = useState(false);

  useEffect(() => {
    const trigger = () => setPlay(true);
    if (document.readyState === 'complete') {
      trigger();
    } else {
      window.addEventListener('load', trigger, { once: true });
    }
    return () => window.removeEventListener('load', trigger);
  }, []);

  return (
    <Link href="/" className="inline-flex items-center leading-none select-none">
      <div className="flex items-baseline gap-[1px]">
        {chars.map((char, i) => (
          <motion.span
            key={i}
            className="font-pretendard text-[18px] font-medium tracking-[0.02em] text-text-primary inline-block"
            // initial 없음 → SSR/로딩 중 그대로 보임
            animate={play ? { y: [0, -7, 0] } : {}}
            transition={play ? {
              delay:    ENTER_DELAYS[i],
              duration: 0.65,
              ease:     [0.22, 1, 0.36, 1],
            } : {}}
          >
            {char}
          </motion.span>
        ))}
      </div>
    </Link>
  );
}
