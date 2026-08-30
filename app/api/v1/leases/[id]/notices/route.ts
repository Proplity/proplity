import { NextResponse } from 'next/server';
import { z } from 'zod';
import { NoticeStatus, NoticeType } from '@prisma/client';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';
import { canManageProperty } from '@/lib/api/propertyAccess';

type RouteCtx = { params: Promise<{ id: string }> };

async function loadLeaseWithProperty(id: string) {
  return prisma.lease.findUnique({
    where: { id },
    include: { unit: { include: { property: true } } },
  });
}

export const GET = withAuth(async (_req, { session }, ctx: RouteCtx) => {
  const { id } = await ctx.params;

  try {
    const lease = await loadLeaseWithProperty(id);
    if (!lease) return NextResponse.json({ error: 'Lease not found' }, { status: 404 });

    const isOwnerTenant = session.role === 'TENANT' && lease.tenantId === session.sub;
    if (!isOwnerTenant && !canManageProperty(session, lease.unit.property)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const notices = await prisma.notice.findMany({
      where: { leaseId: id },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ data: notices });
  } catch (err) {
    return handleApiError(err);
  }
});

// A single POST endpoint doubles as create (staff drafting/sending a notice)
// and update (staff progressing it, or the tenant responding) -- the plan
// specifies one file tracking sentAt/viewedAt/respondedAt/status, and there's
// no separate [noticeId] route to split those operations across.
const bodySchema = z.object({
  id: z.string().optional(),
  type: z.nativeEnum(NoticeType).optional(),
  invoiceId: z.string().optional(),
  content: z.string().optional(),
  documentUrl: z.string().optional(),
  proposedTerms: z.any().optional(),
  status: z.nativeEnum(NoticeStatus).optional(),
});

const TENANT_SETTABLE_STATUSES: NoticeStatus[] = ['VIEWED', 'ACCEPTED', 'REJECTED', 'COUNTERED'];

export const POST = withAuth(async (req, { session }, ctx: RouteCtx) => {
  const { id: leaseId } = await ctx.params;

  try {
    const lease = await loadLeaseWithProperty(leaseId);
    if (!lease) return NextResponse.json({ error: 'Lease not found' }, { status: 404 });

    const validated = await validateBody(req, bodySchema);
    if (!validated.success) return validated.response;
    const { id, type, invoiceId, content, documentUrl, proposedTerms, status } = validated.data;

    const isOwnerTenant = session.role === 'TENANT' && lease.tenantId === session.sub;
    const canManage = canManageProperty(session, lease.unit.property);

    // Update an existing notice.
    if (id) {
      const notice = await prisma.notice.findUnique({ where: { id } });
      if (!notice || notice.leaseId !== leaseId) {
        return NextResponse.json({ error: 'Notice not found' }, { status: 404 });
      }

      if (isOwnerTenant && !canManage) {
        if (!status || !TENANT_SETTABLE_STATUSES.includes(status)) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        const updated = await prisma.notice.update({
          where: { id },
          data: {
            status,
            ...(status === 'VIEWED' ? { viewedAt: new Date() } : {}),
            ...(['ACCEPTED', 'REJECTED', 'COUNTERED'].includes(status)
              ? { respondedAt: new Date() }
              : {}),
          },
        });
        return NextResponse.json({ data: updated });
      }

      if (!canManage) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

      const updated = await prisma.notice.update({
        where: { id },
        data: {
          ...(content !== undefined ? { content } : {}),
          ...(documentUrl !== undefined ? { documentUrl } : {}),
          ...(proposedTerms !== undefined ? { proposedTerms } : {}),
          ...(invoiceId !== undefined ? { invoiceId } : {}),
          ...(status !== undefined
            ? { status, ...(status === 'SENT' ? { sentAt: new Date() } : {}) }
            : {}),
        },
      });
      return NextResponse.json({ data: updated });
    }

    // Create a new notice -- staff/property-manager action only.
    if (!canManage) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!type)
      return NextResponse.json({ error: 'type is required to create a notice' }, { status: 400 });

    const created = await prisma.notice.create({
      data: {
        leaseId,
        type,
        invoiceId,
        content,
        documentUrl,
        proposedTerms,
        status: status ?? 'DRAFT',
        ...(status === 'SENT' ? { sentAt: new Date() } : {}),
      },
    });
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
});
