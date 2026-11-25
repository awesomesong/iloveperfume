import { memo } from "react";
import BottleSvg from "./BottleSvg";
import { getBottleShape } from "@/src/app/lib/blend/bottleShapes";
import { getPerfumeColor } from "@/src/app/lib/blend/perfumeColors";

/** 큰 병 미리보기 — 세 단계가 같은 칸(.blend-preview)을 쓴다. 고른 향수 색은 이 병에만 입힌다 */
const BottlePreview = ({ bottleId, colorId }: { bottleId: string; colorId: string }) => (
    <div className="blend-preview">
        <BottleSvg shape={getBottleShape(bottleId)} tint={getPerfumeColor(colorId).liquidStyle} />
    </div>
);

export default memo(BottlePreview);
