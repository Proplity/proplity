// How a payment frequency reads on screen. The stored values are ANNUAL, BI_ANNUAL, QUARTERLY and
// MONTHLY; people read "per year", never "per annual". Agreement text uses "per annum" separately.
const PER: Record<string, string> = {
  ANNUAL: 'year',
  BI_ANNUAL: '6 months',
  QUARTERLY: 'quarter',
  MONTHLY: 'month',
};

const NAME: Record<string, string> = {
  ANNUAL: 'Yearly',
  BI_ANNUAL: 'Every 6 months',
  QUARTERLY: 'Quarterly',
  MONTHLY: 'Monthly',
};

/** The word after "per" / "/": year, 6 months, quarter or month. Defaults to year. */
export function perFrequency(freq?: string | null): string {
  return PER[(freq ?? 'ANNUAL').toUpperCase()] ?? 'year';
}

/** The adjective: Yearly, Every 6 months, Quarterly or Monthly. */
export function frequencyName(freq?: string | null): string {
  return NAME[(freq ?? 'ANNUAL').toUpperCase()] ?? 'Yearly';
}
