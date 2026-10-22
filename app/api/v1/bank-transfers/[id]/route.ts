import { NextResponse } from 'next/server';
import { PUBLIC_PAYMENT_SELECT } from '@/lib/api/paymentSelect';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { canManageProperty, PUBLIC_PROPERTY } from '@/lib/api/propertyAccess';

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
                unit: { include: { property: PUBLIC_PROPERTY } },
              },
            },
            maintenanceRequest: {
              include: {
                unit: { include: { property: PUBLIC_PROPERTY } },
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
        payment: { select: PUBLIC_PAYMENT_SELECT },
      },
    });

    if (!submission) {
      return NextResponse.json({ error: 'Bank transfer submission not found' }, { status: 404 });
    }

    const isSubmitter = submission.submittedById === session.sub;
    const property =
      submission.invoice.lease?.unit.property ??
      submission.invoice.maintenanceRequest?.unit.property;

    const canManage =
      session.role === 'ADMIN' || (property && canManageProperty(session, property));

    if (!isSubmitter && !canManage) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ data: submission });
  } catch (err) {
    return handleApiError(err);
  }
});
