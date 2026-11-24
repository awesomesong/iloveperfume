import { memo, type ChangeEventHandler } from "react";
import { HiCheck, HiPlus } from "react-icons/hi2";
import type { ScentNote } from "@/src/app/lib/blend/scentNotes";

type Props = {
    scent: ScentNote;
    checked: boolean;
    /** 다른 층에 이미 담은 향이면 그 층 이름 — 동그라미 대신 보여 주고, 누르면 토스트로 알린다 */
    takenBy?: string;
    onChange: ChangeEventHandler<HTMLInputElement>;
};

/**
 * 향 한 줄 — 여러 개를 고르므로 체크박스. 이름은 왼쪽(자르지 않고 줄을 바꾼다),
 * 오른쪽 동그라미는 안 고른 줄은 ＋(눌러서 담기), 고른 줄은 채운 동그라미 + 체크.
 * 다른 층에 담은 향은 동그라미 대신 그 층 이름("처음 향")을 흐리게 쓴다.
 */
const ScentOption = ({ scent, checked, takenBy, onChange }: Props) => (
    <label className={takenBy ? "blend-scent-option blend-scent-option--taken" : "blend-scent-option"}>
        <input
            type="checkbox"
            name="scent"
            value={scent.id}
            checked={checked}
            onChange={onChange}
            className="blend-scent-option__input sr-only"
        />
        <span className="blend-scent-option__label">
            {scent.name}
            {takenBy ? (
                <span className="blend-scent-option__taken">{takenBy}</span>
            ) : (
                <span className="blend-scent-option__mark" aria-hidden>
                    <HiPlus className="blend-scent-option__plus" />
                    <HiCheck className="blend-scent-option__check" />
                </span>
            )}
        </span>
    </label>
);

export default memo(ScentOption);
