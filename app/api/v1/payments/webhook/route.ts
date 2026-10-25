import { createHmac, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma, PaymentMethod } from '@prisma/client';
import { prisma } from '@/lib/db';
import { handleApiError } from '@/lib/api/errors';
import { notifyAndEmail, notifyUser, notifyUsers } from '@/lib/notifications';
import { MOCK_PAYSTACK_SECRET, paymentsMockEnabled } from '@/lib/payments/mockGateway';
import { subscriptionsEnabled } from '@/lib/subscriptions';
import { getSystemSettings } from '@/lib/systemSettings';
import { countUnitsFor, graceEndsAtFrom } from '@/lib/plans';
import { settleTransferFromWebhook } from '@/lib/payments/payoutService';
import { grantPurchasedCredits } from '@/lib/creditPacks';

// Reached by Paystack's own servers, not a browser -- no session, no CSRF.
// The HMAC signature over the raw body IS the security boundary here, so it
// must be verified before the body is parsed or trusted in any way.
function verifySignature(rawBody: string, signature: string | null, secret: string) {
  if (!signature) return false;
  const expected = createHmac('sha512', secret).update(rawBody).digest('hex');
  const sigBuf = new Uint8Array(Buffer.from(signature, 'hex'));
  const expBuf = new Uint8Array(Buffer.from(expected, 'hex'));
  return sigBuf.length === expBuf.length && timingSafeEqual(sigBuf, expBuf);
}

// Rough channel -> PaymentMethod mapping; Paystack's `channel` values don't
// line up 1:1 with the schema's enum (no way to distinguish credit vs.
// debit card from the webhook payload), so this is a best-effort default.
function mapPaymentMethod(channel: string | undefined): PaymentMethod {
  if (channel === 'card') return 'CREDIT_CARD';
  if (channel === 'bank' || channel === 'bank_transfer' || channel === 'ussd')
    return 'BANK_TRANSFER';
  return 'BANK_TRANSFER';
}

export async function POST(req: NextRequest) {
  try {
    // Falls back to the mock secret only when there's no real key and the
    // mock is explicitly on -- see lib/payments/mockGateway.ts and
    // app/dev/mock-checkout, the only caller that ever signs with it.
    const secretKey =
      process.env.PAYSTACK_SECRET_KEY || (paymentsMockEnabled() ? MOCK_PAYSTACK_SECRET : null);
    if (!secretKey)
      return NextResponse.json({ error: 'Payment provider not configured' }, { status: 503 });

    const rawBody = await req.text();
    const signature = req.headers.get('x-paystack-signature');
    if (!verifySignature(rawBody, signature, secretKey)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);

    // Vendor payouts: Paystack reports the real outcome of a transfer here (ISS-063).
    if (
      payload.event === 'transfer.success' ||
      payload.event === 'transfer.failed' ||
      payload.event === 'transfer.reversed'
    ) {
      const reference: string | undefined = payload.data?.reference;
      if (reference) {
        await settleTransferFromWebhook(
          reference,
          payload.event.replace('transfer.', '') as 'success' | 'failed' | 'reversed',
          payload.data?.reason,
        );
      }
      return NextResponse.json({ received: true });
    }

    if (payload.event === 'charge.success') {
      const data = payload.data;
      const invoiceId: string | undefined = data?.metadata?.invoiceId;
      if (!invoiceId)
        return NextResponse.json({ error: 'Missing invoiceId in metadata' }, { status: 400 });

      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          rent: {
            include: {
              unit: {
                include: {
                  property: true,
                },
              },
            },
          },
        },
      });
      if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

      const amount = Math.round(Number(data.amount)) / 100;
      if (!data.reference || !Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json({ error: 'Missing reference or amount' }, { status: 400 });
      }

      // Paystack can redeliver the same event, even concurrently. The unique
      // Payment.transactionRef makes the second insert fail, and that is
      // treated as "already handled" -- never a second credit (ISS-052).
      // The invoice row is locked first so two different payments landing at
      // once also total correctly.
      let outcome: {
        wasPaid: boolean;
        status: string;
        paidTotal: number;
        paymentId: string;
      } | null = null;
      try {
        outcome = await prisma.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT "id" FROM "Invoice" WHERE "id" = ${invoiceId} FOR UPDATE`;
          const before = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
          const created = await tx.payment.create({
            data: {
              invoiceId,
              amount,
              paymentMethod: mapPaymentMethod(data.channel),
              provider: 'PAYSTACK',
              transactionRef: data.reference,
              rawProviderPayload: rawBody,
              paidAt: data.paid_at ? new Date(data.paid_at) : new Date(),
            },
          });
          const { _sum } = await tx.payment.aggregate({
            where: { invoiceId },
            _sum: { amount: true },
          });
          const paidTotal = _sum.amount ?? 0;
          // A cancelled invoice stays cancelled; the money did move, so the
          // payment is kept and flagged below for a refund.
          const status =
            before.status === 'CANCELLED'
              ? 'CANCELLED'
              : paidTotal >= before.amount - 0.005
                ? 'PAID'
                : 'PARTIALLY_PAID';
          if (status !== before.status) {
            await tx.invoice.update({ where: { id: invoiceId }, data: { status } });
          }
          return { wasPaid: before.status === 'PAID', status, paidTotal, paymentId: created.id };
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          return NextResponse.json({ received: true, duplicate: true });
        }
        throw err;
      }

      // Anything that does not add up goes to the audit log for an admin.
      const flags: string[] = [];
      if (outcome.status === 'CANCELLED') flags.push('PAYMENT_ON_CANCELLED_INVOICE');
      if (outcome.paidTotal > invoice.amount + 0.005 && outcome.status !== 'CANCELLED')
        flags.push('PAYMENT_EXCEEDS_INVOICE');
      const expected = data.metadata?.expectedAmount;
      if (typeof expected === 'number' && Math.abs(expected - amount) > 0.005)
        flags.push('PAYMENT_AMOUNT_MISMATCH');
      for (const action of flags) {
        await prisma.auditLog.create({
          data: {
            actorId: null,
            action,
            entityType: 'Invoice',
            entityId: invoiceId,
            metadata: {
              reference: data.reference,
              paid: amount,
              expected: typeof expected === 'number' ? expected : null,
              invoiceAmount: invoice.amount,
              paidTotal: outcome.paidTotal,
            },
          },
        });
      }

      {
        if (invoice.type === 'RENT' && invoice.rent) {
          const property = invoice.rent.unit?.property;
          const managersToNotify = [property?.landlordId, property?.managerId].filter(
            (id): id is string => Boolean(id),
          );
          if (managersToNotify.length > 0) {
            await notifyUsers(managersToNotify, {
              type: 'SYSTEM',
              title: 'Rent Payment Received',
              body: `A rent payment of ₦${amount.toLocaleString()} was received for ${property?.name ?? 'your property'}.`,
              link: '/dashboard',
            });
          }
          if (invoice.rent.tenantId) {
            await notifyUser(invoice.rent.tenantId, {
              type: 'SYSTEM',
              title: 'Rent Payment Confirmed',
              body: `Your rent payment of ₦${amount.toLocaleString()} has been received. Thank you!`,
              link: '/dashboard/payment-history',
            });
          }
        }

        // A vendor's invoice being paid: the vendor is told, with the receipt (this used to happen for
        // rent only, so a vendor never learned they had been paid).
        if (invoice.type === 'MAINTENANCE' && invoice.maintenanceRequestId) {
          const job = await prisma.maintenanceRequest.findUnique({
            where: { id: invoice.maintenanceRequestId },
            select: { vendorId: true },
          });
          if (job?.vendorId) {
            await notifyAndEmail(job.vendorId, {
              type: 'SYSTEM',
              title: `Payment received: ${invoice.invoiceNumber}`,
              body: `₦${amount.toLocaleString()} was paid on your invoice ${invoice.invoiceNumber}. Open the receipt to view or print it.`,
              link: `/receipts/${outcome.paymentId}`,
            });
          }
        }

        // A credit pack paid in full adds its credits, once (the claim and the ledger row share a
        // transaction, so a redelivered or doubled payment cannot add them twice).
        if (invoice.type === 'CREDIT_PURCHASE' && invoice.userId && outcome.status === 'PAID') {
          const added = await prisma.$transaction((tx) => grantPurchasedCredits(tx, invoice.id));
          if (added > 0) {
            await notifyAndEmail(invoice.userId, {
              type: 'SYSTEM',
              title: 'Credits added',
              body: `${added} credit${added === 1 ? '' : 's'} ${added === 1 ? 'was' : 'were'} added to your account. Thank you!`,
              link: '/dashboard',
            });
          }
        }

        // A subscription invoice paying activates the subscription itself -- plan/cycle have no
        // dedicated column, encoded into the description at checkout time (see
        // subscriptions/checkout/route.ts).
        if (
          subscriptionsEnabled() &&
          invoice.type === 'SUBSCRIPTION' &&
          invoice.userId &&
          outcome.status === 'PAID' &&
          !outcome.wasPaid
        ) {
          const match = invoice.description?.match(/plan=([a-z0-9-]+) cycle=(\w+)/);
          const plan = match ? await prisma.plan.findUnique({ where: { key: match[1] } }) : null;
          if (!plan) {
            console.error('Paid subscription invoice names no known plan', invoice.id);
          } else {
            const cycle = match?.[2] === 'yearly' ? 'YEARLY' : 'MONTHLY';
            const now = new Date();
            const periodEnd = new Date(now);
            if (cycle === 'YEARLY') periodEnd.setFullYear(periodEnd.getFullYear() + 1);
            else periodEnd.setMonth(periodEnd.getMonth() + 1);

            // Moving to a plan that includes fewer units than the account has opens the admin's
            // grace period, when that is the rule.
            const settings = await getSystemSettings();
            const units = await countUnitsFor(settings.unitBillingOwner, invoice.userId);
            const graceEndsAt =
              settings.enforcePlanLimits &&
              settings.downgradeRule === 'GRACE_PERIOD' &&
              units > plan.unitsIncluded
                ? graceEndsAtFrom(settings.downgradeGraceDays)
                : null;

            await prisma.subscription.upsert({
              where: { userId: invoice.userId },
              create: {
                userId: invoice.userId,
                planId: plan.id,
                billingCycle: cycle,
                status: 'ACTIVE',
                providerSubscriptionId: data.reference,
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                graceEndsAt,
              },
              update: {
                planId: plan.id,
                billingCycle: cycle,
                status: 'ACTIVE',
                providerSubscriptionId: data.reference,
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                cancelAtPeriodEnd: false,
                graceEndsAt,
              },
            });
          }
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    return handleApiError(err);
  }
}
