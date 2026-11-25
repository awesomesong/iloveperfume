import { notFound } from 'next/navigation';
import { after } from 'next/server';
import { getFragranceBySlugServer, getFragranceSlugsServer } from '@/src/app/lib/getFragrances';
import FragranceDetail from '@/src/app/components/fragrance/FragranceDetail';
import { ensureKoreanName, getCachedKoreanName } from '@/src/app/lib/scan/koreanName';
import { isLaunchArticleUrl } from '@/src/app/lib/arrivals/sourceStore';

// 향수 상세는 데이터 변경 빈도가 낮으므로 ISR로 캐싱 (1시간)
export const revalidate = 3600;

// 빌드 시 모든 향수 슬러그를 미리 정적 생성하고,
// 이후 추가되는 향수는 첫 요청 시 on-demand 렌더링 후 ISR 캐시에 저장됨
export async function generateStaticParams() {
  const slugs = await getFragranceSlugsServer();
  return slugs.map((slug) => ({ id: slug }));
}

type Props = {
  params: Promise<{ id: string }>;
};

export default async function FragrancePage({ params }: Props) {
  const { id: slug } = await params;

  // Suspense 밖에서 확인해야 응답 코드가 404가 된다 — 스트리밍이 시작된 뒤 notFound()를 부르면 200으로 나간다
  const fragrance = await getFragranceBySlugServer(slug);
  if (!fragrance) notFound();

  // 네이버 쇼핑 검색 링크용 한글 이름 — 캐시만 읽어 렌더를 막지 않는다.
  // 없으면 영문 이름으로 링크를 만들고, 응답 후에 음역해 두어 다음 재생성부터 한글로 검색된다.
  // 수집된 향수의 출처가 출시 기사면 화면에서 "공식 사이트"라고 적지 않는다. 확인하지 못하면 공식 사이트로 본다
  const [koreanName, fromLaunchArticle] = await Promise.all([
    getCachedKoreanName(fragrance.brand, fragrance.name),
    fragrance.source === 'AI_AGENT' && fragrance.officialUrl
      ? isLaunchArticleUrl(fragrance.officialUrl).catch(() => false)
      : Promise.resolve(false),
  ]);
  if (!koreanName) {
    after(() => ensureKoreanName(fragrance.brand, fragrance.name));
  }

  return (
    <FragranceDetail
      slug={slug}
      fragrance={fragrance}
      koreanName={koreanName}
      fromLaunchArticle={fromLaunchArticle}
    />
  );
}
