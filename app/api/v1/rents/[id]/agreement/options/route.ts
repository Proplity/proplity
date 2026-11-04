import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { canManageProperty } from '@/lib/api/propertyAccess';
import { getSystemSettings } from '@/lib/systemSettings';
import { creditBalance } from '@/lib/credits';
import { ensureDefaultServices } from '@/lib/plans';
import { listJurisdictions, listUsableTemplates } from '@/lib/agreements';
import { checkTenancyRules, jurisdictionFor, type JurisdictionRules } from '@/lib/tenancyRules';
import { loadRentForAgreement, offersOf, resolveParties } from '@/lib/rentAgreement';

type RouteCtx = { params: Promise<{ id: string }> };

// Everything the "make an agreement" form needs for one rent: the templates that may be used in
// this place, who the landlord is (or that the manager must type the name), the fees on offer, what
// making and uploading cost, the credits the account has, and the legal warnings for the tenancy.
export const GET = withAuth(
  async (_req, { session }, ctx: RouteCtx) => {
    const { id } = await ctx.params;
    try {
      const rent = await loadRentForAgreement(id);
      if (!rent) return NextResponse.json({ error: 'Rent not found' }, { status: 404 });
      if (!canManageProperty(session, rent.unit.property)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const settings = await getSystemSettings();
      const jurisdictions = await listJurisdictions();
      const jurisdiction = jurisdictionFor(rent.unit.property, jurisdictions);
      const defaultId = jurisdictions.find((j) => j.isDefault)?.id;

      const templates = (await listUsableTemplates(settings))
        .filter((t) => t.jurisdictionId === jurisdiction?.id || t.jurisdictionId === defaultId)
        .map((t) => ({
          id: t.id,
          key: t.key,
          name: t.name,
          version: t.version,
          status: t.status,
          witnessRequired: t.witnessRequired,
          clauses: t.clauses,
        }));

      const parties = resolveParties(rent, session, settings, 'x');
      await ensureDefaultServices();
      const service = await prisma.paidService.findUnique({ where: { key: 'rent_agreement' } });
      const cost = service?.isActive ? service.creditCost : 0;

      return NextResponse.json({
        data: {
          jurisdiction: jurisdiction && {
            id: jurisdiction.id,
            name: jurisdiction.name,
            lawyerReviewed: jurisdiction.lawyerReviewed,
            stampDutyNote: jurisdiction.stampDutyNote,
          },
          templates,
          landlord: {
            hasAccount: !!rent.unit.property.landlord,
            name: rent.unit.property.landlord?.name ?? null,
            // False when the property has no landlord account and the admin has not allowed the
            // manager to type the owner's name.
            canTypeName: parties.ok || parties.code !== 'LANDLORD_REQUIRED',
          },
          offers: offersOf(settings),
          credits: {
            generateCost: settings.chargeForAgreements && session.role !== 'ADMIN' ? cost : 0,
            uploadCost: settings.chargeForUploads && session.role !== 'ADMIN' ? cost : 0,
            balance: session.role === 'ADMIN' ? null : await creditBalance(session.sub),
          },
          findings: jurisdiction
            ? checkTenancyRules(jurisdiction as JurisdictionRules, {
                paymentFrequency: rent.paymentFrequency,
                startDate: rent.startDate,
                endDate: rent.endDate,
                address: rent.unit.property.address,
                city: rent.unit.property.city,
              })
            : [],
          rent: {
            rentAmount: rent.rentAmount,
            paymentFrequency: rent.paymentFrequency,
            startDate: rent.startDate,
            endDate: rent.endDate,
            deposit: rent.deposit,
          },
        },
      });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN', 'MANAGER', 'LANDLORD'] },
);
