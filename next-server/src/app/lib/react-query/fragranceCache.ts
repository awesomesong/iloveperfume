import { QueryClient, InfiniteData } from "@tanstack/react-query";
import { FragranceListFilter, FragranceWithAuthor } from "@/src/app/types/fragrance";

export const fragranceListKey = ["fragrances"];
/** 출처별 목록 키의 공통 접두어 — 등록·수정 뒤 한 번에 무효화할 때 쓴다 */
const fragranceSourceListKey = [...fragranceListKey, "source"];
/**
 * /fragrance 목록 탭별 키. "ALL"은 홈 갤러리와 같은 키(fragranceListKey)를 써서 캐시를 공유한다.
 * 출처별 키는 fragranceListKey로 시작하므로 removeQueries({ queryKey: fragranceListKey })에 함께 지워진다.
 */
export const fragranceListKeyBySource = (filter: FragranceListFilter) =>
    filter === "ALL" ? fragranceListKey : [...fragranceSourceListKey, filter];
export const fragranceBrandsKey = ["fragrance-brands"];
export const fragranceDetailKey = (idOrSlug: string) => ["fragrance", idOrSlug];

/**
 * 향수 목록 캐시에 데이터 추가 (낙관적 업데이트 또는 수동 업데이트용)
 */
export const prependFragranceCard = (queryClient: QueryClient, newFragrance: FragranceWithAuthor) => {
    queryClient.setQueryData<InfiniteData<FragranceWithAuthor[]>>(fragranceListKey, (old) => {
        if (!old?.pages?.length) {
            return { pages: [[newFragrance]], pageParams: [''] };
        }
        const [first, ...rest] = old.pages;
        return {
            ...old,
            pages: [[newFragrance, ...(first ?? [])], ...rest],
        };
    });
    queryClient.invalidateQueries({ queryKey: fragranceSourceListKey });
};

/**
 * 향수 목록 캐시의 특정 항목 업데이트
 */
export const upsertFragranceCardById = (queryClient: QueryClient, updatedFragrance: Partial<FragranceWithAuthor> & { id: string }) => {
    queryClient.setQueryData<InfiniteData<FragranceWithAuthor[]>>(fragranceListKey, (old) => {
        if (!old) return old;
        return {
            ...old,
            pages: old.pages.map((page) =>
                (page ?? []).map((f) =>
                    f.id === updatedFragrance.id ? { ...f, ...updatedFragrance } : f
                )
            ),
        };
    });
    queryClient.invalidateQueries({ queryKey: fragranceSourceListKey });
};
