import prisma from '../../../../prisma/db';
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from 'next/cache';
import { requireUser } from '../../lib/apiAuth';
import { generateBrandIndexSlug } from '../../lib/fragranceSlug';

export async function GET(req: NextRequest) {
    try {
        const cursorParam = req.nextUrl.searchParams.get('cursor');
        const cursor = cursorParam ? cursorParam : null;
        const limit = 12;

        const fragrances = await prisma.fragrance.findMany({
            include: {
                author: { select: { id: true, name: true, email: true, image: true, profileImage: true, role: true } }
            },
            orderBy: [
                { createdAt: 'desc' },
                { id: 'desc' },
            ],
            ...(cursor && {
                cursor: {
                    id: cursor
                }
            }),
            take: limit,
            skip: cursor ? 1 : 0,
        });

        return NextResponse.json({ fragrances }, { status: 200 });
    } catch (error) {
        console.error('Error fetching fragrance:', error);
        return NextResponse.json({ message: '향수 정보를 가져오는데 실패했습니다.' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const auth = await requireUser('로그인 후에 글을 작성해주세요.');
        if (!auth.ok) return auth.response;
        const { user } = auth;

        const { brand, name, images, description, notes } = await req.json();

        if (!brand || !name) {
            return NextResponse.json({ message: '브랜드와 이름은 필수 입력값입니다.' }, { status: 400 });
        }
        if (!description) {
            return NextResponse.json({ message: '향수 상세 설명은 필수 입력값입니다.' }, { status: 400 });
        }
        if (!images?.length) {
            return NextResponse.json({ message: '향수 이미지는 필수 입력값입니다.' }, { status: 400 });
        }

        // optional 필드(notes): 빈 문자열이면 DB에 null로 저장
        const notesValue = (notes?.trim() ?? '') === '' ? null : notes;

        const slug = await generateBrandIndexSlug(brand);

        const newFragrance = await prisma.fragrance.create({
            data: {
                brand,
                name,
                slug,
                images: images ?? [],
                description,
                notes: notesValue,
                authorEmail: user.email,
            },
            include: {
                author: {
                    select: { id: true, name: true, email: true, image: true, profileImage: true },
                },
            },
        });

        // SSG로 미리 빌드된 슬러그 목록에 없는 신규 향수라, 첫 조회 전에 캐시를 채워둠
        revalidatePath(`/fragrance/${newFragrance.slug}`);

        return NextResponse.json({ newFragrance }, { status: 200 });
    } catch (error: unknown) {
        if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2002') {
            return NextResponse.json({ message: '이미 존재하는 슬러그입니다.' }, { status: 400 });
        }
        return NextResponse.json({ message: 'Something went wrong!' }, { status: 500 });
    }
}
