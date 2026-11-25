import { NextResponse } from 'next/server';
import prisma from '@/prisma/db';
import { requireUser } from '@/src/app/lib/apiAuth';

export const runtime = 'nodejs';

type Params = Promise<{ scanId: string }>;

/**
 * 로그인 없이 찍은 스캔을 내 스캔 기록에 남긴다.
 * 주인이 비어 있는 스캔만 채운다 — 이미 주인이 있는 스캔은 바꾸지 않는다.
 */
export async function POST(_req: Request, { params }: { params: Params }) {
  try {
    const auth = await requireUser('로그인 후에 저장할 수 있습니다.');
    if (!auth.ok) return auth.response;

    const { scanId } = await params;

    // 조건을 건 한 번의 갱신이라 두 사람이 동시에 눌러도 한 명만 주인이 된다
    const { count } = await prisma.scanResult.updateMany({
      where: { id: scanId, userEmail: null },
      data: { userEmail: auth.user.email },
    });
    if (count === 1) return NextResponse.json({ saved: true });

    const scan = await prisma.scanResult.findUnique({
      where: { id: scanId },
      select: { userEmail: true },
    });
    if (!scan) {
      return NextResponse.json({ message: '스캔 결과를 찾을 수 없습니다.' }, { status: 404 });
    }
    // 이미 내 기록이면 성공으로 본다 (버튼을 두 번 누른 경우)
    if (scan.userEmail === auth.user.email) return NextResponse.json({ saved: true });

    return NextResponse.json({ message: '다른 사람이 이미 저장한 스캔이에요.' }, { status: 409 });
  } catch (err) {
    console.error('[scan/save] error', err);
    return NextResponse.json({ message: '스캔 결과를 저장하지 못했어요.' }, { status: 500 });
  }
}
