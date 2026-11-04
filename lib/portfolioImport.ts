import { z } from 'zod';
import { PaymentFrequency, PropertyType } from '@prisma/client';

// Reads a spreadsheet of properties, units and (optionally) the tenant in each unit. Pure: no
// database, no clock except the `today` it is given, so every rule here can be tested directly.
// One row is one unit; rows with the same property name, address and city are one property.

export const MAX_PORTFOLIO_ROWS = 500;

export type ImportTenancy = {
  name: string;
  email: string;
  phoneNumber: string | null;
  startDate: Date;
  endDate: Date;
  deposit: number;
  /**
   * When the first rent invoice falls due: the start date, or the next due date of a running
   * tenancy. Null when the whole term is already paid and nothing falls due until it is renewed.
   */
  firstDueDate: Date | null;
  /** The tenancy has already started, so it is recorded as active. */
  active: boolean;
};

export type ImportUnit = {
  row: number;
  unitNumber: string;
  bedrooms: number;
  bathrooms: number;
  squareFeet: number | null;
  rentAmount: number;
  paymentFrequency: PaymentFrequency;
  serviceCharge: number;
  tenancy: ImportTenancy | null;
};

export type ImportProperty = {
  key: string;
  name: string;
  address: string;
  city: string;
  state: string | null;
  type: PropertyType;
  units: ImportUnit[];
};

export type ImportIssue = { row: number; error: string };

export type ParsedPortfolio = {
  properties: ImportProperty[];
  issues: ImportIssue[];
  /** A problem with the file as a whole (missing columns, empty, too long). */
  fileError: string | null;
};

type Field =
  | 'propertyName'
  | 'address'
  | 'city'
  | 'state'
  | 'propertyType'
  | 'unitNumber'
  | 'bedrooms'
  | 'bathrooms'
  | 'squareFeet'
  | 'rentAmount'
  | 'paymentFrequency'
  | 'serviceCharge'
  | 'tenantName'
  | 'tenantEmail'
  | 'tenantPhone'
  | 'startDate'
  | 'endDate'
  | 'deposit'
  | 'nextRentDue';

/** The columns of the template, in order, with the name people see. */
export const TEMPLATE_COLUMNS: Field[] = [
  'propertyName',
  'address',
  'city',
  'state',
  'propertyType',
  'unitNumber',
  'bedrooms',
  'bathrooms',
  'squareFeet',
  'rentAmount',
  'paymentFrequency',
  'serviceCharge',
  'tenantName',
  'tenantEmail',
  'tenantPhone',
  'startDate',
  'endDate',
  'deposit',
  'nextRentDue',
];

const ALIASES: Record<string, Field> = {
  propertyname: 'propertyName',
  property: 'propertyName',
  building: 'propertyName',
  buildingname: 'propertyName',
  address: 'address',
  streetaddress: 'address',
  city: 'city',
  town: 'city',
  state: 'state',
  propertytype: 'propertyType',
  type: 'propertyType',
  unitnumber: 'unitNumber',
  unit: 'unitNumber',
  unitname: 'unitNumber',
  flat: 'unitNumber',
  apartment: 'unitNumber',
  bedrooms: 'bedrooms',
  beds: 'bedrooms',
  bathrooms: 'bathrooms',
  baths: 'bathrooms',
  squarefeet: 'squareFeet',
  sqft: 'squareFeet',
  rentamount: 'rentAmount',
  rent: 'rentAmount',
  paymentfrequency: 'paymentFrequency',
  frequency: 'paymentFrequency',
  servicecharge: 'serviceCharge',
  tenantname: 'tenantName',
  tenant: 'tenantName',
  tenantemail: 'tenantEmail',
  email: 'tenantEmail',
  tenantphone: 'tenantPhone',
  phone: 'tenantPhone',
  startdate: 'startDate',
  start: 'startDate',
  tenancystart: 'startDate',
  enddate: 'endDate',
  end: 'endDate',
  tenancyend: 'endDate',
  deposit: 'deposit',
  cautiondeposit: 'deposit',
  nextrentdue: 'nextRentDue',
  nextdue: 'nextRentDue',
  nextrentdate: 'nextRentDue',
};

const REQUIRED: Field[] = ['propertyName', 'address', 'city', 'unitNumber', 'rentAmount'];

/** Two rows are the same property when name, address and city match, ignoring case and spacing. */
export function propertyKey(name: string, address: string, city: string): string {
  return [name, address, city].map((v) => v.toLowerCase().replace(/\s+/g, ' ').trim()).join('|');
}

const normalise = (header: string) => header.toLowerCase().replace(/[^a-z0-9]/g, '');

const FREQUENCY: Record<string, PaymentFrequency> = {
  annual: 'ANNUAL',
  annually: 'ANNUAL',
  yearly: 'ANNUAL',
  year: 'ANNUAL',
  peryear: 'ANNUAL',
  perannum: 'ANNUAL',
  biannual: 'BI_ANNUAL',
  biannually: 'BI_ANNUAL',
  halfyearly: 'BI_ANNUAL',
  semiannual: 'BI_ANNUAL',
  '6months': 'BI_ANNUAL',
  sixmonths: 'BI_ANNUAL',
  quarterly: 'QUARTERLY',
  quarter: 'QUARTERLY',
  '3months': 'QUARTERLY',
  threemonths: 'QUARTERLY',
  monthly: 'MONTHLY',
  month: 'MONTHLY',
  permonth: 'MONTHLY',
};

const emailOk = z.string().email();

/** A naira amount as people type it: "₦1,500,000", "1 500 000", "2500000". */
export function parseMoney(raw: string): number | null {
  const cleaned = raw.replace(/[₦,\s]|NGN/gi, '');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * A calendar date as a UTC midnight. Accepts 2026-09-01 (also with a time after it) and 01/09/2026,
 * read day first as people in Nigeria write it. Returns null for anything else, including a day
 * that does not exist (31/02/2026).
 */
export function parseDate(raw: string): Date | null {
  const text = raw.trim();
  let y: number, m: number, d: number;
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/.exec(text);
  if (match) {
    [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else {
    match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(text);
    if (!match) return null;
    [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
    ? date
    : null;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

function parseType(raw: string): PropertyType | null {
  if (raw === '') return 'RESIDENTIAL';
  const key = raw.toUpperCase().replace(/[\s-]+/g, '_');
  return (Object.values(PropertyType) as string[]).includes(key) ? (key as PropertyType) : null;
}

/**
 * Turns the rows of a file into properties with their units, or says what is wrong with each row.
 * `today` is the date tenancies are judged against (one that has started is recorded as active; one
 * that has ended is refused).
 */
export function parsePortfolio(rawRows: Record<string, string>[], today: Date): ParsedPortfolio {
  const empty = (fileError: string | null): ParsedPortfolio => ({
    properties: [],
    issues: [],
    fileError,
  });
  if (rawRows.length === 0) return empty('The file has no data rows');
  if (rawRows.length > MAX_PORTFOLIO_ROWS) {
    return empty(`Import at most ${MAX_PORTFOLIO_ROWS} units at a time`);
  }

  // Which header in the file is which field. Unknown columns are ignored.
  const columns = new Map<Field, string>();
  for (const header of Object.keys(rawRows[0])) {
    const field = ALIASES[normalise(header)];
    if (field && !columns.has(field)) columns.set(field, header);
  }
  const missing = REQUIRED.filter((f) => !columns.has(f));
  if (missing.length > 0) {
    return empty(`The file is missing these columns: ${missing.join(', ')}`);
  }

  const get = (row: Record<string, string>, field: Field) => {
    const header = columns.get(field);
    return header === undefined ? '' : String(row[header] ?? '').trim();
  };

  const issues: ImportIssue[] = [];
  const byKey = new Map<string, ImportProperty>();
  const seenUnits = new Set<string>();
  const todayUtc = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );

  rawRows.forEach((raw, index) => {
    const row = index + 2; // row 1 is the header
    const fail = (error: string) => issues.push({ row, error });

    const name = get(raw, 'propertyName');
    const address = get(raw, 'address');
    const city = get(raw, 'city');
    const unitNumber = get(raw, 'unitNumber');
    if (!name || !address || !city) return fail('propertyName, address and city are required');
    if (!unitNumber) return fail('unitNumber is required');

    const rentAmount = parseMoney(get(raw, 'rentAmount'));
    if (rentAmount === null || rentAmount <= 0) return fail('rentAmount must be a positive number');

    const type = parseType(get(raw, 'propertyType'));
    if (!type) return fail('propertyType must be RESIDENTIAL, COMMERCIAL, INDUSTRIAL or MIXED_USE');

    const frequencyText = get(raw, 'paymentFrequency');
    const frequency = frequencyText
      ? FREQUENCY[frequencyText.toLowerCase().replace(/[^a-z0-9]/g, '')]
      : 'ANNUAL';
    if (!frequency) {
      return fail('paymentFrequency must be annual, 6 months, quarterly or monthly');
    }

    const number = (field: Field, fallback: number | null, label: string, whole = false) => {
      const text = get(raw, field);
      if (text === '') return fallback;
      const n = Number(text.replace(/,/g, ''));
      if (!Number.isFinite(n) || n < 0 || (whole && !Number.isInteger(n))) {
        fail(`${label} must be ${whole ? 'a whole number' : 'a number'}`);
        return undefined;
      }
      return n;
    };
    const bedrooms = number('bedrooms', 1, 'bedrooms', true);
    const bathrooms = number('bathrooms', 1, 'bathrooms');
    const squareFeet = number('squareFeet', null, 'squareFeet', true);
    if (bedrooms === undefined || bathrooms === undefined || squareFeet === undefined) return;

    const serviceText = get(raw, 'serviceCharge');
    const serviceCharge = serviceText === '' ? 0 : parseMoney(serviceText);
    if (serviceCharge === null || serviceCharge < 0) {
      return fail('serviceCharge must be a number');
    }

    // A tenancy is described by any of these; once one is filled in the rest must be.
    const tenant = {
      name: get(raw, 'tenantName'),
      email: get(raw, 'tenantEmail'),
      phone: get(raw, 'tenantPhone'),
      start: get(raw, 'startDate'),
      end: get(raw, 'endDate'),
      deposit: get(raw, 'deposit'),
      next: get(raw, 'nextRentDue'),
    };
    let tenancy: ImportTenancy | null = null;
    if (Object.values(tenant).some((v) => v !== '')) {
      if (!tenant.name) return fail('tenantName is required when a tenant is given');
      const email = tenant.email.toLowerCase();
      if (!emailOk.safeParse(email).success) {
        return fail('tenantEmail must be a valid email address');
      }
      const startDate = parseDate(tenant.start);
      const endDate = parseDate(tenant.end);
      if (!startDate) return fail('startDate must be a date such as 2026-09-01 or 01/09/2026');
      if (!endDate) return fail('endDate must be a date such as 2027-08-31 or 31/08/2027');
      if (endDate <= startDate) return fail('endDate must be after startDate');
      if (endDate < todayUtc) return fail('This tenancy has already ended, so it cannot be added');
      const deposit = tenant.deposit === '' ? 0 : parseMoney(tenant.deposit);
      if (deposit === null || deposit < 0) return fail('deposit must be a number');

      const started = startDate <= todayUtc;
      let firstDueDate: Date | null = startDate;
      const nextText = tenant.next.trim();
      const paidForTerm = /^(paid|none|n\/a|-)$/i.test(nextText);
      if (started) {
        // A tenancy already running has been billed before; the first invoice here is the next one,
        // so say when it falls due instead of billing the start date over again.
        if (paidForTerm) {
          firstDueDate = null;
        } else {
          const next = parseDate(nextText);
          if (!next) {
            return fail(
              `nextRentDue is required for a tenancy that started on ${iso(startDate)}: the date the next rent falls due, or PAID if the whole term is paid`,
            );
          }
          if (next < startDate || next > endDate) {
            return fail('nextRentDue must fall between startDate and endDate');
          }
          firstDueDate = next;
        }
      } else if (nextText !== '' && !paidForTerm) {
        const next = parseDate(nextText);
        if (!next || next < startDate || next > endDate) {
          return fail('nextRentDue must fall between startDate and endDate');
        }
        firstDueDate = next;
      } else if (paidForTerm) {
        firstDueDate = null;
      }

      tenancy = {
        name: tenant.name,
        email,
        phoneNumber: tenant.phone || null,
        startDate,
        endDate,
        deposit,
        firstDueDate,
        active: started,
      };
    }

    const key = propertyKey(name, address, city);
    const unitKey = `${key}|${unitNumber.toLowerCase()}`;
    if (seenUnits.has(unitKey)) {
      return fail(`Unit "${unitNumber}" appears twice for ${name}`);
    }
    seenUnits.add(unitKey);

    let property = byKey.get(key);
    if (!property) {
      property = {
        key,
        name,
        address,
        city,
        state: get(raw, 'state') || null,
        type,
        units: [],
      };
      byKey.set(key, property);
    }
    property.units.push({
      row,
      unitNumber,
      bedrooms: bedrooms ?? 1,
      bathrooms: bathrooms ?? 1,
      squareFeet: squareFeet ?? null,
      rentAmount,
      paymentFrequency: frequency,
      serviceCharge,
      tenancy,
    });
  });

  return { properties: [...byKey.values()], issues, fileError: null };
}

const addMonths = (d: Date, months: number) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, d.getUTCDate()));

/** The template as a CSV a person can fill in, with example dates that are valid today. */
export function templateCsv(today: Date): string {
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const started = addMonths(monthStart, -3);
  const base = {
    propertyName: 'Sunrise Court',
    address: '12 Admiralty Way, Lekki Phase 1',
    city: 'Lagos',
    state: 'Lagos',
    propertyType: 'RESIDENTIAL',
  };
  const noTenant = {
    tenantName: '',
    tenantEmail: '',
    tenantPhone: '',
    startDate: '',
    endDate: '',
    deposit: '',
    nextRentDue: '',
  };
  const rows: Record<Field, string>[] = [
    {
      ...base,
      unitNumber: 'Flat 1A',
      bedrooms: '2',
      bathrooms: '2',
      squareFeet: '90',
      rentAmount: '250000',
      paymentFrequency: 'MONTHLY',
      serviceCharge: '15000',
      tenantName: 'Ada Okafor',
      tenantEmail: 'ada@example.com',
      tenantPhone: '08030000000',
      startDate: iso(started),
      endDate: iso(addMonths(started, 12)),
      deposit: '250000',
      nextRentDue: iso(addMonths(monthStart, 1)),
    },
    {
      ...base,
      unitNumber: 'Flat 1B',
      bedrooms: '3',
      bathrooms: '3',
      squareFeet: '120',
      rentAmount: '3200000',
      paymentFrequency: 'ANNUAL',
      serviceCharge: '',
      tenantName: 'Chidi Eze',
      tenantEmail: 'chidi@example.com',
      tenantPhone: '',
      startDate: iso(started),
      endDate: iso(addMonths(started, 12)),
      deposit: '',
      nextRentDue: 'PAID',
    },
    {
      ...base,
      ...noTenant,
      unitNumber: 'Flat 1C',
      bedrooms: '1',
      bathrooms: '1',
      squareFeet: '',
      rentAmount: '2000000',
      paymentFrequency: 'ANNUAL',
      serviceCharge: '',
    },
  ];
  const escape = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = [TEMPLATE_COLUMNS.join(',')];
  for (const row of rows) lines.push(TEMPLATE_COLUMNS.map((c) => escape(row[c])).join(','));
  return lines.join('\r\n') + '\r\n';
}
