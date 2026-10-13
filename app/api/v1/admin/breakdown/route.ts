import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { adminBreakdownSummary } from '@/lib/dashboardBreakdown';

// Counts and totals behind the admin dashboard cards (ISS-049).
export const GET = withAuth(
  async () => {
    try {
      return NextResponse.json({ data: await adminBreakdownSummary() });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN'] },
);
