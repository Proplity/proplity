import fs from 'fs/promises';
import path from 'path';
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

// The rent agreement as a PDF made on the server, so it can be downloaded, attached to an email
// or kept without a browser's print dialog. Plain typesetting: A4, a serif face with the naira
// sign, numbered clauses that flow across pages, the signatures (typed names with the time they
// were added) and a footer on every page. pdf-lib is pure JavaScript, so it runs anywhere the app does.

const PAGE = { width: 595.28, height: 841.89 };
const MARGIN = { x: 64, top: 64, bottom: 72 };
const BODY = 11;
const LEADING = 15.5;
const INK = rgb(0.1, 0.1, 0.12);
const MUTED = rgb(0.4, 0.4, 0.45);
const RULE = rgb(0.75, 0.75, 0.78);

export type PdfSignature = { name: string; at: Date } | null;
export type PdfWitness = { name?: string; address?: string; signature?: PdfSignature };

export type AgreementPdfInput = {
  subtitle: string;
  status: 'DRAFT' | 'ISSUED' | 'EXECUTED';
  clauses: { title: string; body: string }[];
  specialConditions?: string | null;
  landlord: { name: string; agent?: string | null; signature?: PdfSignature };
  tenant: { name: string; signature?: PdfSignature };
  witnessRequired: boolean;
  witnesses: { landlord?: PdfWitness; tenant?: PdfWitness };
  documentId: string;
  /** "Made on Proplity from the lagos-residential template, version 1." and the like. */
  footerNote?: string;
};

type Fonts = { regular: PDFFont; bold: PDFFont; italic: PDFFont };
type Run = {
  text: string;
  font: PDFFont;
  size: number;
  gapBefore?: number;
  color?: ReturnType<typeof rgb>;
};

const FONT_DIR = path.join(process.cwd(), 'lib', 'pdf', 'fonts');
let fontBytes: Promise<Record<keyof Fonts, Uint8Array>> | null = null;
function loadFontBytes() {
  fontBytes ??= Promise.all(
    (
      [
        ['regular', 'LiberationSerif-Regular.ttf'],
        ['bold', 'LiberationSerif-Bold.ttf'],
        ['italic', 'LiberationSerif-Italic.ttf'],
      ] as const
    ).map(async ([key, file]) => [key, await fs.readFile(path.join(FONT_DIR, file))] as const),
  ).then((pairs) => Object.fromEntries(pairs) as unknown as Record<keyof Fonts, Uint8Array>);
  // A failed read must not be remembered forever.
  fontBytes.catch(() => {
    fontBytes = null;
  });
  return fontBytes;
}

/** Text the font can draw: line breaks kept, tabs to spaces, anything it has no glyph for becomes "?". */
function clean(text: string, font: PDFFont): string {
  const known = new Set(font.getCharacterSet());
  let out = '';
  for (const ch of text.replace(/\r\n?/g, '\n').replace(/\t/g, '    ')) {
    const cp = ch.codePointAt(0)!;
    if (ch === '\n') out += ch;
    else if (cp < 32 || cp === 0x7f) continue;
    else out += known.has(cp) ? ch : '?';
  }
  return out;
}

/** Breaks text into lines no wider than `width`, breaking inside a word only when one is too long. */
export function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    if (paragraph.trim() === '') {
      lines.push('');
      continue;
    }
    let line = '';
    for (const word of paragraph.split(/ +/)) {
      if (!word) continue;
      const attempt = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(attempt, size) <= width) {
        line = attempt;
        continue;
      }
      if (line) lines.push(line);
      line = '';
      let rest = word;
      while (font.widthOfTextAtSize(rest, size) > width) {
        let cut = rest.length - 1;
        while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > width) cut -= 1;
        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      line = rest;
    }
    lines.push(line);
  }
  return lines;
}

const when = (d: Date) =>
  `${d.toLocaleString('en-GB', {
    timeZone: 'Africa/Lagos',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })} (Lagos time)`;

class Flow {
  page: PDFPage;
  y: number;
  constructor(
    private doc: PDFDocument,
    private fonts: Fonts,
  ) {
    this.page = doc.addPage([PAGE.width, PAGE.height]);
    this.y = PAGE.height - MARGIN.top;
  }

  get width() {
    return PAGE.width - MARGIN.x * 2;
  }

  private newPage() {
    this.page = this.doc.addPage([PAGE.width, PAGE.height]);
    this.y = PAGE.height - MARGIN.top;
  }

  /** Starts a new page unless `height` still fits on this one. */
  ensure(height: number) {
    if (this.y - height < MARGIN.bottom) this.newPage();
  }

  space(h: number) {
    this.y -= h;
  }

  /** Draws wrapped runs one under another, moving to a new page between lines when needed. */
  runs(
    items: Run[],
    opts: { x?: number; width?: number; align?: 'left' | 'center'; keepWithNext?: number } = {},
  ) {
    const x0 = opts.x ?? MARGIN.x;
    const width = opts.width ?? this.width;
    let first = true;
    for (const item of items) {
      const text = clean(item.text, item.font);
      const lines = wrap(text, item.font, item.size, width);
      const lead = item.size * 1.4;
      if (first) {
        // A heading is never left alone at the foot of a page.
        this.ensure((item.gapBefore ?? 0) + lead + (opts.keepWithNext ?? 0));
        first = false;
      }
      this.y -= item.gapBefore ?? 0;
      for (const line of lines) {
        this.ensure(lead);
        this.y -= lead;
        if (line) {
          const w = item.font.widthOfTextAtSize(line, item.size);
          const x = opts.align === 'center' ? x0 + (width - w) / 2 : x0;
          this.page.drawText(line, {
            x,
            y: this.y + lead * 0.28,
            size: item.size,
            font: item.font,
            color: item.color ?? INK,
          });
        }
      }
    }
  }

  rule() {
    this.page.drawLine({
      start: { x: MARGIN.x, y: this.y },
      end: { x: PAGE.width - MARGIN.x, y: this.y },
      thickness: 0.6,
      color: RULE,
    });
  }

  /** Two blocks side by side, kept together on one page. */
  columns(left: Run[], right: Run[]) {
    const gap = 28;
    const colWidth = (this.width - gap) / 2;
    const measure = (items: Run[]) =>
      items.reduce(
        (h, it) =>
          h +
          (it.gapBefore ?? 0) +
          wrap(clean(it.text, it.font), it.font, it.size, colWidth).length * it.size * 1.4,
        0,
      );
    this.ensure(Math.max(measure(left), measure(right)) + 8);
    const top = this.y;
    this.runs(left, { width: colWidth });
    const leftEnd = this.y;
    this.y = top;
    this.runs(right, { x: MARGIN.x + colWidth + gap, width: colWidth });
    this.y = Math.min(leftEnd, this.y);
  }
}

function signatureRuns(sig: PdfSignature | undefined, f: Fonts, label: string): Run[] {
  if (sig) {
    return [
      { text: sig.name, font: f.italic, size: 14, gapBefore: 10 },
      {
        text: `Signed electronically on ${when(sig.at)}`,
        font: f.regular,
        size: 8.5,
        color: MUTED,
      },
    ];
  }
  return [
    { text: '______________________________', font: f.regular, size: BODY, gapBefore: 22 },
    { text: label, font: f.regular, size: 8.5, color: MUTED },
  ];
}

export async function renderAgreementPdf(input: AgreementPdfInput): Promise<Uint8Array> {
  const bytes = await loadFontBytes();
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle('Rent agreement');
  doc.setProducer('Proplity');
  doc.setCreator('Proplity');
  const fonts: Fonts = {
    regular: await doc.embedFont(bytes.regular, { subset: true }),
    bold: await doc.embedFont(bytes.bold, { subset: true }),
    italic: await doc.embedFont(bytes.italic, { subset: true }),
  };
  const flow = new Flow(doc, fonts);

  flow.runs([{ text: 'RENT AGREEMENT', font: fonts.bold, size: 20 }], { align: 'center' });
  flow.runs(
    [{ text: input.subtitle, font: fonts.regular, size: 10.5, color: MUTED, gapBefore: 2 }],
    {
      align: 'center',
    },
  );
  if (input.status !== 'EXECUTED') {
    flow.runs(
      [
        {
          text: input.status === 'DRAFT' ? 'Draft: not sent yet' : 'Waiting for signatures',
          font: fonts.italic,
          size: 10,
          color: MUTED,
          gapBefore: 4,
        },
      ],
      { align: 'center' },
    );
  }
  flow.space(10);
  flow.rule();
  flow.space(8);

  const clauses = [...input.clauses];
  if (input.specialConditions?.trim()) {
    clauses.push({
      title: 'Special conditions added by the Landlord',
      body: input.specialConditions.trim(),
    });
  }
  clauses.forEach((c, i) => {
    flow.runs(
      [
        { text: `${i + 1}. ${c.title}`, font: fonts.bold, size: BODY + 0.5, gapBefore: 12 },
        { text: c.body, font: fonts.regular, size: BODY, gapBefore: 2 },
      ],
      { keepWithNext: LEADING * 2 },
    );
  });

  flow.space(22);
  flow.ensure(170);
  flow.columns(
    [
      { text: 'Landlord', font: fonts.bold, size: BODY + 0.5 },
      {
        text: `${input.landlord.name}${input.landlord.agent ? `, by their agent ${input.landlord.agent}` : ''}`,
        font: fonts.regular,
        size: 10,
        color: MUTED,
      },
      ...signatureRuns(input.landlord.signature, fonts, 'Signature'),
    ],
    [
      { text: 'Tenant', font: fonts.bold, size: BODY + 0.5 },
      { text: input.tenant.name, font: fonts.regular, size: 10, color: MUTED },
      ...signatureRuns(input.tenant.signature, fonts, 'Signature'),
    ],
  );

  if (input.witnessRequired) {
    flow.space(18);
    const witnessBlock = (side: 'landlord' | 'tenant', title: string): Run[] => {
      const w = input.witnesses[side] ?? {};
      return [
        { text: title, font: fonts.bold, size: BODY },
        {
          text: w.name || 'Name: ______________________',
          font: fonts.regular,
          size: 10,
          color: MUTED,
        },
        {
          text: w.address || 'Address: ____________________',
          font: fonts.regular,
          size: 10,
          color: MUTED,
        },
        ...signatureRuns(w.signature, fonts, 'Witness signature'),
      ];
    };
    flow.columns(
      witnessBlock('landlord', "Witness to the Landlord's signature"),
      witnessBlock('tenant', "Witness to the Tenant's signature"),
    );
  }

  // Page footers go on last, once the page count is known.
  const pages = doc.getPages();
  const note = clean(
    `Made on Proplity${input.footerNote ? `, ${input.footerNote}` : ''}. Document ${input.documentId.slice(0, 8)}.`,
    fonts.regular,
  );
  pages.forEach((page, i) => {
    page.drawLine({
      start: { x: MARGIN.x, y: MARGIN.bottom - 18 },
      end: { x: PAGE.width - MARGIN.x, y: MARGIN.bottom - 18 },
      thickness: 0.4,
      color: RULE,
    });
    const noteLines = wrap(note, fonts.regular, 8, PAGE.width - MARGIN.x * 2 - 70);
    noteLines.slice(0, 2).forEach((line, k) =>
      page.drawText(line, {
        x: MARGIN.x,
        y: MARGIN.bottom - 30 - k * 10,
        size: 8,
        font: fonts.regular,
        color: MUTED,
      }),
    );
    const label = `Page ${i + 1} of ${pages.length}`;
    page.drawText(label, {
      x: PAGE.width - MARGIN.x - fonts.regular.widthOfTextAtSize(label, 8),
      y: MARGIN.bottom - 30,
      size: 8,
      font: fonts.regular,
      color: MUTED,
    });
  });

  return doc.save();
}
