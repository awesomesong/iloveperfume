import prisma from "@/prisma/db";
import { revalidatePath } from "next/cache";
import { generateBrandIndexSlug } from "@/src/app/lib/fragranceSlug";
import type { DescribedArrival } from "./types";

const isUniqueViolation = (e: unknown) =>
  typeof e === "object" && e !== null && (e as { code?: unknown }).code === "P2002";

/**
 * 검증을 통과한 향수(신제품·기존 향수)를 Fragrance로 저장한다. 저장 즉시 공개된다 (source = AI_AGENT, 작성자 없음).
 * officialUrl unique 제약 덕분에 크론이 두 번 실행돼도 같은 제품이 중복 저장되지 않는다(멱등).
 */
export async function saveAsFragrances(
  items: DescribedArrival[],
): Promise<{ saved: number; skippedDuplicate: number }> {
  let saved = 0;
  let skippedDuplicate = 0;

  for (const item of items) {
    try {
      const slug = await generateBrandIndexSlug(item.candidate.brand);
      await prisma.fragrance.create({
        data: {
          brand: item.candidate.brand,
          name: item.name,
          slug,
          images: item.candidate.images,
          description: item.description,
          notes: item.notes,
          source: "AI_AGENT",
          officialUrl: item.candidate.officialUrl,
          // 처음 등장한 날을 모르는 기존 향수는 비워 둔다 — "신제품"으로 표시되지 않는다
          firstSeenAt: item.candidate.firstSeenAt.getTime() > 0 ? item.candidate.firstSeenAt : null,
        },
      });
      // 정적으로 빌드된 slug 목록에 없는 새 향수라, 첫 조회 전에 캐시를 채워둔다 (POST /api/fragrance와 동일)
      revalidatePath(`/fragrance/${slug}`);
      saved += 1;
    } catch (e) {
      if (isUniqueViolation(e)) {
        skippedDuplicate += 1;
        continue;
      }
      throw e;
    }
  }

  return { saved, skippedDuplicate };
}
