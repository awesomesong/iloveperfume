import type { MetadataRoute } from "next";
import prisma from "@/prisma/db";
import { getFragranceSlugsServer } from "@/src/app/lib/getFragrances";

const base = "https://iloveperfume.co.kr";

// 향수 상세(ISR 1시간)와 같은 주기로 갱신
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [slugs, notices] = await Promise.all([
    getFragranceSlugsServer(),
    prisma.notice.findMany({
      where: { status: "PUBLISHED" },
      select: { id: true, updatedAt: true },
    }),
  ]);

  return [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/scan`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/guide`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/news`, changeFrequency: "daily", priority: 0.6 },
    ...slugs.map((slug) => ({
      url: `${base}/fragrance/${slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
    ...notices.map((n) => ({
      url: `${base}/news/${n.id}`,
      lastModified: n.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.3,
    })),
  ];
}
