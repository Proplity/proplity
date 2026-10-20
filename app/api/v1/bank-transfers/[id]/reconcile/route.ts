import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';
import { reconcileBankTransfer, BankTransferError } from '@/lib/payments/bankTransferService';

type RouteCtx = { params: Promise<{ id: string }> };

const reconcileSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  notes: z.string().trim().max(500).optional(),
  rejectionReason: z.string().trim().max(500).optional(),
});

export const POST = withAuth(
  async (req, { session }, ctx: RouteCtx) => {
    const { id } = await ctx.params;

    try {
      const validated = await validateBody(req, reconcileSchema);
      if (!validated.success) return validated.response;

      const { action, notes, rejectionReason } = validated.data;

      try {
        const result = await reconcileBankTransfer(session, id, action, {
          notes,
          rejectionReason,
        });

        return NextResponse.json({ data: result }, { status: 200 });
      } catch (err) {
        if (err instanceof BankTransferError) {
          return NextResponse.json({ error: err.message }, { status: err.statusCode });
        }
        throw err;
      }
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN', 'MANAGER', 'LANDLORD'] },
);
