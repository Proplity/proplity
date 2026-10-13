import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { ownerBreakdownSummary } from '@/lib/dashboardBreakdown';

// Totals, buckets and chart data for the pages opened from a dashboard card
// (ISS-049). The long tables on those pages are ordinary paged lists.
export const GET = withAuth(
  async (_req, { session }) => {
    try {
      return NextResponse.json({ data: await ownerBreakdownSummary(session.sub) });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['MANAGER', 'LANDLORD'] },
);
