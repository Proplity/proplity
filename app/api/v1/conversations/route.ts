import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ConversationType } from '@prisma/client';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';
import { checkFreeformParticipants } from '@/lib/api/messagingAccess';
import { canManageProperty } from '@/lib/api/propertyAccess';
import { syncThreadVendor } from '@/lib/maintenanceFlow';

export const GET = withAuth(async (_req, { session }) => {
  try {
    const participantRows = await prisma.conversationParticipant.findMany({
      where: { userId: session.sub },
      include: {
        conversation: {
          include: {
            participants: {
              include: { user: { select: { id: true, name: true, avatarUrl: true, role: true } } },
            },
            property: { select: { id: true, name: true } },
            rent: {
              select: {
                unit: {
                  select: { unitNumber: true, property: { select: { id: true, name: true } } },
                },
              },
            },
            maintenanceRequest: { select: { title: true } },
          },
        },
      },
    });

    const data = await Promise.all(
      participantRows.map(async (p) => {
        // Someone whose tenancy ended sees the thread as it stood when they left (ISS-142).
        const visible = p.leftAt ? { lte: p.leftAt } : undefined;
        const [lastMessage, unreadCount] = await Promise.all([
          prisma.message.findFirst({
            where: { conversationId: p.conversationId, createdAt: visible },
            orderBy: { createdAt: 'desc' },
          }),
          prisma.message.count({
            where: {
              conversationId: p.conversationId,
              createdAt: { gt: p.lastReadAt ?? new Date(0), ...visible },
              senderId: { not: session.sub },
            },
          }),
        ]);
        return {
          ...p.conversation,
          lastMessage,
          lastReadAt: p.lastReadAt,
          leftAt: p.leftAt,
          unreadCount,
        };
      }),
    );

    data.sort((a, b) => {
      const aTime = (a.lastMessage?.createdAt ?? a.updatedAt).getTime();
      const bTime = (b.lastMessage?.createdAt ?? b.updatedAt).getTime();
      return bTime - aTime;
    });

    return NextResponse.json({ data });
  } catch (err) {
    return handleApiError(err);
  }
});

const createConversationSchema = z.object({
  type: z.nativeEnum(ConversationType),
  title: z.string().optional(),
  participantIds: z.array(z.string()).optional(),
  maintenanceRequestId: z.string().optional(),
  rentId: z.string().optional(),
  propertyId: z.string().optional(),
});

export const POST = withAuth(async (req, { session }) => {
  try {
    const validated = await validateBody(req, createConversationSchema);
    if (!validated.success) return validated.response;
    const {
      type,
      title,
      participantIds = [],
      maintenanceRequestId,
      rentId,
      propertyId,
    } = validated.data;

    // MAINTENANCE_THREAD: one thread per request (maintenanceRequestId is
    // @unique on Conversation) -- participants derived from the request's
    // tenant/vendor/property staff rather than caller-supplied.
    if (type === 'MAINTENANCE_THREAD') {
      if (!maintenanceRequestId) {
        return NextResponse.json(
          { error: 'maintenanceRequestId is required for MAINTENANCE_THREAD' },
          { status: 400 },
        );
      }
      const request = await prisma.maintenanceRequest.findUnique({
        where: { id: maintenanceRequestId },
        include: { unit: { include: { property: true } } },
      });
      if (!request)
        return NextResponse.json({ error: 'Maintenance request not found' }, { status: 404 });

      const isParty =
        request.tenantId === session.sub ||
        request.vendorId === session.sub ||
        canManageProperty(session, request.unit.property);
      if (!isParty) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

      const existing = await prisma.conversation.findUnique({ where: { maintenanceRequestId } });
      if (existing) {
        // A vendor assigned after the thread was made would otherwise never be in it.
        await syncThreadVendor(maintenanceRequestId, request.vendorId);
        return NextResponse.json({ data: existing });
      }

      // A work order the property team raised has no tenant.
      const participantUserIds = new Set<string>();
      if (request.tenantId) participantUserIds.add(request.tenantId);
      if (request.vendorId) participantUserIds.add(request.vendorId);
      if (request.unit.property.managerId) participantUserIds.add(request.unit.property.managerId);
      if (request.unit.property.landlordId)
        participantUserIds.add(request.unit.property.landlordId);

      const conversation = await prisma.conversation.create({
        data: {
          type,
          title,
          maintenanceRequestId,
          participants: { create: [...participantUserIds].map((userId) => ({ userId })) },
        },
      });
      return NextResponse.json({ data: conversation }, { status: 201 });
    }

    // RENT_THREAD: participants derived from the rent's tenant + property staff.
    if (type === 'RENT_THREAD') {
      if (!rentId)
        return NextResponse.json({ error: 'rentId is required for RENT_THREAD' }, { status: 400 });

      const rent = await prisma.rent.findUnique({
        where: { id: rentId },
        include: { unit: { include: { property: true } } },
      });
      if (!rent) return NextResponse.json({ error: 'Rent not found' }, { status: 404 });

      const isParty =
        rent.tenantId === session.sub || canManageProperty(session, rent.unit.property);
      if (!isParty) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

      const existing = await prisma.conversation.findFirst({ where: { rentId } });
      if (existing) return NextResponse.json({ data: existing });

      const participantUserIds = new Set<string>([rent.tenantId]);
      if (rent.unit.property.managerId) participantUserIds.add(rent.unit.property.managerId);
      if (rent.unit.property.landlordId) participantUserIds.add(rent.unit.property.landlordId);

      const conversation = await prisma.conversation.create({
        data: {
          type,
          title,
          rentId,
          participants: { create: [...participantUserIds].map((userId) => ({ userId })) },
        },
      });
      return NextResponse.json({ data: conversation }, { status: 201 });
    }

    // COMMUNITY_DISCUSSION: every active tenant on the property plus its
    // staff are added as participants up front -- there's no separate
    // "discover conversations for a property" route, so a board only shows
    // up in someone's GET /conversations if they're already a participant.
    if (type === 'COMMUNITY_DISCUSSION') {
      if (!propertyId)
        return NextResponse.json(
          { error: 'propertyId is required for COMMUNITY_DISCUSSION' },
          { status: 400 },
        );

      const property = await prisma.property.findUnique({ where: { id: propertyId } });
      if (!property) return NextResponse.json({ error: 'Property not found' }, { status: 404 });

      const isManager = canManageProperty(session, property);
      const hasRent = await prisma.rent.findFirst({
        where: { tenantId: session.sub, unit: { propertyId }, status: 'ACTIVE' },
      });
      if (!isManager && !hasRent) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

      const tenants = await prisma.rent.findMany({
        where: { unit: { propertyId }, status: 'ACTIVE' },
        select: { tenantId: true },
        distinct: ['tenantId'],
      });
      const participantUserIds = new Set<string>(tenants.map((t) => t.tenantId));
      if (property.managerId) participantUserIds.add(property.managerId);
      if (property.landlordId) participantUserIds.add(property.landlordId);
      participantUserIds.add(session.sub);

      const conversation = await prisma.conversation.create({
        data: {
          type,
          title,
          propertyId,
          participants: { create: [...participantUserIds].map((userId) => ({ userId })) },
        },
      });
      return NextResponse.json({ data: conversation }, { status: 201 });
    }

    // DIRECT / SUPPORT: unlinked, participants explicitly supplied by the caller.
    if (participantIds.length === 0) {
      return NextResponse.json(
        { error: 'participantIds must include at least one other user' },
        { status: 400 },
      );
    }
    const allParticipantIds = Array.from(new Set([session.sub, ...participantIds]));

    const blocked = await checkFreeformParticipants(session, participantIds);
    if (blocked) return NextResponse.json({ error: blocked }, { status: 403 });

    if (type === 'DIRECT' && allParticipantIds.length === 2) {
      // Avoid spawning a duplicate 1:1 thread between the same two users.
      const candidates = await prisma.conversation.findMany({
        where: { type: 'DIRECT', participants: { every: { userId: { in: allParticipantIds } } } },
        include: { participants: true },
      });
      const existing = candidates.find(
        (c) =>
          c.participants.length === allParticipantIds.length &&
          allParticipantIds.every((id) => c.participants.some((p) => p.userId === id)),
      );
      if (existing) return NextResponse.json({ data: existing });
    }

    const conversation = await prisma.conversation.create({
      data: {
        type,
        title,
        participants: { create: allParticipantIds.map((userId) => ({ userId })) },
      },
    });
    return NextResponse.json({ data: conversation }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
});
