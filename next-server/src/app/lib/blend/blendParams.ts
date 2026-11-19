import { BOTTLE_SHAPES, DEFAULT_BOTTLE_ID } from "./bottleShapes";
import { MAX_SCENT_NOTES, SCENT_NOTE_BY_ID, scentNoteName } from "./scentNotes";

export type BlendStep = "bottle" | "scent" | "result";

/** 지금 단계와 고른 값 — 주소의 쿼리스트링(?step=&bottle=&notes=)과 1:1로 대응한다 */
export type BlendState = {
    step: BlendStep;
    bottleId: string;
    noteIds: readonly string[];
};

type ParamValue = string | string[] | undefined;
export type BlendSearchParams = Partial<Record<"step" | "bottle" | "notes", ParamValue>>;

const STEPS = new Set<string>(["bottle", "scent", "result"]);
const BOTTLE_IDS = new Set(BOTTLE_SHAPES.map((shape) => shape.id));

const firstValue = (value: ParamValue) => (Array.isArray(value) ? value[0] : value);

/** 결과는 고른 향이 있어야 보여줄 수 있다 — 없으면 향 고르기로 */
export const resolveStep = (step: BlendStep, noteIds: readonly string[]): BlendStep =>
    step === "result" && noteIds.length === 0 ? "scent" : step;

/** 쿼리스트링을 상태로 바꾼다. 모르는 병·향·단계는 버리고 기본값을 쓴다(주소를 손으로 고쳐도 깨지지 않는다). */
export function parseBlendParams(params: BlendSearchParams): BlendState {
    const bottle = firstValue(params.bottle);
    const step = firstValue(params.step);
    const noteIds = [
        ...new Set((firstValue(params.notes) ?? "").split(",").filter((id) => SCENT_NOTE_BY_ID.has(id))),
    ].slice(0, MAX_SCENT_NOTES);

    return {
        step: resolveStep(step && STEPS.has(step) ? (step as BlendStep) : "bottle", noteIds),
        bottleId: bottle && BOTTLE_IDS.has(bottle) ? bottle : DEFAULT_BOTTLE_ID,
        noteIds,
    };
}

/** 상태를 쿼리스트링으로 바꾼다. 병 단계면 step을, 고른 향이 없으면 notes를 뺀다. id는 영문 소문자·하이픈뿐이라 그대로 쓴다. */
export function toBlendSearch({ step, bottleId, noteIds }: BlendState): string {
    const parts = [step === "bottle" ? null : `step=${step}`, `bottle=${bottleId}`, noteIds.length > 0 ? `notes=${noteIds.join(",")}` : null];
    return `?${parts.filter(Boolean).join("&")}`;
}

/** 브라우저 주소(location.search)를 상태로 */
export const parseBlendSearch = (search: string): BlendState =>
    parseBlendParams(Object.fromEntries(new URLSearchParams(search)));

/** 결과를 나눌 때 쓰는 제목 — 공유 시트와 링크 미리보기(og:title)가 같은 문장을 쓴다 */
export function blendResultTitle(noteIds: readonly string[]) {
    const names = noteIds.map(scentNoteName).join(", ");
    return `${names}${withRo(names)} 만든 나만의 향수`;
}

/** "로"/"으로" — 마지막 글자에 받침이 없거나 ㄹ이면 "로"(바닐라로, 머스크로, 우드로, 앰버로, 시더우드로 / 레몬으로) */
function withRo(word: string) {
    const code = word.charCodeAt(word.length - 1) - 0xac00;
    if (code < 0 || code > 11171) return "로";
    const final = code % 28;
    return final === 0 || final === 8 ? "로" : "으로";
}
