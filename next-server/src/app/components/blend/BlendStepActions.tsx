import { memo } from "react";
import Button from "@/src/app/components/Button";

type Props = {
    /** 보조 버튼 글자 — 병 단계는 "랜덤", 향 단계는 "이전" */
    secondaryLabel: string;
    onSecondary: () => void;
    /** 다음 버튼 글자 — 결과 단계는 "다시 만들기" */
    nextLabel?: string;
    /** 결과 단계는 공유가 주요 버튼이라 다시 만들기를 보조 모양으로 낮춘다 */
    nextVariant?: "ilp" | "ghostLavender";
    onNext: () => void;
};

/** 단계 아래 버튼 묶음 — 보조(ghostLavender) + 다음(ilp) */
const BlendStepActions = ({ secondaryLabel, onSecondary, nextLabel = "다음", nextVariant = "ilp", onNext }: Props) => (
    <div className="blend-actions">
        <Button variant="ghostLavender" onClick={onSecondary}>
            {secondaryLabel}
        </Button>
        <Button variant={nextVariant} onClick={onNext} className="flex-1">
            {nextLabel}
        </Button>
    </div>
);

export default memo(BlendStepActions);
