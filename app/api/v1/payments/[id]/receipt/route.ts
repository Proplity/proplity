import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { buildReceipt } from '@/lib/receipts';

type RouteCtx = { params: Promise<{ id: string }> };

// One payment's receipt, for the people it concerns (see lib/receipts.ts). Anyone else gets 404, not
// 403, so a receipt id cannot be probed for existence.
export const GET = withAuth(async (_req, { session }, ctx: RouteCtx) => {
  const { id } = await ctx.params;
  try {
    const receipt = await buildReceipt(session, id);
    if (!receipt) return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
    return NextResponse.json({ data: receipt });
  } catch (err) {
    return handleApiError(err);
  }
});
