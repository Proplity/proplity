import { NextResponse } from 'next/server';
import { z } from 'zod';
import { PayoutMethod, Prisma, VendorPayoutStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { parsePagination, buildMeta } from '@/lib/api/pagination';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';
import {
  initiateVendorPayout,
  VendorPayoutError,
} from '@/lib/payments/payoutService';

const initiateSchema = z.object({
  vendorId: z.string().uuid(),
  invoiceId: z.string().uuid().optional(),
  maintenanceRequestId: z.string().uuid().optional(),
  amount: z.number().positive(),
  bankAccountId: z.string().uuid().optional(),
  payoutMethod: z.nativeEnum(PayoutMethod).optional(),
  notes: z.string().trim().max(500).optional(),
});

export const GET = withAuth(async (req, { session }) => {
  try {
    const { searchParams } = req.nextUrl;
    const { skip, take, page, limit } = parsePagination(searchParams);
    const status = searchParams.get('status') as VendorPayoutStatus | null;
    const vendorId = searchParams.get('vendorId');
    const invoiceId = searchParams.get('invoiceId');

    const filters: Prisma.VendorPayoutWhereInput[] = [
      ...(status ? [{ status }] : []),
      ...(vendorId ? [{ vendorId }] : []),
      ...(invoiceId ? [{ invoiceId }] : []),
    ];

    if (session.role === 'VENDOR') {
      filters.push({ vendorId: session.sub });
    } else if (session.role === 'MANAGER' || session.role === 'LANDLORD') {
      filters.push({
        OR: [
          {
            invoice: {
              maintenanceRequest: {
                unit: {
                  property: {
                    OR: [{ managerId: session.sub }, { landlordId: session.sub }],
                  },
                },
              },
            },
          },
          {
            maintenanceRequest: {
              unit: {
                property: {
                  OR: [{ managerId: session.sub }, { landlordId: session.sub }],
                },
              },
            },
          },
        ],
      });
    }
    // ADMIN sees all

    const where: Prisma.VendorPayoutWhereInput =
      filters.length > 0 ? { AND: filters } : {};

    const [payouts, total] = await Promise.all([
      prisma.vendorPayout.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          vendor: {
            select: {
              id: true,
              name: true,
              email: true,
              phoneNumber: true,
            },
          },
          bankAccount: {
            select: {
              id: true,
              bankName: true,
              accountName: true,
              accountNumber: true,
            },
          },
          invoice: {
            select: {
              id: true,
              invoiceNumber: true,
              amount: true,
              status: true,
            },
          },
          maintenanceRequest: {
            select: {
              id: true,
              title: true,
              status: true,
            },
          },
          initiatedBy: {
            select: {
              id: true,
              name: true,
              role: true,
            },
          },
          approvedBy: {
            select: {
              id: true,
              name: true,
              role: true,
            },
          },
        },
      }),
      prisma.vendorPayout.count({ where }),
    ]);

    return NextResponse.json({
      data: payouts,
      meta: buildMeta(total, page, limit),
    });
  } catch (err) {
    return handleApiError(err);
  }
});

export const POST = withAuth(
  async (req, { session }) => {
    try {
      const validated = await validateBody(req, initiateSchema);
      if (!validated.success) return validated.response;

      try {
        const payout = await initiateVendorPayout(session, validated.data);
        return NextResponse.json({ data: payout }, { status: 201 });
      } catch (err) {
        if (err instanceof VendorPayoutError) {
          return NextResponse.json({ error: err.message }, { status: err.statusCode });
        }
        throw err;
      }
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN', 'MANAGER', 'LANDLORD'] },
);
