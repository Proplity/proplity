import { NextResponse } from 'next/server';
import { z } from 'zod';
import { InvoiceStatus, InvoiceType, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { parsePagination, buildMeta } from '@/lib/api/pagination';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';

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
        OR: [{ lease: { tenantId: session.sub } }, { maintenanceRequest: { tenantId: session.sub } }, { userId: session.sub }],
      });
    } else if (session.role === 'VENDOR') {
      filters.push({ maintenanceRequest: { vendorId: session.sub } });
    } else if (session.role === 'MANAGER' || session.role === 'LANDLORD') {
      filters.push({
        OR: [
          { lease: { unit: { property: { OR: [{ managerId: session.sub }, { landlordId: session.sub }] } } } },
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
              unit: { select: { unitNumber: true, property: { select: { id: true, name: true } } } },
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

      if (session.role === 'VENDOR') {
        if (rest.type !== 'MAINTENANCE' || !maintenanceRequestId) {
          return NextResponse.json(
            { error: 'Vendors may only create MAINTENANCE invoices linked to a maintenance request' },
            { status: 403 },
          );
        }
        const request = await prisma.maintenanceRequest.findUnique({ where: { id: maintenanceRequestId } });
        if (!request || request.vendorId !== session.sub) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
      }

      const data = { leaseId, maintenanceRequestId, userId, ...rest };

      try {
        const invoice = await prisma.invoice.create({ data });
        return NextResponse.json({ data: invoice }, { status: 201 });
      } catch (err) {
        // invoiceNumber is dbgenerated (rule 11) -- never set by app code.
        // On the vanishingly rare uuid-derived collision, retry once.
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          const invoice = await prisma.invoice.create({ data });
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
