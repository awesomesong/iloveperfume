import { requireUser } from "@/src/app/lib/apiAuth";
import { NextResponse } from "next/server";
import prisma from '@/prisma/db'

export async function POST(req: Request) {
    try {
        const { name, image } = await req.json();

        const auth = await requireUser('로그인이 되지 않았습니다. 로그인 후에 이용해주세요.');
        if (!auth.ok) return auth.response;
        const { user } = auth;

        const updateUser = await prisma.user.update({
            where: {
                id: user.id
            },
            data: {
                name: name,
                image: image
            }
        });

        return NextResponse.json(updateUser);
    } catch(error) {
        console.log('ERROR_SETTINGS', error);
        return NextResponse.json({message: "예상치 못한 에러가 발생하였습니다.", status: 500});
    }
}