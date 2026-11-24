import { BOTTLE_SHAPES, DEFAULT_BOTTLE_ID } from "./bottleShapes";
import { DEFAULT_COLOR_ID, isPerfumeColorId } from "./perfumeColors";
import {
    LAYER_BY_NOTE_ID,
    MAX_LAYER_NOTES,
    SCENT_LAYERS,
    SCENT_NOTE_BY_ID,
    allNoteIds,
    scentNoteName,
    type LayerNotes,
    type ScentLayerId,
} from "./scentNotes";

/** 향수 만들기 페이지 주소와 제목 */
export const BLEND_PATH = "/blend";
export const BLEND_PAGE_TITLE = "나만의 향수 만들기";

/** 병 → 처음 향 → 중심 향 → 남는 향 → 결과 */
export const BLEND_STEPS = ["bottle", "top", "middle", "base", "result"] as const;
export type BlendStep = (typeof BLEND_STEPS)[number];

/** 지금 단계와 고른 값 — 주소의 쿼리스트링(?step=&bottle=&color=&top=&middle=&base=)과 1:1로 대응한다 */
export type BlendState = {
    step: BlendStep;
    bottleId: string;
    colorId: string;
    notes: LayerNotes;
};

type ParamValue = string | string[] | undefined;
/** notes는 층이 없던 옛 공유 링크(?notes=베르가못,장미,…) — 읽기만 하고 새로 쓰지 않는다 */
export type BlendSearchParams = Partial<Record<"step" | "bottle" | "color" | "notes" | ScentLayerId, ParamValue>>;

const STEPS = new Set<string>(BLEND_STEPS);
const BOTTLE_IDS = new Set(BOTTLE_SHAPES.map((shape) => shape.id));

const firstValue = (value: ParamValue) => (Array.isArray(value) ? value[0] : value);

/** 바로 다음·이전 단계 */
export const nextStep = (step: BlendStep): BlendStep => BLEND_STEPS[Math.min(BLEND_STEPS.indexOf(step) + 1, BLEND_STEPS.length - 1)];
export const prevStep = (step: BlendStep): BlendStep => BLEND_STEPS[Math.max(BLEND_STEPS.indexOf(step) - 1, 0)];

/** 결과는 세 층을 모두 골라야 보여줄 수 있다 — 빈 층이 있으면 그 층 고르기로 */
export function resolveStep(step: BlendStep, notes: LayerNotes): BlendStep {
    if (step !== "result") return step;
    return SCENT_LAYERS.find((layer) => notes[layer.id].length === 0)?.id ?? step;
}

/** 층마다 쉼표로 이은 향 id → 모르는 향, 앞 층에 이미 담은 향을 버리고 층마다 MAX_LAYER_NOTES개까지 */
function cleanLayerNotes(raw: Partial<Record<ScentLayerId, string>>): LayerNotes {
    const seen = new Set<string>();
    const notes: Record<ScentLayerId, string[]> = { top: [], middle: [], base: [] };
    for (const { id: layerId } of SCENT_LAYERS) {
        for (const id of (raw[layerId] ?? "").split(",")) {
            if (!SCENT_NOTE_BY_ID.has(id) || seen.has(id) || notes[layerId].length >= MAX_LAYER_NOTES) continue;
            seen.add(id);
            notes[layerId].push(id);
        }
    }
    return notes;
}

/** 옛 링크(?notes=)는 향마다 흔한 층으로 나눈다 */
function legacyLayerNotes(raw: string): Partial<Record<ScentLayerId, string>> {
    const ids = raw.split(",");
    return Object.fromEntries(
        SCENT_LAYERS.map((layer) => [layer.id, ids.filter((id) => LAYER_BY_NOTE_ID.get(id) === layer.id).join(",")]),
    );
}

/** 쿼리스트링을 상태로 바꾼다. 모르는 병·향·단계는 버리고 기본값을 쓴다(주소를 손으로 고쳐도 깨지지 않는다). */
export function parseBlendParams(params: BlendSearchParams): BlendState {
    const bottle = firstValue(params.bottle);
    const color = firstValue(params.color);
    const step = firstValue(params.step);
    const hasLayers = SCENT_LAYERS.some((layer) => firstValue(params[layer.id]));
    const notes = cleanLayerNotes(
        hasLayers
            ? Object.fromEntries(SCENT_LAYERS.map((layer) => [layer.id, firstValue(params[layer.id])]))
            : legacyLayerNotes(firstValue(params.notes) ?? ""),
    );

    return {
        step: resolveStep(step && STEPS.has(step) ? (step as BlendStep) : "bottle", notes),
        bottleId: bottle && BOTTLE_IDS.has(bottle) ? bottle : DEFAULT_BOTTLE_ID,
        colorId: color && isPerfumeColorId(color) ? color : DEFAULT_COLOR_ID,
        notes,
    };
}

/** 상태를 쿼리스트링으로 바꾼다. 병 단계면 step을, 기본 색이면 color를, 빈 층은 뺀다. id는 영문 소문자·하이픈뿐이라 그대로 쓴다. */
export function toBlendSearch({ step, bottleId, colorId, notes }: BlendState): string {
    const parts = [
        step === "bottle" ? null : `step=${step}`,
        `bottle=${bottleId}`,
        colorId === DEFAULT_COLOR_ID ? null : `color=${colorId}`,
        ...SCENT_LAYERS.map((layer) => (notes[layer.id].length > 0 ? `${layer.id}=${notes[layer.id].join(",")}` : null)),
    ];
    return `?${parts.filter(Boolean).join("&")}`;
}

/**
 * 브라우저 주소(location.search)를 상태로.
 * 같은 이름이 여러 번 있으면 서버(parseBlendParams)처럼 첫 값을 쓴다 — 서버와 첫 화면이 같아야 한다.
 */
export function parseBlendSearch(search: string): BlendState {
    const params = new URLSearchParams(search);
    const keys = ["step", "bottle", "color", "notes", ...SCENT_LAYERS.map((layer) => layer.id)] as const;
    return parseBlendParams(Object.fromEntries(keys.map((key) => [key, params.get(key) ?? undefined])));
}

/** 결과를 나눌 때 쓰는 제목 — 공유 시트와 링크 미리보기(og:title)가 같은 문장을 쓴다 */
export function blendResultTitle(notes: LayerNotes) {
    // 처음 향 → 중심 향 → 남는 향 순서로 읽힌다
    const names = allNoteIds(notes).map(scentNoteName).join(", ");
    return `${names}${withRo(names)} 만든 나만의 향수`;
}

/** "로"/"으로" — 마지막 글자에 받침이 없거나 ㄹ이면 "로"(바닐라로, 머스크로, 우드로, 앰버로, 시더우드로 / 레몬으로) */
function withRo(word: string) {
    const code = word.charCodeAt(word.length - 1) - 0xac00;
    if (code < 0 || code > 11171) return "로";
    const final = code % 28;
    return final === 0 || final === 8 ? "로" : "으로";
}

/** 단계에 맞는 페이지 제목 — 결과면 고른 향을 담는다 */
export const blendPageTitle = ({ step, notes }: Pick<BlendState, "step" | "notes">) =>
    step === "result" ? blendResultTitle(notes) : BLEND_PAGE_TITLE;
