import { NextResponse } from 'next/server';
import { z } from 'zod';
import { InvoiceStatus, InvoiceType, Prisma } from '@prisma/client';
import { canManageProperty } from '@/lib/api/propertyAccess';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { parsePagination, buildMeta } from '@/lib/api/pagination';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';
import { getSystemSettings } from '@/lib/systemSettings';
import { subscriptionsEnabled } from '@/lib/subscriptions';

export const GET = withAuth(async (req, { session }) => {
  try {
    const { searchParams } = req.nextUrl;
    const { skip, take, page, limit } = parsePagination(searchParams);
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const dueDate = searchParams.get('dueDate');

    const filters: Prisma.InvoiceWhereInput[] = [
      ...(type ? [{ type: type as InvoiceType }] : []),
      ...(status ? [{ status: status as InvoiceStatus }] : []),
      ...(dueDate ? [{ dueDate: new Date(dueDate) }] : []),
    ];

    if (session.role === 'TENANT') {
      filters.push({
        OR: [
          { lease: { tenantId: session.sub } },
          { maintenanceRequest: { tenantId: session.sub } },
          { userId: session.sub },
        ],
      });
    } else if (session.role === 'VENDOR') {
      filters.push({ maintenanceRequest: { vendorId: session.sub } });
    } else if (session.role === 'MANAGER' || session.role === 'LANDLORD') {
      filters.push({
        OR: [
          {
            lease: {
              unit: { property: { OR: [{ managerId: session.sub }, { landlordId: session.sub }] } },
            },
          },
          {
            maintenanceRequest: {
              unit: { property: { OR: [{ managerId: session.sub }, { landlordId: session.sub }] } },
            },
          },
        ],
      });
    }
    // ADMIN: no extra scoping.

    const where: Prisma.InvoiceWhereInput = filters.length ? { AND: filters } : {};

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        skip,
        take,
        include: {
          payments: { orderBy: { paidAt: 'desc' } },
          lease: {
            select: {
              id: true,
              tenant: { select: { id: true, name: true } },
              unit: {
                select: { unitNumber: true, property: { select: { id: true, name: true } } },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.invoice.count({ where }),
    ]);

    return NextResponse.json({ data: invoices, meta: buildMeta(total, page, limit) });
  } catch (err) {
    return handleApiError(err);
  }
});

const createInvoiceSchema = z.object({
  leaseId: z.string().optional(),
  maintenanceRequestId: z.string().optional(),
  userId: z.string().optional(),
  type: z.nativeEnum(InvoiceType),
  amount: z.number().positive(),
  dueDate: z.coerce.date(),
  status: z.nativeEnum(InvoiceStatus).optional(),
  description: z.string().optional(),
});

export const POST = withAuth(
  async (req, { session }) => {
    try {
      const validated = await validateBody(req, createInvoiceSchema);
      if (!validated.success) return validated.response;
      const { leaseId, maintenanceRequestId, userId, ...rest } = validated.data;

      // Prisma can't express "at least one of" as a schema constraint --
      // enforced here (rule: Multi-FK models needing app-level validation).
      if (!leaseId && !maintenanceRequestId && !userId) {
        return NextResponse.json(
          { error: 'At least one of leaseId, maintenanceRequestId, or userId is required' },
          { status: 400 },
        );
      }

      if (rest.type === 'SUBSCRIPTION' && !subscriptionsEnabled()) {
        return NextResponse.json(
          { error: 'Subscriptions are currently disabled' },
          { status: 400 },
        );
      }

      if (session.role === 'VENDOR') {
        if (rest.type !== 'MAINTENANCE' || !maintenanceRequestId) {
          return NextResponse.json(
            {
              error: 'Vendors may only create MAINTENANCE invoices linked to a maintenance request',
            },
            { status: 403 },
          );
        }
        // A vendor bills the job only: not a lease or another user (which would put an
        // invoice in front of an unrelated tenant), and never one that starts as paid.
        if (leaseId || userId) {
          return NextResponse.json(
            { error: 'Vendors may only bill the maintenance job itself' },
            { status: 403 },
          );
        }
        if (rest.status && rest.status !== 'UNPAID') {
          return NextResponse.json({ error: 'New invoices must start as UNPAID' }, { status: 400 });
        }
        const request = await prisma.maintenanceRequest.findUnique({
          where: { id: maintenanceRequestId },
        });
        if (!request || request.vendorId !== session.sub) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
      }

      // MANAGER (ISS-050): may bill only leases and maintenance requests on
      // properties they manage. They cannot bill an arbitrary user, create
      // subscription invoices, or create an invoice that is already paid.
      // ADMIN is unrestricted; VENDOR was checked above.
      if (session.role === 'MANAGER') {
        if (userId || rest.type === 'SUBSCRIPTION') {
          return NextResponse.json(
            { error: 'Managers can only invoice leases and maintenance requests they manage' },
            { status: 403 },
          );
        }
        if (rest.status && rest.status !== 'UNPAID') {
          return NextResponse.json({ error: 'New invoices must start as UNPAID' }, { status: 400 });
        }
        if (leaseId) {
          const lease = await prisma.lease.findUnique({
            where: { id: leaseId },
            include: { unit: { include: { property: true } } },
          });
          if (!lease) return NextResponse.json({ error: 'Lease not found' }, { status: 404 });
          if (!canManageProperty(session, lease.unit.property)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
          }
        }
        if (maintenanceRequestId) {
          const request = await prisma.maintenanceRequest.findUnique({
            where: { id: maintenanceRequestId },
            include: { unit: { include: { property: true } } },
          });
          if (!request) {
            return NextResponse.json({ error: 'Maintenance request not found' }, { status: 404 });
          }
          if (!canManageProperty(session, request.unit.property)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
          }
        }
      }

      // One live invoice per job (ISS-051): a vendor cannot bill the same work
      // twice. A cancelled invoice frees the job for a corrected one.
      if (maintenanceRequestId && rest.type === 'MAINTENANCE') {
        const open = await prisma.invoice.findFirst({
          where: { maintenanceRequestId, type: 'MAINTENANCE', status: { not: 'CANCELLED' } },
          select: { invoiceNumber: true },
        });
        if (open) {
          return NextResponse.json(
            {
              error: `This job already has an invoice (${open.invoiceNumber}). Cancel it first to send a corrected one.`,
            },
            { status: 409 },
          );
        }
      }

      const data = { leaseId, maintenanceRequestId, userId, ...rest };

      // Admin-configurable (Platform Settings, SystemSettings.
      // autoCompleteMaintenanceOnInvoice): a MAINTENANCE invoice against a
      // request auto-completes it in the same transaction, unless an
      // operator has turned that off for vendors who invoice interim costs
      // mid-job.
      const shouldAutoComplete =
        rest.type === 'MAINTENANCE' &&
        !!maintenanceRequestId &&
        (await getSystemSettings()).autoCompleteMaintenanceOnInvoice;

      const createInvoice = () =>
        shouldAutoComplete
          ? prisma.$transaction(async (tx) => {
              const invoice = await tx.invoice.create({ data });
              await tx.maintenanceRequest.update({
                where: { id: maintenanceRequestId! },
                data: { status: 'COMPLETED' },
              });
              return invoice;
            })
          : prisma.invoice.create({ data });

      try {
        const invoice = await createInvoice();
        return NextResponse.json({ data: invoice }, { status: 201 });
      } catch (err) {
        // invoiceNumber is dbgenerated (rule 11) -- never set by app code.
        // On the vanishingly rare uuid-derived collision, retry once.
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          const invoice = await createInvoice();
          return NextResponse.json({ data: invoice }, { status: 201 });
        }
        throw err;
      }
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN', 'MANAGER', 'VENDOR'] },
);
