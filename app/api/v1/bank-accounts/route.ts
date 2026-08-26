import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';

// Self-service only, own accounts -- LANDLORD/MANAGER/VENDOR are the roles
// that realistically receive money (rent payouts, service payment). No
// Paystack/payout integration reads this table yet (see CLAUDE.md's
// orphaned-model note) -- this is real storage for real bank details, but
// nothing automatically pays out to them. Honest gap, not faked.
export const GET = withAuth(
  async (_req, { session }) => {
    try {
      const accounts = await prisma.bankAccount.findMany({
        where: { userId: session.sub },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      });
      return NextResponse.json({ data: accounts });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN', 'MANAGER', 'LANDLORD', 'VENDOR'] },
);

const createBankAccountSchema = z.object({
  // NUBAN: exactly 10 digits, the Nigerian bank account number standard.
  accountNumber: z.string().regex(/^\d{10}$/, 'Must be a 10-digit NUBAN account number'),
  bankCode: z.string().min(1),
  bankName: z.string().min(1),
  accountName: z.string().min(1),
  isDefault: z.boolean().optional(),
});

export const POST = withAuth(
  async (req, { session }) => {
    try {
      const validated = await validateBody(req, createBankAccountSchema);
      if (!validated.success) return validated.response;
      const { isDefault, ...rest } = validated.data;

      // Only one default per user -- clear any existing default first if
      // this one is being marked default (or if it's the user's first
      // account, make it the default regardless of what was requested).
      const existingCount = await prisma.bankAccount.count({ where: { userId: session.sub } });
      const shouldBeDefault = isDefault || existingCount === 0;

      const account = await prisma.$transaction(async (tx) => {
        if (shouldBeDefault) {
          await tx.bankAccount.updateMany({ where: { userId: session.sub, isDefault: true }, data: { isDefault: false } });
        }
        return tx.bankAccount.create({
          data: { userId: session.sub, ...rest, isDefault: shouldBeDefault },
        });
      });

      return NextResponse.json({ data: account }, { status: 201 });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN', 'MANAGER', 'LANDLORD', 'VENDOR'] },
);
