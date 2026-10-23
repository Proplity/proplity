import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { validateBody } from '@/lib/api/validate';
import { handleApiError } from '@/lib/api/errors';
import { creditBalance } from '@/lib/credits';

// An admin adds credits to an account, or takes some back with a negative amount (never below 0).
const grantSchema = z
  .object({
    email: z.string().trim().toLowerCase().email(),
    amount: z
      .number()
      .int('Enter whole credits')
      .refine((n) => n !== 0, 'Enter a number other than 0')
      .refine((n) => Math.abs(n) <= 100_000, 'At most 100,000 at a time'),
    note: z.string().trim().max(200).optional(),
  })
  .strict();

export const POST = withAuth(
  async (req, { session }) => {
    try {
      const validated = await validateBody(req, grantSchema);
      if (!validated.success) return validated.response;
      const { email, amount, note } = validated.data;

      const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, name: true, role: true },
      });
      if (!user || (user.role !== 'MANAGER' && user.role !== 'LANDLORD')) {
        return NextResponse.json(
          { error: 'No manager or landlord has that email address' },
          { status: 404 },
        );
      }

      const balance = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`credits:${user.id}`}))`;
        const sum = await tx.creditEntry.aggregate({
          where: { userId: user.id },
          _sum: { delta: true },
        });
        const current = sum._sum.delta ?? 0;
        if (current + amount < 0) return null;
        await tx.creditEntry.create({
          data: {
            userId: user.id,
            delta: amount,
            reason: 'ADMIN_GRANT',
            note,
            createdById: session.sub,
          },
        });
        return current + amount;
      });
      if (balance === null) {
        return NextResponse.json({ error: 'That would take the balance below 0' }, { status: 400 });
      }
      await prisma.auditLog.create({
        data: {
          actorId: session.sub,
          action: 'CREDITS_GRANTED',
          entityType: 'User',
          entityId: user.id,
          metadata: { amount, note: note ?? null, balance } as object,
        },
      });
      return NextResponse.json({
        data: { userId: user.id, name: user.name, balance: await creditBalance(user.id) },
      });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN'] },
);
