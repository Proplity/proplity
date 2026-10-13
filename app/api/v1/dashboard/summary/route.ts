import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { ownerDashboardSummary } from '@/lib/dashboardSummary';

// Totals for the MANAGER / LANDLORD dashboards, computed in the database over
// the caller's own properties (ISS-049). Not paginated: it returns a handful
// of numbers plus a few "recent" rows, however much data exists.
export const GET = withAuth(
  async (_req, { session }) => {
    try {
      return NextResponse.json({ data: await ownerDashboardSummary(session.sub) });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['MANAGER', 'LANDLORD'] },
);
