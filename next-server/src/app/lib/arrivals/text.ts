/**
 * 글자 처리 공용 함수 (순수 함수). 수집·판별·브랜드 찾기가 같은 기준으로 비교하도록 한곳에 둔다.
 */

/** 악센트 제거 (é → e) */
export function stripAccents(text: string): string {
  return text.normalize("NFKD").replace(/[̀-ͯ]/g, "");
}

/** 비교용 키: 악센트·대소문자·공백·기호를 무시한 글자와 숫자 */
export function toKey(text: string): string {
  return stripAccents(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

/**
 * 글 길이 기준값은 영어 기준이다. 한국어·중국어·일본어는 같은 내용을 절반쯤의 글자로 쓰므로 이런 글자는 2자로 센다.
 * 예) 한국어 소개문 90자 → 약 160
 */
export function effectiveTextLength(text: string): number {
  const cjk = text.match(/[\p{Script=Hangul}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu)?.length ?? 0;
  return text.length + cjk;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", bdquo: "„", ndash: "–", mdash: "—", hellip: "…",
  times: "×", deg: "°", middot: "·", eacute: "é", egrave: "è", ecirc: "ê", euml: "ë", agrave: "à", acirc: "â",
  auml: "ä", ccedil: "ç", icirc: "î", iuml: "ï", ocirc: "ô", ouml: "ö", ugrave: "ù", ucirc: "û",
  uuml: "ü", szlig: "ß", Eacute: "É", Auml: "Ä", Ouml: "Ö", Uuml: "Ü", ntilde: "ñ", oacute: "ó", aacute: "á", iacute: "í",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, body: string) => {
    if (body[0] === "#") {
      const code = body[1].toLowerCase() === "x" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[body] ?? match;
  });
}

/** 문단·줄바꿈 태그 — 그냥 지우면 앞뒤 글이 붙는다 ("Cashmeran</p><p>Heart notes" → "CashmeranHeart notes") */
const BLOCK_TAG = /<\/?(?:p|div|br|li|ul|ol|h[1-6]|table|tr|td|th|section|blockquote)\b[^>]*>/gi;

/** HTML을 일반 텍스트로 바꾼다. 문단 경계는 줄바꿈으로 남기고, 태그는 지우고, 엔티티는 글자로 되돌린다 */
export function htmlToText(html: string): string {
  return html
    .replace(/\s+/g, " ")
    .replace(BLOCK_TAG, "\n")
    .split("\n")
    .map((line) => decodeEntities(line.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}
