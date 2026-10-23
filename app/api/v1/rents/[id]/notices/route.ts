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

async function loadRentWithProperty(id: string) {
  return prisma.rent.findUnique({
    where: { id },
    include: { unit: { include: { property: true } } },
  });
}

export const GET = withAuth(async (_req, { session }, ctx: RouteCtx) => {
  const { id } = await ctx.params;

  try {
    const rent = await loadRentWithProperty(id);
    if (!rent) return NextResponse.json({ error: 'Rent not found' }, { status: 404 });

    const isOwnerTenant = session.role === 'TENANT' && rent.tenantId === session.sub;
    if (!isOwnerTenant && !canManageProperty(session, rent.unit.property)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const notices = await prisma.notice.findMany({
      take: LIST_LIMIT,
      // A draft is the property team's work in progress; the tenant sees a notice once it is sent (ISS-145).
      where: { rentId: id, ...(isOwnerTenant ? { status: { not: 'DRAFT' } } : {}) },
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
/** A notice may point at an invoice, but only one on its own rent (ISS-145). */
async function invoiceBelongsToRent(invoiceId: string, rentId: string) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, rentId },
    select: { id: true },
  });
  return !!invoice;
}

async function tellTenantOfNotice(
  rent: { tenantId: string; unit: { unitNumber: string; property: { name: string } } },
  type: string,
  content: string | null,
  req: NotifyRequest,
) {
  const label = type.replace(/_/g, ' ').toLowerCase();
  await notifyAndEmail(
    rent.tenantId,
    {
      title: `New notice: ${label}`,
      body: `You have a ${label} for unit ${rent.unit.unitNumber} at ${rent.unit.property.name}.${content ? `\n\n${content}` : ''}`,
      link: '/dashboard',
    },
    { req },
  );
}

const TENANT_SETTABLE_STATUSES: NoticeStatus[] = ['VIEWED', 'ACCEPTED', 'REJECTED', 'COUNTERED'];

export const POST = withAuth(async (req, { session }, ctx: RouteCtx) => {
  const { id: rentId } = await ctx.params;

  try {
    const rent = await loadRentWithProperty(rentId);
    if (!rent) return NextResponse.json({ error: 'Rent not found' }, { status: 404 });

    const validated = await validateBody(req, bodySchema);
    if (!validated.success) return validated.response;
    const { id, type, invoiceId, content, documentUrl, proposedTerms, status } = validated.data;

    if (documentUrl) {
      await assertOwnsFileUrls([documentUrl], session.sub, 'notices');
    }

    const isOwnerTenant = session.role === 'TENANT' && rent.tenantId === session.sub;
    const canManage = canManageProperty(session, rent.unit.property);

    // Update an existing notice.
    if (id) {
      const notice = await prisma.notice.findUnique({ where: { id } });
      if (!notice || notice.rentId !== rentId) {
        return NextResponse.json({ error: 'Notice not found' }, { status: 404 });
      }
      // A draft is not the tenant's to answer (ISS-145).
      if (isOwnerTenant && !canManage && notice.status === 'DRAFT') {
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
            rent.unit.property,
            {
              title: `Tenant ${status.toLowerCase()} a ${notice.type.replace(/_/g, ' ').toLowerCase()}`,
              body: `The tenant of unit ${rent.unit.unitNumber} at ${rent.unit.property.name} ${
                status === 'COUNTERED' ? 'sent a counter-proposal to' : `${status.toLowerCase()}`
              } the ${notice.type.replace(/_/g, ' ').toLowerCase()}.`,
              link: `/dashboard/tenants/${rent.id}`,
            },
            { req },
          );
        }
        return NextResponse.json({ data: updated });
      }

      if (!canManage) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      if (invoiceId && !(await invoiceBelongsToRent(invoiceId, rentId))) {
        return NextResponse.json({ error: 'That invoice is not on this rent' }, { status: 400 });
      }

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
        await tellTenantOfNotice(rent, updated.type, updated.content, req);
      }
      return NextResponse.json({ data: updated });
    }

    // Create a new notice -- staff/property-manager action only.
    if (!canManage) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!type)
      return NextResponse.json({ error: 'type is required to create a notice' }, { status: 400 });
    if (invoiceId && !(await invoiceBelongsToRent(invoiceId, rentId))) {
      return NextResponse.json({ error: 'That invoice is not on this rent' }, { status: 400 });
    }

    const created = await prisma.notice.create({
      data: {
        rentId,
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
      await tellTenantOfNotice(rent, created.type, created.content, req);
    }
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
});
