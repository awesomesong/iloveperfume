import type { CSSProperties } from "react";

/**
 * 향수 색 — 병 안 액체의 색. 유리는 그대로 맑고 액체만 물든다.
 * 12가지 색 계열(가로) × 옅은 색부터 짙은 색까지 4단계(세로)로 놓는다.
 * 색마다 기준 색 하나만 적고, 액체의 명암 단계는 liquidRamp가 만든다.
 * 사물(향수 액체)을 그리는 값이라 hex를 쓴다(design-system 9절 허용 예외).
 */
const ROWS = [
    // 가장 옅은 색
    [["clear", "클리어", "#e8ecea"], ["butter", "버터", "#f8eebf"], ["honey", "허니", "#f3d79a"], ["apricot", "애프리콧", "#f9dcc0"], ["blush", "블러시", "#f6e1dc"], ["rose", "로제", "#f5d3d4"], ["orchid", "오키드", "#ecd3ea"], ["lilac", "라일락", "#ddd4ea"], ["ice", "아이스", "#dcecf5"], ["aqua", "아쿠아", "#cfe6e8"], ["mint", "민트", "#bfe6d2"], ["green", "연두", "#dbe8b4"]],
    // 맑은 색
    [["nude", "누드", "#ebdac6"], ["lemon", "레몬", "#f1e06a"], ["gold", "골드", "#e6bb45"], ["peach", "피치", "#f5cba4"], ["coral", "코랄", "#f3ab9a"], ["pink", "핑크", "#f0a3bd"], ["mauve", "모브", "#c9a3c4"], ["violet", "바이올렛", "#b4a9e6"], ["sky", "스카이", "#b0d4ec"], ["turquoise", "터쿼이즈", "#58c2c4"], ["sage", "세이지", "#a9c9a4"], ["lime", "라임", "#d9e37a"]],
    // 선명한 색
    [["sand", "샌드", "#d9bf9a"], ["champagne", "샴페인", "#f2d47a"], ["amber", "앰버", "#cf9132"], ["orange", "오렌지", "#f0a04a"], ["ruby", "루비", "#bf3340"], ["fuchsia", "푸크시아", "#e370b0"], ["plum", "플럼", "#84489c"], ["iris", "아이리스", "#7f6fd0"], ["sapphire", "사파이어", "#4f88d6"], ["teal", "틸", "#2f9aa0"], ["emerald", "에메랄드", "#3fa37a"], ["olive", "올리브", "#c2c06a"]],
    // 짙은 색
    [["cognac", "코냑", "#92551a"], ["mustard", "머스터드", "#c9a227"], ["caramel", "카라멜", "#a8661f"], ["terracotta", "테라코타", "#c2622e"], ["burgundy", "버건디", "#7a1830"], ["berry", "베리", "#b02a66"], ["aubergine", "오버진", "#4a2060"], ["indigo", "인디고", "#3f358f"], ["navy", "네이비", "#2a3f8a"], ["petrol", "페트롤", "#1f5f6e"], ["forest", "포레스트", "#1f6a48"], ["moss", "모스", "#7f8a3a"]],
] as const;

/** 기본 색 — 병 그림의 원래 액체 색(globals.css의 --blend-liquid-*)이라 덮어쓰지 않는다 */
export const DEFAULT_COLOR_ID = "champagne";
/** 색이 거의 없는 색 — 수면·밝은 곳을 흰색으로 둔다 */
const CLEAR_LIQUID = ["#8a9391", "#b7bfbd", "#d8dddb", "#e8ecea", "#f3f5f4", "#ffffff"];
/** 가장자리 → 짙은 곳 → 중간 → 기본 → 밝은 곳 → 수면 */
const LIQUID_VARS = ["--blend-liquid-edge", "--blend-liquid-deep", "--blend-liquid-mid", "--blend-liquid", "--blend-liquid-hi", "--blend-liquid-top"];

export type PerfumeColor = {
    id: string;
    name: string;
    /** 색 견본에 칠하는 색 */
    swatch: string;
    /** 병 그림에 얹는 액체 색 변수 — 기본 색은 없다 */
    liquidStyle?: CSSProperties;
};

/** 기준 색에서 액체의 명암 여섯 단계를 만든다. 옅은 색은 조금만, 짙은 색은 많이 어두워진다 */
function liquidRamp(hex: string): string[] {
    const [r, g, b] = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const light = (max + min) / 2;
    const delta = max - min;
    const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * light - 1));
    let hue = 0;
    if (delta !== 0) hue = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
    hue = Math.round(hue * 60 + 360) % 360;
    const tone = (l: number, s = saturation) =>
        `hsl(${hue} ${Math.round(s * 100)}% ${Math.round(Math.max(0, Math.min(1, l)) * 1000) / 10}%)`;
    return [
        tone(light * (0.2 + 0.47 * light)),
        tone(light * (0.45 + 0.4 * light)),
        tone(light * (0.78 + 0.18 * light)),
        hex,
        tone(light + (1 - light) * (0.05 + 0.33 * light)),
        tone(light + (1 - light) * (0.2 + 0.6 * light), saturation * 0.85),
    ];
}

function toColor([id, name, base]: readonly [string, string, string]): PerfumeColor {
    if (id === DEFAULT_COLOR_ID) return { id, name, swatch: base };
    const liquid = id === "clear" ? CLEAR_LIQUID : liquidRamp(base);
    return {
        id,
        name,
        swatch: base,
        liquidStyle: Object.fromEntries(LIQUID_VARS.map((name, index) => [name, liquid[index]])) as CSSProperties,
    };
}

/** 색 표에 그리는 순서(가로 12개씩 네 줄). 모듈을 불러올 때 한 번만 계산한다 */
export const PERFUME_COLORS: readonly PerfumeColor[] = ROWS.flat().map(toColor);

const COLOR_BY_ID = new Map(PERFUME_COLORS.map((color) => [color.id, color]));

export const isPerfumeColorId = (id: string) => COLOR_BY_ID.has(id);
export const getPerfumeColor = (id: string): PerfumeColor => COLOR_BY_ID.get(id) ?? COLOR_BY_ID.get(DEFAULT_COLOR_ID)!;
