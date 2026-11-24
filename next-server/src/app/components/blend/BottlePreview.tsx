import { memo } from "react";
import BottleSvg from "./BottleSvg";
import { getBottleShape } from "@/src/app/lib/blend/bottleShapes";

/** 큰 병 미리보기(액체까지 그린다) — 세 단계가 같은 칸(.blend-preview)을 쓴다 */
const BottlePreview = ({ bottleId }: { bottleId: string }) => (
    <div className="blend-preview">
        <BottleSvg shape={getBottleShape(bottleId)} filled />
    </div>
);

export default memo(BottlePreview);
