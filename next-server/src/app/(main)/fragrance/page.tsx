import type { Metadata } from 'next';
import FragranceList from '@/src/app/components/fragrance/FragranceList';
import PageIntro from '@/src/app/components/PageIntro';

const title = '향수 컬렉션 | I Love Perfume';
const description = '브랜드 공식 사이트에서 모은 신제품과 회원이 직접 등록한 향수를 한곳에서 살펴보세요.';

export const metadata: Metadata = {
    title,
    description,
    alternates: { canonical: 'https://iloveperfume.co.kr/fragrance' },
    openGraph: {
        title,
        description,
        url: 'https://iloveperfume.co.kr/fragrance',
        type: 'website',
        images: [{ url: '/image/metadata/main_web.png', width: 1200, height: 630 }],
    },
    keywords: ['I Love Perfume', '향수', '향수 신제품', '니치 향수', '향수 컬렉션'],
};

// 목록형 향수 페이지 — 스타일 기준은 docs/design-system.md "향수 목록 패턴" 참고
const FragranceListPage = () => {
    return (
        <div className="fragrance-list-page">
            <PageIntro title="향수 컬렉션" description={description} />
            <FragranceList />
        </div>
    );
};

export default FragranceListPage;
