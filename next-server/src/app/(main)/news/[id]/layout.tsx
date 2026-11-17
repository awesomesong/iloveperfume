import { cache } from 'react';

interface Props {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

// params를 캐시하여 한 번만 해결하도록 함
const getParams = cache(async (params: Promise<{ id: string }>) => {
  return await params;
});

// 향수 뉴스 데이터를 가져오는 함수 (캐시 적용)
const getNoticData = cache(async (id: string) => {
  try {
    const base = 'https://iloveperfume.co.kr';
    const res = await fetch(`${base}/api/notice/${id}`, { 
      next: { revalidate: 3600 } // 1시간 캐시
    });
    
    if (!res.ok) {
      return null;
    }
    
    const { notice } = await res.json();
    return notice;
  } catch {
    return null;
  }
});

// 동기적으로 메타데이터를 생성하는 함수
const createMetadata = async (id: string) => {
  const base = 'https://iloveperfume.co.kr';
  
  const notice = await getNoticData(id);
  
  if (!notice) {
    // 글을 찾을 수 없는 경우 기본 메타데이터
    return {
      title: '향수 뉴스 | I Love Perfume',
      description: '최신 향수 뉴스를 AI 요약으로 확인해 보세요.',
      openGraph: {
        title: '향수 뉴스 | I Love Perfume',
        description: '최신 향수 뉴스를 AI 요약으로 확인해 보세요.',
        url: `${base}/news/${id}`,
        type: 'article',
      },
    };
  }
  
  const summary: string = notice.summary || '';
  const description = summary.slice(0, 150) + (summary.length > 150 ? '...' : '');
  
  // 썸네일이 없으면 기본 OG 이미지 사용
  const imageUrl = notice.image?.[0] || '/image/metadata/notice.png';
  
  const metadata = {
    title: `${notice.title} | I Love Perfume`,
    description,
    keywords: [
      '향수 뉴스',
      'I Love Perfume',
      notice.title,
      ...(notice.sourceName ? [notice.sourceName] : []),
    ],
    openGraph: {
      title: notice.title,
      description,
      url: `${base}/news/${id}`,
      type: 'article',
      images: [{ url: imageUrl, width: 1200, height: 700 }],
      publishedTime: notice.publishedAt,
    },
    twitter: {
      card: 'summary_large_image',
      title: notice.title,
      description,
      images: [imageUrl],
    },
  };
  
  return metadata;
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await getParams(params);
  return await createMetadata(id);
}

export default async function NoticeLayout({ children }: Props) {
  
  return <>{children}</>;
}
