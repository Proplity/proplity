import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { validateBody } from '@/lib/api/validate';
import { handleApiError } from '@/lib/api/errors';
import { ensureDefaultServices } from '@/lib/plans';

export const GET = withAuth(
  async () => {
    try {
      await ensureDefaultServices();
      const data = await prisma.paidService.findMany({
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      });
      return NextResponse.json({ data });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN'] },
);

const createSchema = z
  .object({
    key: z
      .string()
      .regex(
        /^[a-z0-9][a-z0-9_-]{0,40}$/,
        'Use lower-case letters, numbers, dashes or underscores',
      ),
    name: z.string().trim().min(1, 'Give the service a name').max(80),
    description: z.string().trim().max(300).nullable().optional(),
    creditCost: z.number().int('Enter whole credits').min(0).max(100_000),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(1000).optional(),
  })
  .strict();

export const POST = withAuth(
  async (req, { session }) => {
    try {
      const validated = await validateBody(req, createSchema);
      if (!validated.success) return validated.response;
      await ensureDefaultServices();
      const service = await prisma.paidService.create({ data: validated.data });
      await prisma.auditLog.create({
        data: {
          actorId: session.sub,
          action: 'SERVICE_CREATED',
          entityType: 'PaidService',
          entityId: service.id,
          metadata: { key: service.key, creditCost: service.creditCost } as object,
        },
      });
      return NextResponse.json({ data: service }, { status: 201 });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN'] },
);
