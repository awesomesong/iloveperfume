import { Suspense } from 'react';
import { getFragranceBySlugServer, getFragranceSlugsServer } from '@/src/app/lib/getFragrances';
import FragranceDetail from '@/src/app/components/fragrance/FragranceDetail';
import FragranceDetailSkeleton from '@/src/app/components/FragranceDetailSkeleton';
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

async function FragranceContent({ slug }: { slug: string }) {
  const { fragrance } = await getFragranceBySlugServer(slug);
  // 수집된 향수의 출처가 출시 기사면 화면에서 "공식 사이트"라고 적지 않는다. 확인하지 못하면 공식 사이트로 본다
  const fromLaunchArticle =
    fragrance.source === 'AI_AGENT' && fragrance.officialUrl
      ? await isLaunchArticleUrl(fragrance.officialUrl).catch(() => false)
      : false;
  return <FragranceDetail slug={slug} fragrance={fragrance} fromLaunchArticle={fromLaunchArticle} />;
}

export default async function FragrancePage({ params }: Props) {
  const { id: slug } = await params;

  return (
    <Suspense fallback={<FragranceDetailSkeleton />}>
      <FragranceContent slug={slug} />
    </Suspense>
  );
}
