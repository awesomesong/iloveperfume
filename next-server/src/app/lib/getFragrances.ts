import { FragranceWithAuthor, isFragranceSource } from "@/src/app/types/fragrance";
import prisma from "@/prisma/db";
import { apiFetch } from "@/src/app/utils/apiFetch";

// ─────────────────────────────────────────────
// Server-only functions (Prisma 직접 조회)
// Server Components, generateStaticParams에서만 사용
// ─────────────────────────────────────────────

export const getFragranceSlugsServer = async (): Promise<string[]> => {
    const fragrances = await prisma.fragrance.findMany({
        select: { slug: true },
        orderBy: { createdAt: "asc" },
    });
    
    return fragrances.map((f) => f.slug);
};

/** 없으면 null — 페이지에서 notFound()로 404를 낸다 (예외를 던지면 500이 된다) */
export const getFragranceBySlugServer = async (slug: string): Promise<FragranceWithAuthor | null> =>
    prisma.fragrance.findUnique({
        where: { slug },
        include: {
            author: { select: { id: true, name: true, email: true, image: true, profileImage: true, role: true } }
        },
    });

type FragranceListParam = {
    pageParam: string;
    queryKey?: readonly unknown[];
};

/** queryKey: ["fragrances"](전체) 또는 ["fragrances", "source", 출처] — fragranceListKeyBySource 참고 */
export const getFragrances = async (
    { pageParam, queryKey }: FragranceListParam
): Promise<FragranceWithAuthor[]> => {
    const params = new URLSearchParams({ cursor: pageParam ?? '' });
    const source = queryKey?.[2];
    if (isFragranceSource(source)) params.set('source', source);

    const { fragrances } = await apiFetch<{ fragrances: FragranceWithAuthor[] }>(
        `/api/fragrance?${params.toString()}`,
        { defaultErrorMessage: "향수 목록을 가져오는데 실패했습니다." },
    );
    return fragrances;
};

export const getFragranceBrands = async (): Promise<string[]> => {
    const { brands } = await apiFetch<{ brands: string[] }>('/api/fragrance/brands', {
        defaultErrorMessage: '브랜드 목록을 가져오는데 실패했습니다.',
    });
    return brands;
};
