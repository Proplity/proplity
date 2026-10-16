import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { canManageProperty } from '@/lib/api/propertyAccess';

type RouteCtx = { params: Promise<{ id: string }> };

export const GET = withAuth(async (_req, { session }, ctx: RouteCtx) => {
  const { id } = await ctx.params;

  try {
    const submission = await prisma.bankTransferSubmission.findUnique({
      where: { id },
      include: {
        invoice: {
          include: {
            lease: {
              include: {
                unit: { include: { property: true } },
              },
            },
            maintenanceRequest: {
              include: {
                unit: { include: { property: true } },
              },
            },
            payments: {
              select: {
                id: true,
                amount: true,
                paymentMethod: true,
                transactionRef: true,
                paidAt: true,
              },
            },
          },
        },
        submittedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            phoneNumber: true,
          },
        },
        reconciledBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        payment: true,
      },
    });

    if (!submission) {
      return NextResponse.json(
        { error: 'Bank transfer submission not found' },
        { status: 404 },
      );
    }

    const isSubmitter = submission.submittedById === session.sub;
    const property =
      submission.invoice.lease?.unit.property ??
      submission.invoice.maintenanceRequest?.unit.property;

    const canManage =
      session.role === 'ADMIN' ||
      (property && canManageProperty(session, property));

    if (!isSubmitter && !canManage) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ data: submission });
  } catch (err) {
    return handleApiError(err);
  }
});
