import { memo, type ChangeEventHandler } from "react";
import BottleSvg from "./BottleSvg";
import type { BottleShape } from "@/src/app/lib/blend/bottleShapes";

type Props = {
    shape: BottleShape;
    checked: boolean;
    onChange: ChangeEventHandler<HTMLInputElement>;
};

/** 병 선택지 한 칸 — 화살표 키 이동과 단일 선택은 라디오 버튼 기본 동작에 맡긴다 */
const BottleOption = ({ shape, checked, onChange }: Props) => (
    <label className="blend-option">
        <input
            type="radio"
            name="bottle-shape"
            value={shape.id}
            checked={checked}
            onChange={onChange}
            className="blend-option__input sr-only"
        />
        <span className="blend-option__card">
            <BottleSvg shape={shape} />
            {shape.name}
        </span>
    </label>
);

export default memo(BottleOption);
