import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { validateBody } from '@/lib/api/validate';
import { handleApiError } from '@/lib/api/errors';
import { listCreditPacks } from '@/lib/creditPacks';

export const GET = withAuth(
  async () => {
    try {
      return NextResponse.json({ data: await listCreditPacks() });
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
    name: z.string().trim().min(1, 'Give the pack a name').max(80),
    credits: z.number().int('Enter whole credits').min(1).max(100_000),
    price: z.number().int('Enter whole naira').min(1).max(100_000_000),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(1000).optional(),
  })
  .strict();

export const POST = withAuth(
  async (req, { session }) => {
    try {
      const validated = await validateBody(req, createSchema);
      if (!validated.success) return validated.response;
      // Seed the starting packs first so an admin's first pack does not stop them being added.
      await listCreditPacks();
      const pack = await prisma.creditPack.create({ data: validated.data });
      await prisma.auditLog.create({
        data: {
          actorId: session.sub,
          action: 'CREDIT_PACK_CREATED',
          entityType: 'CreditPack',
          entityId: pack.id,
          metadata: { key: pack.key, credits: pack.credits, price: pack.price } as object,
        },
      });
      return NextResponse.json({ data: pack }, { status: 201 });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN'] },
);
