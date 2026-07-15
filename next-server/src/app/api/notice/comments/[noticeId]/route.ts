import { requireUser } from '@/src/app/lib/apiAuth';
import prisma from '../../../../../../prisma/db';
import { NextRequest, NextResponse } from "next/server";

interface ParamsProp {
    params: Promise<{
        noticeId?: string;
    }>
}

export async function GET(
    req: NextRequest,
    { params }: ParamsProp
){
    try {
        const { noticeId } = await params;
        const limit = 15;
        const cursor  = req.nextUrl.searchParams.get('cursor') || null;

        const commentsCount = await prisma.comment.count({
            where: {
                noticeId: noticeId    
            },
        });

        const comments = await prisma.comment.findMany({
            where: {
                noticeId
            },
            orderBy: {
                createdAt: 'desc'
            },
            ...(cursor && {
                cursor: {
                    id: cursor,
                }
            }),
            take: limit,
            skip: cursor ? 1 : 0,
            select: {
                id: true,
                text: true,
                authorEmail: true,
                createdAt: true,
                updatedAt: true,
                noticeId: true,
                author: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        image: true,
                        profileImage: true,
                        role: true,
                    }
                },
            }
        });
        return NextResponse.json({comments, commentsCount}, { status: 200 });
    } catch (e) {
        console.error('[notice comments GET] error:', e);
        return NextResponse.json({message: '댓글을 불러오지 못했습니다.'}, { status: 500 });
    }
}

export async function POST(
    req: Request,
    { params }: ParamsProp
){
    const { noticeId } = await params;

    try {
        const auth = await requireUser('로그인 후에 댓글을 작성할 수 있습니다.');
        if (!auth.ok) return auth.response;
        const { user } = auth;

        const { text } = await req.json();
        const newComment = await prisma.comment.create({
            data: {
                noticeId: noticeId,
                text,
                authorEmail: user.email,
            }
        });
        return NextResponse.json({newComment}, {status: 200});

    } catch {
        return NextResponse.json({message: 'Something went wrong!'}, { status: 500 });
    }
}
