import prisma from '@/prisma/db';
import { transliterateNameToKorean } from './transliterate';

/**
 * 향수 한글 이름 조회·생성 (서버 전용).
 * 네이버 쇼핑 검색 링크를 한글 검색어로 만들기 위해 쓴다.
 */

type NameKey = { brand: string; name: string };

const keyOf = ({ brand, name }: NameKey) => `${brand.trim()}\u0000${name.trim()}`;

/**
 * DB 캐시(FragranceKoreanName)에서만 읽는다. LLM을 부르지 않아 페이지 렌더를 막지 않는다.
 * 캐시에 없으면 null — 호출자는 영문 이름으로 링크를 만든다.
 */
export async function getCachedKoreanName(brand: string, name: string): Promise<string | null> {
  const trimmedName = name.trim();
  if (!trimmedName) return null;
  try {
    const cached = await prisma.fragranceKoreanName.findUnique({
      where: { brand_name: { brand: brand.trim(), name: trimmedName } },
      select: { korean: true },
    });
    return cached?.korean ?? null;
  } catch (err) {
    console.warn('[koreanName] 캐시 조회 실패:', err instanceof Error ? err.message : err);
    return null;
  }
}

/** 여러 향수의 한글 이름을 한 번에 조회. 반환 Map의 키는 `koreanNameKey()`로 만든다. */
export async function getCachedKoreanNames(items: NameKey[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const targets = items.filter((i) => i.name.trim());
  if (targets.length === 0) return result;
  try {
    const rows = await prisma.fragranceKoreanName.findMany({
      where: { OR: targets.map((i) => ({ brand: i.brand.trim(), name: i.name.trim() })) },
      select: { brand: true, name: true, korean: true },
    });
    for (const row of rows) result.set(keyOf(row), row.korean);
  } catch (err) {
    console.warn('[koreanName] 일괄 조회 실패:', err instanceof Error ? err.message : err);
  }
  return result;
}

export const koreanNameKey = keyOf;

/**
 * 캐시에 없으면 LLM으로 음역해 저장한다. 응답을 보낸 뒤(`after`) 호출해
 * 다음 방문부터 한글 검색어가 쓰이도록 하는 용도. 실패해도 조용히 넘어간다.
 */
export async function ensureKoreanName(brand: string, name: string): Promise<void> {
  const trimmedBrand = brand.trim();
  const trimmedName = name.trim();
  if (!trimmedName) return;
  try {
    const existing = await prisma.fragranceKoreanName.findUnique({
      where: { brand_name: { brand: trimmedBrand, name: trimmedName } },
      select: { id: true },
    });
    if (existing) return;

    const korean = await transliterateNameToKorean(trimmedName);
    if (!korean) return;

    await prisma.fragranceKoreanName.upsert({
      where: { brand_name: { brand: trimmedBrand, name: trimmedName } },
      create: { brand: trimmedBrand, name: trimmedName, korean },
      update: { korean },
    });
  } catch (err) {
    console.warn('[koreanName] 생성 실패:', err instanceof Error ? err.message : err);
  }
}
