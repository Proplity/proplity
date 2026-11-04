import { describe, expect, it } from 'vitest';
import { quoteStampDuty, stampDutyTiersSchema } from '../../lib/stampDuty';

const tiers = [
  { upToYears: 7, ratePercent: 0.78 },
  { upToYears: 21, ratePercent: 3 },
  { upToYears: null, ratePercent: 6 },
];
const place = { stampDutyTiers: tiers, stampDutyBasis: 'TERM_RENT' as const };
const rent = (
  over: Partial<{ rentAmount: number; paymentFrequency: string; end: string }> = {},
) => ({
  rentAmount: over.rentAmount ?? 2_500_000,
  paymentFrequency: over.paymentFrequency ?? 'ANNUAL',
  startDate: new Date('2026-12-01T00:00:00Z'),
  endDate: new Date(over.end ?? '2027-11-30T00:00:00Z'),
});

describe('quoting stamp duty', () => {
  it('applies the rate for the length of the tenancy to the rent for the whole term', () => {
    const q = quoteStampDuty(place, rent(), 1000);
    expect(q).toMatchObject({
      ok: true,
      termYears: 1,
      ratePercent: 0.78,
      basisAmount: 2_500_000,
      dutyAmount: 19_500,
      serviceFee: 1000,
      total: 20_500,
    });
    // Two years of rent for a two-year tenancy.
    const two = quoteStampDuty(place, rent({ end: '2028-11-30T00:00:00Z' }), 0);
    expect(two).toMatchObject({ termYears: 2, basisAmount: 5_000_000, dutyAmount: 39_000 });
  });

  it('can charge on one year’s rent instead', () => {
    const q = quoteStampDuty(
      { ...place, stampDutyBasis: 'ANNUAL_RENT' },
      rent({ end: '2028-11-30T00:00:00Z' }),
      0,
    );
    expect(q).toMatchObject({ ok: true, basisAmount: 2_500_000, dutyAmount: 19_500 });
  });

  it('turns a monthly rent into a year’s rent first', () => {
    const q = quoteStampDuty(place, rent({ rentAmount: 100_000, paymentFrequency: 'MONTHLY' }), 0);
    expect(q).toMatchObject({ ok: true, basisAmount: 1_200_000, dutyAmount: 9_360 });
    const quarterly = quoteStampDuty(
      place,
      rent({ rentAmount: 300_000, paymentFrequency: 'QUARTERLY' }),
      0,
    );
    expect(quarterly).toMatchObject({ basisAmount: 1_200_000 });
  });

  it('moves up a tier at the boundary: shorter than 7 years pays the first rate', () => {
    expect(quoteStampDuty(place, rent({ end: '2033-11-30T00:00:00Z' }), 0)).toMatchObject({
      termYears: 7,
      ratePercent: 3,
    });
    expect(quoteStampDuty(place, rent({ end: '2033-05-31T00:00:00Z' }), 0)).toMatchObject({
      ratePercent: 0.78,
    });
    expect(quoteStampDuty(place, rent({ end: '2048-11-30T00:00:00Z' }), 0)).toMatchObject({
      ratePercent: 6,
    });
  });

  it('rounds the duty up to a whole naira so it is never short', () => {
    const q = quoteStampDuty(place, rent({ rentAmount: 333_333 }), 0);
    expect(q).toMatchObject({ ok: true, dutyAmount: Math.ceil(333_333 * 0.0078) });
  });

  it('says so when the place has no rates', () => {
    const q = quoteStampDuty({ ...place, stampDutyTiers: [] }, rent(), 0);
    expect(q).toMatchObject({ ok: false, code: 'NO_STAMP_RATE' });
    expect(quoteStampDuty({ ...place, stampDutyTiers: 'junk' }, rent(), 0)).toMatchObject({
      ok: false,
    });
  });
});

describe('the tiers an admin saves', () => {
  it('accepts tiers in order with an open last tier, and none at all', () => {
    expect(stampDutyTiersSchema.safeParse(tiers).success).toBe(true);
    expect(stampDutyTiersSchema.safeParse([]).success).toBe(true);
    expect(stampDutyTiersSchema.safeParse([{ upToYears: null, ratePercent: 1 }]).success).toBe(
      true,
    );
  });

  it('refuses tiers out of order, a limit on the last tier, an open tier that is not last, and bad rates', () => {
    const bad = (v: unknown) => expect(stampDutyTiersSchema.safeParse(v).success).toBe(false);
    bad([
      { upToYears: 21, ratePercent: 3 },
      { upToYears: 7, ratePercent: 1 },
      { upToYears: null, ratePercent: 6 },
    ]);
    bad([{ upToYears: 7, ratePercent: 1 }]);
    bad([
      { upToYears: null, ratePercent: 1 },
      { upToYears: null, ratePercent: 6 },
    ]);
    bad([{ upToYears: null, ratePercent: 101 }]);
    bad([{ upToYears: null, ratePercent: -1 }]);
    bad([
      { upToYears: 0, ratePercent: 1 },
      { upToYears: null, ratePercent: 6 },
    ]);
  });
});
