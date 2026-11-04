import { describe, expect, it } from 'vitest';
import { parseCsv } from '@/lib/csv';
import {
  MAX_PORTFOLIO_ROWS,
  parseDate,
  parseMoney,
  parsePortfolio,
  templateCsv,
} from '@/lib/portfolioImport';

const TODAY = new Date(Date.UTC(2026, 9, 23)); // 23 October 2026

const HEADER =
  'propertyName,address,city,unitNumber,rentAmount,paymentFrequency,tenantName,tenantEmail,startDate,endDate,deposit,nextRentDue';

function parse(...lines: string[]) {
  return parsePortfolio(parseCsv([HEADER, ...lines].join('\n')), TODAY);
}

describe('reading money and dates', () => {
  it('reads naira the way people type it', () => {
    expect(parseMoney('₦1,500,000')).toBe(1_500_000);
    expect(parseMoney('2 500 000')).toBe(2_500_000);
    expect(parseMoney('NGN 300000')).toBe(300_000);
    expect(parseMoney('')).toBeNull();
    expect(parseMoney('lots')).toBeNull();
  });

  it('reads ISO dates and day-first dates, and refuses days that do not exist', () => {
    expect(parseDate('2026-09-01')?.toISOString()).toBe('2026-09-01T00:00:00.000Z');
    expect(parseDate('2026-09-01T00:00:00.000Z')?.toISOString()).toBe('2026-09-01T00:00:00.000Z');
    expect(parseDate('01/09/2026')?.toISOString()).toBe('2026-09-01T00:00:00.000Z');
    expect(parseDate('31/08/2026')?.toISOString()).toBe('2026-08-31T00:00:00.000Z');
    expect(parseDate('31/02/2026')).toBeNull();
    expect(parseDate('2026-13-01')).toBeNull();
    expect(parseDate('next week')).toBeNull();
  });
});

describe('reading a file of properties and units', () => {
  it('says which columns are missing', () => {
    const parsed = parsePortfolio(parseCsv('propertyName,city\nSunrise,Lagos'), TODAY);
    expect(parsed.fileError).toContain('address');
    expect(parsed.fileError).toContain('unitNumber');
    expect(parsed.fileError).toContain('rentAmount');
  });

  it('refuses an empty file and one with too many rows', () => {
    expect(parsePortfolio([], TODAY).fileError).toMatch(/no data rows/);
    const rows = Array.from({ length: MAX_PORTFOLIO_ROWS + 1 }, (_, i) => ({
      propertyName: 'P',
      address: 'A',
      city: 'C',
      unitNumber: `U${i}`,
      rentAmount: '1',
    }));
    expect(parsePortfolio(rows, TODAY).fileError).toMatch(/at most 500/);
  });

  it('groups rows of one property, ignoring case and spacing, and keeps vacant units', () => {
    const parsed = parse(
      'Sunrise Court,12 Admiralty Way,Lagos,1A,2500000,,,,,,,',
      'sunrise  court,12 admiralty way,LAGOS,1B,3000000,monthly,,,,,,',
      'Palm House,3 Palm Rd,Abuja,G1,1000000,,,,,,,',
    );
    expect(parsed.issues).toEqual([]);
    expect(parsed.properties).toHaveLength(2);
    expect(parsed.properties[0].units.map((u) => u.unitNumber)).toEqual(['1A', '1B']);
    expect(parsed.properties[0].units[0].paymentFrequency).toBe('ANNUAL');
    expect(parsed.properties[0].units[1].paymentFrequency).toBe('MONTHLY');
    expect(parsed.properties[0].units[0].tenancy).toBeNull();
  });

  it('accepts the usual alternative column names', () => {
    const parsed = parsePortfolio(
      parseCsv('Building,Street Address,Town,Flat,Rent\nSunrise,12 Way,Lagos,1A,"₦1,200,000"'),
      TODAY,
    );
    expect(parsed.fileError).toBeNull();
    expect(parsed.properties[0].units[0].rentAmount).toBe(1_200_000);
  });

  it('reports a bad row by its spreadsheet row number and carries on with the rest', () => {
    const parsed = parse(
      'Sunrise,12 Way,Lagos,1A,2500000,,,,,,,',
      'Sunrise,12 Way,Lagos,,2500000,,,,,,,',
      'Sunrise,12 Way,Lagos,1C,free,,,,,,,',
      'Sunrise,12 Way,Lagos,1D,2500000,fortnightly,,,,,,',
      'Sunrise,12 Way,Lagos,1A,1,,,,,,,',
    );
    expect(parsed.issues.map((i) => i.row)).toEqual([3, 4, 5, 6]);
    expect(parsed.issues[0].error).toMatch(/unitNumber/);
    expect(parsed.issues[1].error).toMatch(/rentAmount/);
    expect(parsed.issues[2].error).toMatch(/paymentFrequency/);
    expect(parsed.issues[3].error).toMatch(/appears twice/);
    expect(parsed.properties[0].units).toHaveLength(1);
  });
});

describe('reading the tenant on a row', () => {
  it('records a tenancy that has not started with its first invoice on the start date', () => {
    const parsed = parse(
      'S,A,Lagos,1A,2500000,,Ada Okafor,ADA@Example.com,2026-12-01,2027-11-30,250000,',
    );
    expect(parsed.issues).toEqual([]);
    const t = parsed.properties[0].units[0].tenancy!;
    expect(t.email).toBe('ada@example.com');
    expect(t.active).toBe(false);
    expect(t.firstDueDate?.toISOString()).toBe('2026-12-01T00:00:00.000Z');
    expect(t.deposit).toBe(250_000);
  });

  it('needs the next due date for a tenancy already running, so it is not billed twice', () => {
    const missing = parse(
      'S,A,Lagos,1A,100000,monthly,Ada,ada@example.com,2026-01-01,2026-12-31,,',
    );
    expect(missing.issues[0].error).toMatch(/nextRentDue is required/);

    const ok = parse(
      'S,A,Lagos,1A,100000,monthly,Ada,ada@example.com,2026-01-01,2026-12-31,,2026-11-01',
    );
    expect(ok.issues).toEqual([]);
    const t = ok.properties[0].units[0].tenancy!;
    expect(t.active).toBe(true);
    expect(t.firstDueDate?.toISOString()).toBe('2026-11-01T00:00:00.000Z');
  });

  it('lets a running tenancy that is paid for the whole term say so', () => {
    const parsed = parse('S,A,Lagos,1A,3000000,,Ada,ada@example.com,2026-03-01,2027-02-28,,PAID');
    expect(parsed.issues).toEqual([]);
    expect(parsed.properties[0].units[0].tenancy!.firstDueDate).toBeNull();
  });

  it('refuses a tenancy that has ended, a next due date outside the term, and half-filled tenants', () => {
    expect(
      parse('S,A,Lagos,1A,1,,Ada,ada@example.com,2025-01-01,2025-12-31,,2025-06-01').issues[0]
        .error,
    ).toMatch(/already ended/);
    expect(
      parse('S,A,Lagos,1A,1,,Ada,ada@example.com,2026-01-01,2026-12-31,,2027-06-01').issues[0]
        .error,
    ).toMatch(/between startDate and endDate/);
    expect(parse('S,A,Lagos,1A,1,,Ada,,2026-12-01,2027-11-30,,').issues[0].error).toMatch(
      /valid email/,
    );
    expect(
      parse('S,A,Lagos,1A,1,,,ada@example.com,2026-12-01,2027-11-30,,').issues[0].error,
    ).toMatch(/tenantName/);
    expect(
      parse('S,A,Lagos,1A,1,,Ada,ada@example.com,2026-12-01,2026-06-01,,').issues[0].error,
    ).toMatch(/after startDate/);
    expect(parse('S,A,Lagos,1A,1,,Ada,ada@example.com,,2027-11-30,,').issues[0].error).toMatch(
      /startDate/,
    );
  });
});

describe('the template', () => {
  it('is a file this reader accepts with no problems, whatever day it is made on', () => {
    for (const day of [TODAY, new Date(Date.UTC(2027, 0, 31)), new Date(Date.UTC(2028, 1, 29))]) {
      const parsed = parsePortfolio(parseCsv(templateCsv(day)), day);
      expect(parsed.fileError).toBeNull();
      expect(parsed.issues).toEqual([]);
      expect(parsed.properties[0].units).toHaveLength(3);
    }
  });
});
