import type { Role } from '@prisma/client';
import { prisma } from '@/lib/db';
import { canManageProperty } from '@/lib/api/propertyAccess';
import type { Receipt } from '@/lib/receiptTypes';
import { isAutomaticNote } from '@/lib/payments/transferNote';

// A receipt for one payment, for the people the payment concerns. Built from the payment, its
// invoice and (for a bank transfer) the submission that was confirmed, so it never shows anything the
// parties could not already see: names, amounts, references and the proof they attached. No emails,
// phone numbers or provider data.

const METHOD_LABEL: Record<string, string> = {
  CREDIT_CARD: 'Card',
  DEBIT_CARD: 'Card',
  BANK_TRANSFER: 'Bank transfer',
  CASH: 'Cash',
  CHECK: 'Cheque',
};

export async function buildReceipt(
  actor: { sub: string; role: Role },
  paymentId: string,
): Promise<Receipt | null> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      bankTransferSubmission: {
        include: {
          submittedBy: { select: { name: true } },
          reconciledBy: { select: { name: true } },
        },
      },
      invoice: {
        include: {
          payments: { select: { amount: true } },
          user: { select: { name: true } },
          rent: {
            include: {
              tenant: { select: { id: true, name: true } },
              unit: {
                include: {
                  property: {
                    include: {
                      landlord: { select: { name: true } },
                      manager: { select: { name: true } },
                    },
                  },
                },
              },
            },
          },
          maintenanceRequest: {
            include: {
              vendor: {
                select: { id: true, name: true, vendorProfile: { select: { businessName: true } } },
              },
              unit: {
                include: {
                  property: {
                    include: {
                      landlord: { select: { name: true } },
                      manager: { select: { name: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!payment) return null;

  const invoice = payment.invoice;
  const rent = invoice.rent;
  const job = invoice.maintenanceRequest;
  const unit = rent?.unit ?? job?.unit ?? null;
  const property = unit?.property ?? null;

  // Who may open it: the payer, the one paid, the property team and admins. A tenant is not a party
  // to a vendor's invoice, so they cannot open that receipt.
  const allowed =
    actor.role === 'ADMIN' ||
    rent?.tenantId === actor.sub ||
    invoice.userId === actor.sub ||
    job?.vendorId === actor.sub ||
    (property !== null && canManageProperty(actor, property));
  if (!allowed) return null;

  const owner = property?.landlord?.name ?? property?.manager?.name ?? property?.name ?? 'Property';
  let payer: string;
  let payee: string;
  if (rent) {
    payer = rent.tenant.name;
    payee = owner;
  } else if (job) {
    payer = owner;
    payee = job.vendor?.vendorProfile?.businessName ?? job.vendor?.name ?? 'Vendor';
  } else {
    payer = invoice.user?.name ?? 'Account holder';
    payee = 'Proplity';
  }

  const paidToDate = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
  const submission = payment.bankTransferSubmission;

  return {
    receiptNumber: payment.receiptNumber,
    paidAt: payment.paidAt.toISOString(),
    amount: payment.amount,
    currency: 'NGN',
    method: METHOD_LABEL[payment.paymentMethod] ?? payment.paymentMethod,
    reference: payment.transactionRef,
    notes: isAutomaticNote(payment.notes) ? null : payment.notes,
    payer: { name: payer },
    payee: { name: payee },
    invoice: {
      number: invoice.invoiceNumber,
      type: invoice.type,
      description: invoice.description,
      amount: invoice.amount,
      paidToDate,
      balance: Math.max(0, Math.round((invoice.amount - paidToDate) * 100) / 100),
      status: invoice.status,
    },
    property: property
      ? { name: property.name, address: property.address, unit: unit?.unitNumber ?? null }
      : null,
    transfer: submission
      ? {
          bankName: submission.bankName,
          senderAccountName: submission.senderAccountName,
          recordedBy: submission.submittedBy.name,
          confirmedBy: submission.reconciledBy?.name ?? null,
          confirmedAt: submission.reconciledAt?.toISOString() ?? null,
        }
      : null,
    proofFileUrl: submission?.proofFileUrl ?? null,
  };
}
