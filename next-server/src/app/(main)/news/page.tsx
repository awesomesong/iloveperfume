import Notices from '@/src/app/components/Notices';
import PageIntro from '@/src/app/components/PageIntro';

// 목록형 뉴스 페이지 — 스타일 기준은 docs/design-system.md "뉴스 목록 패턴" 참고
const NewsPage = () => {
    return (
        <div className="news-page">
            <PageIntro
                title="향수 뉴스"
                description="국내 향수 신제품과 브랜드 소식을 모아 요약해 전합니다."
            />
            <Notices />
        </div>
    );
}

export default NewsPage;
