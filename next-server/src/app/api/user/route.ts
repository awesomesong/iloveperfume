import { requireUser } from '../../lib/apiAuth';
import prisma from '../../../../prisma/db';
import { NextResponse } from "next/server";

export async function GET(){
    const auth = await requireUser('로그인이 되지 않았습니다.');
    if (!auth.ok) return auth.response;
    const { user } = auth;

    try {
        const userInfo = await prisma.user.findUnique({
            where: {
                id: user.id
            },
            select: {
                id: true,
                name: true,
                email: true,
                image: true,
                profileImage: true,
                role: true,
                provider: true,
                createdAt: true,
                _count: {
                    select: {
                        conversations: true,
                        messages: true
                    }
                }
            }
        });

        return NextResponse.json({userInfo} , {status: 200});
    } catch (e) {
        console.error('[GET /api/user] error:', e);
        return NextResponse.json({message: "사용자의 정보를 찾지 못했습니다."}, {status: 500});
    }
}