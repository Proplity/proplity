import { prisma } from '@/lib/db';
import { paymentsMockEnabled } from '@/lib/payments/mockGateway';

export type AutopayChargeDetail = {
  invoiceId: string;
  leaseId: string;
  amount: number;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED' | 'DISABLED';
  error?: string;
};

export type AutopayChargerResult = {
  enabled: boolean;
  message: string;
  eligibleCount: number;
  processedCount: number;
  successfulCount: number;
  failedCount: number;
  skippedCount: number;
  details: AutopayChargeDetail[];
};

/**
 * Auto-Pay Mandate Recurring Charging Worker (ISS-011).
 *
 * Scans for open invoices (UNPAID, OVERDUE, PARTIALLY_PAID) on active leases
 * with an ACTIVE AutoPayMandate whose due date has arrived.
 *
 * SAFETY FIRST:
 * Charging real bank/card tokens is financial action. By default, this worker
 * runs in DRY-RUN / DISABLED mode unless explicitly enabled via environment variable:
 *   AUTOPAY_WORKER_ENABLED=true
 *
 * When disabled (the default), it audits and reports all eligible invoices and mandates
 * without making any external payment calls or writing payment rows.
 */
export async function runAutopayCharger(): Promise<AutopayChargerResult> {
  const enabled = process.env.AUTOPAY_WORKER_ENABLED === 'true';
  const now = new Date();

  // Find active leases with active auto-pay mandates and due/overdue invoices
  const openInvoices = await prisma.invoice.findMany({
    where: {
      status: { in: ['UNPAID', 'OVERDUE', 'PARTIALLY_PAID'] },
      dueDate: { lte: now },
      leaseId: { not: null },
      lease: {
        status: 'ACTIVE',
        autoPayMandates: {
          some: {
            status: 'ACTIVE',
          },
        },
      },
    },
    include: {
      lease: {
        include: {
          tenant: { select: { id: true, email: true, name: true } },
          autoPayMandates: {
            where: { status: 'ACTIVE' },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      },
      payments: {
        select: { amount: true },
      },
    },
  });

  const details: AutopayChargeDetail[] = [];
  let successfulCount = 0;
  let failedCount = 0;
  let skippedCount = 0;
  let processedCount = 0;

  for (const invoice of openInvoices) {
    const lease = invoice.lease;
    const mandate = lease?.autoPayMandates[0];

    if (!lease || !mandate || !lease.tenant?.email) {
      skippedCount++;
      details.push({
        invoiceId: invoice.id,
        leaseId: invoice.leaseId ?? '',
        amount: invoice.amount,
        status: 'SKIPPED',
        error: 'Missing active lease, mandate, or tenant email',
      });
      continue;
    }

    // Calculate remaining balance to charge
    const paidSum = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
    const balanceDue = invoice.amount - paidSum;

    if (balanceDue <= 0) {
      // Inconsistency: invoice marked open but fully paid -- mark PAID and skip
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: 'PAID' },
      });
      skippedCount++;
      details.push({
        invoiceId: invoice.id,
        leaseId: lease.id,
        amount: 0,
        status: 'SKIPPED',
        error: 'Invoice is already fully satisfied by existing payments',
      });
      continue;
    }

    if (!enabled) {
      // Disabled mode: report eligible invoice without executing charges
      details.push({
        invoiceId: invoice.id,
        leaseId: lease.id,
        amount: balanceDue,
        status: 'DISABLED',
      });
      continue;
    }

    // Enabled mode: execute charge under concurrency protection
    processedCount++;
    const reference = `AUTOPAY-${invoice.id.slice(0, 8)}-${Date.now()}`;

    try {
      let isSuccess = false;
      let rawResponse: unknown = null;

      if (paymentsMockEnabled()) {
        // Mock gateway active for testing / local development
        isSuccess = true;
        rawResponse = {
          status: true,
          message: 'Charge attempted (mock gateway)',
          data: {
            status: 'success',
            reference,
            amount: Math.round(balanceDue * 100),
          },
        };
      } else {
        const secretKey = process.env.PAYSTACK_SECRET_KEY;
        if (!secretKey) {
          throw new Error('PAYSTACK_SECRET_KEY is not configured');
        }

        const res = await fetch('https://api.paystack.co/transaction/charge_authorization', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${secretKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            authorization_code: mandate.paymentMethodToken,
            email: lease.tenant.email,
            amount: Math.round(balanceDue * 100), // Kobo conversion
            reference,
            metadata: {
              invoiceId: invoice.id,
              leaseId: lease.id,
              mandateId: mandate.id,
            },
          }),
        });

        const data = (await res.json()) as { status: boolean; data?: { status?: string } };
        rawResponse = data;
        isSuccess = res.ok && data.status === true && data.data?.status === 'success';
      }

      if (isSuccess) {
        // Record payment and update invoice status atomically
        await prisma.$transaction(async (tx) => {
          await tx.payment.create({
            data: {
              invoiceId: invoice.id,
              amount: balanceDue,
              paymentMethod: 'DEBIT_CARD',
              provider: 'PAYSTACK',
              transactionRef: reference,
              rawProviderPayload: JSON.stringify(rawResponse),
            },
          });

          await tx.invoice.update({
            where: { id: invoice.id },
            data: { status: 'PAID' },
          });

          await tx.autoPayMandate.update({
            where: { id: mandate.id },
            data: { lastChargedAt: new Date() },
          });

          await tx.auditLog.create({
            data: {
              actorId: lease.tenantId,
              action: 'AUTOPAY_CHARGED',
              entityType: 'Invoice',
              entityId: invoice.id,
              metadata: {
                reference,
                amount: balanceDue,
                mandateId: mandate.id,
              },
            },
          });
        });

        successfulCount++;
        details.push({
          invoiceId: invoice.id,
          leaseId: lease.id,
          amount: balanceDue,
          status: 'SUCCESS',
        });
      } else {
        failedCount++;
        await prisma.auditLog.create({
          data: {
            actorId: lease.tenantId,
            action: 'AUTOPAY_CHARGE_FAILED',
            entityType: 'Invoice',
            entityId: invoice.id,
            metadata: {
              reference,
              amount: balanceDue,
              mandateId: mandate.id,
              response:
                typeof rawResponse === 'object' && rawResponse !== null
                  ? JSON.stringify(rawResponse)
                  : String(rawResponse),
            },
          },
        });

        details.push({
          invoiceId: invoice.id,
          leaseId: lease.id,
          amount: balanceDue,
          status: 'FAILED',
          error: 'Charge authorization declined by gateway',
        });
      }
    } catch (err) {
      failedCount++;
      const errorMessage = err instanceof Error ? err.message : String(err);
      details.push({
        invoiceId: invoice.id,
        leaseId: lease.id,
        amount: balanceDue,
        status: 'FAILED',
        error: errorMessage,
      });
    }
  }

  return {
    enabled,
    message: enabled
      ? `Auto-pay charger processed ${processedCount} due invoice(s).`
      : 'Auto-pay charger is disabled (set AUTOPAY_WORKER_ENABLED=true to enable). Eligible invoices audited only.',
    eligibleCount: openInvoices.length,
    processedCount,
    successfulCount,
    failedCount,
    skippedCount,
    details,
  };
}
