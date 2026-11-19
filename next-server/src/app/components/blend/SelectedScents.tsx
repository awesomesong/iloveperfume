import { memo, type MouseEventHandler } from "react";
import { HiXMark } from "react-icons/hi2";
import { MAX_SCENT_NOTES, SCENT_NOTE_BY_ID } from "@/src/app/lib/blend/scentNotes";

type Props = {
    noteIds: readonly string[];
    /** 누른 칩의 data-id로 어떤 향을 뺄지 안다 — 칩마다 함수를 만들지 않는다 */
    onRemove: MouseEventHandler<HTMLButtonElement>;
};

/** 고른 향 개수와 칩 — 칩을 누르면 그 향을 뺀다 */
const SelectedScents = ({ noteIds, onRemove }: Props) => (
    <>
        <p className="blend-scent__count" aria-live="polite">
            고른 향 {noteIds.length}/{MAX_SCENT_NOTES}
        </p>
        {noteIds.length > 0 && (
            <ul className="blend-chips">
                {noteIds.map((id) => {
                    const name = SCENT_NOTE_BY_ID.get(id)?.name ?? id;
                    return (
                        <li key={id}>
                            <button
                                type="button"
                                className="blend-chip"
                                data-id={id}
                                onClick={onRemove}
                                aria-label={`${name} 빼기`}
                            >
                                {name}
                                <HiXMark aria-hidden />
                            </button>
                        </li>
                    );
                })}
            </ul>
        )}
    </>
);

export default memo(SelectedScents);
