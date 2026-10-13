import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { adminDashboardSummary } from '@/lib/dashboardSummary';

// Platform-wide counts and totals for the admin dashboard (ISS-049),
// computed in the database instead of from the first page of each list.
export const GET = withAuth(
  async () => {
    try {
      return NextResponse.json({ data: await adminDashboardSummary() });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN'] },
);
