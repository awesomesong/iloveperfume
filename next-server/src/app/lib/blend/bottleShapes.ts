/** 병 그림의 좌표계 — BottleSvg의 viewBox와 같다 */
export const BOTTLE_VIEW_BOX = "0 0 100 140";
export const BOTTLE_LIQUID_TOP = 64;

const CENTER_X = 50;
const Y = { capTop: 7, neckTop: 22, neckBottom: 36, shoulder: 54, waist: 92, base: 132 } as const;

/** 중심축에서 잰 반너비(neck·shoulder·waist·base)와 곡률로 병 하나를 정의한다 */
type BottleSpec = {
    id: string;
    name: string;
    neck: number;
    shoulder: number;
    waist: number;
    base: number;
    /** 어깨 곡률 — 0이면 각지고 1이면 둥글다 */
    shoulderRound: number;
    baseRadius: number;
};

export type BottleShape = {
    id: string;
    name: string;
    /** 좌우 대칭으로 닫힌 병 윤곽선 (SVG path d) */
    outline: string;
    cap: { x: number; y: number; width: number; height: number };
    /** 유리 하이라이트 띠의 x 위치 */
    shineX: number;
};

type Point = readonly [dx: number, y: number];
type Curve = readonly [control1: Point, control2: Point, end: Point];

const round = (value: number) => Math.round(value * 100) / 100;
const at = (side: 1 | -1, [dx, y]: Point) => `${round(CENTER_X + side * dx)} ${round(y)}`;

function buildOutline({ neck, shoulder, waist, base, shoulderRound, baseRadius }: BottleSpec): string {
    const neckTop: Point = [neck, Y.neckTop];
    const neckBottom: Point = [neck, Y.neckBottom];
    // 허리에서 바닥 모서리로 내려가는 방향 — 모서리 곡선이 이 방향을 이어받아 꺾이지 않는다
    const footY = Y.base - baseRadius;
    const drop = footY - Y.waist;
    const slant = (base - waist) * 0.6;
    const slantLength = Math.hypot(slant, drop);
    const leanX = slant / slantLength;
    const leanY = drop / slantLength;

    // 오른쪽 윤곽을 위에서 아래로 한 번만 정의하고, 왼쪽은 이를 뒤집어 만든다
    const curves: Curve[] = [
        [
            [neck + (shoulder - neck) * (1 - shoulderRound), Y.neckBottom + 8 * shoulderRound],
            [shoulder, Y.shoulder - 12 * shoulderRound],
            [shoulder, Y.shoulder],
        ],
        [[shoulder, 68], [waist, 76], [waist, Y.waist]],
        [
            [waist, Y.waist + drop * 0.45],
            [base - leanX * drop * 0.35, footY - leanY * drop * 0.35],
            [base, footY],
        ],
        [
            [base + leanX * baseRadius * 0.55, footY + leanY * baseRadius * 0.55],
            [base - baseRadius * 0.45, Y.base],
            [base - baseRadius, Y.base],
        ],
    ];
    const starts: Point[] = [neckBottom, ...curves.map((curve) => curve[2])];

    const right = curves.map(([c1, c2, end]) => `C${at(1, c1)} ${at(1, c2)} ${at(1, end)}`);
    const left = curves
        .map(([c1, c2], index) => `C${at(-1, c2)} ${at(-1, c1)} ${at(-1, starts[index])}`)
        .reverse();

    return [
        `M${at(1, neckTop)}`,
        `L${at(1, neckBottom)}`,
        ...right,
        `L${at(-1, starts[curves.length])}`,
        ...left,
        `L${at(-1, neckTop)}`,
        "Z",
    ].join(" ");
}

function toShape(spec: BottleSpec): BottleShape {
    return {
        id: spec.id,
        name: spec.name,
        outline: buildOutline(spec),
        cap: {
            x: CENTER_X - spec.neck - 2,
            y: Y.capTop,
            width: spec.neck * 2 + 4,
            height: Y.neckTop - Y.capTop,
        },
        shineX: round(CENTER_X - Math.min(spec.shoulder, spec.waist, spec.base) * 0.62),
    };
}

const SPECS: BottleSpec[] = [
    { id: "cylinder", name: "원통", neck: 8, shoulder: 24, waist: 24, base: 24, shoulderRound: 0.5, baseRadius: 4 },
    { id: "square", name: "사각", neck: 9, shoulder: 32, waist: 32, base: 32, shoulderRound: 0, baseRadius: 2 },
    { id: "sphere", name: "구형", neck: 8, shoulder: 34, waist: 38, base: 38, shoulderRound: 1, baseRadius: 34 },
    { id: "drop", name: "물방울", neck: 6, shoulder: 14, waist: 34, base: 34, shoulderRound: 1, baseRadius: 28 },
    { id: "slim", name: "슬림", neck: 7, shoulder: 14, waist: 14, base: 14, shoulderRound: 0.3, baseRadius: 3 },
    { id: "gourd", name: "호리병", neck: 7, shoulder: 28, waist: 16, base: 30, shoulderRound: 1, baseRadius: 8 },
    { id: "inverted", name: "역삼각", neck: 9, shoulder: 36, waist: 26, base: 14, shoulderRound: 0.2, baseRadius: 4 },
    { id: "trapezoid", name: "사다리꼴", neck: 8, shoulder: 16, waist: 26, base: 36, shoulderRound: 0.2, baseRadius: 3 },
    { id: "wide", name: "와이드", neck: 10, shoulder: 38, waist: 38, base: 38, shoulderRound: 0.4, baseRadius: 8 },
    { id: "jar", name: "항아리", neck: 10, shoulder: 30, waist: 36, base: 36, shoulderRound: 1, baseRadius: 24 },
    { id: "bell", name: "종 모양", neck: 6, shoulder: 12, waist: 28, base: 38, shoulderRound: 1, baseRadius: 4 },
    { id: "flask", name: "플라스크", neck: 6, shoulder: 8, waist: 30, base: 36, shoulderRound: 1, baseRadius: 12 },
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
