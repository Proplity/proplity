import { describe, expect, it } from 'vitest';
import { confirmedNote, isAutomaticNote } from '@/lib/payments/transferNote';

describe('transfer notes on receipts', () => {
  it('recognises the automatic wording, old and new', () => {
    expect(isAutomaticNote(confirmedNote('REF-1'))).toBe(true);
    expect(isAutomaticNote('Reconciled by MANAGER from bank transfer ref REF-1')).toBe(true);
    expect(isAutomaticNote('Reconciled by LANDLORD from bank transfer ref REF-1')).toBe(true);
    expect(isAutomaticNote('  Confirmed from bank transfer reference REF-1  ')).toBe(true);
  });

  it('leaves a note a person wrote alone', () => {
    expect(isAutomaticNote('Part payment, balance on Friday')).toBe(false);
    expect(isAutomaticNote('Reconciled by hand after the call')).toBe(false);
    expect(isAutomaticNote('')).toBe(false);
    expect(isAutomaticNote(null)).toBe(false);
    expect(isAutomaticNote(undefined)).toBe(false);
  });
});
