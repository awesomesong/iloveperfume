import { memo } from "react";
import { HiXMark } from "react-icons/hi2";
import {
    MAX_LAYER_NOTES,
    SCENT_LAYERS,
    scentNoteName,
    type LayerNotes,
    type ScentLayerId,
} from "@/src/app/lib/blend/scentNotes";

type Props = {
    notes: LayerNotes;
    /** 지금 고르는 층 — 이 줄은 개수(1/2)를 붙이고, 고른 향을 눌러 뺄 수 있게 그린다 */
    currentLayerId?: ScentLayerId;
    /** 고른 향 빼기 — 지금 층 줄의 × 버튼 */
    onRemove?: (noteId: string) => void;
};

/**
 * 고른 향을 층별 표로 — "처음 향 | 베르가못, 레몬" 한 줄씩. 향 고르기와 결과가 함께 쓴다.
 * 아직 고르지 않은 층은 뿌린 뒤 언제 나는 향인지(layer.hint)를 보여 준다.
 */
const ScentPyramid = ({ notes, currentLayerId, onRemove }: Props) => (
    <dl className="blend-pyramid" aria-live="polite">
        {SCENT_LAYERS.map((layer) => {
            const ids = notes[layer.id];
            const isCurrent = layer.id === currentLayerId;
            return (
                <div key={layer.id} className={isCurrent ? "blend-pyramid__row blend-pyramid__row--current" : "blend-pyramid__row"}>
                    <dt className="blend-pyramid__label">
                        {layer.name}
                        {isCurrent && <span className="blend-pyramid__count"> {ids.length}/{MAX_LAYER_NOTES}</span>}
                    </dt>
                    {ids.length === 0 ? (
                        <dd className="blend-pyramid__notes blend-pyramid__notes--empty">{layer.hint}</dd>
                    ) : isCurrent && onRemove ? (
                        <dd className="blend-pyramid__notes blend-pyramid__chips">
                            {ids.map((id) => (
                                <button
                                    key={id}
                                    type="button"
                                    onClick={() => onRemove(id)}
                                    className="blend-pyramid__chip"
                                    aria-label={`${scentNoteName(id)} 빼기`}
                                >
                                    {scentNoteName(id)}
                                    <HiXMark aria-hidden className="blend-pyramid__chip-icon" />
                                </button>
                            ))}
                        </dd>
                    ) : (
                        <dd className="blend-pyramid__notes">{ids.map(scentNoteName).join(", ")}</dd>
                    )}
                </div>
            );
        })}
    </dl>
);

export default memo(ScentPyramid);
