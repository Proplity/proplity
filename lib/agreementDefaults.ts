import type { TemplateClause } from '@/lib/agreementFields';

// The first jurisdictions and agreement wording, used only while those tables are empty. NOTHING
// HERE HAS BEEN REVIEWED BY A LAWYER: every row is seeded as "not lawyer reviewed" and the
// templates start as drafts, so they cannot be used for real agreements until an admin approves
// them (or switches the approval requirement off). Edit them at Admin > Rent agreements. Plain
// data with no database import, so tests can seed the same rows.

const CHECKED = new Date('2026-10-23T00:00:00.000Z');

export const DEFAULT_JURISDICTIONS = [
  {
    key: 'lagos',
    name: 'Lagos State',
    states: ['Lagos'],
    isDefault: false,
    advanceRentMaxMonths: 12,
    advanceRentMode: 'WARN',
    noticeDays: { MONTHLY: 30, QUARTERLY: 90, BI_ANNUAL: 90, ANNUAL: 180 },
    excludedAreas: ['Apapa', 'Ikeja GRA', 'Ikoyi', 'Victoria Island'],
    excludedAreasMode: 'WARN',
    registrationThresholdYears: 3,
    stampDutyNote:
      'Stamp duty is a federal charge, paid through FIRS e-stamping with the parties’ tax numbers. The rate depends on the length of the tenancy (roughly 0.78% to 6% of the rent for the term). Confirm the current rate.',
    sourceNote:
      'Lagos State Tenancy Law 2011 (in force): rent paid in advance is capped at one year, with a fine (₦100,000) or imprisonment (3 months) for demanding more. The law does not apply in Apapa, Ikeja GRA, Ikoyi and Victoria Island. Notice periods in published summaries conflict; the periods here are a starting point to confirm. A 2025 bill capping agency fees at 5% has not become law. A tenancy over 3 years may need a registered deed (unverified). Witnesses are customary.',
    rulesCheckedAt: CHECKED,
    lawyerReviewed: false,
    sortOrder: 1,
  },
  {
    key: 'abuja',
    name: 'Federal Capital Territory (Abuja)',
    states: ['FCT', 'Abuja', 'Federal Capital Territory'],
    isDefault: false,
    advanceRentMaxMonths: null,
    advanceRentMode: 'WARN',
    noticeDays: { MONTHLY: 30, QUARTERLY: 90, BI_ANNUAL: 90, ANNUAL: 180 },
    excludedAreas: [],
    excludedAreasMode: 'WARN',
    registrationThresholdYears: null,
    stampDutyNote:
      'Stamp duty is a federal charge, paid through FIRS e-stamping. The rate depends on the length of the tenancy. Confirm the current rate.',
    sourceNote:
      'The FCT rests on the Recovery of Premises Act (Cap 544), which sets notice to quit and the court process. A Senate bill proposing a 3-month cap on advance rent was reported; its status is unconfirmed, so no cap is set here. Notice periods are a starting point to confirm.',
    rulesCheckedAt: CHECKED,
    lawyerReviewed: false,
    sortOrder: 2,
  },
  {
    key: 'nigeria-general',
    name: 'Nigeria',
    states: [],
    isDefault: true,
    advanceRentMaxMonths: null,
    advanceRentMode: 'WARN',
    noticeDays: { MONTHLY: 30, QUARTERLY: 90, BI_ANNUAL: 90, ANNUAL: 180 },
    excludedAreas: [],
    excludedAreasMode: 'WARN',
    registrationThresholdYears: null,
    stampDutyNote:
      'Stamp duty is a federal charge, paid through FIRS e-stamping. The rate depends on the length of the tenancy. Confirm the current rate.',
    sourceNote:
      'Used for any state without its own entry. No state-specific rules are set: add a jurisdiction for the state once its tenancy law has been checked.',
    rulesCheckedAt: CHECKED,
    lawyerReviewed: false,
    sortOrder: 3,
  },
] as const;

/** The wording shared by the starting templates; only the governing-law line differs. */
function residentialClauses(governingLaw: string): TemplateClause[] {
  return [
    {
      id: 'parties',
      title: 'The parties',
      mode: 'LOCKED',
      body: 'This agreement is made on {{agreementDate}} between {{landlordName}}{{agentNote}} (the Landlord) and {{tenantName}} (the Tenant).',
    },
    {
      id: 'premises',
      title: 'The premises',
      mode: 'LOCKED',
      body: 'The Landlord lets and the Tenant takes unit {{unitNumber}} at {{propertyName}}, {{propertyAddress}}, {{city}} (the Premises).',
    },
    {
      id: 'term',
      title: 'The term',
      mode: 'LOCKED',
      body: 'The tenancy is for {{termDescription}}, starting on {{startDate}} and ending on {{endDate}}.',
    },
    {
      id: 'rent',
      title: 'The rent',
      mode: 'LOCKED',
      body: 'The Tenant shall pay rent of {{rentAmount}} ({{rentAmountWords}}) {{rentPeriod}}, in advance. The first payment is due on or before {{startDate}}.',
    },
    {
      id: 'other-payments',
      title: 'Other payments',
      mode: 'EDITABLE',
      body: 'Before taking possession the Tenant shall also pay: a refundable caution deposit of {{cautionDeposit}}; an agency fee of {{agencyFee}}; and a legal fee of {{legalFee}}. A service charge of {{serviceCharge}} is payable {{rentPeriod}} together with the rent.',
    },
    {
      id: 'caution-deposit',
      title: 'The caution deposit',
      mode: 'EDITABLE',
      body: 'The caution deposit is held as security for the Tenant’s obligations. After the Tenant gives up possession and the Premises have been inspected, the Landlord shall return it within 30 days, less the cost of any damage beyond fair wear and tear and any rent or charges unpaid.',
    },
    {
      id: 'use',
      title: 'Use of the premises',
      mode: 'EDITABLE',
      body: 'The Tenant shall use the Premises as a private dwelling only, and shall not carry on any trade or business there without the Landlord’s written consent.',
    },
    {
      id: 'tenant-obligations',
      title: 'The Tenant’s obligations',
      mode: 'EDITABLE',
      body: 'The Tenant shall: pay the rent and other sums on time; keep the Premises clean and in good condition; not cause nuisance or annoyance to neighbours; obey the reasonable rules of the building; and pay for electricity, water, waste and other utilities used at the Premises.',
    },
    {
      id: 'landlord-obligations',
      title: 'The Landlord’s obligations',
      mode: 'EDITABLE',
      body: 'The Landlord shall: let the Tenant enjoy the Premises without interruption while the Tenant keeps to this agreement; keep the structure, roof, and the supply installations in repair; and give the Tenant a receipt for every payment.',
    },
    {
      id: 'repairs',
      title: 'Repairs and maintenance',
      mode: 'EDITABLE',
      body: 'The Tenant shall report any defect to the Landlord or the manager promptly, in writing or through Proplity. The Landlord shall arrange repairs of defects not caused by the Tenant within a reasonable time. The Tenant shall pay for damage caused by the Tenant, the Tenant’s household or guests.',
    },
    {
      id: 'subletting',
      title: 'No subletting or assignment',
      mode: 'EDITABLE',
      body: 'The Tenant shall not sublet, share possession of, or assign the Premises or any part of them without the Landlord’s written consent.',
    },
    {
      id: 'alterations',
      title: 'Alterations',
      mode: 'OPTIONAL',
      defaultOn: true,
      body: 'The Tenant shall not make structural alterations or additions to the Premises, or fix anything to the walls, ceilings or floors beyond ordinary pictures, without the Landlord’s written consent.',
    },
    {
      id: 'access',
      title: 'Access and inspection',
      mode: 'EDITABLE',
      body: 'The Landlord or the manager may enter the Premises at reasonable times, after at least 24 hours’ notice, to inspect or repair them, and at any time in an emergency.',
    },
    {
      id: 'late-payment',
      title: 'Late payment',
      mode: 'OPTIONAL',
      defaultOn: true,
      body: 'If rent is not paid within {{gracePeriodDays}} days of its due date, a late fee of {{lateFee}} is payable. This does not stop the Landlord from using any other right.',
    },
    {
      id: 'notice',
      title: 'Ending the tenancy',
      mode: 'LOCKED',
      body: 'Either party who wishes the tenancy to end shall give the other written notice of at least {{noticePeriod}}, as the law of {{jurisdictionName}} requires. The Tenant shall give up the Premises in good condition on the day the tenancy ends. The Landlord shall not recover possession except by the process the law requires.',
    },
    {
      id: 'renewal',
      title: 'Renewal',
      mode: 'OPTIONAL',
      defaultOn: false,
      body: 'If the Tenant has kept to this agreement, the Tenant may ask to renew it by writing to the Landlord at least {{noticePeriod}} before the end of the term. Any renewal is on terms the parties agree in writing.',
    },
    {
      id: 'governing-law',
      title: 'Governing law and disputes',
      mode: 'LOCKED',
      body: `${governingLaw} The parties shall first try to settle any dispute by discussion. A dispute that cannot be settled may be taken to a court of competent jurisdiction.`,
    },
    {
      id: 'electronic-signature',
      title: 'Electronic signature',
      mode: 'LOCKED',
      body: 'The parties agree that this agreement may be signed electronically, and that a typed full name recorded with the time and address from which it was signed is a valid signature of the person who typed it.',
    },
  ];
}

const NOT_REVIEWED_NOTE =
  'Starting wording, not reviewed by a lawyer. Have a lawyer review it, then approve it, before managers use it for real agreements.';

export const DEFAULT_TEMPLATES = [
  {
    key: 'lagos-residential',
    name: 'Residential tenancy agreement (Lagos State)',
    jurisdictionKey: 'lagos',
    clauses: residentialClauses(
      'This agreement is governed by the laws of Lagos State and the Federal Republic of Nigeria, including the Lagos State Tenancy Law.',
    ),
    witnessRequired: true,
    notes: NOT_REVIEWED_NOTE,
  },
  {
    key: 'abuja-residential',
    name: 'Residential tenancy agreement (Abuja, FCT)',
    jurisdictionKey: 'abuja',
    clauses: residentialClauses(
      'This agreement is governed by the laws of the Federal Capital Territory and the Federal Republic of Nigeria, including the Recovery of Premises Act.',
    ),
    witnessRequired: true,
    notes: NOT_REVIEWED_NOTE,
  },
  {
    key: 'nigeria-residential',
    name: 'Residential tenancy agreement (general)',
    jurisdictionKey: 'nigeria-general',
    clauses: residentialClauses(
      'This agreement is governed by the laws of {{jurisdictionName}} and the Federal Republic of Nigeria.',
    ),
    witnessRequired: true,
    notes: NOT_REVIEWED_NOTE,
  },
] as const;
