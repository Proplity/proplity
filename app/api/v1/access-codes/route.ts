import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AccessCodeStatus, Role } from '@prisma/client';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';
import { canManageProperty } from '@/lib/api/propertyAccess';

async function canAccessUnit(session: { sub: string; role: Role }, unitId: string) {
  const unit = await prisma.unit.findUnique({ where: { id: unitId }, include: { property: true } });
  if (!unit) return { unit: null, allowed: false };
  if (canManageProperty(session, unit.property)) return { unit, allowed: true };

  const activeLease = await prisma.lease.findFirst({
    where: { unitId, tenantId: session.sub, status: 'ACTIVE' },
  });
  return { unit, allowed: !!activeLease };
}

export const GET = withAuth(async (req, { session }) => {
  try {
    const unitId = req.nextUrl.searchParams.get('unitId');
    if (!unitId) return NextResponse.json({ error: 'unitId query param is required' }, { status: 400 });

    const { unit, allowed } = await canAccessUnit(session, unitId);
    if (!unit) return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const status = req.nextUrl.searchParams.get('status');
    const codes = await prisma.accessCode.findMany({
      where: { unitId, ...(status ? { status: status as AccessCodeStatus } : {}) },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ data: codes });
  } catch (err) {
    return handleApiError(err);
  }
});

const createAccessCodeSchema = z.object({
  unitId: z.string(),
  code: z.string().min(4),
  guestName: z.string().optional(),
  validFrom: z.coerce.date(),
  validUntil: z.coerce.date().nullable().optional(),
});

export const POST = withAuth(
  async (req, { session }) => {
    try {
      const validated = await validateBody(req, createAccessCodeSchema);
      if (!validated.success) return validated.response;
      const { unitId, code, guestName, validFrom, validUntil } = validated.data;

      const activeLease = await prisma.lease.findFirst({
        where: { unitId, tenantId: session.sub, status: 'ACTIVE' },
      });
      if (!activeLease) {
        return NextResponse.json(
          { error: 'You must have an active lease on this unit to create an access code' },
          { status: 403 },
        );
      }

      // AccessCode.code has no DB-level @unique (unlike Invoice.invoiceNumber)
      // -- per-unit uniqueness among ACTIVE codes is enforced here instead.
      // A concurrent request slipping past this check is a real but narrow
      // race window; a genuine unique index would need a migration, out of
      // scope for a route implementation.
      const conflict = await prisma.accessCode.findFirst({ where: { unitId, code, status: 'ACTIVE' } });
      if (conflict) {
        return NextResponse.json(
          { error: 'This code is already active for this unit -- choose a different one', code: 'CODE_CONFLICT' },
          { status: 409 },
        );
      }

      const accessCode = await prisma.accessCode.create({
        data: { unitId, createdById: session.sub, code, guestName, validFrom, validUntil: validUntil ?? null },
      });
      return NextResponse.json({ data: accessCode }, { status: 201 });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['TENANT'] },
);
