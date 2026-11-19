import "./globals.css";
import type { Metadata } from "next";
import { Suspense } from "react";
import localFont from 'next/font/local';
import { Josefin_Sans, Noto_Serif_KR, IBM_Plex_Sans_KR, Nanum_Pen_Script, Gowun_Dodum } from 'next/font/google';
import NextAuthProvider from "@/src/app/context/NextAuthProvider";
import ToasterContext from "@/src/app/context/ToasterContext";
import ToastFromUrl from "@/src/app/components/ToastFromUrl";
import ThemeProvider from "@/src/app/context/ThemeProvider";
import { HeroUIProvider } from "@heroui/react";
import RQProviders from "@/src/app/context/RQProvider";
import SocketLazy from "@/src/app/components/SocketLazy";
import { SocketProvider } from "./context/socketContext";


const nanumGothic = localFont({
  src: [
    { path: '../../public/fonts/NanumGothic-Regular-subset.woff2', weight: '400', style: 'normal' },
    { path: '../../public/fonts/NanumGothic-Bold-subset.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-nanum-gothic',
  preload: true,
  display: 'swap',
});

const josefinSans = Josefin_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '600'],
  style: ['normal'],
  preload: false,
  display: 'swap',
  variable: '--font-josefin-sans',
});

const notoSerifKR = Noto_Serif_KR({
  subsets: ['latin'],
  weight: ['300', '400'],
  preload: false,
  display: 'swap',
  variable: '--font-noto-serif-kr',
});

const ibmPlexSansKR = IBM_Plex_Sans_KR({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  preload: false,
  display: 'swap',
  variable: '--font-ibm-plex-sans-kr',
});

const nanumPenScript = Nanum_Pen_Script({
  subsets: ['latin'],
  weight: ['400'],
  preload: false,
  display: 'swap',
  variable: '--font-nanum-pen-script',
});

const gowunDodum = Gowun_Dodum({
  subsets: ['latin'],
  weight: ['400'],
  preload: false,
  display: 'swap',
  variable: '--font-gowun-dodum',
});

export const metadata: Metadata = {
  metadataBase: new URL("https://iloveperfume.co.kr"),
  title: {
    default: "I Love Perfume | 향수 정보·리뷰·최저가 비교",
    template: "%s | I Love Perfume",
  },
  description:
    "향수 사진 한 장으로 어떤 향수인지 찾고, 노트와 리뷰를 확인한 뒤 판매처별 최저가까지 비교해 보세요. AI 향수 추천과 시향 기록 커뮤니티를 함께 제공합니다.",
  keywords: [
    "향수",
    "향수 추천",
    "향수 최저가",
    "향수 가격 비교",
    "향수 리뷰",
    "향수 노트",
    "향수 스캔",
    "아이러브퍼퓸",
    "I Love Perfume",
  ],
  // 제작자 정보는 제목·설명 대신 authors/creator 메타로 유지
  authors: [{ name: "강송희" }],
  creator: "강송희",
  openGraph: {
    title: "I Love Perfume | 향수 정보·리뷰·최저가 비교",
    description:
      "향수 사진 한 장으로 향수를 찾고, 노트·리뷰 확인부터 판매처별 최저가 비교까지 한 번에.",
    siteName: "I Love Perfume",
    images: [
      {
        url: "/image/metadata/main_web.png", // og:image 경로
        width: 1200,
        height: 627,
        alt: "I Love Perfume 향수 정보·최저가 비교",
      },
    ],
    type: "website",
    locale: "ko_KR",
  },
};


export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  return (
    <html
      lang="ko"
      suppressHydrationWarning
    >
      <head>
        <meta name="google-site-verification" content="ALyIJvkt9qHniyOTPkbNb3MNaUU1U44WV-nnHnwQofY" />
      </head>
      <body className={`
        flex
        flex-col
        min-h-dvh
        text-default
        bg-default
        break-all
        ${nanumGothic.variable}
        ${josefinSans.variable}
        ${notoSerifKR.variable}
        ${ibmPlexSansKR.variable}
        ${nanumPenScript.variable}
        ${gowunDodum.variable}
      `}>
        <NextAuthProvider>
          <RQProviders>
            <ToasterContext />
            <Suspense fallback={null}>
              <ToastFromUrl />
            </Suspense>
            <HeroUIProvider className="flex flex-col flex-1">
              <ThemeProvider>
                <SocketProvider>
                  <SocketLazy />
                  {children}
                </SocketProvider>
              </ThemeProvider>
            </HeroUIProvider>
          </RQProviders>
        </NextAuthProvider>
      </body>
    </html>
  );
}
