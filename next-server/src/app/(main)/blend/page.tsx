import type { Metadata, ResolvingMetadata } from 'next';
import BlendGame from '@/src/app/components/blend/BlendGame';
import BottleDefs from '@/src/app/components/blend/BottleDefs';
import { BLEND_PAGE_TITLE, blendPageTitle, parseBlendParams, type BlendSearchParams } from '@/src/app/lib/blend/blendParams';

type Props = { searchParams: Promise<BlendSearchParams> };

const DESCRIPTION = '병을 고르고 향을 섞어 나만의 향수를 만들어 보세요.';

// 공유받은 결과 링크는 미리보기(카카오톡 등)에 고른 향이 보이게 한다
export async function generateMetadata({ searchParams }: Props, parent: ResolvingMetadata): Promise<Metadata> {
  const state = parseBlendParams(await searchParams);
  if (state.step !== 'result') return { title: BLEND_PAGE_TITLE, description: DESCRIPTION };

  const title = blendPageTitle(state);
  const description = '이 향과 비슷한 실제 향수를 확인하고, 나만의 향수도 만들어 보세요.';
  // openGraph는 통째로 바뀌므로 사이트 이름·이미지는 상위(layout) 값을 이어 쓴다
  const { openGraph } = await parent;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      siteName: openGraph?.siteName,
      locale: openGraph?.locale,
      images: openGraph?.images,
    },
  };
}

// 스타일 기준은 docs/design-system.md "나만의 향수 만들기 패턴" 참고
// 고른 병·향·단계는 쿼리스트링(?step=&bottle=&notes=)에 있다 — 새로고침해도 그대로 그린다
export default async function BlendPage({ searchParams }: Props) {
  const initial = parseBlendParams(await searchParams);
  return (
    <div className="px-4 pt-8 pb-4 md:p-8 max-w-[1440px] w-full mx-auto">
      {/* 병 그림들이 함께 쓰는 그라데이션 — 페이지에 한 번만 둔다 */}
      <BottleDefs />
      <BlendGame initial={initial} />
    </div>
  );
}
