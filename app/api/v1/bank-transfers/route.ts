import { NextResponse } from 'next/server';
import { z } from 'zod';
import { BankTransferStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { parsePagination, buildMeta } from '@/lib/api/pagination';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';
import { safeUrl } from '@/lib/api/urlField';
import { submitBankTransferProof, BankTransferError } from '@/lib/payments/bankTransferService';

const submitSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: z.number().positive(),
  bankName: z.string().trim().min(2).max(100),
  senderAccountName: z.string().trim().min(2).max(120),
  senderAccountNumber: z.string().trim().max(30).optional(),
  referenceNumber: z.string().trim().min(2).max(120),
  paymentDate: z
    .string()
    .datetime()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
  proofFileUrl: safeUrl.optional(),
  notes: z.string().trim().max(500).optional(),
});

export const GET = withAuth(async (req, { session }) => {
  try {
    const { searchParams } = req.nextUrl;
    const { skip, take, page, limit } = parsePagination(searchParams);
    const status = searchParams.get('status') as BankTransferStatus | null;
    const invoiceId = searchParams.get('invoiceId');

    const filters: Prisma.BankTransferSubmissionWhereInput[] = [
      ...(status ? [{ status }] : []),
      ...(invoiceId ? [{ invoiceId }] : []),
    ];

    if (session.role === 'TENANT') {
      filters.push({ submittedById: session.sub });
    } else if (session.role === 'MANAGER' || session.role === 'LANDLORD') {
      filters.push({
        invoice: {
          OR: [
            {
              lease: {
                unit: {
                  property: {
                    OR: [{ managerId: session.sub }, { landlordId: session.sub }],
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
        },
      });
    }
    // ADMIN sees all

    const where: Prisma.BankTransferSubmissionWhereInput =
      filters.length > 0 ? { AND: filters } : {};

    const [submissions, total] = await Promise.all([
      prisma.bankTransferSubmission.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          invoice: {
            select: {
              id: true,
              invoiceNumber: true,
              amount: true,
              status: true,
              type: true,
              dueDate: true,
            },
          },
          submittedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          reconciledBy: {
            select: {
              id: true,
              name: true,
              role: true,
            },
          },
          payment: {
            select: {
              id: true,
              amount: true,
              paidAt: true,
              transactionRef: true,
            },
          },
        },
      }),
      prisma.bankTransferSubmission.count({ where }),
    ]);

    return NextResponse.json({
      data: submissions,
      meta: buildMeta(total, page, limit),
    });
  } catch (err) {
    return handleApiError(err);
  }
});

export const POST = withAuth(async (req, { session }) => {
  try {
    const validated = await validateBody(req, submitSchema);
    if (!validated.success) return validated.response;

    const {
      invoiceId,
      amount,
      bankName,
      senderAccountName,
      senderAccountNumber,
      referenceNumber,
      paymentDate,
      proofFileUrl,
      notes,
    } = validated.data;

    try {
      const submission = await submitBankTransferProof(session, {
        invoiceId,
        amount,
        bankName,
        senderAccountName,
        senderAccountNumber,
        referenceNumber,
        paymentDate: new Date(paymentDate),
        proofFileUrl,
        notes,
      });

      return NextResponse.json({ data: submission }, { status: 201 });
    } catch (err) {
      if (err instanceof BankTransferError) {
        return NextResponse.json({ error: err.message }, { status: err.statusCode });
      }
      throw err;
    }
  } catch (err) {
    return handleApiError(err);
  }
});
