/**
 * 같은 소식의 중복 보도 판별 (순수 함수 — DB 조회 없음).
 *
 * 제목을 글자 바이그램 집합으로 바꾼 뒤 IDF 가중 코사인 유사도로 비교한다.
 * IDF는 이번 실행의 후보 기사 제목·발췌문 등 "코퍼스"에서 계산하므로
 * 여러 기사에 흔한 단어(향수·출시·홀리데이·컬렉션)는 가중치가 낮고,
 * 특정 기사에만 나오는 고유명사(브랜드·제품명)는 가중치가 높다.
 * → 매체마다 제목 표현이 달라도 고유명사가 겹치면 같은 소식으로 잡힌다.
 */

/** [속보]·(종합)·<인터뷰> 같은 짧은 머리말 */
const BRACKET_HEAD = /[\[\(【<][^\]\)】>]{0,12}[\]\)】>]/g;
const TOKEN_SPLIT = /[^\p{L}\p{N}]+/u;

/**
 * 비교용 글자 그램 집합.
 * 단어 경계를 넘는 바이그램은 만들지 않는다(띄어쓰기 차이로 생기는 잡음 제거).
 * 한 글자 단어는 그 글자 자체를 그램으로 쓴다(예: "美").
 */
export function titleGrams(text: string): Set<string> {
  const grams = new Set<string>();
  const tokens = text.replace(BRACKET_HEAD, " ").toLowerCase().split(TOKEN_SPLIT);
  for (const token of tokens) {
    if (!token) continue;
    const chars = Array.from(token);
    if (chars.length === 1) {
      grams.add(chars[0]);
      continue;
    }
    for (let i = 0; i < chars.length - 1; i++) grams.add(chars[i] + chars[i + 1]);
  }
  return grams;
}

/** 브랜드 포함 비교용 정규화: 소문자 + 글자·숫자만 남김 */
export function compactText(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

export type TitleSimilarity = (a: string, b: string) => number;

/**
 * 코퍼스로 IDF를 계산해 제목 유사도 함수(0~1)를 만든다.
 * 각 문서는 그램 집합 하나로 본다: idf(g) = ln((N+1)/(df(g)+1)) + 1 (코퍼스에 없는 그램은 df=0).
 * 그램 집합·노름은 텍스트별로 캐시한다.
 */
export function createTitleSimilarity(corpus: string[]): TitleSimilarity {
  const df = new Map<string, number>();
  for (const doc of corpus) {
    for (const gram of titleGrams(doc)) df.set(gram, (df.get(gram) ?? 0) + 1);
  }
  const n = corpus.length;
  const idfSquared = (gram: string) => {
    const idf = Math.log((n + 1) / ((df.get(gram) ?? 0) + 1)) + 1;
    return idf * idf;
  };

  const cache = new Map<string, { grams: Set<string>; norm: number }>();
  const vectorOf = (text: string) => {
    let entry = cache.get(text);
    if (!entry) {
      const grams = titleGrams(text);
      let sum = 0;
      for (const gram of grams) sum += idfSquared(gram);
      entry = { grams, norm: Math.sqrt(sum) };
      cache.set(text, entry);
    }
    return entry;
  };

  return (a, b) => {
    const va = vectorOf(a);
    const vb = vectorOf(b);
    if (va.norm === 0 || vb.norm === 0) return 0;
    const [small, large] = va.grams.size <= vb.grams.size ? [va, vb] : [vb, va];
    let dot = 0;
    for (const gram of small.grams) if (large.grams.has(gram)) dot += idfSquared(gram);
    return dot / (va.norm * vb.norm);
  };
}

/** title이 others 중 하나와 기준 이상 비슷하면 true */
export function isSimilarToAny(
  similarity: TitleSimilarity,
  title: string,
  others: readonly string[],
  threshold: number,
): boolean {
  return others.some((other) => similarity(title, other) >= threshold);
}
