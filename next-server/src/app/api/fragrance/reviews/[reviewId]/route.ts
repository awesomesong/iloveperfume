import { NextRequest, NextResponse } from "next/server";
import prisma from "@/prisma/db";
import { requireOwner } from "@/src/app/lib/apiAuth";

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
      lookup: () => prisma.fragranceReview.findUnique({ where: { id: reviewId }, select: { authorEmail: true } }),
      unauthorizedMessage: "로그인 후에 삭제할 수 있습니다.",
      notFoundMessage: "존재하지 않는 리뷰입니다.",
      forbiddenMessage: "삭제 권한이 없습니다.",
    });
    if (!auth.ok) return auth.response;

    await prisma.fragranceReview.delete({
      where: { id: reviewId },
    });

    return NextResponse.json({ id: reviewId }, { status: 200 });
  } catch {
    return NextResponse.json(
      { message: "Something went wrong!" },
      { status: 500 }
    );
  }
}
