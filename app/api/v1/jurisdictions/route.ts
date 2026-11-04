import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { listJurisdictions } from '@/lib/agreements';

// The places whose tenancy rules apply, for the people setting up a tenancy: what the rules are and
// whether a lawyer has checked them. Admins edit them at /admin/jurisdictions.
export const GET = withAuth(
  async () => {
    try {
      return NextResponse.json({ data: await listJurisdictions() });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN', 'MANAGER', 'LANDLORD'] },
);
