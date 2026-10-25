import type { CreditPack, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { ensureDefaultCreditPacks } from '@/lib/plans';
import { billingAccountOf } from '@/lib/team';

type Tx = Prisma.TransactionClient;

export async function listCreditPacks(opts: { onlyActive?: boolean } = {}): Promise<CreditPack[]> {
  await ensureDefaultCreditPacks();
  return prisma.creditPack.findMany({
    where: opts.onlyActive ? { isActive: true } : {},
    orderBy: [{ sortOrder: 'asc' }, { price: 'asc' }],
  });
}

/**
 * Starts buying a pack: one unpaid invoice for the pack's price at this moment, and a purchase row
 * that keeps what the pack was. Asking twice for the same pack at the same price returns the same
 * invoice instead of piling up unpaid ones; if the admin changed the pack in between, the old
 * invoice is cancelled (nothing was paid on it) and a new one is made.
 */
export async function startCreditPurchase(buyerId: string, pack: CreditPack) {
  return prisma.$transaction(async (tx) => {
    const open = await tx.creditPurchase.findFirst({
      where: {
        userId: buyerId,
        packKey: pack.key,
        creditedAt: null,
        invoice: { status: 'UNPAID' },
      },
      include: { invoice: { include: { payments: { select: { id: true }, take: 1 } } } },
      orderBy: { createdAt: 'desc' },
    });
    if (open) {
      const same = open.price === pack.price && open.credits === pack.credits;
      if (same) return open;
      // Money may already be on the way for it (a payment started but not yet confirmed); only an
      // invoice nothing was paid against can be dropped.
      if (open.invoice.payments.length === 0) {
        await tx.invoice.update({ where: { id: open.invoiceId }, data: { status: 'CANCELLED' } });
      }
    }
    const invoice = await tx.invoice.create({
      data: {
        userId: buyerId,
        type: 'CREDIT_PURCHASE',
        amount: pack.price,
        dueDate: new Date(),
        description: `Proplity credits: ${pack.name}`,
      },
    });
    return tx.creditPurchase.create({
      data: {
        userId: buyerId,
        invoiceId: invoice.id,
        packKey: pack.key,
        packName: pack.name,
        credits: pack.credits,
        price: pack.price,
      },
      include: { invoice: { include: { payments: { select: { id: true }, take: 1 } } } },
    });
  });
}

/**
 * Adds the credits of a purchase whose invoice has been paid in full, once. Claiming the purchase
 * (`creditedAt` still null) and adding the ledger row happen in one transaction, so a payment
 * delivered twice, or two payments completing the invoice together, still add the credits once.
 * Returns the credits added, or 0 if the invoice is not a purchase or was already credited.
 */
export async function grantPurchasedCredits(tx: Tx, invoiceId: string): Promise<number> {
  const purchase = await tx.creditPurchase.findUnique({ where: { invoiceId } });
  if (!purchase || purchase.creditedAt) return 0;
  const accountId = await billingAccountOf(purchase.userId, tx);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`credits:${accountId}`}))`;
  const claimed = await tx.creditPurchase.updateMany({
    where: { id: purchase.id, creditedAt: null },
    data: { creditedAt: new Date() },
  });
  if (claimed.count === 0) return 0;
  const entry = await tx.creditEntry.create({
    data: {
      userId: accountId,
      delta: purchase.credits,
      reason: 'PURCHASE',
      note: `Bought ${purchase.packName}`,
      createdById: purchase.userId,
    },
  });
  await tx.creditPurchase.update({
    where: { id: purchase.id },
    data: { creditEntryId: entry.id },
  });
  return purchase.credits;
}
