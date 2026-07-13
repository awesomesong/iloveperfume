import { FragranceWithAuthor } from "@/src/app/types/fragrance";
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

export const getFragranceBySlugServer = async (
    slug: string
): Promise<{ fragrance: FragranceWithAuthor }> => {
    const fragrance = await prisma.fragrance.findUnique({
        where: { slug },
        include: {
            author: { select: { id: true, name: true, email: true, image: true, profileImage: true, role: true } }
        },
    });

    if (!fragrance) {
        throw new Error("해당 향수를 찾을 수 없습니다.");
    }

    return { fragrance };
};

type FragranceListParam = {
    pageParam: string;
};

export const getFragrances = async (
    { pageParam }: FragranceListParam
): Promise<FragranceWithAuthor[]> => {
    const searchParams = '?cursor=' + encodeURIComponent(pageParam ?? '');
    const { fragrances } = await apiFetch<{ fragrances: FragranceWithAuthor[] }>(
        `/api/fragrance${searchParams}`,
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
