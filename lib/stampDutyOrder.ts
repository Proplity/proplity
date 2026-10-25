import type { Prisma, RentAgreement, StampDutyOrder } from '@prisma/client';
import { prisma } from '@/lib/db';
import { listJurisdictions } from '@/lib/agreements';
import { jurisdictionFor, type JurisdictionRules } from '@/lib/tenancyRules';
import { quoteStampDuty, type QuoteResult } from '@/lib/stampDuty';

type Tx = Prisma.TransactionClient;

type RentForQuote = {
  rentAmount: number;
  paymentFrequency: string;
  startDate: Date;
  endDate: Date;
  unit: { property: { state: string | null } };
};

export type StampDutyBlock = { ok: false; status: number; code: string; error: string };

/** The quote for a rent, from the rates of the place its property is in. */
export async function stampDutyQuoteFor(rent: RentForQuote, serviceFee: number) {
  const jurisdictions = await listJurisdictions();
  const jurisdiction = jurisdictionFor(rent.unit.property, jurisdictions);
  if (!jurisdiction) {
    return {
      jurisdiction: null,
      quote: {
        ok: false,
        code: 'NO_STAMP_RATE',
        error: 'No jurisdiction covers this property. Ask an admin to add one.',
      } satisfies QuoteResult,
    };
  }
  return {
    jurisdiction: jurisdiction as typeof jurisdiction & JurisdictionRules,
    quote: quoteStampDuty(jurisdiction, rent, serviceFee),
  };
}

/** Whether this agreement can have its stamp duty paid through Proplity at all (not who may ask). */
export function stampDutyBlock(
  agreement: Pick<RentAgreement, 'status' | 'stampDutyStatus'>,
): StampDutyBlock | null {
  if (agreement.status !== 'EXECUTED') {
    return {
      ok: false,
      status: 409,
      code: 'NOT_SIGNED',
      error: 'Stamp duty is paid once the agreement has been signed',
    };
  }
  if (agreement.stampDutyStatus === 'STAMPED') {
    return {
      ok: false,
      status: 409,
      code: 'ALREADY_STAMPED',
      error: 'This agreement is already stamped',
    };
  }
  return null;
}

/** The order that is still live for an agreement: not cancelled. */
export function liveOrder(agreementId: string, db: Tx | typeof prisma = prisma) {
  return db.stampDutyOrder.findFirst({
    where: { agreementId, status: { not: 'CANCELLED' } },
    orderBy: { createdAt: 'desc' },
  });
}

export function serializeOrder(o: StampDutyOrder) {
  return {
    id: o.id,
    status: o.status,
    dutyAmount: o.dutyAmount,
    serviceFee: o.serviceFee,
    total: o.total,
    ratePercent: o.ratePercent,
    termYears: o.termYears,
    invoiceId: o.invoiceId,
    paidAt: o.paidAt,
    completedAt: o.completedAt,
    cancelReason: o.cancelReason,
  };
}
