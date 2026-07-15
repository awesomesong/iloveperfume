import prisma from '@/prisma/db';
import { requireUser } from "@/src/app/lib/apiAuth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest){
    const auth = await requireUser('로그인이 필요합니다.');
    if (!auth.ok) return auth.response;
    const { user } = auth;

    try {
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get('userId');

        if (userId) {
            const target = await prisma.user.findUnique({
                where: { id: userId },
                select: { id: true, name: true, email: true, image: true, role: true },
            });
            if (!target) {
                return NextResponse.json({ message: '유저를 찾을 수 없습니다.' }, { status: 404 });
            }
            return NextResponse.json({ user: target }, { status: 200 });
        }

        const users = await prisma.user.findMany({
            orderBy: {
                name: 'asc',
            },
            where: {
                NOT: {
                    email: user.email
                }
            },
            select: {
                id: true,
                name: true,
                email: true,
                image: true,
                role: true
            }
        });

        return NextResponse.json({ users }, { status: 200 });
    } catch (e) {
        console.error('[GET /api/chatMember] error:', e);
        return NextResponse.json({message: '채팅 멤버를 찾지 못했습니다.'}, { status: 500 });
    }
};