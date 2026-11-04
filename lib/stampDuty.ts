import { z } from 'zod';
import { termMonths } from '@/lib/agreementFields';
import { MONTHS_PER_CYCLE, type PaymentFrequencyKey } from '@/lib/tenancyRules';

// Stamp duty on a tenancy, worked out from the place's rates so Proplity can quote it. The rates are
// the admin's (Admin > Rent agreements > Jurisdictions): they depend on the length of the tenancy
// and change with the law. A quote is an estimate: the tax authority's own assessment decides what
// is actually paid, and any difference is flagged for a refund when the order is completed (CLAUDE.md rule 22).

export const stampDutyTierSchema = z
  .object({
    // The tier applies to a tenancy shorter than this many years; null on the last tier = no limit.
    upToYears: z.number().positive().max(999).nullable(),
    ratePercent: z.number().min(0).max(100),
  })
  .strict();

export const stampDutyTiersSchema = z
  .array(stampDutyTierSchema)
  .max(8)
  .superRefine((tiers, ctx) => {
    tiers.forEach((t, i) => {
      const last = i === tiers.length - 1;
      if (last && t.upToYears !== null) {
        ctx.addIssue({
          code: 'custom',
          message: 'The last tier has no upper limit (leave it blank)',
        });
      }
      if (!last) {
        if (t.upToYears === null) {
          ctx.addIssue({ code: 'custom', message: 'Only the last tier can have no upper limit' });
        } else if (
          i > 0 &&
          tiers[i - 1].upToYears !== null &&
          t.upToYears <= tiers[i - 1].upToYears!
        ) {
          ctx.addIssue({
            code: 'custom',
            message: 'Put the tiers in order, shortest tenancy first',
          });
        }
      }
    });
  });

export type StampDutyTier = z.infer<typeof stampDutyTierSchema>;

/** The tiers as stored, or none when the stored value is not a well-formed list. */
export function readTiers(value: unknown): StampDutyTier[] {
  const parsed = stampDutyTiersSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
}

export type StampDutyQuote = {
  termYears: number;
  basis: 'ANNUAL_RENT' | 'TERM_RENT';
  basisAmount: number;
  ratePercent: number;
  dutyAmount: number;
  serviceFee: number;
  total: number;
};

export type QuoteResult =
  ({ ok: true } & StampDutyQuote) | { ok: false; code: 'NO_STAMP_RATE'; error: string };

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * The duty and the service fee for a tenancy. Whole naira, rounded up for the duty so the quote
 * never falls short of the rate. `NO_STAMP_RATE` when the place has no rates set.
 */
export function quoteStampDuty(
  jurisdiction: { stampDutyTiers: unknown; stampDutyBasis: 'ANNUAL_RENT' | 'TERM_RENT' },
  rent: { rentAmount: number; paymentFrequency: string; startDate: Date; endDate: Date },
  serviceFee: number,
): QuoteResult {
  const tiers = readTiers(jurisdiction.stampDutyTiers);
  if (tiers.length === 0) {
    return {
      ok: false,
      code: 'NO_STAMP_RATE',
      error: 'Stamp duty rates are not set for this place yet. Ask an admin to add them.',
    };
  }
  const months = termMonths(rent.startDate, rent.endDate);
  const termYears = round2(months / 12);
  const tier =
    tiers.find((t) => t.upToYears === null || termYears < t.upToYears) ?? tiers[tiers.length - 1];
  const perCycle =
    MONTHS_PER_CYCLE[(rent.paymentFrequency as PaymentFrequencyKey) ?? 'ANNUAL'] ?? 12;
  const annualRent = rent.rentAmount * (12 / perCycle);
  const basisAmount = round2(
    jurisdiction.stampDutyBasis === 'ANNUAL_RENT' ? annualRent : annualRent * termYears,
  );
  const dutyAmount = Math.ceil((basisAmount * tier.ratePercent) / 100);
  return {
    ok: true,
    termYears,
    basis: jurisdiction.stampDutyBasis,
    basisAmount,
    ratePercent: tier.ratePercent,
    dutyAmount,
    serviceFee,
    total: dutyAmount + serviceFee,
  };
}
