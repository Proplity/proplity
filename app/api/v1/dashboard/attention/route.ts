import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { attentionFor } from '@/lib/dashboardAttention';

// Everything waiting on the caller, whatever their role: the "Needs your attention" list on
// each dashboard. Scoped to the caller's own records and properties.
export const GET = withAuth(async (_req, { session }) => {
  try {
    return NextResponse.json({ data: await attentionFor(session.sub, session.role) });
  } catch (err) {
    return handleApiError(err);
  }
});
