import { Role } from '@prisma/client';
import { prisma } from '@/lib/db';
import { canManageProperty } from '@/lib/api/propertyAccess';
import { notifyAdmins, notifyAndEmail, notifyPropertyTeam, notifyUser } from '@/lib/notifications';
import { assertOwnsFileUrls } from '@/lib/storage/service';
import { getSystemSettings } from '@/lib/systemSettings';
import { confirmedNote } from './transferNote';

export type SubmitBankTransferInput = {
  invoiceId: string;
  amount: number;
  bankName: string;
  senderAccountName: string;
  senderAccountNumber?: string;
  referenceNumber: string;
  paymentDate: Date;
  proofFileUrl?: string;
  notes?: string;
};

export class BankTransferError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = 'BankTransferError';
  }
}

/**
 * Does a payment the property team records on this invoice need someone other than the recorder to
 * confirm it? Two admin switches decide (Platform Settings): one for what a tenant owes, one for
 * what the team owes a vendor. Both are on by default. A tenant recording their own transfer is
 * never covered: the team always confirms that.
 */
export async function teamEntryNeedsSecondPerson(invoice: {
  rentId: string | null;
  maintenanceRequestId: string | null;
}): Promise<boolean> {
  const settings = await getSystemSettings();
  if (invoice.maintenanceRequestId) return settings.requireSecondPersonForVendorPayments;
  if (invoice.rentId) return settings.requireSecondPersonForTenantPayments;
  return true;
}

const SUBMISSION_INCLUDE = {
  invoice: { select: { id: true, invoiceNumber: true, amount: true } },
  submittedBy: { select: { id: true, name: true, email: true } },
} as const;

/**
 * Tenant or authorized user submits a bank transfer payment proof for an open invoice.
 */
export async function submitBankTransferProof(
  actor: { sub: string; role: Role },
  input: SubmitBankTransferInput,
) {
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
  } = input;

  if (amount <= 0) {
    throw new BankTransferError('Transfer amount must be greater than zero', 400);
  }

  // Load invoice with tenancy and property context
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      rent: {
        include: {
          unit: { include: { property: true } },
        },
      },
      maintenanceRequest: {
        include: {
          unit: { include: { property: true } },
        },
      },
      payments: { select: { amount: true } },
    },
  });

  if (!invoice) {
    throw new BankTransferError('Invoice not found', 404);
  }

  if (invoice.status === 'CANCELLED') {
    throw new BankTransferError('Cannot submit transfer proof for a cancelled invoice', 409);
  }

  if (invoice.status === 'PAID') {
    throw new BankTransferError('Invoice is already paid in full', 409);
  }

  // Access check: Tenant on the rent, direct user on the invoice, property manager/landlord, or ADMIN
  const isTenantOfRent = invoice.rent?.tenantId === actor.sub;
  const isDirectUser = invoice.userId === actor.sub;
  const property = invoice.rent?.unit.property ?? invoice.maintenanceRequest?.unit.property;
  const canManage = property ? canManageProperty(actor, property) : actor.role === 'ADMIN';

  if (!isTenantOfRent && !isDirectUser && !canManage) {
    throw new BankTransferError('You are not authorized to submit payments for this invoice', 403);
  }

  // Validate proof file URL ownership if uploaded through StoredFile gateway
  if (proofFileUrl) {
    await assertOwnsFileUrls([proofFileUrl], actor.sub, 'reconciliation');
  }

  // Check reference uniqueness against existing Payments and pending BankTransferSubmissions
  const cleanRef = referenceNumber.trim();
  const [existingPayment, existingSubmission] = await Promise.all([
    prisma.payment.findUnique({ where: { transactionRef: cleanRef } }),
    prisma.bankTransferSubmission.findFirst({
      where: {
        referenceNumber: cleanRef,
        status: { in: ['PENDING', 'APPROVED'] },
      },
    }),
  ]);

  if (existingPayment || existingSubmission) {
    throw new BankTransferError(
      'A payment or submission with this bank reference number has already been recorded',
      409,
    );
  }

  // Calculate outstanding balance
  const paidTotal = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
  const outstanding = Math.round((invoice.amount - paidTotal) * 100) / 100;
  if (amount > outstanding + 0.005) {
    throw new BankTransferError(
      `Submitted amount (₦${amount.toLocaleString()}) exceeds invoice balance of ₦${outstanding.toLocaleString()}`,
      400,
    );
  }

  const submission = await prisma.bankTransferSubmission.create({
    data: {
      invoiceId,
      submittedById: actor.sub,
      amount,
      bankName: bankName.trim(),
      senderAccountName: senderAccountName.trim(),
      senderAccountNumber: senderAccountNumber?.trim() || null,
      referenceNumber: cleanRef,
      paymentDate,
      proofFileUrl: proofFileUrl || null,
      notes: notes?.trim() || null,
      status: 'PENDING',
    },
    include: SUBMISSION_INCLUDE,
  });

  // The property team recording a payment (not the tenant recording their own): when the admin has
  // switched the two-person rule off for this kind of money, the entry counts at once. It still
  // creates the receipt and the audit row, which says the recorder confirmed it themselves.
  const teamEntry = !isTenantOfRent && !isDirectUser;
  if (teamEntry && !(await teamEntryNeedsSecondPerson(invoice))) {
    try {
      await reconcileBankTransfer(actor, submission.id, 'APPROVE');
      return prisma.bankTransferSubmission.findUniqueOrThrow({
        where: { id: submission.id },
        include: SUBMISSION_INCLUDE,
      });
    } catch (err) {
      // Stays pending (for example the invoice changed under it): someone can still confirm it.
      console.error('Auto-confirm of a team-recorded transfer failed', err);
    }
  }

  // Tell whoever can confirm it (the property's manager and landlord, except the person who
  // submitted it: nobody confirms their own entry). When there is no one else on the property
  // team, the admins are told instead, so the entry is never left with nobody to confirm it.
  const alert = {
    type: 'SYSTEM' as const,
    title: 'Bank transfer to confirm',
    body: `A transfer of ₦${amount.toLocaleString()} for invoice ${invoice.invoiceNumber} is waiting for someone to confirm it.`,
  };
  const others = [property?.managerId, property?.landlordId].filter(
    (id): id is string => Boolean(id) && id !== actor.sub,
  );
  if (property && others.length > 0) {
    await notifyPropertyTeam(
      property,
      { ...alert, link: '/dashboard/reconciliation' },
      {
        exceptId: actor.sub,
      },
    );
  } else {
    await notifyAdmins({ ...alert, link: '/admin/payments' });
  }

  return submission;
}

/**
 * Reconcile (Approve or Reject) a submitted bank transfer.
 */
export async function reconcileBankTransfer(
  actor: { sub: string; role: Role },
  submissionId: string,
  action: 'APPROVE' | 'REJECT',
  options?: { notes?: string; rejectionReason?: string },
) {
  const submission = await prisma.bankTransferSubmission.findUnique({
    where: { id: submissionId },
    include: {
      invoice: {
        include: {
          rent: {
            include: {
              unit: { include: { property: true } },
            },
          },
          maintenanceRequest: {
            include: {
              unit: { include: { property: true } },
            },
          },
        },
      },
      submittedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!submission) {
    throw new BankTransferError('Bank transfer submission not found', 404);
  }

  if (submission.status !== 'PENDING') {
    throw new BankTransferError(
      `This transfer submission has already been ${submission.status.toLowerCase()}`,
      409,
    );
  }

  // Authorization check: Only ADMIN, or LANDLORD/MANAGER of the property can reconcile
  const property =
    submission.invoice.rent?.unit.property ?? submission.invoice.maintenanceRequest?.unit.property;

  const canManage = property ? canManageProperty(actor, property) : actor.role === 'ADMIN';
  if (!canManage) {
    throw new BankTransferError(
      'You are not authorized to reconcile payments for this property',
      403,
    );
  }

  // Whoever recorded a payment cannot be the one who confirms it. They can still withdraw their own
  // entry (reject it with a reason).
  if (
    action === 'APPROVE' &&
    submission.submittedById === actor.sub &&
    (await teamEntryNeedsSecondPerson(submission.invoice))
  ) {
    throw new BankTransferError(
      'Someone else must confirm a transfer you submitted. Ask another member of the property team or an admin.',
      403,
    );
  }

  if (action === 'REJECT') {
    const reason = options?.rejectionReason?.trim();
    if (!reason) {
      throw new BankTransferError('A rejection reason must be provided', 400);
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Only a still-pending proof can be rejected: a racing approval must not be overwritten.
      const claimed = await tx.bankTransferSubmission.updateMany({
        where: { id: submissionId, status: 'PENDING' },
        data: {
          status: 'REJECTED',
          reconciledById: actor.sub,
          reconciledAt: new Date(),
          rejectionReason: reason,
        },
      });
      if (claimed.count === 0) {
        throw new BankTransferError('This transfer submission has already been reconciled', 409);
      }
      const row = await tx.bankTransferSubmission.findUniqueOrThrow({
        where: { id: submissionId },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.sub,
          action: 'BANK_TRANSFER_REJECTED',
          entityType: 'BankTransferSubmission',
          entityId: submissionId,
          metadata: {
            invoiceId: submission.invoiceId,
            referenceNumber: submission.referenceNumber,
            amount: submission.amount,
            reason,
          },
        },
      });

      return row;
    });

    // Tell whoever submitted it, on a screen their role can open.
    if (submission.submittedById !== actor.sub) {
      await notifyUser(submission.submittedById, {
        type: 'SYSTEM',
        title: 'Bank transfer submission rejected',
        body: `Your bank transfer payment proof for invoice ${submission.invoice.invoiceNumber} was rejected: ${reason}`,
        link: await submitterLink(submission.submittedById),
      });
    }

    return updated;
  }

  // APPROVE action: Atomically apply payment and reconcile
  const result = await prisma.$transaction(async (tx) => {
    // Lock invoice row for update
    await tx.$queryRaw`SELECT "id" FROM "Invoice" WHERE "id" = ${submission.invoiceId} FOR UPDATE`;
    const invoice = await tx.invoice.findUniqueOrThrow({
      where: { id: submission.invoiceId },
    });

    if (invoice.status === 'CANCELLED') {
      throw new BankTransferError('Cannot apply payment to a cancelled invoice', 409);
    }

    const { _sum } = await tx.payment.aggregate({
      where: { invoiceId: invoice.id },
      _sum: { amount: true },
    });

    const alreadyPaid = _sum.amount ?? 0;
    const outstanding = Math.round((invoice.amount - alreadyPaid) * 100) / 100;
    if (outstanding <= 0) {
      throw new BankTransferError('Invoice is already paid in full', 409);
    }
    if (submission.amount > outstanding + 0.005) {
      throw new BankTransferError(
        `The transfer (₦${submission.amount.toLocaleString()}) is more than the outstanding balance of ₦${outstanding.toLocaleString()}. Reject it or ask the tenant to resubmit.`,
        409,
      );
    }

    // Claim the submission under the invoice lock: a second approval or a reject that
    // raced this one finds it already settled.
    const claimed = await tx.bankTransferSubmission.updateMany({
      where: { id: submissionId, status: 'PENDING' },
      data: { status: 'APPROVED', reconciledById: actor.sub, reconciledAt: new Date() },
    });
    if (claimed.count === 0) {
      throw new BankTransferError('This transfer submission has already been reconciled', 409);
    }

    // Create the confirmed Payment record
    const payment = await tx.payment.create({
      data: {
        invoiceId: invoice.id,
        amount: submission.amount,
        paymentMethod: 'BANK_TRANSFER',
        provider: 'BANK_TRANSFER',
        transactionRef: submission.referenceNumber,
        paidAt: submission.paymentDate,
        notes: options?.notes?.trim() || confirmedNote(submission.referenceNumber),
      },
    });

    const newPaidTotal = alreadyPaid + submission.amount;
    const newStatus = newPaidTotal >= invoice.amount - 0.005 ? 'PAID' : 'PARTIALLY_PAID';

    await tx.invoice.update({
      where: { id: invoice.id },
      data: { status: newStatus },
    });

    const updatedSubmission = await tx.bankTransferSubmission.update({
      where: { id: submissionId },
      data: { paymentId: payment.id },
    });

    await tx.auditLog.create({
      data: {
        actorId: actor.sub,
        action: 'BANK_TRANSFER_RECONCILED',
        entityType: 'BankTransferSubmission',
        entityId: submissionId,
        metadata: {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          paymentId: payment.id,
          referenceNumber: submission.referenceNumber,
          amount: submission.amount,
          newStatus,
          newPaidTotal,
          // The recorder confirmed their own entry: only possible when an admin has switched the
          // two-person rule off for this kind of money.
          ...(submission.submittedById === actor.sub ? { confirmedByRecorder: true } : {}),
        },
      },
    });

    return { submission: updatedSubmission, payment, newStatus };
  });

  // Tell everyone the payment concerns, each with a link they can open (the receipt for those who
  // were paid or are the payer).
  const receipt = `/receipts/${result.payment.id}`;
  const money = `₦${submission.amount.toLocaleString()}`;
  if (submission.submittedById !== actor.sub) {
    await notifyUser(submission.submittedById, {
      type: 'SYSTEM',
      title: 'Bank transfer payment confirmed',
      body: `Your bank transfer of ${money} for invoice ${submission.invoice.invoiceNumber} has been verified and applied. Receipt ${result.payment.receiptNumber} is ready.`,
      link: receipt,
    });
  }
  const rentTenantId = submission.invoice.rent?.tenantId;
  if (rentTenantId && rentTenantId !== submission.submittedById) {
    await notifyUser(rentTenantId, {
      type: 'SYSTEM',
      title: 'Payment recorded',
      body: `A payment of ${money} was recorded on invoice ${submission.invoice.invoiceNumber}.`,
      link: receipt,
    });
  }
  const vendorId = submission.invoice.maintenanceRequest?.vendorId;
  if (vendorId) {
    await notifyAndEmail(vendorId, {
      type: 'SYSTEM',
      title: `Payment received: ${submission.invoice.invoiceNumber}`,
      body: `${money} was paid on your invoice ${submission.invoice.invoiceNumber}. Open the receipt to view or print it.`,
      link: receipt,
    });
  }

  return result;
}

/** Where to send someone about a transfer they submitted: tenants see their payments, staff the list to confirm. */
async function submitterLink(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (user?.role === 'ADMIN') return '/admin/payments';
  if (user?.role === 'MANAGER' || user?.role === 'LANDLORD') return '/dashboard/reconciliation';
  return '/dashboard/payment-history';
}
