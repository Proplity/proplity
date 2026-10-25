import { describe, expect, it } from 'vitest';
import {
  AGREEMENT_FIELD_KEYS,
  clauseProblems,
  fieldsUsed,
  humanDays,
  nairaInWords,
  renderClauses,
  termDescription,
  formatLongDate,
  formatNaira,
  type TemplateClause,
} from '@/lib/agreementFields';
import { DEFAULT_TEMPLATES } from '@/lib/agreementDefaults';

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const clauses: TemplateClause[] = [
  {
    id: 'a',
    title: 'Parties',
    body: '{{tenantName}} rents from {{landlordName}}.',
    mode: 'LOCKED',
  },
  { id: 'b', title: 'Use', body: 'Private dwelling only.', mode: 'EDITABLE' },
  { id: 'c', title: 'Renewal', body: 'May renew.', mode: 'OPTIONAL', defaultOn: false },
  { id: 'e', title: 'Alterations', body: 'No alterations.', mode: 'OPTIONAL', defaultOn: true },
];

describe('fields in clauses', () => {
  it('finds the fields a text uses, with or without spaces inside the braces', () => {
    expect(fieldsUsed('{{a}} and {{ b }} and {{c1}}')).toEqual(['a', 'b', 'c1']);
    expect(fieldsUsed('nothing here')).toEqual([]);
  });

  it('accepts known fields and names an unknown one', () => {
    expect(clauseProblems(clauses)).toEqual([]);
    const bad = clauseProblems([
      { id: 'x', title: 'Rent', body: 'Pay {{rentAmmount}}', mode: 'LOCKED' },
    ]);
    expect(bad).toHaveLength(1);
    expect(bad[0]).toContain('{{rentAmmount}}');
  });

  it('refuses an empty list and duplicate ids', () => {
    expect(clauseProblems([])).toContain('Add at least one clause');
    expect(
      clauseProblems([
        { id: 'a', title: 'One', body: 'x', mode: 'LOCKED' },
        { id: 'a', title: 'Two', body: 'y', mode: 'LOCKED' },
      ]).join(' '),
    ).toContain('share the id "a"');
  });
});

describe('rendering clauses', () => {
  const values = { tenantName: 'Ada Okafor', landlordName: 'Mr Bello' };

  it('fills fields, drops optional clauses that are off, and keeps those that are on', () => {
    const { clauses: out, missing } = renderClauses(clauses, values);
    expect(out.map((c) => c.id)).toEqual(['a', 'b', 'e']);
    expect(out[0].body).toBe('Ada Okafor rents from Mr Bello.');
    expect(missing).toEqual([]);
  });

  it('lets the manager turn an optional clause on or off', () => {
    expect(renderClauses(clauses, values, { include: ['c'] }).clauses.map((c) => c.id)).toContain(
      'c',
    );
    expect(renderClauses(clauses, values, { omit: ['e'] }).clauses.map((c) => c.id)).not.toContain(
      'e',
    );
    // A locked clause can never be left out.
    expect(renderClauses(clauses, values, { omit: ['a'] }).clauses.map((c) => c.id)).toContain('a');
  });

  it('applies edits to editable clauses only', () => {
    const out = renderClauses(clauses, values, {
      edits: { b: 'Home and small home office.', a: 'Changed locked wording.' },
    }).clauses;
    expect(out.find((c) => c.id === 'b')!.body).toBe('Home and small home office.');
    expect(out.find((c) => c.id === 'a')!.body).toBe('Ada Okafor rents from Mr Bello.');
  });

  it('fills fields inside an edit too, and reports a field it has no value for', () => {
    const { clauses: out, missing } = renderClauses(clauses, values, {
      edits: { b: 'Used by {{tenantName}} in {{city}}.' },
    });
    expect(out.find((c) => c.id === 'b')!.body).toBe('Used by Ada Okafor in {{city}}.');
    expect(missing).toEqual(['city']);
  });
});

describe('the starting templates', () => {
  it('only use fields that exist and have unique clause ids', () => {
    for (const t of DEFAULT_TEMPLATES) {
      expect(clauseProblems(t.clauses as unknown as TemplateClause[]), t.key).toEqual([]);
    }
  });

  it('render completely when every field has a value', () => {
    const values = Object.fromEntries(AGREEMENT_FIELD_KEYS.map((k) => [k, `<${k}>`]));
    for (const t of DEFAULT_TEMPLATES) {
      const { missing, clauses: out } = renderClauses(
        t.clauses as unknown as TemplateClause[],
        values,
      );
      expect(missing, t.key).toEqual([]);
      expect(out.length).toBeGreaterThan(10);
    }
  });
});

describe('formatting', () => {
  it('writes naira and long dates the way an agreement does', () => {
    expect(formatNaira(2_500_000)).toBe('₦2,500,000');
    expect(formatNaira(1234.5)).toBe('₦1,234.5');
    expect(formatLongDate(d('2026-09-01'))).toBe('1 September 2026');
    expect(formatLongDate(d('2027-12-31'))).toBe('31 December 2027');
  });

  it('writes amounts in words', () => {
    expect(nairaInWords(0)).toBe('Zero Naira');
    expect(nairaInWords(1)).toBe('One Naira');
    expect(nairaInWords(21)).toBe('Twenty-One Naira');
    expect(nairaInWords(250_000)).toBe('Two Hundred and Fifty Thousand Naira');
    expect(nairaInWords(2_500_000)).toBe('Two Million, Five Hundred Thousand Naira');
    expect(nairaInWords(1_000_050)).toBe('One Million and Fifty Naira');
    expect(nairaInWords(3_200_000)).toBe('Three Million, Two Hundred Thousand Naira');
    expect(nairaInWords(1_500.5)).toBe('One Thousand, Five Hundred Naira and Fifty Kobo');
  });

  it('describes a term in whole months or years', () => {
    expect(termDescription(d('2026-09-01'), d('2027-08-31'))).toBe('12 months');
    expect(termDescription(d('2026-09-01'), d('2027-09-01'))).toBe('12 months');
    expect(termDescription(d('2026-01-15'), d('2027-01-14'))).toBe('12 months');
    expect(termDescription(d('2026-01-01'), d('2026-06-30'))).toBe('6 months');
    expect(termDescription(d('2026-03-10'), d('2026-06-09'))).toBe('3 months');
    expect(termDescription(d('2026-09-01'), d('2028-08-31'))).toBe('2 years');
    expect(termDescription(d('2026-09-01'), d('2027-02-28'))).toBe('6 months');
    expect(termDescription(d('2026-09-01'), d('2026-09-10'))).toBe('1 months');
  });

  it('says days the way people do', () => {
    expect(humanDays(7)).toBe('1 week');
    expect(humanDays(14)).toBe('2 weeks');
    expect(humanDays(30)).toBe('1 month');
    expect(humanDays(90)).toBe('3 months');
    expect(humanDays(180)).toBe('6 months');
    expect(humanDays(365)).toBe('1 year');
    expect(humanDays(45)).toBe('45 days');
    expect(humanDays(1)).toBe('1 day');
  });
});
