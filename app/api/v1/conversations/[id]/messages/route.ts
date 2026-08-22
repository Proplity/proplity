import { NextResponse } from 'next/server';
import { z } from 'zod';
import { MessageChannel } from '@prisma/client';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { parseCursorPagination, buildCursorMeta } from '@/lib/api/pagination';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';

type RouteCtx = { params: Promise<{ id: string }> };

async function isParticipant(conversationId: string, userId: string) {
  const row = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  return !!row;
}

export const GET = withAuth(async (req, { session }, ctx: RouteCtx) => {
  const { id } = await ctx.params;

  try {
    if (!(await isParticipant(id, session.sub))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { take, cursor } = parseCursorPagination(req.nextUrl.searchParams);
    const rows = await prisma.message.findMany({
      where: { conversationId: id },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
    });

    // Viewing a conversation's messages marks it read -- resolves the known
    // gap (CLAUDE.md: "unreadCount only grows") the simplest way a v1
    // polling-based client actually reads messages: opening the thread.
    // Awaited so the read-marker is durable before the response returns,
    // but failing to mark read shouldn't fail the message fetch itself.
    try {
      await prisma.conversationParticipant.update({
        where: { conversationId_userId: { conversationId: id, userId: session.sub } },
        data: { lastReadAt: new Date() },
      });
    } catch {
      // ignore -- unread count staying stale is not worth failing the request over
    }

    const { page, meta } = buildCursorMeta(rows, take);
    return NextResponse.json({ data: page, meta });
  } catch (err) {
    return handleApiError(err);
  }
});

const createMessageSchema = z.object({
  body: z.string().min(1),
  channel: z.nativeEnum(MessageChannel).optional(),
  attachmentUrls: z.array(z.string()).optional(),
});

export const POST = withAuth(async (req, { session }, ctx: RouteCtx) => {
  const { id } = await ctx.params;

  try {
    if (!(await isParticipant(id, session.sub))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const validated = await validateBody(req, createMessageSchema);
    if (!validated.success) return validated.response;

    const [message] = await prisma.$transaction([
      prisma.message.create({
        data: { conversationId: id, senderId: session.sub, senderType: 'USER', ...validated.data },
      }),
      prisma.conversation.update({ where: { id }, data: { updatedAt: new Date() } }),
    ]);

    return NextResponse.json({ data: message }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
});
