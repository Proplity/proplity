import { NextResponse } from 'next/server';
import { z } from 'zod';
import { NoticeStatus, NoticeType } from '@prisma/client';
import { prisma } from '@/lib/db';
import { notifyAndEmail, notifyPropertyTeam, type NotifyRequest } from '@/lib/notifications';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';
import { canManageProperty } from '@/lib/api/propertyAccess';
import { safeUrl } from '@/lib/api/urlField';
import { assertOwnsFileUrls } from '@/lib/storage/service';

// Lists are capped so one busy record cannot return an unbounded response (ISS-073).
const LIST_LIMIT = 500;

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
      take: LIST_LIMIT,
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
  documentUrl: safeUrl.optional(),
  proposedTerms: z.any().optional(),
  status: z.nativeEnum(NoticeStatus).optional(),
});

// A notice only matters once it is sent: the tenant is told in the app and by email.
async function tellTenantOfNotice(
  lease: { tenantId: string; unit: { unitNumber: string; property: { name: string } } },
  type: string,
  content: string | null,
  req: NotifyRequest,
) {
  const label = type.replace(/_/g, ' ').toLowerCase();
  await notifyAndEmail(
    lease.tenantId,
    {
      title: `New notice: ${label}`,
      body: `You have a ${label} for unit ${lease.unit.unitNumber} at ${lease.unit.property.name}.${content ? `\n\n${content}` : ''}`,
      link: '/dashboard',
    },
    { req },
  );
}

const TENANT_SETTABLE_STATUSES: NoticeStatus[] = ['VIEWED', 'ACCEPTED', 'REJECTED', 'COUNTERED'];

export const POST = withAuth(async (req, { session }, ctx: RouteCtx) => {
  const { id: leaseId } = await ctx.params;

  try {
    const lease = await loadLeaseWithProperty(leaseId);
    if (!lease) return NextResponse.json({ error: 'Lease not found' }, { status: 404 });

    const validated = await validateBody(req, bodySchema);
    if (!validated.success) return validated.response;
    const { id, type, invoiceId, content, documentUrl, proposedTerms, status } = validated.data;

    if (documentUrl) {
      await assertOwnsFileUrls([documentUrl], session.sub, 'notices');
    }

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
        // A counter or a rejection needs the property team to act; a plain read does not.
        if (status !== 'VIEWED') {
          await notifyPropertyTeam(
            lease.unit.property,
            {
              title: `Tenant ${status.toLowerCase()} a ${notice.type.replace(/_/g, ' ').toLowerCase()}`,
              body: `The tenant of unit ${lease.unit.unitNumber} at ${lease.unit.property.name} ${
                status === 'COUNTERED' ? 'sent a counter-proposal to' : `${status.toLowerCase()}`
              } the ${notice.type.replace(/_/g, ' ').toLowerCase()}.`,
              link: `/dashboard/tenants/${lease.id}`,
            },
            { req },
          );
        }
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
      if (status === 'SENT' && notice.status !== 'SENT') {
        await tellTenantOfNotice(lease, updated.type, updated.content, req);
      }
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
    if (created.status === 'SENT') {
      await tellTenantOfNotice(lease, created.type, created.content, req);
    }
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
});
