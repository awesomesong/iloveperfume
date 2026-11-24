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
                // 이메일은 보내지 않는다 — 채팅방 참여자 정보 화면만 대화 멤버의 이메일을 보여준다
                select: { id: true, name: true, image: true, role: true },
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
                    id: user.id
                }
            },
            // 전체 회원 목록이므로 이메일은 보내지 않는다
            select: {
                id: true,
                name: true,
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