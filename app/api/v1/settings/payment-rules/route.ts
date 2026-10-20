import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { getSystemSettings } from '@/lib/systemSettings';

// The two payment-rule switches, for the people who record payments on the team's behalf, so their
// forms can say truthfully whether an entry waits for a second person. Only these two flags: the
// rest of the platform settings stay admin-only (GET /admin/settings).
export const GET = withAuth(
  async () => {
    try {
      const settings = await getSystemSettings();
      return NextResponse.json({
        data: {
          requireSecondPersonForTenantPayments: settings.requireSecondPersonForTenantPayments,
          requireSecondPersonForVendorPayments: settings.requireSecondPersonForVendorPayments,
        },
      });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN', 'MANAGER', 'LANDLORD'] },
);
