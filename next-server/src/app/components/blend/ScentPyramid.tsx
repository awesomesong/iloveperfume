import { memo } from "react";
import { SCENT_LAYERS, notesInLayer, scentNoteName } from "@/src/app/lib/blend/scentNotes";

/**
 * 고른 향을 층별 표로 — "처음 향 | 베르가못, 레몬" 한 줄씩. 향 고르기와 결과가 함께 쓴다.
 * 빼기는 목록에서 다시 눌러 한다(다른 층은 "이전"으로 돌아가서).
 */
const ScentPyramid = ({ noteIds }: { noteIds: readonly string[] }) => (
    <dl className="blend-pyramid" aria-live="polite">
        {SCENT_LAYERS.map((layer) => {
            const names = notesInLayer(noteIds, layer.id).map(scentNoteName);
            return (
                <div key={layer.id} className="blend-pyramid__row">
                    <dt className="blend-pyramid__label">{layer.name}</dt>
                    <dd className={names.length > 0 ? "blend-pyramid__notes" : "blend-pyramid__notes blend-pyramid__notes--empty"}>
                        {names.length > 0 ? names.join(", ") : "아직 고르지 않았어요"}
                    </dd>
                </div>
            );
        })}
    </dl>
);

export default memo(ScentPyramid);
