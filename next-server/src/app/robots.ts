import type { MetadataRoute } from "next";

const base = "https://iloveperfume.co.kr";

/**
 * 검색엔진 수집 규칙.
 * 로그인 전용·개인 화면(middleware matcher와 같은 범위)과 API, 일회성 스캔 결과는 제외.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/auth/",
        "/profile",
        "/chat-redirect",
        "/chatMember",
        "/conversations",
        "/scan/result/",
        "/fragrance/create",
        "/fragrance/*/edit",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
