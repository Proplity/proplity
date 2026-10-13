import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { tenantDashboardSummary, vendorDashboardSummary } from '@/lib/dashboardMine';

// Totals for the TENANT and VENDOR dashboards, over the caller's own records
// only (ISS-049). The shape depends on the role.
export const GET = withAuth(
  async (_req, { session }) => {
    try {
      const data =
        session.role === 'VENDOR'
          ? await vendorDashboardSummary(session.sub)
          : await tenantDashboardSummary(session.sub);
      return NextResponse.json({ data });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['TENANT', 'VENDOR'] },
);
