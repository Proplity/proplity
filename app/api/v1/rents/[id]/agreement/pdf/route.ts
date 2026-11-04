import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { accessibleRent, currentAgreement } from '@/lib/rentAgreement';
import { renderAgreementPdf, type PdfSignature } from '@/lib/pdf/agreementPdf';

type RouteCtx = { params: Promise<{ id: string }> };

// Needs Node (fonts are read from disk), never prerendered or cached by a shared cache.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const slug = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 40) || 'agreement';

/**
 * The rent agreement as a PDF made on the server: the clauses as they were when it was made, the
 * signatures with the time each was added, and the witnesses. Same access as reading the agreement
 * (the tenant only once it has been sent). An uploaded agreement is already a file: this answers
 * 409 and the file is opened instead. `?inline=1` shows it in the browser rather than downloading.
 */
export const GET = withAuth(
  async (req, { session }, ctx: RouteCtx) => {
    const { id } = await ctx.params;
    try {
      const access = await accessibleRent(session, id);
      if (access === 'NOT_FOUND')
        return NextResponse.json({ error: 'Rent not found' }, { status: 404 });
      if (access === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      const { rent, viewer } = access;

      const agreement = await currentAgreement(id);
      if (!agreement || (viewer === 'TENANT' && agreement.status === 'DRAFT')) {
        return NextResponse.json(
          { error: 'There is no agreement to download yet' },
          { status: 404 },
        );
      }
      if (agreement.source === 'UPLOADED' || agreement.status === 'VOID') {
        return NextResponse.json(
          {
            error: 'This agreement is an uploaded file. Open the file instead.',
            code: 'UPLOADED_AGREEMENT',
          },
          { status: 409 },
        );
      }

      const [signatures, witnessRows] = await Promise.all([
        prisma.rentSignature.findMany({ where: { rentId: id }, orderBy: { signedAt: 'asc' } }),
        prisma.agreementWitness.findMany({ where: { agreementId: agreement.id } }),
      ]);
      const sig = (s?: { fullNameTyped: string; signedAt: Date }): PdfSignature =>
        s ? { name: s.fullNameTyped, at: s.signedAt } : null;
      const tenantSig = signatures.find((s) => s.signerRole === 'TENANT');
      const landlordSig = signatures.find((s) =>
        ['MANAGER', 'LANDLORD', 'ADMIN'].includes(s.signerRole),
      );
      const typed = (agreement.witnesses ?? {}) as Record<
        string,
        { name?: string; address?: string }
      >;
      const witness = (side: 'LANDLORD' | 'TENANT') => {
        const key = side === 'LANDLORD' ? 'landlord' : 'tenant';
        const row = witnessRows.find((w) => w.side === side && w.status === 'SIGNED');
        return {
          name: typed[key]?.name,
          address: typed[key]?.address,
          signature: row?.signedAt ? { name: row.signedName ?? row.name, at: row.signedAt } : null,
        };
      };

      const clauses = (agreement.clauses ?? []) as { title: string; body: string }[];
      const pdf = await renderAgreementPdf({
        subtitle: `Unit ${rent.unit.unitNumber}, ${rent.unit.property.name}`,
        status:
          agreement.status === 'DRAFT'
            ? 'DRAFT'
            : agreement.status === 'EXECUTED'
              ? 'EXECUTED'
              : 'ISSUED',
        clauses,
        specialConditions: agreement.specialConditions,
        landlord: {
          name: agreement.landlordName ?? '',
          agent: agreement.agentName,
          signature: sig(landlordSig),
        },
        tenant: { name: rent.tenant.name, signature: sig(tenantSig) },
        witnessRequired: agreement.witnessRequired,
        witnesses: { landlord: witness('LANDLORD'), tenant: witness('TENANT') },
        documentId: agreement.id,
        footerNote: agreement.templateKey
          ? `from the ${agreement.templateKey} template, version ${agreement.templateVersion}. Signed with a typed full name recorded with the time and address of signing`
          : undefined,
      });

      const inline = req.nextUrl.searchParams.get('inline') === '1';
      const filename = `Rent-agreement-${slug(rent.unit.property.name)}-unit-${slug(rent.unit.unitNumber)}.pdf`;
      return new NextResponse(Buffer.from(pdf), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${filename}"`,
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN', 'MANAGER', 'LANDLORD', 'TENANT'] },
);
