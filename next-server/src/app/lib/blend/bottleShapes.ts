/**
 * 병 모양 — 실제 향수병 구조로 정의한다.
 * 바깥 윤곽 → 커팅 면(비스듬한 가장자리) → 정면 유리 → 안쪽 공간(두꺼운 유리벽·두툼한 바닥) → 액체,
 * 그 위에 짧은 목·금속 고리·큰 뚜껑. 모든 병이 같은 바닥선(y = BASE_Y)에 선다.
 * 모양마다 오른쪽 절반의 윤곽만 적으면 나머지(안쪽으로 줄인 윤곽, 면, 액체)는 여기서 계산한다.
 */

/** 병 그림의 좌표계 — BottleSvg의 viewBox와 같다 */
export const BOTTLE_VIEW_BOX = "0 0 240 340";

const CENTER_X = 120;
const BASE_Y = 310;
/** 커팅 면 폭 / 유리벽 두께 / 어깨 유리 두께 / 바닥 유리 두께 / 액체 위 빈 곳 */
const BEVEL = 6;
const WALL = 14;
const SHOULDER = 18;
const BASE_GLASS = 28;
const AIR_GAP = 9;
/** 빛이 오는 방향(왼쪽 위) — 커팅 면의 밝기를 정한다 */
const LIGHT = { x: -0.6, y: -0.8 } as const;

type Point = readonly [x: number, y: number];
/** 중심축에서 잰 반너비와 높이 */
type HalfPoint = readonly [dx: number, y: number];
/** 곡선 한 토막: 제어점 둘 + 끝점 */
type Curve = readonly [control1: HalfPoint, control2: HalfPoint, end: HalfPoint];

type BottleSpec = {
    id: string;
    name: string;
    cap: { width: number; height: number };
} & (
    | { kind: "cut"; side: readonly HalfPoint[] }
    | { kind: "round"; start: HalfPoint; curves: readonly Curve[] }
);

export type BottleFacet = {
    d: string;
    /** 세로·가로로 곧은 면은 그라데이션, 비스듬한 면은 단색 + 그늘 농도(0~1) */
    tone: "top" | "left" | "right" | "bottom" | number;
};

export type BottleShape = {
    id: string;
    name: string;
    /** 각진 커팅 병(면이 나뉨) / 둥근 병(가장자리가 부드럽게 이어짐) */
    kind: "cut" | "round";
    outer: string;
    face: string;
    /** 커팅 병만: 가장자리 면들 */
    facets: readonly BottleFacet[];
    /** 커팅 병만: 면이 만나는 모서리 선 */
    creases: string;
    cavity: string;
    liquid: string;
    /** 수면의 왼쪽·오른쪽 끝과 높이 */
    surface: { left: number; right: number; y: number };
    /** 바닥 유리에 비치는 오목한 밑면 곡선의 양끝 */
    punt: { left: number; right: number };
    /** 액체가 보이는 높이 범위와, 그 안에서 가장 좁은 곳의 반너비 — 반사광이 병 밖으로 나가지 않게 잡는다 */
    liquidBox: { top: number; bottom: number; narrowHalf: number };
    /** 모서리에 맺힌 빛(커팅 병) / 왼쪽 가장자리 반사 위치(둥근 병) */
    glint: Point;
    bodyTop: number;
    bodyHalfWidth: number;
    baseHalfWidth: number;
    cap: { width: number; height: number };
};

const round = (value: number) => Math.round(value * 10) / 10;

/** 곡선 한 토막을 점으로 나눈다(끝점 포함, 시작점 제외) */
function sampleCurve(from: HalfPoint, [c1, c2, to]: Curve, steps: number): HalfPoint[] {
    const points: HalfPoint[] = [];
    for (let step = 1; step <= steps; step++) {
        const t = step / steps;
        const u = 1 - t;
        const a = u * u * u;
        const b = 3 * u * u * t;
        const c = 3 * u * t * t;
        const e = t * t * t;
        points.push([
            a * from[0] + b * c1[0] + c * c2[0] + e * to[0],
            a * from[1] + b * c1[1] + c * c2[1] + e * to[1],
        ]);
    }
    return points;
}

/** 오른쪽 절반(위 → 아래)을 좌우로 펼쳐 시계 방향으로 닫힌 윤곽을 만든다 */
function mirror(side: readonly HalfPoint[]): Point[] {
    const right = side.map(([dx, y]): Point => [CENTER_X + dx, y]);
    const left = side.map(([dx, y]): Point => [CENTER_X - dx, y]).reverse();
    return [...right, ...left];
}

/** 윤곽을 안쪽으로 일정하게 줄인다(점 개수·순서 유지) */
function inset(points: readonly Point[], distance: number): Point[] {
    const count = points.length;
    const normals = points.map((point, index): Point => {
        const next = points[(index + 1) % count];
        const dx = next[0] - point[0];
        const dy = next[1] - point[1];
        const length = Math.hypot(dx, dy) || 1;
        return [-dy / length, dx / length];
    });
    return points.map((point, index): Point => {
        const before = normals[(index - 1 + count) % count];
        const after = normals[index];
        const mx = before[0] + after[0];
        const my = before[1] + after[1];
        const length = Math.hypot(mx, my) || 1;
        const miterX = mx / length;
        const miterY = my / length;
        const scale = Math.min(distance / Math.max(miterX * after[0] + miterY * after[1], 0.4), distance * 2.5);
        return [point[0] + miterX * scale, point[1] + miterY * scale];
    });
}

/** 가로선 위(keep = "below")나 아래(keep = "above")를 잘라 낸다 */
function clipAt(points: readonly Point[], y: number, keep: "above" | "below"): Point[] {
    const inside = (point: Point) => (keep === "below" ? point[1] >= y : point[1] <= y);
    const result: Point[] = [];
    points.forEach((point, index) => {
        const previous = points[(index - 1 + points.length) % points.length];
        if (inside(point) !== inside(previous)) {
            const t = (y - previous[1]) / (point[1] - previous[1]);
            result.push([previous[0] + (point[0] - previous[0]) * t, y]);
        }
        if (inside(point)) result.push(point);
    });
    return result;
}

/** 가로선이 윤곽과 만나는 왼쪽·오른쪽 끝 */
function spanAt(points: readonly Point[], y: number): { left: number; right: number } {
    const xs: number[] = [];
    points.forEach((point, index) => {
        const next = points[(index + 1) % points.length];
        if (point[1] === next[1]) {
            if (point[1] === y) xs.push(point[0], next[0]);
            return;
        }
        const t = (y - point[1]) / (next[1] - point[1]);
        if (t >= 0 && t <= 1) xs.push(point[0] + (next[0] - point[0]) * t);
    });
    if (xs.length === 0) return { left: CENTER_X, right: CENTER_X };
    return { left: Math.min(...xs), right: Math.max(...xs) };
}

/** 닫힌 경로. radius가 있으면 꺾이는 모서리만 둥글린다(keepSharpY 높이의 점은 그대로 둔다) */
function toPath(points: readonly Point[], radius = 0, keepSharpY?: number): string {
    const count = points.length;
    const parts: string[] = [];
    points.forEach((point, index) => {
        const previous = points[(index - 1 + count) % count];
        const next = points[(index + 1) % count];
        const inX = point[0] - previous[0];
        const inY = point[1] - previous[1];
        const outX = next[0] - point[0];
        const outY = next[1] - point[1];
        const inLength = Math.hypot(inX, inY) || 1;
        const outLength = Math.hypot(outX, outY) || 1;
        const turn = Math.acos(Math.max(-1, Math.min(1, (inX * outX + inY * outY) / (inLength * outLength))));
        const command = index === 0 ? "M" : "L";
        if (radius === 0 || turn < 0.5 || point[1] === keepSharpY) {
            parts.push(`${command}${round(point[0])} ${round(point[1])}`);
            return;
        }
        const r = Math.min(radius, inLength / 2, outLength / 2);
        const startX = point[0] - (inX / inLength) * r;
        const startY = point[1] - (inY / inLength) * r;
        const endX = point[0] + (outX / outLength) * r;
        const endY = point[1] + (outY / outLength) * r;
        parts.push(
            `${command}${round(startX)} ${round(startY)}Q${round(point[0])} ${round(point[1])} ${round(endX)} ${round(endY)}`,
        );
    });
    return `${parts.join("")}Z`;
}

/** 커팅 병: 바깥 윤곽과 정면 유리 사이의 면들. 면이 향한 방향으로 밝기를 정한다 */
function buildFacets(outer: readonly Point[], face: readonly Point[]): BottleFacet[] {
    return outer.map((point, index) => {
        const next = (index + 1) % outer.length;
        const dx = outer[next][0] - point[0];
        const dy = outer[next][1] - point[1];
        const length = Math.hypot(dx, dy) || 1;
        // 바깥을 향한 방향
        const nx = dy / length;
        const ny = -dx / length;
        const d = toPath([point, outer[next], face[next], face[index]]);
        if (ny < -0.995) return { d, tone: "top" };
        if (ny > 0.995) return { d, tone: "bottom" };
        if (nx < -0.995) return { d, tone: "left" };
        if (nx > 0.995) return { d, tone: "right" };
        const brightness = nx * LIGHT.x + ny * LIGHT.y;
        return { d, tone: round(Math.max(0, Math.min(1, 0.42 - brightness * 0.5))) };
    });
}

function toShape(spec: BottleSpec): BottleShape {
    const side =
        spec.kind === "cut"
            ? spec.side
            : spec.curves.reduce<HalfPoint[]>(
                  (points, curve) => [...points, ...sampleCurve(points[points.length - 1], curve, 10)],
                  [spec.start],
              );
    const outer = mirror(side);
    const face = inset(outer, spec.kind === "cut" ? BEVEL : BEVEL - 1);
    const bodyTop = side[0][1];
    const cavityBottom = BASE_Y - BASE_GLASS;
    const cavity = clipAt(clipAt(inset(outer, WALL), bodyTop + SHOULDER, "below"), cavityBottom, "above");
    const liquidTop = bodyTop + SHOULDER + AIR_GAP;
    const liquid = clipAt(cavity, liquidTop, "below");
    const surface = spanAt(cavity, liquidTop);
    // 액체가 가장 좁아지는 곳의 반너비(높이 12곳에서 잰다)
    const narrowHalf = Math.min(
        ...Array.from({ length: 12 }, (_, index) => {
            const y = liquidTop + ((cavityBottom - 2 - liquidTop) * index) / 11;
            const span = spanAt(cavity, y);
            return (span.right - span.left) / 2;
        }),
    );
    const puntSpan = spanAt(face, BASE_Y - 12.5);
    const isCut = spec.kind === "cut";
    // 커팅 병: 정면 유리의 왼쪽 위 모서리 / 둥근 병: 가장 넓은 높이의 왼쪽 가장자리
    const widest = side.reduce((best, point) => (point[0] > best[0] ? point : best));
    const glint: Point = isCut
        ? face.reduce((best, point) => (point[0] + point[1] < best[0] + best[1] ? point : best))
        : [spanAt(face, widest[1]).left + 3, widest[1]];

    return {
        id: spec.id,
        name: spec.name,
        kind: spec.kind,
        outer: toPath(outer),
        face: toPath(face),
        facets: isCut ? buildFacets(outer, face) : [],
        creases: isCut
            ? outer.map((point, index) => `M${round(point[0])} ${round(point[1])}L${round(face[index][0])} ${round(face[index][1])}`).join("")
            : "",
        cavity: toPath(cavity, 5),
        liquid: toPath(liquid, 5, liquidTop),
        surface: { left: round(surface.left), right: round(surface.right), y: liquidTop },
        punt: { left: round(puntSpan.left + 9), right: round(puntSpan.right - 9) },
        liquidBox: { top: liquidTop, bottom: cavityBottom, narrowHalf: round(narrowHalf) },
        glint: [round(glint[0]), round(glint[1])],
        bodyTop,
        bodyHalfWidth: Math.max(...side.map((point) => point[0])),
        baseHalfWidth: side[side.length - 1][0],
        cap: spec.cap,
    };
}

/** 각 병의 오른쪽 절반 윤곽(위 → 아래). 마지막 점은 바닥선(y = 310)에 닿는다 */
const SPECS: BottleSpec[] = [
    {
        id: "cylinder",
        name: "원통",
        kind: "round",
        cap: { width: 50, height: 60 },
        start: [36, 110],
        curves: [
            [[46, 110], [54, 118], [54, 128]],
            [[54, 190], [54, 250], [54, 300]],
            [[54, 306], [50, 310], [44, 310]],
        ],
    },
    {
        id: "square",
        name: "사각",
        kind: "cut",
        cap: { width: 56, height: 64 },
        side: [[58, 112], [70, 124], [70, 302], [62, 310]],
    },
    {
        id: "sphere",
        name: "구형",
        kind: "round",
        cap: { width: 50, height: 50 },
        start: [24, 136],
        curves: [
            [[60, 138], [90, 180], [90, 222]],
            [[90, 262], [62, 300], [26, 310]],
        ],
    },
    {
        id: "drop",
        name: "물방울",
        kind: "round",
        cap: { width: 46, height: 58 },
        start: [22, 118],
        curves: [
            [[24, 160], [78, 196], [78, 248]],
            [[78, 286], [62, 310], [40, 310]],
        ],
    },
    {
        id: "slim",
        name: "슬림",
        kind: "cut",
        cap: { width: 46, height: 50 },
        side: [[32, 98], [42, 108], [42, 303], [35, 310]],
    },
    {
        id: "gourd",
        name: "호리병",
        kind: "round",
        cap: { width: 48, height: 56 },
        start: [30, 114],
        curves: [
            [[50, 114], [60, 130], [60, 152]],
            [[60, 176], [44, 184], [44, 204]],
            [[44, 224], [74, 238], [74, 266]],
            [[74, 292], [64, 310], [48, 310]],
        ],
    },
    {
        id: "inverted",
        name: "역삼각",
        kind: "cut",
        cap: { width: 58, height: 60 },
        side: [[68, 124], [80, 136], [54, 302], [47, 310]],
    },
    {
        id: "trapezoid",
        name: "사다리꼴",
        kind: "cut",
        cap: { width: 52, height: 60 },
        side: [[38, 120], [48, 130], [76, 301], [68, 310]],
    },
    {
        id: "wide",
        name: "와이드",
        kind: "cut",
        cap: { width: 64, height: 56 },
        side: [[72, 150], [86, 164], [86, 302], [78, 310]],
    },
    {
        id: "jar",
        name: "항아리",
        kind: "round",
        cap: { width: 60, height: 52 },
        start: [38, 150],
        curves: [
            [[70, 150], [86, 180], [86, 216]],
            [[86, 262], [76, 310], [54, 310]],
        ],
    },
    {
        id: "bell",
        name: "종 모양",
        kind: "round",
        cap: { width: 46, height: 58 },
        start: [24, 116],
        curves: [
            [[26, 200], [52, 262], [78, 294]],
            [[82, 300], [80, 310], [70, 310]],
        ],
    },
    {
        id: "flask",
        name: "플라스크",
        kind: "round",
        cap: { width: 46, height: 56 },
        start: [24, 120],
        curves: [
            [[30, 168], [66, 240], [82, 280]],
            [[90, 298], [82, 310], [64, 310]],
        ],
    },
];

/** 윤곽선은 모듈을 불러올 때 한 번만 계산한다 — 렌더링 중에는 다시 계산하지 않는다 */
export const BOTTLE_SHAPES: readonly BottleShape[] = SPECS.map(toShape);

export const DEFAULT_BOTTLE_ID = BOTTLE_SHAPES[0].id;

const SHAPE_BY_ID = new Map(BOTTLE_SHAPES.map((shape) => [shape.id, shape]));

export const getBottleShape = (id: string): BottleShape => SHAPE_BY_ID.get(id) ?? BOTTLE_SHAPES[0];

/** 지금 고른 병을 뺀 나머지 중 하나를 고른다. roll은 0 이상 1 미만의 난수. */
export function pickOtherBottleId(currentId: string, roll: number): string {
    const others = BOTTLE_SHAPES.filter((shape) => shape.id !== currentId);
    return others[Math.floor(roll * others.length)].id;
}
