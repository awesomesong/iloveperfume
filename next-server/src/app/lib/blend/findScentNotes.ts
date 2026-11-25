import { SCENT_FAMILIES } from "./scentNotes";

/** 향 id → 계열 id */
export const FAMILY_ID_BY_NOTE_ID: ReadonlyMap<string, string> = new Map(
    SCENT_FAMILIES.flatMap((family) => family.notes.map((scent) => [scent.id, family.id] as const)),
);

/** 이름·다른 표기를 긴 것부터 — "핑크 페퍼"를 "페퍼"보다, "로즈우드"를 "로즈"보다 먼저 맞춘다 */
const TERMS = SCENT_FAMILIES.flatMap((family) =>
    family.notes.flatMap((scent) => [scent.name, ...scent.aliases].map((term) => ({ term, id: scent.id }))),
).sort((a, b) => b.term.length - a.term.length);

const HANGUL = /[가-힣]/;

/**
 * 향수 노트 글(Fragrance.notes)에서 향 id를 찾는다.
 * - 긴 표기부터 맞추고, 이미 맞춘 글자는 다시 쓰지 않는다.
 * - 단어가 시작하는 자리(앞 글자가 한글이 아닌 곳)에서만 인정한다 — "럼"이 "처럼"에, "배"가 "재배"에 걸리지 않는다.
 */
export function findScentNoteIds(text: string): Set<string> {
    // DB에 줄바꿈이 "\n" 글자 그대로 저장된 글이 있다
    const source = text.replace(/\\n/g, "\n");
    const used = new Uint8Array(source.length);
    const found = new Set<string>();

    for (const { term, id } of TERMS) {
        for (let index = source.indexOf(term); index !== -1; index = source.indexOf(term, index + 1)) {
            if (index > 0 && HANGUL.test(source[index - 1])) continue;
            if (used.subarray(index, index + term.length).some(Boolean)) continue;
            used.fill(1, index, index + term.length);
            found.add(id);
        }
    }
    return found;
}
