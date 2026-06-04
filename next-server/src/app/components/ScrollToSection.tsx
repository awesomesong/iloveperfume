'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * URL ?section=<id> 쿼리스트링이 있으면 해당 id를 가진 요소로 부드럽게 스크롤.
 * 서버 컴포넌트인 페이지에 삽입해 사용.
 */
export default function ScrollToSection() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const sectionId = searchParams.get('section');
    if (!sectionId) return;

    const target = document.getElementById(sectionId);
    if (!target) return;

    // 레이아웃이 그려진 뒤 스크롤
    const raf = requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return () => cancelAnimationFrame(raf);
  }, [searchParams]);

  return null;
}
