import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { adminReportsSummary, parseMonthRange } from '@/lib/dashboardSummary';

// Everything on the admin Reports page, computed in the database (ISS-049).
// `from` and `to` are inclusive `YYYY-MM` months (UTC) for the period charts;
// all other figures are platform-wide.
export const GET = withAuth(
  async (req) => {
    try {
      const { searchParams } = req.nextUrl;
      const range = parseMonthRange(searchParams.get('from'), searchParams.get('to'));
      if (!range) {
        return NextResponse.json(
          { error: 'from and to must be YYYY-MM months, at most about a year apart' },
          { status: 400 },
        );
      }
      return NextResponse.json({ data: await adminReportsSummary(range.start, range.end) });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN'] },
);
