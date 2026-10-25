import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';

const statusSchema = z.enum(['PAID', 'COMPLETED', 'CANCELLED', 'AWAITING_PAYMENT', 'ALL']);

// The stamping queue for Proplity staff: orders people have paid for (the default view), and the
// ones already done. Each shows what is needed to stamp the agreement and where the money came from.
export const GET = withAuth(
  async (req) => {
    try {
      const parsed = statusSchema.safeParse(req.nextUrl.searchParams.get('status') ?? 'PAID');
      if (!parsed.success) return NextResponse.json({ error: 'Unknown status' }, { status: 400 });
      const where: Prisma.StampDutyOrderWhereInput =
        parsed.data === 'ALL' ? {} : { status: parsed.data };
      const orders = await prisma.stampDutyOrder.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        take: 200,
        include: {
          invoice: { select: { invoiceNumber: true } },
          agreement: {
            select: {
              id: true,
              rentId: true,
              landlordName: true,
              rent: {
                select: {
                  startDate: true,
                  endDate: true,
                  rentAmount: true,
                  paymentFrequency: true,
                  tenant: { select: { name: true, email: true } },
                  unit: {
                    select: {
                      unitNumber: true,
                      property: { select: { name: true, address: true, city: true, state: true } },
                    },
                  },
                },
              },
            },
          },
        },
      });
      return NextResponse.json({ data: orders });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN'] },
);
