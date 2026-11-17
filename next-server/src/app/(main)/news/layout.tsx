import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "향수 뉴스 | I Love Perfume",
  description: "신제품 출시, 브랜드 소식, 트렌드까지 최신 향수 뉴스를 AI 요약으로 확인해 보세요.",
  openGraph: {
    title: "향수 뉴스 | I Love Perfume",
    description: "신제품 출시, 브랜드 소식, 트렌드까지 최신 향수 뉴스를 AI 요약으로 확인해 보세요.",
    url: "https://iloveperfume.co.kr/news",
    type: "website",
    images: [
      {
        url: '/image/metadata/notice.png',
        width: 1200,
        height: 656,
        alt: 'I Love Perfume 향수 뉴스',
      },
    ],
  },
  keywords: [
    "I Love Perfume",
    "향수 뉴스",
    "향수 신제품",
    "니치 향수",
    "향수 트렌드",
  ],
};

export default async function NoticeLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  return (
    <>
      {children}
    </>
  )
}
