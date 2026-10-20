import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { paymentsMockEnabled } from '@/lib/payments/mockGateway';
import { notifyUser } from '@/lib/notifications';
import { autopayChargingOn, getSystemSettings } from '@/lib/systemSettings';

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
 * A run claims each mandate before charging it (lastAttemptAt), uses a stable per-invoice
 * per-day reference (so a repeated charge is rejected by Paystack and by the unique
 * Payment.transactionRef), times out calls to the gateway, and pauses a mandate whose
 * card is declined three times in a row, telling the tenant each time.
 *
 * SAFETY FIRST:
 * Charging real bank/card tokens is financial action. By default, this worker
 * runs in DRY-RUN / DISABLED mode. Two gates must both be open (ADR-0015): the deployment
 * allows it (environment variable AUTOPAY_WORKER_ENABLED=true) and an admin has switched it
 * on in Platform Settings (SystemSettings.autopayChargingEnabled, off by default).
 *
 * When disabled (the default), it audits and reports all eligible invoices and mandates
 * without making any external payment calls or writing payment rows.
 */
// A mandate attempted within this window is not charged again.
const CLAIM_WINDOW_MS = 30 * 60 * 1000;
const MAX_CONSECUTIVE_FAILURES = 3;
const GATEWAY_TIMEOUT_MS = 20_000;

// A real Paystack key always wins over the mock flag, so a flag left on cannot record
// fake successes against real money. Test keys and the test environment use the mock.
function chargesAreMocked(): boolean {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (process.env.NODE_ENV === 'test' || key?.startsWith('test_only')) return true;
  return !key && paymentsMockEnabled();
}

export async function runAutopayCharger(): Promise<AutopayChargerResult> {
  const enabled = autopayChargingOn(await getSystemSettings());
  const useMock = chargesAreMocked();
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

    // Enabled mode: claim the mandate so an overlapping run (a second cron, a manual
    // trigger) cannot charge it too. One invoice per mandate per claim window.
    const claimed = await prisma.autoPayMandate.updateMany({
      where: {
        id: mandate.id,
        status: 'ACTIVE',
        OR: [
          { lastAttemptAt: null },
          { lastAttemptAt: { lt: new Date(Date.now() - CLAIM_WINDOW_MS) } },
        ],
      },
      data: { lastAttemptAt: new Date() },
    });
    if (claimed.count === 0) {
      skippedCount++;
      details.push({
        invoiceId: invoice.id,
        leaseId: lease.id,
        amount: balanceDue,
        status: 'SKIPPED',
        error: 'Another run is already charging this mandate',
      });
      continue;
    }

    processedCount++;
    // Stable per invoice and day: a repeat of the same charge is refused by Paystack and
    // by the unique Payment.transactionRef instead of taking money twice.
    const reference = `AUTOPAY-${invoice.id}-${now.toISOString().slice(0, 10)}`;

    try {
      let isSuccess = false;
      let rawResponse: unknown = null;

      if (useMock) {
        // Mock gateway active for testing / local development
        // A mandate whose token is DECLINE_TEST simulates a declined card (mock only).
        isSuccess = mandate.paymentMethodToken !== 'DECLINE_TEST';
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
          signal: AbortSignal.timeout(GATEWAY_TIMEOUT_MS),
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
        // The money has moved. Record it; if the webhook already did (same reference), fine.
        try {
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
            await tx.invoice.update({ where: { id: invoice.id }, data: { status: 'PAID' } });
            await tx.autoPayMandate.update({
              where: { id: mandate.id },
              data: { lastChargedAt: new Date(), consecutiveFailures: 0 },
            });
            await tx.auditLog.create({
              data: {
                actorId: lease.tenantId,
                action: 'AUTOPAY_CHARGED',
                entityType: 'Invoice',
                entityId: invoice.id,
                metadata: { reference, amount: balanceDue, mandateId: mandate.id },
              },
            });
          });
        } catch (err) {
          const duplicate =
            err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
          if (!duplicate) {
            // Charged but not recorded: leave a trail; the charge.success webhook (same
            // reference) will record it, and the stable reference stops a second charge.
            await prisma.auditLog
              .create({
                data: {
                  actorId: lease.tenantId,
                  action: 'AUTOPAY_CHARGED_UNRECORDED',
                  entityType: 'Invoice',
                  entityId: invoice.id,
                  metadata: { reference, amount: balanceDue, mandateId: mandate.id },
                },
              })
              .catch(() => undefined);
            throw err;
          }
        }

        successfulCount++;
        details.push({
          invoiceId: invoice.id,
          leaseId: lease.id,
          amount: balanceDue,
          status: 'SUCCESS',
        });
      } else {
        failedCount++;
        await recordFailure(mandate.id, lease.tenantId, invoice.id, balanceDue);
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
      await recordFailure(mandate.id, lease.tenantId, invoice.id, balanceDue).catch(
        () => undefined,
      );
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
      : 'Auto-pay charger is off (it needs AUTOPAY_WORKER_ENABLED=true on the deployment and the switch in Platform Settings). Eligible invoices audited only.',
    eligibleCount: openInvoices.length,
    processedCount,
    successfulCount,
    failedCount,
    skippedCount,
    details,
  };
}

// Counts a failed charge, tells the tenant, and pauses the mandate after repeated declines
// so a dead card is not retried every day.
async function recordFailure(
  mandateId: string,
  tenantId: string,
  invoiceId: string,
  amount: number,
) {
  const updated = await prisma.autoPayMandate.update({
    where: { id: mandateId },
    data: { consecutiveFailures: { increment: 1 } },
    select: { consecutiveFailures: true },
  });
  const paused = updated.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES;
  if (paused) {
    await prisma.autoPayMandate.update({ where: { id: mandateId }, data: { status: 'PAUSED' } });
  }
  await notifyUser(tenantId, {
    type: 'SYSTEM',
    title: paused ? 'Auto-pay paused' : 'Auto-pay payment failed',
    body: paused
      ? `We could not charge your card for ₦${amount.toLocaleString()} after ${MAX_CONSECUTIVE_FAILURES} tries, so auto-pay is paused. Update your payment method and pay the invoice.`
      : `We could not charge your card for ₦${amount.toLocaleString()}. We will try again; you can also pay the invoice yourself.`,
    link: `/dashboard/payment-history?invoice=${invoiceId}`,
  });
}
