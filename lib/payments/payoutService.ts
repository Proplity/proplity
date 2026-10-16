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
    : vendor.bankAccounts.find((b) => b.isDefault) ?? vendor.bankAccounts[0];

  if (!targetBankAccount && payoutMethod !== PayoutMethod.MANUAL) {
    throw new VendorPayoutError(
      'Vendor does not have a registered bank account for settlement',
      400,
    );
  }

  // 3. Resolve context (Invoice and/or MaintenanceRequest) and check authorization
  let propertyContext: { managerId: string | null; landlordId: string | null } | null = null;

  if (invoiceId) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        maintenanceRequest: {
          include: { unit: { include: { property: true } } },
        },
        vendorPayouts: {
          where: { status: { in: ['PENDING_APPROVAL', 'APPROVED', 'PROCESSING', 'COMPLETED'] } },
          select: { amount: true },
        },
      },
    });

    if (!invoice) throw new VendorPayoutError('Invoice not found', 404);

    if (invoice.type !== 'MAINTENANCE') {
      throw new VendorPayoutError('Vendor payouts may only be linked to maintenance invoices', 400);
    }

    const totalExistingPayouts = invoice.vendorPayouts.reduce((sum, p) => sum + p.amount, 0);
    if (totalExistingPayouts + amount > invoice.amount + 0.005) {
      throw new VendorPayoutError(
        `Total payouts (₦${(totalExistingPayouts + amount).toLocaleString()}) cannot exceed invoice amount of ₦${invoice.amount.toLocaleString()}`,
        400,
      );
    }

    if (invoice.maintenanceRequest?.unit?.property) {
      propertyContext = invoice.maintenanceRequest.unit.property;
    }
  }

  if (maintenanceRequestId && !propertyContext) {
    const mr = await prisma.maintenanceRequest.findUnique({
      where: { id: maintenanceRequestId },
      include: { unit: { include: { property: true } } },
    });
    if (!mr) throw new VendorPayoutError('Maintenance request not found', 404);
    propertyContext = mr.unit.property;
  }

  // Authorization check
  const isAuthorized =
    actor.role === 'ADMIN' ||
    (propertyContext && canManageProperty(actor, propertyContext));

  if (!isAuthorized) {
    throw new VendorPayoutError(
      'You are not authorized to initiate payouts for this property or vendor',
      403,
    );
  }

  // Landlord or Admin can auto-approve at creation; Manager creates PENDING_APPROVAL
  const autoApprove =
    actor.role === 'ADMIN' || (!!propertyContext?.landlordId && propertyContext.landlordId === actor.sub);
  const initialStatus = autoApprove ? 'APPROVED' : 'PENDING_APPROVAL';

  const payout = await prisma.$transaction(async (tx) => {
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
export async function approveVendorPayout(
  actor: { sub: string; role: Role },
  payoutId: string,
) {
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
    payout.invoice?.maintenanceRequest?.unit?.property ??
    payout.maintenanceRequest?.unit?.property;

  const canApprove =
    actor.role === 'ADMIN' || (!!property?.landlordId && property.landlordId === actor.sub);

  if (!canApprove) {
    throw new VendorPayoutError(
      'Only the property landlord or an admin can approve vendor payouts',
      403,
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.vendorPayout.update({
      where: { id: payoutId },
      data: {
        status: 'APPROVED',
        approvedById: actor.sub,
        approvedAt: new Date(),
      },
    });

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
    payout.invoice?.maintenanceRequest?.unit?.property ??
    payout.maintenanceRequest?.unit?.property;

  const canProcess =
    actor.role === 'ADMIN' || (property && canManageProperty(actor, property));

  if (!canProcess) {
    throw new VendorPayoutError(
      'You are not authorized to process payouts for this property',
      403,
    );
  }

  // Update to PROCESSING
  await prisma.vendorPayout.update({
    where: { id: payoutId },
    data: { status: 'PROCESSING' },
  });

  // Execute transfer disbursement: Mock or Paystack Transfer API
  let transferSuccess = false;
  let reference = options?.externalReference || null;
  let transferCode: string | null = null;
  let failureReason: string | null = null;

  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  const useMock = paymentsMockEnabled() || !secretKey;

  if (payout.payoutMethod === PayoutMethod.MANUAL) {
    // Manual cash or offline transfer recorded by landlord/admin
    transferSuccess = true;
    reference = reference || `MANUAL-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  } else if (useMock) {
    // Mock simulation
    transferSuccess = true;
    reference = reference || `TRF-MOCK-${crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`;
    transferCode = `TRF_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  } else {
    // Live Paystack Transfer API
    try {
      if (!payout.bankAccount) {
        throw new Error('Destination bank account is missing');
      }

      // Step A: Create or resolve transfer recipient
      const recipientRes = await fetch('https://api.paystack.co/transferrecipient', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
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

      const recipientCode = recipientJson.data.recipient_code;
      const transferRef = reference || `PO-${payout.payoutNumber}-${Date.now()}`;

      // Step B: Initiate transfer
      const transferRes = await fetch('https://api.paystack.co/transfer', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source: 'balance',
          amount: Math.round(payout.amount * 100), // convert to kobo
          recipient: recipientCode,
          reason: `Payout ${payout.payoutNumber}`,
          reference: transferRef,
        }),
      });

      const transferJson = await transferRes.json();
      if (!transferRes.ok || !transferJson.status) {
        throw new Error(transferJson.message || 'Failed to execute Paystack transfer');
      }

      transferSuccess = true;
      reference = transferRef;
      transferCode = transferJson.data?.transfer_code || null;
    } catch (err) {
      transferSuccess = false;
      failureReason = err instanceof Error ? err.message : 'Transfer execution failed';
    }
  }

  // Update row with final status
  const finalStatus = transferSuccess ? 'COMPLETED' : 'FAILED';
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.vendorPayout.update({
      where: { id: payoutId },
      data: {
        status: finalStatus,
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
        action: transferSuccess ? 'VENDOR_PAYOUT_COMPLETED' : 'VENDOR_PAYOUT_FAILED',
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
    throw new VendorPayoutError(
      `Cannot reject a payout in status ${payout.status}`,
      409,
    );
  }

  const property =
    payout.invoice?.maintenanceRequest?.unit?.property ??
    payout.maintenanceRequest?.unit?.property;

  const canReject =
    actor.role === 'ADMIN' || (!!property?.landlordId && property.landlordId === actor.sub);

  if (!canReject) {
    throw new VendorPayoutError(
      'Only the property landlord or an admin can reject vendor payouts',
      403,
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.vendorPayout.update({
      where: { id: payoutId },
      data: {
        status: 'REJECTED',
        failureReason: cleanReason,
      },
    });

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
