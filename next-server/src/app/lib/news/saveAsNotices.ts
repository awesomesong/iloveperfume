import prisma from "@/prisma/db";
import type { SelectedNews } from "./types";

const isUniqueViolation = (e: unknown) =>
  typeof e === "object" && e !== null && (e as { code?: unknown }).code === "P2002";

/**
 * 선별된 뉴스를 Notice로 저장한다. 저장 즉시 공개(PUBLISHED)된다.
 * sourceUrl unique 제약 덕분에 크론이 두 번 실행돼도 같은 기사가 중복 저장되지 않는다(멱등).
 */
export async function saveAsNotices(
  items: SelectedNews[],
): Promise<{ published: number; skippedDuplicate: number }> {
  // 한 번 실행에서 고른 후보들은 filterCandidates 단계에서 이미 URL 중복이 제거된 상태라
  // 서로 다른 sourceUrl을 갖는다 — 병렬로 저장해도 안전하다.
  const results = await Promise.allSettled(
    items.map((item) =>
      prisma.notice.create({
        data: {
          title: item.title,
          summary: item.summary,
          category: item.category,
          status: "PUBLISHED",
          sourceUrl: item.candidate.url,
          sourceName: item.candidate.sourceName,
          publishedAt: item.candidate.publishedAt,
          image: item.image ? [item.image] : [],
        },
      }),
    ),
  );

  let published = 0;
  let skippedDuplicate = 0;
  for (const result of results) {
    if (result.status === "fulfilled") {
      published += 1;
    } else if (isUniqueViolation(result.reason)) {
      skippedDuplicate += 1;
    } else {
      throw result.reason;
    }
  }

  return { published, skippedDuplicate };
}
