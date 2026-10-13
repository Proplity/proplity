import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { parsePagination, buildMeta } from '@/lib/api/pagination';
import { handleApiError } from '@/lib/api/errors';

// No user-listing route existed anywhere in the API (confirmed by search
// during Phase 9.6) -- needed for AdminDashboard/AdminBreakdownPage/
// AdminReports' user-facing stats, all of which are platform-wide and
// ADMIN-only. Excludes passwordHash and other auth-internal fields.
export const GET = withAuth(
  async (req) => {
    try {
      const { searchParams } = req.nextUrl;
      const { skip, take, page, limit } = parsePagination(searchParams);
      const role = searchParams.get('role');
      const status = searchParams.get('status');
      const vendorStatus = searchParams.get('vendorStatus');
      const q = searchParams.get('q')?.trim();

      // Filters run in the database so the list pages correctly (ISS-054).
      const where: import('@prisma/client').Prisma.UserWhereInput = {
        ...(role ? { role: role as import('@prisma/client').Role } : {}),
        ...(status ? { status: status as import('@prisma/client').UserStatus } : {}),
        ...(vendorStatus
          ? {
              vendorProfile: {
                verificationStatus:
                  vendorStatus as import('@prisma/client').VendorVerificationStatus,
              },
            }
          : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { email: { contains: q, mode: 'insensitive' } },
                { phoneNumber: { contains: q } },
              ],
            }
          : {}),
      };

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          skip,
          take,
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            status: true,
            phoneNumber: true,
            createdAt: true,
            vendorProfile: {
              select: { businessName: true, verificationStatus: true, verificationNote: true },
            },
            _count: { select: { managedProperties: true, ownedProperties: true } },
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.user.count({ where }),
      ]);

      const data = users.map((u) => ({
        ...u,
        propertiesCount: u._count.managedProperties + u._count.ownedProperties,
        _count: undefined,
      }));

      return NextResponse.json({ data, meta: buildMeta(total, page, limit) });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN'] },
);
