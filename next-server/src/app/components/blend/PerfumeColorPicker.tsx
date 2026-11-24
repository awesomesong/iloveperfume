import { memo, type ChangeEventHandler, type CSSProperties } from "react";
import { PERFUME_COLORS, getPerfumeColor, type PerfumeColor } from "@/src/app/lib/blend/perfumeColors";

type OptionProps = {
    color: PerfumeColor;
    checked: boolean;
    onChange: ChangeEventHandler<HTMLInputElement>;
};

/** 색 견본 한 칸 — 화살표 키 이동과 단일 선택은 라디오 버튼 기본 동작에 맡긴다 */
const ColorOption = memo(({ color, checked, onChange }: OptionProps) => (
    <label className="blend-color" title={color.name}>
        <input
            type="radio"
            name="perfume-color"
            value={color.id}
            checked={checked}
            onChange={onChange}
            className="blend-color__input sr-only"
        />
        <span className="blend-color__swatch" style={{ "--blend-swatch": color.swatch } as CSSProperties} />
        <span className="sr-only">{color.name}</span>
    </label>
));
ColorOption.displayName = "ColorOption";

type Props = {
    selectedId: string;
    onChange: ChangeEventHandler<HTMLInputElement>;
};

/**
 * 향수 색 고르기 — 고른 색 이름 한 줄 + 색 견본 표(12개씩 네 줄, Apple 구매 화면의 색상 선택 근거).
 * 색을 바꾸면 이름과 선택이 바뀐 두 칸만 다시 그린다. 스타일은 globals.css의 .blend-color*.
 */
const PerfumeColorPicker = ({ selectedId, onChange }: Props) => (
    <fieldset className="blend-colors">
        <legend className="sr-only">향수 색</legend>
        <p className="blend-colors__label" aria-hidden>
            향수 색<strong>{getPerfumeColor(selectedId).name}</strong>
        </p>
        <div className="blend-colors__list">
            {PERFUME_COLORS.map((color) => (
                <ColorOption key={color.id} color={color} checked={color.id === selectedId} onChange={onChange} />
            ))}
        </div>
    </fieldset>
);

export default memo(PerfumeColorPicker);
