import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';
import { getSystemSettings } from '@/lib/systemSettings';
import { loadRentForAgreement, prepareGeneration } from '@/lib/rentAgreement';
import { previewAgreementSchema } from '@/lib/rentAgreementSchema';

type RouteCtx = { params: Promise<{ id: string }> };

// What an agreement would say with these choices, without saving it or taking any credits, and the
// legal warnings (or the blocking reason) that go with it.
export const POST = withAuth(
  async (req, { session }, ctx: RouteCtx) => {
    const { id } = await ctx.params;
    try {
      const validated = await validateBody(req, previewAgreementSchema);
      if (!validated.success) return validated.response;
      const rent = await loadRentForAgreement(id);
      if (!rent) return NextResponse.json({ error: 'Rent not found' }, { status: 404 });

      const prepared = await prepareGeneration(
        session,
        rent,
        validated.data,
        await getSystemSettings(),
      );
      if (!prepared.ok) {
        return NextResponse.json(
          { error: prepared.error, code: prepared.code, findings: prepared.findings },
          { status: prepared.status },
        );
      }
      return NextResponse.json({
        data: {
          clauses: prepared.built.clauses,
          specialConditions: validated.data.specialConditions?.trim() || null,
          landlordName: prepared.landlordName,
          agentName: prepared.agentName,
          findings: prepared.findings,
        },
      });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN', 'MANAGER', 'LANDLORD'] },
);
