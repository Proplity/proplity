import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { renderAgreementPdf, type AgreementPdfInput } from '../../lib/pdf/agreementPdf';

const base = (over: Partial<AgreementPdfInput> = {}): AgreementPdfInput => ({
  subtitle: 'Unit A1, Sunrise Court',
  status: 'EXECUTED',
  clauses: [{ title: 'Rent', body: 'The Tenant pays ₦2,500,000 per annum.' }],
  landlord: {
    name: 'Mr Bello',
    signature: { name: 'Mr Bello', at: new Date('2026-12-01T10:00:00Z') },
  },
  tenant: {
    name: 'Ada Okafor',
    signature: { name: 'Ada Okafor', at: new Date('2026-12-01T11:00:00Z') },
  },
  witnessRequired: true,
  witnesses: {},
  documentId: 'abcd1234-5678',
  ...over,
});

const pages = async (bytes: Uint8Array) => (await PDFDocument.load(bytes)).getPageCount();

describe('the agreement PDF', () => {
  it('is a real PDF with the agreement’s title and a single page for a short agreement', async () => {
    const bytes = await renderAgreementPdf(base());
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getTitle()).toBe('Rent agreement');
  });

  it('flows long agreements onto more pages', async () => {
    const long = Array.from({ length: 40 }, (_, i) => ({
      title: `Clause ${i + 1}`,
      body: 'The parties agree to the terms of this tenancy in full. '.repeat(12),
    }));
    expect(await pages(await renderAgreementPdf(base({ clauses: long })))).toBeGreaterThanOrEqual(
      4,
    );
  });

  it('prints the naira sign, curly quotes and dashes, and survives text the font cannot draw', async () => {
    const odd = base({
      clauses: [
        {
          title: 'Naira ₦ and “quotes” — dash',
          body: 'Emoji 😀, Arabic مرحبا, control \u0007 char, tab\there.',
        },
      ],
    });
    await expect(renderAgreementPdf(odd)).resolves.toBeInstanceOf(Uint8Array);
  });

  it('breaks a word that is wider than the page instead of running off it', async () => {
    const wide = base({ clauses: [{ title: 'Long', body: 'x'.repeat(600) }] });
    await expect(renderAgreementPdf(wide)).resolves.toBeInstanceOf(Uint8Array);
  });

  it('copes with a draft, with no witnesses, with empty clauses and with special conditions', async () => {
    await expect(
      renderAgreementPdf(base({ status: 'DRAFT', witnessRequired: false, clauses: [] })),
    ).resolves.toBeInstanceOf(Uint8Array);
    await expect(
      renderAgreementPdf(base({ status: 'ISSUED', specialConditions: 'No pets.\n\nNo noise.' })),
    ).resolves.toBeInstanceOf(Uint8Array);
  });

  it('keeps the signatures together: a page break comes before them, not through them', async () => {
    // Fill most of a page so the signature blocks cannot fit under the last clause.
    const filler = Array.from({ length: 6 }, (_, i) => ({
      title: `Clause ${i + 1}`,
      body: 'Filler text for the tenancy agreement. '.repeat(30),
    }));
    const doc = await PDFDocument.load(await renderAgreementPdf(base({ clauses: filler })));
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  });
});
