import { memo, useId, type CSSProperties } from "react";
import clsx from "clsx";
import { LiquidGradients } from "./BottleDefs";
import { BOTTLE_VIEW_BOX, type BottleShape } from "@/src/app/lib/blend/bottleShapes";

type Props = {
    shape: BottleShape;
    /** 향수 색(액체 색 변수) — 주면 이 병만 그 색으로 그린다. 없으면 기본 색 */
    tint?: CSSProperties;
    className?: string;
};

const CENTER_X = 120;
/** BottleDefs의 그라데이션을 가리킨다 — 같은 페이지에 BottleDefs가 한 번 있어야 한다 */
const paint = (name: string) => `url(#blend-${name})`;

/**
 * 병 그림 한 개 — 실제 향수병 구조를 선 없이 빛과 그림자로 그린다.
 * 아래에서 위로: 바닥 그림자 → 유리 목 → 몸통 가장자리(커팅 면) → 정면 유리(바닥 유리는 색 없이 맑게)
 * → 안쪽 공간과 액체 → 유리 앞면 반사 → 모서리 선 → 금속 목 고리 → 뚜껑.
 * 도형과 그라데이션만 쓴다(흐림 필터·마스크·겹침 효과 없음). 색은 globals.css의 .blend-bottle 변수.
 */
const BottleSvg = ({ shape, tint, className }: Props) => {
    // 향수 색을 입힌 병은 액체 그라데이션을 자기 것으로 한 벌 둔다(변수는 svg의 style에서 읽는다)
    const tintId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
    const liquidPaint = tint ? (name: string) => `url(#${tintId}-${name})` : paint;
    const { bodyTop, bodyHalfWidth, baseHalfWidth, cap, surface, punt, liquidBox, glint } = shape;
    const isCut = shape.kind === "cut";

    const liquidHeight = liquidBox.bottom - liquidBox.top;
    const half = liquidBox.narrowHalf;

    const capBottom = bodyTop - 22;
    const capTop = capBottom - cap.height;
    const capLeft = CENTER_X - cap.width / 2;
    const neckHalf = Math.max(10, cap.width / 2 - 14);

    return (
        <svg viewBox={BOTTLE_VIEW_BOX} className={clsx("blend-bottle", className)} style={tint} aria-hidden focusable="false">
            {tint && (
                <defs>
                    <LiquidGradients prefix={tintId} />
                </defs>
            )}
            {/* 바닥: 빛 반대쪽(오른쪽)으로 지는 그림자 → 맞닿은 그림자. 액체 색이 바닥에 번지는 빛은 넣지 않는다(얼룩처럼 보임) */}
            <ellipse cx={CENTER_X + bodyHalfWidth * 0.28} cy="313" rx={bodyHalfWidth * 1.5} ry="11" fill={paint("shadow")} />
            <ellipse cx={CENTER_X + 2} cy="310.6" rx={baseHalfWidth + 10} ry="2.8" fill={paint("shadow-contact")} />

            <rect x={CENTER_X - neckHalf} y={bodyTop - 10.5} width={neckHalf * 2} height="11.5" fill={paint("neck")} />

            {/* 몸통 가장자리: 커팅 병은 면마다 밝기가 다르고, 둥근 병은 부드럽게 이어진다 */}
            {isCut ? (
                <>
                    <path d={shape.outer} className="blend-bottle__glass" />
                    {shape.facets.map((facet) =>
                        typeof facet.tone === "number" ? (
                            <path key={facet.d} d={facet.d} className="blend-bottle__facet" fillOpacity={facet.tone} />
                        ) : (
                            <path key={facet.d} d={facet.d} fill={paint(`facet-${facet.tone}`)} />
                        ),
                    )}
                </>
            ) : (
                <path d={shape.outer} fill={paint("rim")} />
            )}

            {/* 정면 유리. 두꺼운 바닥 유리는 색 없이 맑게 두고, 오목한 밑면만 곡선 한 줄로 비친다 */}
            <path d={shape.face} fill={paint("face")} />
            <path d={shape.face} fill={paint("face-top")} className="blend-bottle__face-top" />
            <path d={`M${punt.left} 297.5Q${CENTER_X} 289.5 ${punt.right} 297.5`} className="blend-bottle__line" />

            {/* 안쪽 공간: 위 빈 곳 + 액체 */}
            <path d={shape.cavity} fill={paint("air")} />
            <path d={shape.liquid} fill={liquidPaint("liquid")} />
            <ellipse cx={CENTER_X + half * 0.4} cy={liquidBox.top + liquidHeight * 0.47} rx={half * 0.36} ry={liquidHeight * 0.43} fill={liquidPaint("back-light")} />
            <path d={shape.liquid} fill={liquidPaint("liquid-depth")} />
            <path d={shape.liquid} fill={liquidPaint("liquid-deep")} />
            <ellipse cx={CENTER_X - 4} cy={liquidBox.bottom - 5} rx={half * 0.8} ry="5.5" fill={liquidPaint("glow")} />
            {/* 수면: 벽을 타고 살짝 올라온다 */}
            <path
                d={`M${surface.left} ${surface.y - 1.6}Q${surface.left + 2} ${surface.y} ${surface.left + 6} ${surface.y}H${surface.right - 6}Q${surface.right - 2} ${surface.y} ${surface.right} ${surface.y - 1.6}V${surface.y + 2}Q${surface.right - 2} ${surface.y + 3.5} ${surface.right - 6} ${surface.y + 3.5}H${surface.left + 6}Q${surface.left + 2} ${surface.y + 3.5} ${surface.left} ${surface.y + 2}Z`}
                className="blend-bottle__surface"
            />
            <path
                d={`M${surface.left} ${surface.y - 1.8}Q${surface.left + 2} ${surface.y - 0.3} ${surface.left + 6} ${surface.y - 0.3}H${surface.right - 6}Q${surface.right - 2} ${surface.y - 0.3} ${surface.right} ${surface.y - 1.8}`}
                className="blend-bottle__surface-line"
            />
            <path d={shape.cavity} className="blend-bottle__cavity-edge" />

            {/* 유리 앞면에 비친 조명 — 액체가 가장 좁은 곳 안쪽에 둔다 */}
            <ellipse cx={CENTER_X - half * 0.42} cy={liquidBox.top + liquidHeight * 0.46} rx={half * 0.4} ry={liquidHeight * 0.5} fill={paint("sheen")} className="blend-bottle__sheen" />
            <ellipse cx={CENTER_X + half * 0.66} cy={liquidBox.top + liquidHeight * 0.66} rx={half * 0.15} ry={liquidHeight * 0.34} fill={paint("sheen")} className="blend-bottle__sheen blend-bottle__sheen--back" />

            {/* 모서리 선과 맺힌 빛 */}
            <path d={shape.face} className="blend-bottle__face-edge" />
            {isCut && <path d={shape.creases} className="blend-bottle__crease" />}
            <path d={shape.outer} className="blend-bottle__outline" />
            {isCut ? (
                <circle cx={glint[0]} cy={glint[1]} r="3.4" fill={paint("sheen")} />
            ) : (
                <ellipse cx={glint[0]} cy={glint[1]} rx="1.6" ry={(310 - bodyTop) * 0.14} fill={paint("sheen")} className="blend-bottle__glint" />
            )}

            {/* 금속 목 고리: 두 단 */}
            <rect x={capLeft + 9} y={bodyTop - 15.5} width={cap.width - 18} height="5.5" fill={paint("metal")} />
            <rect x={capLeft + 9} y={bodyTop - 15.5} width={cap.width - 18} height="5.5" className="blend-bottle__shade" opacity="0.18" />
            <rect x={capLeft + 4} y={capBottom} width={cap.width - 8} height="7.4" rx="0.8" fill={paint("metal")} />
            <rect x={capLeft + 4} y={capBottom} width={cap.width - 8} height="1.8" className="blend-bottle__shade" opacity="0.45" />

            {/* 뚜껑: 윗모서리를 깎고, 아래에 금색 띠 */}
            <rect x={capLeft} y={capTop} width={cap.width} height={cap.height} fill={paint("cap")} />
            <rect x={capLeft} y={capTop} width={cap.width} height={cap.height} fill={paint("cap-shade")} />
            <path d={`M${capLeft + 4} ${capTop - 6}H${capLeft + cap.width - 4}L${capLeft + cap.width} ${capTop}H${capLeft}Z`} fill={paint("cap-top")} />
            <rect x={capLeft} y={capTop - 0.3} width={cap.width} height="0.6" className="blend-bottle__hi" opacity="0.45" />
            <rect x={capLeft} y={capBottom - 8.5} width={cap.width} height="2.4" fill={paint("metal")} />
            <rect x={capLeft} y={capBottom - 6.1} width={cap.width} height="0.6" className="blend-bottle__shade" opacity="0.5" />
            <circle cx={capLeft + 12.2} cy={capTop} r="2.4" fill={paint("sheen")} className="blend-bottle__glint" />
        </svg>
    );
};

export default memo(BottleSvg);
