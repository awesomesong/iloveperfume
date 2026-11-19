import { memo, type ChangeEventHandler } from "react";
import type { ScentNote } from "@/src/app/lib/blend/scentNotes";

type Props = {
    scent: ScentNote;
    checked: boolean;
    onChange: ChangeEventHandler<HTMLInputElement>;
};

/** 향 한 칸 — 여러 개를 고르므로 체크박스. 이름은 자르지 않고 칸 안에서 줄을 바꾼다 */
const ScentOption = ({ scent, checked, onChange }: Props) => (
    <label className="blend-scent-option">
        <input
            type="checkbox"
            name="scent"
            value={scent.id}
            checked={checked}
            onChange={onChange}
            className="blend-scent-option__input sr-only"
        />
        <span className="blend-scent-option__label">{scent.name}</span>
    </label>
);

export default memo(ScentOption);
