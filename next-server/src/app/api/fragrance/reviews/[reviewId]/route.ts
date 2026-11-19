import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/db";
import { requireOwner } from "@/src/app/lib/apiAuth";
import { queueSocketEvents } from "@/src/app/lib/socketServer/emitSocketEvents";

interface ParamsProp {
  params: Promise<{ reviewId: string }>;
}

export async function PUT(req: NextRequest, { params }: ParamsProp) {
  const { reviewId } = await params;

  try {
    const auth = await requireOwner({
      lookup: () => prisma.fragranceReview.findUnique({ where: { id: reviewId }, select: { authorEmail: true } }),
      unauthorizedMessage: "로그인 후에 수정할 수 있습니다.",
      notFoundMessage: "존재하지 않는 리뷰입니다.",
      forbiddenMessage: "수정 권한이 없습니다.",
    });
    if (!auth.ok) return auth.response;

    const { text } = await req.json();
    const updateReview = await prisma.fragranceReview.update({
      where: { id: reviewId },
      data: { text, updatedAt: new Date() },
    });

    // 다른 접속자 화면에 수정 반영 (수정한 사람 화면은 이미 반영함)
    queueSocketEvents([
      {
        kind: "broadcast",
        event: "fragrance:review:updated",
        payload: { fragranceSlug: updateReview.fragranceSlug, review: updateReview },
        exceptUserIds: [auth.user.id],
      },
    ]);

    return NextResponse.json({ updateReview }, { status: 200 });
  } catch {
    return NextResponse.json(
      { message: "Something went wrong!" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: ParamsProp) {
  const { reviewId } = await params;

  try {
    const auth = await requireOwner({
      lookup: () =>
        prisma.fragranceReview.findUnique({ where: { id: reviewId }, select: { authorEmail: true, fragranceSlug: true } }),
      unauthorizedMessage: "로그인 후에 삭제할 수 있습니다.",
      notFoundMessage: "존재하지 않는 리뷰입니다.",
      forbiddenMessage: "삭제 권한이 없습니다.",
    });
    if (!auth.ok) return auth.response;

    await prisma.fragranceReview.delete({
      where: { id: reviewId },
    });

    // 다른 접속자 화면에서 삭제 반영 (삭제한 사람 화면은 이미 반영함)
    queueSocketEvents([
      {
        kind: "broadcast",
        event: "fragrance:review:deleted",
        payload: { fragranceSlug: auth.record.fragranceSlug, reviewId },
        exceptUserIds: [auth.user.id],
      },
    ]);

    return NextResponse.json({ id: reviewId }, { status: 200 });
  } catch {
    return NextResponse.json(
      { message: "Something went wrong!" },
      { status: 500 }
    );
  }
}
