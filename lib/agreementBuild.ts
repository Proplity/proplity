import {
  RENT_PERIOD,
  formatLongDate,
  formatNaira,
  nairaInWords,
  renderClauses,
  termDescription,
  type AgreementValues,
  type ClauseChoices,
  type RenderedClause,
  type TemplateClause,
} from '@/lib/agreementFields';
import {
  noticePeriodText,
  type JurisdictionRules,
  type PaymentFrequencyKey,
} from '@/lib/tenancyRules';

// Turns a rent and the manager's choices into the text of a rent agreement. Pure: no database, no
// clock except the `today` it is given, so every rule here can be tested directly.

export type AgreementOffers = { caution: boolean; agency: boolean; legal: boolean };

export type AgreementBuildInput = {
  clauses: TemplateClause[];
  jurisdiction: Pick<JurisdictionRules, 'name' | 'noticeDays'>;
  rent: {
    startDate: Date;
    endDate: Date;
    rentAmount: number;
    serviceCharge: number;
    paymentFrequency: PaymentFrequencyKey;
    deposit: number;
    gracePeriodDays: number;
    lateFeeType: 'PERCENTAGE' | 'FIXED';
    lateFeePercentage: number;
    lateFeeFlatAmount: number;
  };
  unitNumber: string;
  property: { name: string; address: string; city: string; state: string | null };
  tenant: { name: string; email: string; phoneNumber: string | null };
  landlordName: string;
  /** The manager acting for an owner, named on the agreement. */
  agentName: string | null;
  agencyFee: number | null;
  legalFee: number | null;
  offers: AgreementOffers;
  today: Date;
  choices: ClauseChoices;
};

const money = (n: number | null | undefined, on = true) =>
  on && typeof n === 'number' && n > 0 ? formatNaira(n) : 'nil';

function lateFeeText(rent: AgreementBuildInput['rent']): string {
  if (rent.lateFeeType === 'FIXED') return money(rent.lateFeeFlatAmount);
  return rent.lateFeePercentage > 0 ? `${rent.lateFeePercentage}% of the amount overdue` : 'nil';
}

export function buildAgreementValues(input: AgreementBuildInput): AgreementValues {
  const { rent, property, tenant, offers } = input;
  return {
    agreementDate: formatLongDate(input.today),
    landlordName: input.landlordName,
    agentNote: input.agentName ? `, represented by their agent ${input.agentName}` : '',
    tenantName: tenant.name,
    tenantEmail: tenant.email,
    tenantPhone: tenant.phoneNumber || 'nil',
    propertyName: property.name,
    propertyAddress: property.address,
    unitNumber: input.unitNumber,
    city: property.city,
    state: property.state ?? '',
    jurisdictionName: input.jurisdiction.name,
    startDate: formatLongDate(rent.startDate),
    endDate: formatLongDate(rent.endDate),
    termDescription: termDescription(rent.startDate, rent.endDate),
    rentAmount: formatNaira(rent.rentAmount),
    rentAmountWords: nairaInWords(rent.rentAmount),
    rentPeriod: RENT_PERIOD[rent.paymentFrequency],
    cautionDeposit: money(rent.deposit, offers.caution),
    serviceCharge: money(rent.serviceCharge),
    agencyFee: money(input.agencyFee, offers.agency),
    legalFee: money(input.legalFee, offers.legal),
    noticePeriod: noticePeriodText(input.jurisdiction, rent.paymentFrequency),
    gracePeriodDays: String(rent.gracePeriodDays),
    lateFee: lateFeeText(rent),
  };
}

export type BuiltAgreement = {
  values: AgreementValues;
  clauses: RenderedClause[];
  /** Fields a clause used that had no value (an edit with a misspelt field). */
  missing: string[];
};

export function buildAgreement(input: AgreementBuildInput): BuiltAgreement {
  const values = buildAgreementValues(input);
  const { clauses, missing } = renderClauses(input.clauses, values, input.choices);
  return { values, clauses, missing };
}
