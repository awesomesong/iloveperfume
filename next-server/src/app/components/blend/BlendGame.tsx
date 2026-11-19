'use client';
import { useCallback, useEffect, useRef, useState } from "react";
import BlendResult from "./BlendResult";
import BottlePicker from "./BottlePicker";
import ScentPicker from "./ScentPicker";
import PageIntro from "@/src/app/components/PageIntro";
import { DEFAULT_BOTTLE_ID } from "@/src/app/lib/blend/bottleShapes";
import {
    parseBlendSearch,
    resolveStep,
    toBlendSearch,
    type BlendState,
    type BlendStep,
} from "@/src/app/lib/blend/blendParams";

type Props = {
    /** 서버가 쿼리스트링에서 읽은 첫 상태 — 새로고침해도 고른 값이 남는다 */
    initial: BlendState;
};

/**
 * 나만의 향수 만들기 — 단계와 고른 값을 주소 쿼리스트링에 담는다.
 * - 병·향을 고를 때: 주소만 덮어쓴다(replaceState). 이 컴포넌트는 다시 그려지지 않는다.
 * - 단계를 넘길 때: 주소를 새로 쌓는다(pushState). 브라우저 뒤로 가기로 이전 단계에 간다.
 */
const BlendGame = ({ initial }: Props) => {
    /** 화면에 그리는 단계와, 그 단계를 열 때 넘겨줄 값 */
    const [view, setView] = useState(initial);
    /** 사용자의 최신 선택 — 고를 때마다 바뀌지만 다시 그리지 않으려고 ref에 둔다 */
    const latest = useRef(initial);

    const writeUrl = useCallback((mode: "push" | "replace") => {
        const url = `${window.location.pathname}${toBlendSearch(latest.current)}`;
        if (mode === "push") window.history.pushState(null, "", url);
        else window.history.replaceState(null, "", url);
    }, []);

    const goTo = useCallback(
        (step: BlendStep, patch?: Partial<BlendState>) => {
            const next = { ...latest.current, ...patch };
            latest.current = { ...next, step: resolveStep(step, next.noteIds) };
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

    const handleNotesSelect = useCallback(
        (noteIds: readonly string[]) => {
            if (latest.current.noteIds === noteIds) return;
            latest.current = { ...latest.current, noteIds };
            writeUrl("replace");
        },
        [writeUrl],
    );

    const handleBottleNext = useCallback(() => goTo("scent"), [goTo]);
    const handleScentBack = useCallback(() => goTo("bottle"), [goTo]);
    const handleScentNext = useCallback(() => goTo("result"), [goTo]);
    const handleResultBack = useCallback(() => goTo("scent"), [goTo]);
    const handleRestart = useCallback(
        () => goTo("bottle", { bottleId: DEFAULT_BOTTLE_ID, noteIds: [] }),
        [goTo],
    );

    // 뒤로·앞으로 가기: 단계만 주소에서 읽고, 고른 값은 최신 선택을 그대로 쓴다
    // (지나간 주소에는 그때의 선택이 남아 있어서, 그걸 따르면 방금 고른 것이 사라진다)
    useEffect(() => {
        const handlePopState = () => {
            const { step } = parseBlendSearch(window.location.search);
            latest.current = { ...latest.current, step: resolveStep(step, latest.current.noteIds) };
            setView(latest.current);
            writeUrl("replace");
        };
        window.addEventListener("popstate", handlePopState);
        return () => window.removeEventListener("popstate", handlePopState);
    }, [writeUrl]);

    // 단계가 바뀌면 새 화면을 맨 위부터 보여준다
    const isFirstRender = useRef(true);
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        window.scrollTo({ top: 0 });
    }, [view.step]);

    if (view.step === "bottle") {
        return (
            <BottlePicker initialBottleId={view.bottleId} onSelect={handleBottleSelect} onNext={handleBottleNext}>
                <PageIntro title="나만의 향수를 담을 병을 골라 주세요." className="blend-picker__head" />
            </BottlePicker>
        );
    }

    if (view.step === "result") {
        return (
            <BlendResult
                bottleId={view.bottleId}
                noteIds={view.noteIds}
                onBack={handleResultBack}
                onRestart={handleRestart}
            >
                <PageIntro title="고른 향과 비슷한 향수를 찾았어요." className="blend-result__head" />
            </BlendResult>
        );
    }

    return (
        <ScentPicker
            bottleId={view.bottleId}
            initialNoteIds={view.noteIds}
            onSelect={handleNotesSelect}
            onBack={handleScentBack}
            onNext={handleScentNext}
        >
            <PageIntro title="병에 담을 향을 골라 주세요." className="blend-scent__head" />
        </ScentPicker>
    );
};

export default BlendGame;
