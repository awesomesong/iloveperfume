'use client';
import { memo, useCallback } from "react";
import toast from "react-hot-toast";
import { HiArrowUpOnSquare } from "react-icons/hi2";
import Button from "@/src/app/components/Button";
import { BLEND_PATH, blendResultTitle, toBlendSearch } from "@/src/app/lib/blend/blendParams";

type Props = {
    bottleId: string;
    colorId: string;
    noteIds: readonly string[];
};

/** 클립보드 API가 막힌 곳(일부 앱 내 브라우저)을 위한 옛 복사 방식 */
function copyWithSelection(text: string) {
    const field = document.createElement("textarea");
    field.value = text;
    field.readOnly = true;
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    field.setSelectionRange(0, text.length);
    try {
        return document.execCommand("copy");
    } catch {
        return false;
    } finally {
        field.remove();
    }
}

/** 공유 시트가 없거나(대부분의 데스크톱) 실패하면 링크를 복사한다 */
async function copyLink(url: string) {
    const copied = await navigator.clipboard
        ?.writeText(url)
        .then(() => true)
        .catch(() => false);
    if (copied || copyWithSelection(url)) {
        toast.success("링크를 복사했어요.");
        return;
    }
    toast.error("링크를 복사하지 못했어요. 주소창의 링크를 복사해 주세요.");
}

/**
 * 결과 공유 — 링크에 병·색·향이 담겨 있어, 받은 사람도 같은 결과 화면을 연다.
 * 휴대폰은 기기 공유 시트(카카오톡·메시지 등)를 띄우고, 없으면 링크를 복사한다.
 */
const BlendShareButton = ({ bottleId, colorId, noteIds }: Props) => {
    const handleShare = useCallback(async () => {
        const url = `${window.location.origin}${BLEND_PATH}${toBlendSearch({ step: "result", bottleId, colorId, noteIds })}`;
        if (typeof navigator.share !== "function") {
            await copyLink(url);
            return;
        }
        try {
            await navigator.share({ title: blendResultTitle(noteIds), url });
        } catch (error) {
            // 사용자가 공유 시트를 닫은 것은 실패가 아니다
            if (error instanceof DOMException && error.name === "AbortError") return;
            await copyLink(url);
        }
    }, [bottleId, colorId, noteIds]);

    return (
        <Button variant="ilp" onClick={handleShare} className="w-full">
            <HiArrowUpOnSquare className="size-5 shrink-0" aria-hidden />
            결과 공유하기
        </Button>
    );
};

export default memo(BlendShareButton);
