import { requireOwner } from '@/src/app/lib/apiAuth';
import prisma from '../../../../../../../prisma/db';
import { NextResponse } from "next/server";

interface ParamsProp {
    params: Promise<{
        commentId?: string;
    }>
}

export async function PUT(
    req: Request,
    { params }: ParamsProp
) {
    const { commentId } = await params;

    try {
        const auth = await requireOwner({
            lookup: () => prisma.comment.findUnique({ where: { id: commentId }, select: { authorEmail: true } }),
            unauthorizedMessage: '로그인 후에 댓글을 수정할 수 있습니다.',
            notFoundMessage: '존재하지 않는 댓글입니다.',
            forbiddenMessage: '해당 댓글을 수정할 권한이 없습니다.',
        });
        if (!auth.ok) return auth.response;

        const { text } = await req.json();

        const updatedComment = await prisma.comment.update({
            where: { id: commentId },
            data: {
                text,
                updatedAt: new Date(),
            },
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

        return NextResponse.json({ updatedComment }, { status: 200 });
    } catch {
        return NextResponse.json({ message: '댓글 수정 중에 오류가 발생했습니다. 다시 시도해주세요.' }, { status: 500 });
    }
}

export async function DELETE(
    req: Request,
    { params }: ParamsProp
) {
    const { commentId } = await params;

    try {
        const auth = await requireOwner({
            lookup: () => prisma.comment.findUnique({ where: { id: commentId }, select: { authorEmail: true } }),
            unauthorizedMessage: '로그인 후에 댓글을 삭제할 수 있습니다.',
            notFoundMessage: '존재하지 않는 댓글입니다.',
            forbiddenMessage: '해당 댓글을 삭제할 권한이 없습니다.',
        });
        if (!auth.ok) return auth.response;

        await prisma.comment.delete({
            where: { id: commentId },
        });

        return NextResponse.json({ message: '댓글이 삭제되었습니다.' }, { status: 200 });
    } catch {
        return NextResponse.json({ message: '댓글 삭제 중에 오류가 발생했습니다. 다시 시도해주세요.' }, { status: 500 });
    }
}
