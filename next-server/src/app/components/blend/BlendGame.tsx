'use client';
import { useCallback, useEffect, useRef, useState } from "react";
import BlendResult from "./BlendResult";
import BottlePicker from "./BottlePicker";
import ScentPicker from "./ScentPicker";
import PageIntro from "@/src/app/components/PageIntro";
import { DEFAULT_BOTTLE_ID } from "@/src/app/lib/blend/bottleShapes";
import { DEFAULT_COLOR_ID } from "@/src/app/lib/blend/perfumeColors";
import { EMPTY_LAYER_NOTES, SCENT_LAYERS, getScentLayer, type LayerNotes, type ScentLayerId } from "@/src/app/lib/blend/scentNotes";
import {
    BLEND_PATH,
    blendPageTitle,
    nextStep,
    parseBlendSearch,
    prevStep,
    resolveStep,
    toBlendSearch,
    type BlendState,
    type BlendStep,
} from "@/src/app/lib/blend/blendParams";

/** 층마다 제목 한 문장 — 그 층이 어떤 향인지 제목만 읽어도 알 수 있게 */
const LAYER_TITLES: Record<ScentLayerId, string> = {
    top: "처음 뿌렸을 때 날 향을 한두 가지 골라 주세요.",
    middle: "향의 중심이 될 향을 한두 가지 골라 주세요.",
    base: "오래 남을 향을 한두 가지 골라 주세요.",
};

type Props = {
    /** 서버가 쿼리스트링에서 읽은 첫 상태 — 새로고침해도 고른 값이 남는다 */
    initial: BlendState;
};

/**
 * 첫 화면의 상태를 정한다.
 * - 주소가 이미 /blend(새로고침, 다른 페이지에서 뒤로·앞으로 가기로 돌아옴): 주소를 읽는다.
 *   돌아올 때 Next는 처음 받은 서버 값(initial)을 다시 넘겨줘서, 그 값을 쓰면 주소와 다른 단계가 열린다.
 * - 주소가 아직 이전 페이지(링크로 들어오는 중): Next가 화면을 먼저 그리고 주소를 나중에 바꾸므로
 *   주소를 읽으면 빈 값이 된다 — 방금 서버가 읽어 준 initial을 쓴다.
 * 새로고침 때는 서버도 같은 주소를 읽었으므로 두 값이 같다(서버·브라우저 첫 화면이 일치).
 */
function readInitialState(initial: BlendState): BlendState {
    if (typeof window === "undefined" || window.location.pathname !== BLEND_PATH) return initial;
    return parseBlendSearch(window.location.search);
}

/**
 * 나만의 향수 만들기 — 단계와 고른 값을 주소 쿼리스트링에 담는다.
 * - 병·색·향을 고를 때: 주소만 덮어쓴다(replaceState). 이 컴포넌트는 다시 그려지지 않는다.
 * - 단계를 넘길 때: 주소를 새로 쌓는다(pushState). 브라우저 뒤로 가기로 이전 단계에 간다.
 */
const BlendGame = ({ initial }: Props) => {
    /** 화면에 그리는 단계와, 그 단계를 열 때 넘겨줄 값 */
    const [view, setView] = useState(() => readInitialState(initial));
    /** 사용자의 최신 선택 — 고를 때마다 바뀌지만 다시 그리지 않으려고 ref에 둔다 */
    const latest = useRef(view);

    const writeUrl = useCallback((mode: "push" | "replace") => {
        const url = `${BLEND_PATH}${toBlendSearch(latest.current)}`;
        if (mode === "push") window.history.pushState(null, "", url);
        else window.history.replaceState(null, "", url);
    }, []);

    const goTo = useCallback(
        (step: BlendStep, patch?: Partial<BlendState>) => {
            const next = { ...latest.current, ...patch };
            latest.current = { ...next, step: resolveStep(step, next.notes) };
            setView(latest.current);
            writeUrl("push");
        },
        [writeUrl],
    );

    // 화면을 처음 열 때도 피커가 알려 오는데, 그때는 주소와 같은 값이라 쓰지 않는다.
    // (첫 렌더의 effect는 Next 라우터가 history를 넘겨받기 전에 돌아서, 그때 쓰면 라우터 상태가 지워진다)
    const handleBottleSelect = useCallback(
        (bottleId: string) => {
            if (latest.current.bottleId === bottleId) return;
            latest.current = { ...latest.current, bottleId };
            writeUrl("replace");
        },
        [writeUrl],
    );

    const handleColorSelect = useCallback(
        (colorId: string) => {
            if (latest.current.colorId === colorId) return;
            latest.current = { ...latest.current, colorId };
            writeUrl("replace");
        },
        [writeUrl],
    );

    const handleNotesSelect = useCallback(
        (notes: LayerNotes) => {
            if (latest.current.notes === notes) return;
            latest.current = { ...latest.current, notes };
            writeUrl("replace");
        },
        [writeUrl],
    );

    // 단계 순서는 BLEND_STEPS 한 곳에서 정한다 — 모든 화면이 같은 이전·다음을 쓴다
    const handleNext = useCallback(() => goTo(nextStep(latest.current.step)), [goTo]);
    const handleBack = useCallback(() => goTo(prevStep(latest.current.step)), [goTo]);
    const handleRestart = useCallback(
        () => goTo("bottle", { bottleId: DEFAULT_BOTTLE_ID, colorId: DEFAULT_COLOR_ID, notes: EMPTY_LAYER_NOTES }),
        [goTo],
    );

    // 뒤로·앞으로 가기: 단계만 주소에서 읽고, 고른 값은 최신 선택을 그대로 쓴다
    // (지나간 주소에는 그때의 선택이 남아 있어서, 그걸 따르면 방금 고른 것이 사라진다)
    useEffect(() => {
        const handlePopState = () => {
            // 이 페이지를 떠나는 뒤로 가기(다른 페이지로 돌아감)도 여기로 온다 — 그 주소는 건드리지 않는다
            if (window.location.pathname !== BLEND_PATH) return;
            const { step } = parseBlendSearch(window.location.search);
            latest.current = { ...latest.current, step: resolveStep(step, latest.current.notes) };
            setView(latest.current);
            writeUrl("replace");
        };
        window.addEventListener("popstate", handlePopState);
        return () => window.removeEventListener("popstate", handlePopState);
    }, [writeUrl]);

    // 단계가 바뀌면 새 화면을 맨 위부터 보여주고, 탭 제목도 바꾼다
    // (서버 제목은 처음 열 때만 정해진다. 뒤 문구는 layout의 title.template과 같다)
    const isFirstRender = useRef(true);
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        window.scrollTo({ top: 0 });
        document.title = `${blendPageTitle(view)} | I Love Perfume`;
    }, [view]);

    if (view.step === "bottle") {
        return (
            <BottlePicker
                initialBottleId={view.bottleId}
                initialColorId={view.colorId}
                onSelect={handleBottleSelect}
                onColorSelect={handleColorSelect}
                onNext={handleNext}
            >
                <PageIntro title="나만의 향수를 담을 병을 골라 주세요." className="blend-picker__head" />
            </BottlePicker>
        );
    }

    if (view.step === "result") {
        return (
            <BlendResult
                bottleId={view.bottleId}
                colorId={view.colorId}
                notes={view.notes}
                onBack={handleBack}
                onRestart={handleRestart}
            >
                <PageIntro title="고른 향과 비슷한 향수를 찾았어요." className="blend-result__head" />
            </BlendResult>
        );
    }

    // 층이 바뀌면 key로 새로 열어, 검색어는 비우고 고른 향은 최신 값으로 시작한다
    const layer = getScentLayer(view.step);
    const eyebrow = `${SCENT_LAYERS.indexOf(layer) + 1} / ${SCENT_LAYERS.length} · ${layer.name}`;
    return (
        <ScentPicker
            key={view.step}
            layer={layer}
            bottleId={view.bottleId}
            colorId={view.colorId}
            initialNotes={view.notes}
            onSelect={handleNotesSelect}
            onBack={handleBack}
            onNext={handleNext}
        >
            <PageIntro eyebrow={eyebrow} title={LAYER_TITLES[view.step]} className="blend-scent__head" />
        </ScentPicker>
    );
};

export default BlendGame;
