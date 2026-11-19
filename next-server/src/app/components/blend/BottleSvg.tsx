import { memo, useId } from "react";
import clsx from "clsx";
import { BOTTLE_LIQUID_TOP, BOTTLE_VIEW_BOX, type BottleShape } from "@/src/app/lib/blend/bottleShapes";

type Props = {
    shape: BottleShape;
    /** 병 속 액체와 유리 하이라이트까지 그린다 (큰 미리보기용) */
    filled?: boolean;
    className?: string;
};

/** 병 그림 한 개. 색은 globals.css의 .blend-bottle__* 가 토큰으로 입힌다. */
const BottleSvg = ({ shape, filled = false, className }: Props) => {
    const clipId = useId();
    const { outline, cap, shineX } = shape;

    return (
        <svg viewBox={BOTTLE_VIEW_BOX} className={clsx("blend-bottle", className)} aria-hidden focusable="false">
            <path d={outline} className="blend-bottle__glass" />
            {filled && (
                <>
                    <clipPath id={clipId}>
                        <path d={outline} />
                    </clipPath>
                    <g clipPath={`url(#${clipId})`}>
                        <rect x="0" y={BOTTLE_LIQUID_TOP} width="100" height="76" className="blend-bottle__liquid" />
                        <rect x={shineX} y="46" width="4.5" height="76" rx="2.25" className="blend-bottle__shine" />
                    </g>
                </>
            )}
            <path d={outline} className="blend-bottle__edge" />
            <rect x={cap.x} y={cap.y} width={cap.width} height={cap.height} rx="2" className="blend-bottle__cap" />
        </svg>
    );
};

export default memo(BottleSvg);
