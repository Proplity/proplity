import { Role, PayoutMethod } from '@prisma/client';
import crypto from 'crypto';
import { prisma } from '@/lib/db';
import { canManageProperty } from '@/lib/api/propertyAccess';
import { notifyUser } from '@/lib/notifications';
import { paymentsMockEnabled } from '@/lib/payments/mockGateway';

export type InitiateVendorPayoutInput = {
  vendorId: string;
  invoiceId?: string;
  maintenanceRequestId?: string;
  amount: number;
  bankAccountId?: string;
  payoutMethod?: PayoutMethod;
  notes?: string;
};

export class VendorPayoutError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = 'VendorPayoutError';
  }
}

/**
 * Initiate a vendor payout for maintenance work.
 */
export async function initiateVendorPayout(
  actor: { sub: string; role: Role },
  input: InitiateVendorPayoutInput,
) {
  const {
    vendorId,
    invoiceId,
    maintenanceRequestId,
    amount,
    bankAccountId,
    payoutMethod = PayoutMethod.BANK_TRANSFER,
    notes,
  } = input;

  if (amount <= 0) {
    throw new VendorPayoutError('Payout amount must be greater than zero', 400);
  }

  // 1. Verify vendor exists and has role VENDOR
  const vendor = await prisma.user.findUnique({
    where: { id: vendorId },
    include: {
      vendorProfile: true,
      bankAccounts: true,
    },
  });

  if (!vendor || vendor.role !== Role.VENDOR) {
    throw new VendorPayoutError('Target recipient must be a registered vendor', 400);
  }

  // 2. Resolve destination bank account
  const targetBankAccount = bankAccountId
    ? vendor.bankAccounts.find((b) => b.id === bankAccountId)
    : (vendor.bankAccounts.find((b) => b.isDefault) ?? vendor.bankAccounts[0]);

  if (!targetBankAccount && payoutMethod !== PayoutMethod.MANUAL) {
    throw new VendorPayoutError(
      'Vendor does not have a registered bank account for settlement',
      400,
    );
  }

  // 3. Resolve context (Invoice and/or MaintenanceRequest) and check authorization
  let propertyContext: { managerId: string | null; landlordId: string | null } | null = null;
  let capScope: { kind: 'invoice' | 'request'; id: string; cap: number } | null = null;
  let assignedVendorId: string | null = null;
  let hasRequest = false;

  if (invoiceId) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        maintenanceRequest: {
          include: { unit: { include: { property: true } } },
        },
      },
    });

    if (!invoice) throw new VendorPayoutError('Invoice not found', 404);

    if (invoice.type !== 'MAINTENANCE') {
      throw new VendorPayoutError('Vendor payouts may only be linked to maintenance invoices', 400);
    }

    capScope = { kind: 'invoice', id: invoice.id, cap: invoice.amount };
    assignedVendorId = invoice.maintenanceRequest?.vendorId ?? null;
    hasRequest = !!invoice.maintenanceRequest;

    if (invoice.maintenanceRequest?.unit?.property) {
      propertyContext = invoice.maintenanceRequest.unit.property;
    }
  }

  if (maintenanceRequestId && invoiceId && !hasRequest) {
    throw new VendorPayoutError('The invoice is not linked to a maintenance request', 400);
  }

  if (maintenanceRequestId && !propertyContext) {
    const mr = await prisma.maintenanceRequest.findUnique({
      where: { id: maintenanceRequestId },
      include: { unit: { include: { property: true } } },
    });
    if (!mr) throw new VendorPayoutError('Maintenance request not found', 404);
    propertyContext = mr.unit.property;
    assignedVendorId = mr.vendorId;
    hasRequest = true;
    // A payout with no invoice is capped by the job's recorded cost.
    const jobCost = mr.finalCost ?? mr.costEstimate;
    if (!capScope) {
      if (jobCost == null) {
        throw new VendorPayoutError(
          'This job has no recorded cost, so a payout cannot be created without an invoice',
          400,
        );
      }
      capScope = { kind: 'request', id: mr.id, cap: jobCost };
    }
  } else if (maintenanceRequestId && invoiceId) {
    // Both given: they must describe the same job.
    const inv = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { maintenanceRequestId: true },
    });
    if (inv?.maintenanceRequestId !== maintenanceRequestId) {
      throw new VendorPayoutError('The invoice does not belong to that maintenance request', 400);
    }
  }

  // The money goes to the vendor doing the job, not to any vendor account.
  if (hasRequest && assignedVendorId !== vendorId) {
    throw new VendorPayoutError(
      'The payout recipient must be the vendor assigned to this maintenance job',
      400,
    );
  }

  // Authorization check
  const isAuthorized =
    actor.role === 'ADMIN' || (propertyContext && canManageProperty(actor, propertyContext));

  if (!isAuthorized) {
    throw new VendorPayoutError(
      'You are not authorized to initiate payouts for this property or vendor',
      403,
    );
  }

  // Landlord or Admin can auto-approve at creation; Manager creates PENDING_APPROVAL
  const autoApprove =
    actor.role === 'ADMIN' ||
    (!!propertyContext?.landlordId && propertyContext.landlordId === actor.sub);
  const initialStatus = autoApprove ? 'APPROVED' : 'PENDING_APPROVAL';

  const payout = await prisma.$transaction(async (tx) => {
    // Re-check the cap under a row lock so parallel requests cannot each pass it.
    if (capScope) {
      if (capScope.kind === 'invoice') {
        await tx.$queryRaw`SELECT "id" FROM "Invoice" WHERE "id" = ${capScope.id} FOR UPDATE`;
      } else {
        await tx.$queryRaw`SELECT "id" FROM "MaintenanceRequest" WHERE "id" = ${capScope.id} FOR UPDATE`;
      }
      const { _sum } = await tx.vendorPayout.aggregate({
        where: {
          ...(capScope.kind === 'invoice'
            ? { invoiceId: capScope.id }
            : { maintenanceRequestId: capScope.id, invoiceId: null }),
          status: { in: ['PENDING_APPROVAL', 'APPROVED', 'PROCESSING', 'COMPLETED'] },
        },
        _sum: { amount: true },
      });
      const total = (_sum.amount ?? 0) + amount;
      if (total > capScope.cap + 0.005) {
        throw new VendorPayoutError(
          `Total payouts (₦${total.toLocaleString()}) cannot exceed ${capScope.kind === 'invoice' ? 'invoice amount' : 'the job cost'} of ₦${capScope.cap.toLocaleString()}`,
          400,
        );
      }
    }
    const row = await tx.vendorPayout.create({
      data: {
        vendorId,
        invoiceId: invoiceId || null,
        maintenanceRequestId: maintenanceRequestId || null,
        amount,
        bankAccountId: targetBankAccount?.id || null,
        payoutMethod,
        notes: notes?.trim() || null,
        status: initialStatus,
        initiatedById: actor.sub,
        approvedById: autoApprove ? actor.sub : null,
        approvedAt: autoApprove ? new Date() : null,
      },
      include: {
        vendor: { select: { id: true, name: true, email: true } },
        bankAccount: true,
        invoice: { select: { id: true, invoiceNumber: true, amount: true } },
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: actor.sub,
        action: 'VENDOR_PAYOUT_INITIATED',
        entityType: 'VendorPayout',
        entityId: row.id,
        metadata: {
          payoutNumber: row.payoutNumber,
          vendorId,
          amount,
          status: initialStatus,
          invoiceId: invoiceId || null,
        },
      },
    });

    return row;
  });

  // Notify vendor about payout initiation
  await notifyUser(vendorId, {
    type: 'SYSTEM',
    title: autoApprove ? 'Vendor payout approved' : 'Vendor payout initiated',
    body: `A payout of ₦${amount.toLocaleString()} (${payout.payoutNumber}) has been ${initialStatus.toLowerCase()} for processing.`,
    link: '/dashboard',
  });

  return payout;
}

/**
 * Approve a pending vendor payout (Admin or Landlord).
 */
export async function approveVendorPayout(actor: { sub: string; role: Role }, payoutId: string) {
  const payout = await prisma.vendorPayout.findUnique({
    where: { id: payoutId },
    include: {
      invoice: {
        include: {
          maintenanceRequest: {
            include: { unit: { include: { property: true } } },
          },
        },
      },
      maintenanceRequest: {
        include: { unit: { include: { property: true } } },
      },
    },
  });

  if (!payout) throw new VendorPayoutError('Vendor payout not found', 404);

  if (payout.status !== 'PENDING_APPROVAL') {
    throw new VendorPayoutError(
      `Payout cannot be approved because it is in status ${payout.status}`,
      409,
    );
  }

  const property =
    payout.invoice?.maintenanceRequest?.unit?.property ?? payout.maintenanceRequest?.unit?.property;

  const canApprove =
    actor.role === 'ADMIN' || (!!property?.landlordId && property.landlordId === actor.sub);

  if (!canApprove) {
    throw new VendorPayoutError(
      'Only the property landlord or an admin can approve vendor payouts',
      403,
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const claimed = await tx.vendorPayout.updateMany({
      where: { id: payoutId, status: 'PENDING_APPROVAL' },
      data: { status: 'APPROVED', approvedById: actor.sub, approvedAt: new Date() },
    });
    if (claimed.count === 0) {
      throw new VendorPayoutError('This payout is no longer waiting for approval', 409);
    }
    const row = await tx.vendorPayout.findUniqueOrThrow({ where: { id: payoutId } });

    await tx.auditLog.create({
      data: {
        actorId: actor.sub,
        action: 'VENDOR_PAYOUT_APPROVED',
        entityType: 'VendorPayout',
        entityId: payoutId,
        metadata: {
          payoutNumber: payout.payoutNumber,
          amount: payout.amount,
          approvedBy: actor.sub,
        },
      },
    });

    return row;
  });

  await notifyUser(payout.vendorId, {
    type: 'SYSTEM',
    title: 'Vendor payout approved',
    body: `Your payout of ₦${payout.amount.toLocaleString()} (${payout.payoutNumber}) has been approved and queued for disbursement.`,
    link: '/dashboard',
  });

  return updated;
}

/**
 * Dispatch/Process an approved vendor payout.
 */
export async function processVendorPayout(
  actor: { sub: string; role: Role },
  payoutId: string,
  options?: { externalReference?: string; manualNote?: string },
) {
  const payout = await prisma.vendorPayout.findUnique({
    where: { id: payoutId },
    include: {
      vendor: { select: { id: true, name: true, email: true } },
      bankAccount: true,
      invoice: {
        include: {
          maintenanceRequest: {
            include: { unit: { include: { property: true } } },
          },
        },
      },
      maintenanceRequest: {
        include: { unit: { include: { property: true } } },
      },
    },
  });

  if (!payout) throw new VendorPayoutError('Vendor payout not found', 404);

  if (payout.status !== 'APPROVED') {
    throw new VendorPayoutError(
      `Payout cannot be processed because it is in status ${payout.status}. Only APPROVED payouts can be processed.`,
      409,
    );
  }

  const property =
    payout.invoice?.maintenanceRequest?.unit?.property ?? payout.maintenanceRequest?.unit?.property;

  const canProcess = actor.role === 'ADMIN' || (property && canManageProperty(actor, property));

  if (!canProcess) {
    throw new VendorPayoutError('You are not authorized to process payouts for this property', 403);
  }

  // Which gateway: a real Paystack key always wins. Mock only when there is no key
  // and the mock is explicitly on (or under test); a missing key in production fails
  // instead of marking the vendor paid (ISS-063).
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  const isTestKey = !!secretKey && secretKey.startsWith('test_only');
  const useMock =
    process.env.NODE_ENV === 'test' || isTestKey || (!secretKey && paymentsMockEnabled());
  const isManual = payout.payoutMethod === PayoutMethod.MANUAL;
  if (!isManual && !useMock && !secretKey) {
    throw new VendorPayoutError('Payment provider not configured', 503);
  }

  // Claim the payout atomically. Two simultaneous requests cannot both pass this, so
  // the transfer cannot be sent twice (ISS-062).
  const claimed = await prisma.vendorPayout.updateMany({
    where: { id: payoutId, status: 'APPROVED' },
    data: { status: 'PROCESSING' },
  });
  if (claimed.count === 0) {
    throw new VendorPayoutError('This payout is already being processed', 409);
  }

  let outcome: 'COMPLETED' | 'PROCESSING' | 'FAILED' = 'FAILED';
  let reference = options?.externalReference || null;
  let transferCode: string | null = null;
  let failureReason: string | null = null;

  if (isManual) {
    // Manual cash or offline transfer recorded by landlord/admin
    outcome = 'COMPLETED';
    reference = reference || `MANUAL-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  } else if (useMock) {
    outcome = 'COMPLETED';
    reference =
      reference || `TRF-MOCK-${crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`;
    transferCode = `TRF_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  } else {
    // Live Paystack Transfer API. The reference is stable per payout, so Paystack
    // itself rejects a second transfer for the same payout.
    const transferRef = reference || `po-${payout.id.replace(/-/g, '')}`;
    reference = transferRef;
    try {
      if (!payout.bankAccount) {
        throw new Error('Destination bank account is missing');
      }
      const headers = {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      };
      const recipientRes = await fetch('https://api.paystack.co/transferrecipient', {
        method: 'POST',
        headers,
        signal: AbortSignal.timeout(15_000),
        body: JSON.stringify({
          type: 'nuban',
          name: payout.bankAccount.accountName,
          account_number: payout.bankAccount.accountNumber,
          bank_code: payout.bankAccount.bankCode,
          currency: 'NGN',
        }),
      });
      const recipientJson = await recipientRes.json();
      if (!recipientRes.ok || !recipientJson.status) {
        throw new Error(recipientJson.message || 'Failed to create Paystack transfer recipient');
      }

      const transferRes = await fetch('https://api.paystack.co/transfer', {
        method: 'POST',
        headers,
        signal: AbortSignal.timeout(15_000),
        body: JSON.stringify({
          source: 'balance',
          amount: Math.round(payout.amount * 100), // kobo
          recipient: recipientJson.data.recipient_code,
          reason: `Payout ${payout.payoutNumber}`,
          reference: transferRef,
        }),
      });
      const transferJson = await transferRes.json();
      if (!transferRes.ok || !transferJson.status) {
        throw new Error(transferJson.message || 'Failed to execute Paystack transfer');
      }
      transferCode = transferJson.data?.transfer_code || null;
      // `status: true` means Paystack accepted the request, not that money moved.
      // Only an explicit success completes the payout; anything else waits for the
      // transfer.success / transfer.failed webhook (settleTransferFromWebhook).
      const transferStatus = String(transferJson.data?.status ?? 'pending');
      if (transferStatus === 'success') outcome = 'COMPLETED';
      else if (transferStatus === 'failed' || transferStatus === 'reversed') {
        outcome = 'FAILED';
        failureReason = `Paystack transfer ${transferStatus}`;
      } else outcome = 'PROCESSING';
    } catch (err) {
      outcome = 'FAILED';
      failureReason = err instanceof Error ? err.message : 'Transfer execution failed';
    }
  }

  const transferSuccess = outcome === 'COMPLETED';
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.vendorPayout.update({
      where: { id: payoutId },
      data: {
        status: outcome,
        reference,
        transferCode,
        failureReason,
        processedAt: transferSuccess ? new Date() : null,
        notes: options?.manualNote?.trim() || payout.notes,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: actor.sub,
        action:
          outcome === 'COMPLETED'
            ? 'VENDOR_PAYOUT_COMPLETED'
            : outcome === 'PROCESSING'
              ? 'VENDOR_PAYOUT_SUBMITTED'
              : 'VENDOR_PAYOUT_FAILED',
        entityType: 'VendorPayout',
        entityId: payoutId,
        metadata: {
          payoutNumber: payout.payoutNumber,
          amount: payout.amount,
          reference,
          transferCode,
          failureReason,
        },
      },
    });

    return row;
  });

  if (outcome === 'PROCESSING') return updated; // the webhook settles it and notifies

  // Notify vendor
  await notifyUser(payout.vendorId, {
    type: 'SYSTEM',
    title: transferSuccess ? 'Vendor payout disbursed' : 'Vendor payout failed',
    body: transferSuccess
      ? `Your payout of ₦${payout.amount.toLocaleString()} (${payout.payoutNumber}) has been disbursed successfully.`
      : `Disbursement for payout ${payout.payoutNumber} failed: ${failureReason}`,
    link: '/dashboard',
  });

  return updated;
}

/**
 * Reject a vendor payout (Admin or Landlord).
 */
export async function rejectVendorPayout(
  actor: { sub: string; role: Role },
  payoutId: string,
  reason: string,
) {
  const cleanReason = reason.trim();
  if (!cleanReason) {
    throw new VendorPayoutError('A rejection reason must be provided', 400);
  }

  const payout = await prisma.vendorPayout.findUnique({
    where: { id: payoutId },
    include: {
      invoice: {
        include: {
          maintenanceRequest: {
            include: { unit: { include: { property: true } } },
          },
        },
      },
      maintenanceRequest: {
        include: { unit: { include: { property: true } } },
      },
    },
  });

  if (!payout) throw new VendorPayoutError('Vendor payout not found', 404);

  if (payout.status !== 'PENDING_APPROVAL' && payout.status !== 'APPROVED') {
    throw new VendorPayoutError(`Cannot reject a payout in status ${payout.status}`, 409);
  }

  const property =
    payout.invoice?.maintenanceRequest?.unit?.property ?? payout.maintenanceRequest?.unit?.property;

  const canReject =
    actor.role === 'ADMIN' || (!!property?.landlordId && property.landlordId === actor.sub);

  if (!canReject) {
    throw new VendorPayoutError(
      'Only the property landlord or an admin can reject vendor payouts',
      403,
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const claimed = await tx.vendorPayout.updateMany({
      where: { id: payoutId, status: { in: ['PENDING_APPROVAL', 'APPROVED'] } },
      data: { status: 'REJECTED', failureReason: cleanReason },
    });
    if (claimed.count === 0) {
      throw new VendorPayoutError('This payout can no longer be rejected', 409);
    }
    const row = await tx.vendorPayout.findUniqueOrThrow({ where: { id: payoutId } });

    await tx.auditLog.create({
      data: {
        actorId: actor.sub,
        action: 'VENDOR_PAYOUT_REJECTED',
        entityType: 'VendorPayout',
        entityId: payoutId,
        metadata: {
          payoutNumber: payout.payoutNumber,
          amount: payout.amount,
          reason: cleanReason,
        },
      },
    });

    return row;
  });

  await notifyUser(payout.vendorId, {
    type: 'SYSTEM',
    title: 'Vendor payout rejected',
    body: `Your payout of ₦${payout.amount.toLocaleString()} (${payout.payoutNumber}) was rejected: ${cleanReason}`,
    link: '/dashboard',
  });

  return updated;
}

/**
 * Settles a payout from Paystack's transfer.success / transfer.failed / transfer.reversed
 * webhook. Only a payout that is still PROCESSING (or was marked COMPLETED but then
 * reversed) changes; repeated deliveries are no-ops.
 */
export async function settleTransferFromWebhook(
  reference: string,
  outcome: 'success' | 'failed' | 'reversed',
  reason?: string,
) {
  const payout = await prisma.vendorPayout.findUnique({ where: { reference } });
  if (!payout) return { handled: false as const };

  const completed = outcome === 'success';
  const allowedFrom = completed ? ['PROCESSING'] : ['PROCESSING', 'COMPLETED'];
  const res = await prisma.vendorPayout.updateMany({
    where: { id: payout.id, status: { in: allowedFrom as ('PROCESSING' | 'COMPLETED')[] } },
    data: completed
      ? { status: 'COMPLETED', processedAt: new Date(), failureReason: null }
      : {
          status: 'FAILED',
          processedAt: null,
          failureReason: reason || `Paystack transfer ${outcome}`,
        },
  });
  if (res.count === 0) return { handled: true as const, changed: false };

  await prisma.auditLog.create({
    data: {
      actorId: null,
      action: completed ? 'VENDOR_PAYOUT_COMPLETED' : 'VENDOR_PAYOUT_FAILED',
      entityType: 'VendorPayout',
      entityId: payout.id,
      metadata: { payoutNumber: payout.payoutNumber, reference, via: 'paystack-webhook', outcome },
    },
  });
  await notifyUser(payout.vendorId, {
    type: 'SYSTEM',
    title: completed ? 'Vendor payout disbursed' : 'Vendor payout failed',
    body: completed
      ? `Your payout of ₦${payout.amount.toLocaleString()} (${payout.payoutNumber}) has been disbursed successfully.`
      : `Disbursement for payout ${payout.payoutNumber} failed: ${reason || outcome}`,
    link: '/dashboard',
  });
  return { handled: true as const, changed: true };
}
