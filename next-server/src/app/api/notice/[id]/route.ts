import prisma from "@/prisma/db";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/src/app/lib/apiAuth";
import { getCurrentUser } from "@/src/app/lib/session";
import { isNoticeStatus } from "@/src/app/lib/news/categories";

export const runtime = "nodejs";

type ParamsProp = {
    params: Promise<{
        id: string;
    }>
}

export async function GET(req: Request, { params }: ParamsProp) {
    const { id: noticeId } = await params;

    try {
        const notice = await prisma.notice.findUnique({
            where: { id: noticeId },
            select: {
                id: true,
                title: true,
                summary: true,
                category: true,
                status: true,
                sourceUrl: true,
                sourceName: true,
                publishedAt: true,
                image: true,
                createdAt: true,
                _count: {
                    select: { comments: true },
                },
                viewCount: true,
            },
        });

        // 내린 글(HIDDEN)은 관리자에게만 보인다
        if (notice && notice.status !== "PUBLISHED") {
            const user = await getCurrentUser();
            if (user?.role !== "admin") {
                return NextResponse.json({ notice: null }, { status: 200 });
            }
        }

        return NextResponse.json({ notice }, { status: 200 });
    } catch (e) {
        console.error("[GET /api/notice/[id]] error:", e);
        return NextResponse.json({ message: "해당 글을 불러오지 못했습니다." }, { status: 500 });
    }
}

// 관리자 전용: 내리기(HIDDEN) / 다시 게시(PUBLISHED). 잘못 올라온 글을 사후에 내릴 때만 쓴다.
// 행을 삭제하지 않는 이유 — sourceUrl이 남아 있어야 파이프라인이 같은 기사를 다시 올리지 않는다.
export async function PATCH(req: Request, { params }: ParamsProp) {
    const { id: noticeId } = await params;

    try {
        const auth = await requireAdmin(
            "로그인 후에 변경할 수 있습니다.",
            "관리자만 변경할 수 있습니다.",
        );
        if (!auth.ok) return auth.response;

        const body = await req.json().catch(() => null);
        const status = body?.status;
        if (!isNoticeStatus(status)) {
            return NextResponse.json({ message: "잘못된 상태 값입니다." }, { status: 400 });
        }

        const existing = await prisma.notice.findUnique({
            where: { id: noticeId },
            select: { id: true },
        });
        if (!existing) {
            return NextResponse.json({ message: "해당 글을 찾을 수 없습니다." }, { status: 404 });
        }

        const notice = await prisma.notice.update({
            where: { id: noticeId },
            data: { status },
            select: { id: true, status: true },
        });

        return NextResponse.json(
            { message: status === "PUBLISHED" ? "글을 다시 게시했습니다." : "글을 내렸습니다.", notice },
            { status: 200 },
        );
    } catch (e) {
        console.error("[PATCH /api/notice/[id]] error:", e);
        return NextResponse.json({ message: "오류가 발생하여 상태를 변경하지 못했습니다." }, { status: 500 });
    }
}
