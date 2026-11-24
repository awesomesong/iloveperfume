/**
 * 브랜드의 국내 인지도 — 네이버 블로그에서 "{브랜드 한글 표기} 향수 시향"으로 찾은 글 수.
 * 판매량·판매 순위를 받아 올 곳이 없어(네이버 쇼핑 검색 API 종료, 국내 쇼핑몰은 자동 수집 금지)
 * "국내에서 얼마나 이야기되는가"로 대신한다. "시향"을 함께 찾는 것은 향수 글만 세기 위해서다
 * ("27 87" 16,835 → 241, "소스피로" 9,564 → 596처럼 이름이 숫자·일반어인 브랜드의 부풀림이 줄어든다).
 * 알려진 한계: "메모"(MEMO PARIS)처럼 한글 표기가 일반 단어이면 여전히 많게 나온다.
 */
const NAVER_BLOG_API = "https://openapi.naver.com/v1/search/blog.json";
const TIMEOUT_MS = 8_000;

/** 한글 표기가 있으면 그것으로, 없으면 영문 브랜드명으로 찾는다 */
export const awarenessQuery = ({ brand, aliases }: { brand: string; aliases: readonly string[] }) =>
  `${aliases.find((alias) => /[가-힣]/.test(alias)) ?? brand} 향수 시향`;

/** 글 수. 설정이 없거나 검색 API가 응답하지 않으면 null — 다음에 다시 잰다 */
export async function measureAwareness(target: { brand: string; aliases: readonly string[] }): Promise<number | null> {
  const clientId = process.env.NAVER_NEWS_CLIENT_ID ?? process.env.NAVER_SHOPPING_CLIENT_ID;
  const clientSecret = process.env.NAVER_NEWS_CLIENT_SECRET ?? process.env.NAVER_SHOPPING_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  try {
    const res = await fetch(`${NAVER_BLOG_API}?display=1&query=${encodeURIComponent(awarenessQuery(target))}`, {
      headers: { "X-Naver-Client-Id": clientId, "X-Naver-Client-Secret": clientSecret },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const total = Number((await res.json()).total);
    return Number.isFinite(total) ? total : null;
  } catch {
    return null;
  }
}
