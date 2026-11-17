'use client';
import { useRef, type KeyboardEvent } from "react";
import clsx from "clsx";

export type TextTabItem<T extends string> = { value: T; label: string };

type Props<T extends string> = {
    items: readonly TextTabItem<T>[];
    value: T;
    onChange: (value: T) => void;
    /** 탭 묶음의 이름 (스크린리더용) */
    ariaLabel: string;
    /** 탭이 제어하는 패널의 id — 패널에는 aria-labelledby={textTabId(idPrefix, value)}를 준다 */
    panelId: string;
    /** 탭 id 접두어 (한 페이지에 탭이 여러 개일 때 구분) */
    idPrefix: string;
    className?: string;
};

export const textTabId = (idPrefix: string, value: string) => `${idPrefix}-tab-${value}`;

/**
 * 글자형 탭 — 밑줄·박스 없이 큰 굵은 글자만 나열하고, 선택된 항목만 진하게 표시한다.
 * WAI-ARIA tabs 패턴: 좌우 화살표로 이동, Home/End로 처음·끝.
 * 스타일은 globals.css의 .text-tabs / .text-tab.
 */
function TextTabs<T extends string>({
    items,
    value,
    onChange,
    ariaLabel,
    panelId,
    idPrefix,
    className,
}: Props<T>) {
    const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

    const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
        const last = items.length - 1;
        let next = -1;
        if (e.key === 'ArrowRight') next = index === last ? 0 : index + 1;
        else if (e.key === 'ArrowLeft') next = index === 0 ? last : index - 1;
        else if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = last;
        if (next === -1) return;

        e.preventDefault();
        const nextValue = items[next].value;
        onChange(nextValue);
        tabRefs.current[nextValue]?.focus();
    };

    return (
        <div role="tablist" aria-label={ariaLabel} className={clsx("text-tabs", className)}>
            {items.map((item, index) => {
                const isActive = item.value === value;
                return (
                    <button
                        key={item.value}
                        ref={(el) => { tabRefs.current[item.value] = el; }}
                        type="button"
                        role="tab"
                        id={textTabId(idPrefix, item.value)}
                        aria-selected={isActive}
                        aria-controls={panelId}
                        tabIndex={isActive ? 0 : -1}
                        onClick={() => onChange(item.value)}
                        onKeyDown={(e) => handleKeyDown(e, index)}
                        className="text-tab"
                    >
                        {item.label}
                    </button>
                );
            })}
        </div>
    );
}

export default TextTabs;
