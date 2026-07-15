import { requireUser } from "@/src/app/lib/apiAuth";
import { NextResponse } from "next/server";
import prisma from "../../../../prisma/db";


export async function GET() {
  const auth = await requireUser("로그인이 되지 않았습니다.");
  if (!auth.ok) return auth.response;
  const { user } = auth;

  try {
    // ✅ 스냅샷 시점 먼저 고정 (모든 쿼리가 이 시점 이전 데이터만 조회)
    const now = new Date();
    const nowMs = now.getTime();

    // 1) 내가 속한 대화방들
    const conversations = await prisma.conversation.findMany({
      orderBy: { lastMessageAt: "desc" },
      where: {
        userIds: {
          has: user.id,
        },
      },
      select: {
        id: true,
        userIds: true,
        isGroup: true,
        isAIChat: true,
        aiAgentType: true,
        name: true,
        lastMessageAt: true,
        lastMessageId: true,
        users: {
          select: {
            id: true,
            name: true,
            image: true,
            email: true,
          },
        },
      },
    });

    if (conversations.length === 0) {
      return NextResponse.json({ conversations: [] }, { status: 200 });
    }

    const conversationIds = conversations.map((c) => c.id);

    // 2) 워터마크 계산: 기본값 먼저 채우고(읽음 레코드 없을 때 0), 읽음 레코드로 덮어쓰기
    const seenMsByConv = new Map<string, number>(
      conversations.map(c => [c.id, 0]) // ✅ 읽음 레코드 없으면 0으로 초기화 → 과거 메시지가 안읽음으로 집계됨
    );

    // 읽음 레코드 조회
    const reads = await prisma.conversationRead.findMany({
      where: { userId: user.id, conversationId: { in: conversationIds } },
      select: { conversationId: true, lastSeenAt: true, lastSeenMsgId: true },
    });

    // lastSeenMsgId가 가리키는 메시지의 createdAt (system은 워터마크에 반영하지 않음)
    const seenMsgIds = reads.map(r => r.lastSeenMsgId).filter(Boolean) as string[];
    const seenMsgs = seenMsgIds.length
      ? await prisma.message.findMany({
          where: { 
            id: { in: seenMsgIds },
            OR: [{ type: null }, { type: { not: "system" } }],
          },
          select: { id: true, createdAt: true },
        })
      : [];
    const seenMsgMap = new Map(seenMsgs.map(m => [m.id, m.createdAt]));

    for (const r of reads) {
      const base = seenMsByConv.get(r.conversationId) ?? nowMs;
      const a = r.lastSeenAt?.getTime?.() ?? 0;
      const b = r.lastSeenMsgId ? (seenMsgMap.get(r.lastSeenMsgId)?.getTime?.() ?? 0) : 0;
      seenMsByConv.set(r.conversationId, Math.max(base, a, b));
    }

    // 3) ✅ 미리보기 + 안읽음 수 + lastMessageAtMs를 두 개의 배치 raw 쿼리로 일괄 조회
    type MsgRow = {
      conversationId: string;
      id: string;
      body: string | null;
      type: string | null;
      createdAt: Date;
      senderId: string | null;
      isAIResponse: boolean | null;
    };

    const lastMessageMap = new Map<string, {
      id: string; body: string | null; type: string | null; createdAt: Date;
      senderId?: string | null; isAIResponse?: boolean | null;
    }>();
    const unreadMap = new Map<string, number>();
    const lastMessageAtMsMap = new Map<string, number>();

    // 3-1) 모든 방의 최신 비-시스템 메시지 1건씩 (DISTINCT ON)
    const latestRows = await prisma.$queryRaw<MsgRow[]>`
      SELECT DISTINCT ON ("conversationId")
        "conversationId", "id", "body", "type", "createdAt", "senderId", "isAIResponse"
      FROM "Message"
      WHERE "conversationId" = ANY(${conversationIds}::text[])
        AND "createdAt" <= ${now}
        AND ("type" IS NULL OR "type" <> 'system')
      ORDER BY "conversationId", "createdAt" DESC
    `;

    const latestByConv = new Map<string, MsgRow>();
    for (const row of latestRows) {
      latestByConv.set(row.conversationId, row);
      lastMessageAtMsMap.set(row.conversationId, row.createdAt.getTime());
    }

    // 3-2) 비-AI 방의 안읽음 수 + 최신 안읽음 메시지 (워터마크 join)
    const nonAiConvs = conversations.filter((c) => !c.isAIChat);
    for (const c of conversations) {
      if (c.isAIChat) unreadMap.set(c.id, 0);
    }

    if (nonAiConvs.length > 0) {
      const nonAiIds = nonAiConvs.map((c) => c.id);
      const watermarks = nonAiConvs.map((c) => new Date(seenMsByConv.get(c.id) ?? 0));

      const unreadRows = await prisma.$queryRaw<Array<MsgRow & { cnt: bigint }>>`
        WITH wm AS (
          SELECT * FROM unnest(${nonAiIds}::text[], ${watermarks}::timestamptz[]) AS t(cid, ts)
        ),
        filtered AS (
          SELECT m."conversationId", m."id", m."body", m."type", m."createdAt", m."senderId", m."isAIResponse"
          FROM "Message" m
          JOIN wm ON m."conversationId" = wm.cid
          WHERE m."createdAt" > wm.ts
            AND m."createdAt" <= ${now}
            AND m."senderId" <> ${user.id}
            AND (m."isAIResponse" IS NULL OR m."isAIResponse" = false)
            AND (m."type" IS NULL OR m."type" <> 'system')
        ),
        counts AS (
          SELECT "conversationId", COUNT(*)::bigint AS cnt FROM filtered GROUP BY "conversationId"
        ),
        latest AS (
          SELECT DISTINCT ON ("conversationId")
            "conversationId", "id", "body", "type", "createdAt", "senderId", "isAIResponse"
          FROM filtered
          ORDER BY "conversationId", "createdAt" DESC
        )
        SELECT c."conversationId", c.cnt, l."id", l."body", l."type", l."createdAt", l."senderId", l."isAIResponse"
        FROM counts c
        JOIN latest l ON c."conversationId" = l."conversationId"
      `;

      const latestUnreadByConv = new Map<string, MsgRow>();
      for (const row of unreadRows) {
        unreadMap.set(row.conversationId, Number(row.cnt));
        latestUnreadByConv.set(row.conversationId, {
          conversationId: row.conversationId,
          id: row.id,
          body: row.body,
          type: row.type,
          createdAt: row.createdAt,
          senderId: row.senderId,
          isAIResponse: row.isAIResponse,
        });
      }

      // 비-AI 방 미리보기: 안읽음 최신 우선, 없으면 전체 최신
      for (const c of nonAiConvs) {
        if (!unreadMap.has(c.id)) unreadMap.set(c.id, 0);
        const preview = latestUnreadByConv.get(c.id) ?? latestByConv.get(c.id);
        if (preview) {
          lastMessageMap.set(c.id, {
            id: preview.id,
            body: preview.body,
            type: preview.type ?? null,
            createdAt: preview.createdAt,
            senderId: preview.senderId ?? null,
            isAIResponse: preview.isAIResponse ?? null,
          });
        }
      }
    }

    // AI 방 미리보기: 전체 최신 메시지 사용
    for (const c of conversations) {
      if (!c.isAIChat) continue;
      const latest = latestByConv.get(c.id);
      if (latest) {
        lastMessageMap.set(c.id, {
          id: latest.id,
          body: latest.body,
          type: latest.type ?? null,
          createdAt: latest.createdAt,
          senderId: latest.senderId ?? null,
          isAIResponse: latest.isAIResponse ?? null,
        });
      }
    }

    // 4) ✅ 응답 조립 - 동일 시점의 데이터로 일관성 보장
    const conversationsWithDetails = conversations.map((conversation) => {
      const lastMessage = lastMessageMap.get(conversation.id) || null;
      const unReadCount = unreadMap.get(conversation.id) ?? 0;
      const lastMessageAtMs = lastMessageAtMsMap.get(conversation.id) ?? null;

      return {
        ...conversation,
        messages: lastMessage ? [lastMessage] : [],
        unReadCount,
        lastMessageAtMs, // ✅ 미리보기 메시지의 createdAt과 동일한 시점
        lastMessageId: lastMessage?.id ?? conversation.lastMessageId,
      };
    });

    return NextResponse.json(
      { conversations: conversationsWithDetails },
      { status: 200 }
    );
  } catch (e) {
    console.error('[GET /api/conversations] error:', e);
    return NextResponse.json(
      { message: "대화방을 불러오는 중 오류가 발생하였습니다." },
      { status: 500 },
    );
  }
}
