import { z } from 'zod';

// The wording of a rent agreement is a list of clauses an admin edits. A clause can use {{fields}},
// filled in from the rent when an agreement is made. This file is pure (no database), so the admin
// screen, the API and the tests all read the same list of fields and the same rendering.

export const CLAUSE_MODES = ['LOCKED', 'EDITABLE', 'OPTIONAL'] as const;
export type ClauseMode = (typeof CLAUSE_MODES)[number];

export type TemplateClause = {
  id: string;
  title: string;
  body: string;
  /** LOCKED: the same in every agreement. EDITABLE: the manager may reword it. OPTIONAL: the manager may leave it out. */
  mode: ClauseMode;
  /** For an OPTIONAL clause: whether it is included until the manager turns it off. */
  defaultOn?: boolean;
};

/** Every field a clause may use, with what it shows, for the admin screen's help list. */
export const AGREEMENT_FIELDS = {
  agreementDate: 'The date the agreement is made, such as 1 September 2026',
  landlordName: "The landlord's name (the owner, as typed or from their account)",
  agentNote: 'Empty, or ", acting through its agent <name>" when a manager acts for the owner',
  tenantName: "The tenant's full name",
  tenantEmail: "The tenant's email address",
  tenantPhone: "The tenant's phone number, or nil",
  propertyName: "The building's name",
  propertyAddress: "The building's street address",
  unitNumber: 'The flat, room or unit',
  city: 'The city',
  state: 'The state',
  jurisdictionName: 'The jurisdiction whose rules apply, such as Lagos State',
  startDate: 'The day the tenancy starts',
  endDate: 'The day the tenancy ends',
  termDescription: 'How long it lasts, such as 12 months',
  rentAmount: 'The rent for one payment, in naira with a ₦ sign',
  rentAmountWords: 'The same amount in words',
  rentPeriod: 'How often it is paid: per annum, every six months, per quarter or per month',
  cautionDeposit: 'The refundable caution deposit, or nil',
  serviceCharge: 'The service charge for one payment, or nil',
  agencyFee: 'The agency fee, or nil',
  legalFee: 'The legal fee, or nil',
  noticePeriod: "The notice to end the tenancy under the jurisdiction's rules, such as 6 months",
  gracePeriodDays: 'The days after the due date before a late fee applies',
  lateFee: 'The late fee, such as 5% of the rent due or ₦10,000',
} as const;

export type AgreementField = keyof typeof AGREEMENT_FIELDS;
export const AGREEMENT_FIELD_KEYS = Object.keys(AGREEMENT_FIELDS) as AgreementField[];
export type AgreementValues = Record<AgreementField, string>;

const FIELD_RE = /\{\{\s*([A-Za-z][A-Za-z0-9]*)\s*\}\}/g;

/** The field names a piece of text uses. */
export function fieldsUsed(text: string): string[] {
  return [...text.matchAll(FIELD_RE)].map((m) => m[1]);
}

export const MAX_CLAUSES = 60;
export const MAX_CLAUSE_BODY = 6000;

export const clauseSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9][a-z0-9-]*$/, 'A clause id uses lower-case letters, numbers and hyphens'),
  title: z.string().trim().min(1, 'Every clause needs a title').max(120),
  body: z.string().trim().min(1, 'Every clause needs wording').max(MAX_CLAUSE_BODY),
  mode: z.enum(CLAUSE_MODES),
  defaultOn: z.boolean().optional(),
});

/**
 * The problems with a list of clauses, as sentences. Empty means it is fine to save: ids are
 * unique, and every {{field}} is one this system fills in (a misspelt one would otherwise print as
 * "{{rentAmmount}}" in a signed agreement).
 */
export function clauseProblems(clauses: TemplateClause[]): string[] {
  const problems: string[] = [];
  if (clauses.length === 0) problems.push('Add at least one clause');
  if (clauses.length > MAX_CLAUSES) problems.push(`At most ${MAX_CLAUSES} clauses`);
  const seen = new Set<string>();
  for (const c of clauses) {
    if (seen.has(c.id)) problems.push(`Two clauses share the id "${c.id}"`);
    seen.add(c.id);
    const unknown = [...new Set(fieldsUsed(`${c.title} ${c.body}`))].filter(
      (f) => !(f in AGREEMENT_FIELDS),
    );
    if (unknown.length > 0) {
      problems.push(
        `"${c.title}" uses ${unknown.map((f) => `{{${f}}}`).join(', ')}, which ${unknown.length === 1 ? 'is' : 'are'} not known fields`,
      );
    }
  }
  return problems;
}

export type ClauseChoices = {
  /** Ids of OPTIONAL clauses to leave out (an OPTIONAL clause not listed here follows its default). */
  omit?: string[];
  /** Ids of OPTIONAL clauses to include although they default to off. */
  include?: string[];
  /** Reworded bodies for EDITABLE clauses, by id. A LOCKED clause ignores these. */
  edits?: Record<string, string>;
};

export type RenderedClause = { id: string; title: string; body: string };

/** Fills the fields in a piece of text; a field with no value is reported and left visible. */
export function fillFields(
  text: string,
  values: Partial<Record<string, string>>,
  missing?: Set<string>,
): string {
  return text.replace(FIELD_RE, (whole, key: string) => {
    const value = values[key];
    if (value === undefined) {
      missing?.add(key);
      return whole;
    }
    return value;
  });
}

/**
 * The clauses an agreement will contain: optional ones left out are dropped, edits applied to the
 * editable ones, fields filled in. `missing` lists fields that had no value.
 */
export function renderClauses(
  clauses: TemplateClause[],
  values: Partial<Record<string, string>>,
  choices: ClauseChoices = {},
): { clauses: RenderedClause[]; missing: string[] } {
  const missing = new Set<string>();
  const omit = new Set(choices.omit ?? []);
  const include = new Set(choices.include ?? []);
  const out: RenderedClause[] = [];
  for (const c of clauses) {
    if (c.mode === 'OPTIONAL') {
      const on = omit.has(c.id) ? false : include.has(c.id) ? true : (c.defaultOn ?? true);
      if (!on) continue;
    }
    const edited = c.mode === 'EDITABLE' ? choices.edits?.[c.id]?.trim() : undefined;
    out.push({
      id: c.id,
      title: fillFields(c.title, values, missing),
      body: fillFields(edited || c.body, values, missing),
    });
  }
  return { clauses: out, missing: [...missing] };
}

// ── Formatting ───────────────────────────────────────────────────────────────────────────────────

export const formatNaira = (n: number) =>
  `₦${n.toLocaleString('en-GB', { maximumFractionDigits: 2 })}`;

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** 1 September 2026, read in UTC so the day does not move with the server's time zone. */
export function formatLongDate(d: Date): string {
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function below1000(n: number): string {
  const parts: string[] = [];
  if (n >= 100) {
    parts.push(`${ONES[Math.floor(n / 100)]} Hundred`);
    n %= 100;
    if (n > 0) parts.push('and');
  }
  if (n >= 20) {
    parts.push(TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : ''));
  } else if (n > 0) {
    parts.push(ONES[n]);
  }
  return parts.join(' ');
}

/** An amount in words, the way agreements write it: "Two Million, Five Hundred Thousand Naira". */
export function nairaInWords(amount: number): string {
  const whole = Math.floor(Math.abs(amount));
  const kobo = Math.round((Math.abs(amount) - whole) * 100);
  if (whole === 0 && kobo === 0) return 'Zero Naira';
  const scales: [number, string][] = [
    [1_000_000_000_000, 'Trillion'],
    [1_000_000_000, 'Billion'],
    [1_000_000, 'Million'],
    [1_000, 'Thousand'],
  ];
  let rest = whole;
  const parts: string[] = [];
  for (const [size, name] of scales) {
    if (rest >= size) {
      parts.push(`${below1000(Math.floor(rest / size))} ${name}`);
      rest %= size;
    }
  }
  if (rest > 0) {
    // "and" joins a final amount under a hundred to what came before: One Million and Fifty Naira.
    parts.push(parts.length > 0 && rest < 100 ? `and ${below1000(rest)}` : below1000(rest));
  }
  let words = parts.join(', ').replace(', and ', ' and ');
  if (whole > 0) words += ' Naira';
  if (kobo > 0) words += `${whole > 0 ? ' and ' : ''}${below1000(kobo)} Kobo`;
  return words;
}

/** How a payment frequency reads inside an agreement. */
export const RENT_PERIOD: Record<string, string> = {
  ANNUAL: 'per annum',
  BI_ANNUAL: 'every six months',
  QUARTERLY: 'per quarter',
  MONTHLY: 'per month',
};

/**
 * "12 months", "2 years", "18 months" for a tenancy from its first day to its last. The last day
 * is included, so 1 September to 31 August is 12 months; a leftover under half a month is dropped.
 */
export function termMonths(start: Date, end: Date): number {
  const exclusive = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  let months =
    (exclusive.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (exclusive.getUTCMonth() - start.getUTCMonth());
  let days = exclusive.getUTCDate() - start.getUTCDate();
  if (days < 0) {
    months -= 1;
    days += 30;
  }
  if (days >= 15) months += 1;
  return Math.max(1, months);
}

export function termDescription(start: Date, end: Date): string {
  const months = termMonths(start, end);
  if (months % 12 === 0) {
    const years = months / 12;
    return years === 1 ? '12 months' : `${years} years`;
  }
  return `${months} months`;
}

/** A number of days as people say it: 180 → "6 months", 7 → "1 week", 45 → "45 days". */
export function humanDays(days: number): string {
  if (days >= 365 && days % 365 === 0) {
    const y = days / 365;
    return `${y} year${y === 1 ? '' : 's'}`;
  }
  if (days >= 30 && days % 30 === 0) {
    const m = days / 30;
    return `${m} month${m === 1 ? '' : 's'}`;
  }
  if (days >= 7 && days % 7 === 0 && days < 30) {
    const w = days / 7;
    return `${w} week${w === 1 ? '' : 's'}`;
  }
  return `${days} day${days === 1 ? '' : 's'}`;
}
