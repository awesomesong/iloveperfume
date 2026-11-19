import { NextResponse } from "next/server";
import { recommendFragrances } from "@/src/app/lib/blend/recommendFragrances";
import { MAX_SCENT_NOTES, SCENT_NOTE_BY_ID } from "@/src/app/lib/blend/scentNotes";

export const runtime = "nodejs";

/** 나만의 향수 만들기 결과 — 고른 향 id로 비슷한 실제 향수를 돌려준다. 로그인 없이 쓴다. */
export async function POST(req: Request) {
    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ message: "요청 형식이 올바르지 않아요." }, { status: 400 });
    }

    const noteIds = (body as { noteIds?: unknown })?.noteIds;
    const isValid =
        Array.isArray(noteIds) &&
        noteIds.length > 0 &&
        noteIds.length <= MAX_SCENT_NOTES &&
        new Set(noteIds).size === noteIds.length &&
        noteIds.every((id) => typeof id === "string" && SCENT_NOTE_BY_ID.has(id));
    if (!isValid) {
        return NextResponse.json(
            { message: `향을 1~${MAX_SCENT_NOTES}가지 골라 주세요.` },
            { status: 400 },
        );
    }

    try {
        const fragrances = await recommendFragrances(noteIds as string[]);
        return NextResponse.json({ fragrances }, { status: 200 });
    } catch (error) {
        console.error("Error recommending fragrances:", error);
        return NextResponse.json({ message: "추천 향수를 가져오지 못했어요." }, { status: 500 });
    }
}
