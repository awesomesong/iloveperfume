import prisma from "@/prisma/db";
import { NextRequest, NextResponse } from "next/server";
import { isNewsCategory, type NewsCategory } from "@/src/app/lib/news/categories";

export const runtime = "nodejs";

const LIMIT = 24;

// 향수 뉴스 목록. 글은 /api/cron/perfume-news 파이프라인만 생성한다 (POST 없음).
export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const cursor = searchParams.get("cursor") || null;
    const categoryParam = searchParams.get("category");

    if (categoryParam && !isNewsCategory(categoryParam)) {
        return NextResponse.json({ message: "잘못된 카테고리입니다." }, { status: 400 });
    }
    // 위 가드가 이미 검증했으니 다시 isNewsCategory를 부르지 않고 타입만 좁힌다.
    const category = categoryParam as NewsCategory | null;

    try {
        const noticePosts = await prisma.notice.findMany({
            where: {
                status: "PUBLISHED",
                ...(category && { category }),
            },
            orderBy: [
                { publishedAt: "desc" },
                { id: "desc" },
            ],
            ...(cursor && { cursor: { id: cursor } }),
            take: LIMIT,
            skip: cursor ? 1 : 0,
            select: {
                id: true,
                title: true,
                summary: true,
                category: true,
                status: true,
                sourceName: true,
                publishedAt: true,
                image: true,
                _count: {
                    select: { comments: true },
                },
                viewCount: true,
            },
        });

        return NextResponse.json({ noticePosts }, { status: 200 });
    } catch (e) {
        console.error("[GET /api/notice] error:", e);
        return NextResponse.json({ message: "향수 뉴스를 불러오지 못했습니다." }, { status: 500 });
    }
}
