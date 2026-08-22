import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';

// No vendor-listing route existed anywhere in the API (confirmed by search
// during Phase 9.3) -- needed for MaintenanceDetail's assign-vendor picker.
// Reputation is computed at query time from real VendorRating/MaintenanceRequest
// rows, per CLAUDE.md rule 8 ("no cached reputationScore column").
export const GET = withAuth(
  async () => {
    try {
      const vendors = await prisma.user.findMany({
        where: { role: 'VENDOR', status: 'ACTIVE' },
        select: {
          id: true,
          name: true,
          phoneNumber: true,
          vendorProfile: {
            select: {
              businessName: true,
              coverageArea: true,
              serviceCategories: { select: { name: true } },
            },
          },
          assignedJobs: { select: { status: true } },
          vendorRatingsReceived: { select: { rating: true } },
        },
      });

      const data = vendors.map((v) => {
        const jobsDone = v.assignedJobs.filter((j) => j.status === 'COMPLETED').length;
        const totalJobs = v.assignedJobs.length;
        const completionRate = totalJobs > 0 ? Math.round((jobsDone / totalJobs) * 100) : null;
        const ratings = v.vendorRatingsReceived.map((r) => r.rating);
        const rating = ratings.length ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length : null;

        return {
          id: v.id,
          name: v.name,
          phoneNumber: v.phoneNumber,
          businessName: v.vendorProfile?.businessName ?? v.name,
          categories: v.vendorProfile?.serviceCategories.map((c) => c.name) ?? [],
          coverageArea: v.vendorProfile?.coverageArea ?? null,
          jobsDone,
          totalJobs,
          completionRate,
          rating,
        };
      });

      return NextResponse.json({ data });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN', 'MANAGER', 'LANDLORD'] },
);
