'use client';
import { useCallback, useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import BottleOption from "./BottleOption";
import BottlePreview from "./BottlePreview";
import BlendStepActions from "./BlendStepActions";
import { BOTTLE_SHAPES, pickOtherBottleId } from "@/src/app/lib/blend/bottleShapes";

type Props = {
    initialBottleId: string;
    /** 병을 바꿀 때마다 — 주소(쿼리스트링)에 남긴다 */
    onSelect: (bottleId: string) => void;
    onNext: () => void;
    /** 제목 영역 — 부모가 만든 요소를 그대로 받아, 병을 바꿔도 다시 그리지 않는다 */
    children: ReactNode;
};

/**
 * 병 모양 선택 — 큰 미리보기 하나와 선택지 한 줄.
 * 병을 바꾸면 미리보기와 선택이 바뀐 두 칸만 다시 그린다. 스타일은 globals.css의 .blend-*.
 */
const BottlePicker = ({ initialBottleId, onSelect, onNext, children }: Props) => {
    const [selectedId, setSelectedId] = useState(initialBottleId);
    const optionsRef = useRef<HTMLFieldSetElement>(null);

    const handleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
        setSelectedId(event.target.value);
    }, []);

    const handleRandom = useCallback(() => {
        // 난수는 밖에서 뽑아 상태 갱신 함수를 순수하게 둔다
        const roll = Math.random();
        setSelectedId((current) => pickOtherBottleId(current, roll));
    }, []);

    useEffect(() => {
        onSelect(selectedId);
        // 모바일 가로 줄에서 고른 병이 가운데로 오게 한다 (가로로만 움직여 페이지는 튀지 않는다)
        const list = optionsRef.current;
        const option = list?.querySelector<HTMLInputElement>("input:checked")?.parentElement;
        if (!list || !option) return;
        list.scrollTo({ left: option.offsetLeft - (list.clientWidth - option.offsetWidth) / 2 });
    }, [selectedId, onSelect]);

    return (
        <section className="blend-picker">
            {children}
            <BottlePreview bottleId={selectedId} />
            <fieldset ref={optionsRef} className="blend-options">
                <legend className="sr-only">병 모양</legend>
                {BOTTLE_SHAPES.map((shape) => (
                    <BottleOption
                        key={shape.id}
                        shape={shape}
                        checked={shape.id === selectedId}
                        onChange={handleChange}
                    />
                ))}
            </fieldset>
            <BlendStepActions secondaryLabel="랜덤" onSecondary={handleRandom} onNext={onNext} />
        </section>
    );
};

export default BottlePicker;
