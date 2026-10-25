import { describe, expect, it } from 'vitest';
import {
  buildAgreement,
  buildAgreementValues,
  type AgreementBuildInput,
} from '@/lib/agreementBuild';
import { DEFAULT_TEMPLATES } from '@/lib/agreementDefaults';
import type { TemplateClause } from '@/lib/agreementFields';

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const input = (over: Partial<AgreementBuildInput> = {}): AgreementBuildInput => ({
  clauses: DEFAULT_TEMPLATES[0].clauses as unknown as TemplateClause[],
  jurisdiction: { name: 'Lagos State', noticeDays: { ANNUAL: 180, MONTHLY: 30 } },
  rent: {
    startDate: d('2026-12-01'),
    endDate: d('2027-11-30'),
    rentAmount: 2_500_000,
    serviceCharge: 150_000,
    paymentFrequency: 'ANNUAL',
    deposit: 250_000,
    gracePeriodDays: 7,
    lateFeeType: 'PERCENTAGE',
    lateFeePercentage: 5,
    lateFeeFlatAmount: 0,
  },
  unitNumber: 'Flat 2B',
  property: { name: 'Sunrise Court', address: '12 Admiralty Way', city: 'Lekki', state: 'Lagos' },
  tenant: { name: 'Ada Okafor', email: 'ada@example.com', phoneNumber: null },
  landlordName: 'Mr Bello',
  agentName: 'Bola Adeyemi',
  agencyFee: 125_000,
  legalFee: null,
  offers: { caution: true, agency: true, legal: true },
  today: d('2026-10-25'),
  choices: {},
  ...over,
});

describe('the values an agreement is made from', () => {
  it('writes the parties, the term, the rent and the notice the way an agreement does', () => {
    const v = buildAgreementValues(input());
    expect(v).toMatchObject({
      agreementDate: '25 October 2026',
      landlordName: 'Mr Bello',
      agentNote: ', represented by their agent Bola Adeyemi',
      tenantName: 'Ada Okafor',
      tenantPhone: 'nil',
      unitNumber: 'Flat 2B',
      jurisdictionName: 'Lagos State',
      startDate: '1 December 2026',
      endDate: '30 November 2027',
      termDescription: '12 months',
      rentAmount: '₦2,500,000',
      rentAmountWords: 'Two Million, Five Hundred Thousand Naira',
      rentPeriod: 'per annum',
      cautionDeposit: '₦250,000',
      serviceCharge: '₦150,000',
      agencyFee: '₦125,000',
      legalFee: 'nil',
      noticePeriod: '6 months',
      gracePeriodDays: '7',
      lateFee: '5% of the amount overdue',
    });
  });

  it('leaves out the agent when there is none, and says nil for fees that are not offered or not set', () => {
    const v = buildAgreementValues(
      input({
        agentName: null,
        offers: { caution: false, agency: false, legal: true },
        legalFee: 40_000,
      }),
    );
    expect(v.agentNote).toBe('');
    expect(v.cautionDeposit).toBe('nil');
    expect(v.agencyFee).toBe('nil');
    expect(v.legalFee).toBe('₦40,000');
  });

  it('reads a fixed late fee, no late fee, and each payment frequency', () => {
    const rent = input().rent;
    expect(
      buildAgreementValues(
        input({ rent: { ...rent, lateFeeType: 'FIXED', lateFeeFlatAmount: 10_000 } }),
      ).lateFee,
    ).toBe('₦10,000');
    expect(buildAgreementValues(input({ rent: { ...rent, lateFeePercentage: 0 } })).lateFee).toBe(
      'nil',
    );
    const period = (paymentFrequency: 'ANNUAL' | 'BI_ANNUAL' | 'QUARTERLY' | 'MONTHLY') =>
      buildAgreementValues(input({ rent: { ...rent, paymentFrequency } })).rentPeriod;
    expect(period('BI_ANNUAL')).toBe('every six months');
    expect(period('QUARTERLY')).toBe('per quarter');
    expect(period('MONTHLY')).toBe('per month');
  });

  it('uses the notice that fits the payment frequency, and a plain phrase when the rules give none', () => {
    const rent = input().rent;
    expect(
      buildAgreementValues(input({ rent: { ...rent, paymentFrequency: 'MONTHLY' } })).noticePeriod,
    ).toBe('1 month');
    expect(
      buildAgreementValues(input({ rent: { ...rent, paymentFrequency: 'QUARTERLY' } }))
        .noticePeriod,
    ).toBe('the period the law requires');
  });
});

describe('the finished agreement', () => {
  it('has no unfilled fields in any starting template, with every choice at its default', () => {
    for (const t of DEFAULT_TEMPLATES) {
      const built = buildAgreement(input({ clauses: t.clauses as unknown as TemplateClause[] }));
      expect(built.missing, t.key).toEqual([]);
      const text = built.clauses.map((c) => `${c.title} ${c.body}`).join('\n');
      expect(text, t.key).not.toContain('{{');
      expect(text).toContain('Mr Bello, represented by their agent Bola Adeyemi (the Landlord)');
      expect(text).toContain('₦2,500,000 (Two Million, Five Hundred Thousand Naira) per annum');
    }
  });

  it('follows the manager’s choices', () => {
    const built = buildAgreement(
      input({
        choices: {
          omit: ['alterations'],
          include: ['renewal'],
          edits: { use: 'Home and small office.' },
        },
      }),
    );
    const ids = built.clauses.map((c) => c.id);
    expect(ids).not.toContain('alterations');
    expect(ids).toContain('renewal');
    expect(built.clauses.find((c) => c.id === 'use')!.body).toBe('Home and small office.');
  });
});
