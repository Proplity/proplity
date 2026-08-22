import { NextResponse } from 'next/server';
import { z } from 'zod';
import { LeaseStatus, PaymentFrequency, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { parsePagination, buildMeta } from '@/lib/api/pagination';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';
import { canManageProperty } from '@/lib/api/propertyAccess';

// VENDOR has no legitimate reason to list leases -- everyone else's access
// is scoped below, not gated by role.
export const GET = withAuth(
  async (req, { session }) => {
    try {
      const { searchParams } = req.nextUrl;
      const { skip, take, page, limit } = parsePagination(searchParams);
      const status = searchParams.get('status');

      const where: Prisma.LeaseWhereInput = {
        ...(status ? { status: status as LeaseStatus } : {}),
      };

      if (session.role === 'TENANT') {
        where.tenantId = session.sub;
      } else if (session.role === 'MANAGER' || session.role === 'LANDLORD') {
        where.unit = {
          property: { OR: [{ managerId: session.sub }, { landlordId: session.sub }] },
        };
      }
      // ADMIN: no extra scoping.

      const [leases, total] = await Promise.all([
        prisma.lease.findMany({
          where,
          skip,
          take,
          include: { unit: true },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.lease.count({ where }),
      ]);

      return NextResponse.json({ data: leases, meta: buildMeta(total, page, limit) });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN', 'MANAGER', 'LANDLORD', 'TENANT'] },
);

const createLeaseSchema = z.object({
  unitId: z.string(),
  tenantId: z.string(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  // Full amount for the payment cycle, per CLAUDE.md rule 5 -- never
  // multiplied by 12 or otherwise normalized here.
  rentAmount: z.number().positive(),
  paymentFrequency: z.nativeEnum(PaymentFrequency).optional(),
  deposit: z.number().nonnegative(),
  gracePeriodDays: z.number().int().nonnegative().optional(),
  lateFeePercentage: z.number().nonnegative().optional(),
});

export const POST = withAuth(
  async (req, { session }) => {
    try {
      const validated = await validateBody(req, createLeaseSchema);
      if (!validated.success) return validated.response;
      const { unitId, tenantId, ...rest } = validated.data;

      const unit = await prisma.unit.findUnique({ where: { id: unitId }, include: { property: true } });
      if (!unit) return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
      if (!canManageProperty(session, unit.property)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const tenant = await prisma.user.findUnique({ where: { id: tenantId } });
      if (!tenant || tenant.role !== 'TENANT') {
        return NextResponse.json({ error: 'tenantId must reference a TENANT user' }, { status: 400 });
      }

      // Initial RENT invoice created in the same transaction -- a lease
      // shouldn't be able to exist with no corresponding first bill.
      const result = await prisma.$transaction(async (tx) => {
        const lease = await tx.lease.create({ data: { unitId, tenantId, ...rest } });
        const invoice = await tx.invoice.create({
          data: {
            leaseId: lease.id,
            type: 'RENT',
            amount: lease.rentAmount,
            dueDate: lease.startDate,
            description: 'Initial rent invoice',
          },
        });
        return { lease, invoice };
      });

      return NextResponse.json({ data: { ...result.lease, initialInvoice: result.invoice } }, { status: 201 });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN', 'MANAGER', 'LANDLORD'] },
);
