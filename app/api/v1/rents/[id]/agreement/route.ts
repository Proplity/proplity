import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { handleFileError } from '@/lib/api/fileErrors';
import { validateBody } from '@/lib/api/validate';
import { canManageProperty } from '@/lib/api/propertyAccess';
import { assertOwnsFileUrls } from '@/lib/storage/service';
import { parseFileUrl } from '@/lib/fileRef';
import { notifyAndEmail } from '@/lib/notifications';
import { serializeWitness } from '@/lib/agreementWitness';
import { getSystemSettings } from '@/lib/systemSettings';
import { CreditError, prepareCredits, spendCreditsIn } from '@/lib/credits';
import { listJurisdictions } from '@/lib/agreements';
import type { ClauseChoices } from '@/lib/agreementFields';
import { jurisdictionFor, checkTenancyRules, type JurisdictionRules } from '@/lib/tenancyRules';
import {
  currentAgreement,
  accessibleRent,
  prepareGeneration,
  serializeAgreement,
} from '@/lib/rentAgreement';
import { createAgreementSchema, updateAgreementSchema } from '@/lib/rentAgreementSchema';

type RouteCtx = { params: Promise<{ id: string }> };

const SERVICE_KEY = 'rent_agreement';

const denied = (why: 'NOT_FOUND' | 'FORBIDDEN') =>
  why === 'NOT_FOUND'
    ? NextResponse.json({ error: 'Rent not found' }, { status: 404 })
    : NextResponse.json({ error: 'Forbidden' }, { status: 403 });

// The rent's agreement: the property team sees it from the first draft, the tenant only once it has
// been issued to them. `findings` are the legal warnings for this tenancy.
export const GET = withAuth(
  async (_req, { session }, ctx: RouteCtx) => {
    const { id } = await ctx.params;
    try {
      const access = await accessibleRent(session, id);
      if (typeof access === 'string') return denied(access);
      const { rent, viewer } = access;

      const agreement = await currentAgreement(id);
      if (!agreement || (viewer === 'TENANT' && agreement.status === 'DRAFT')) {
        return NextResponse.json({ data: null });
      }
      let findings: unknown[] = [];
      if (viewer === 'TEAM') {
        const jurisdiction = jurisdictionFor(rent.unit.property, await listJurisdictions());
        if (jurisdiction) {
          findings = checkTenancyRules(jurisdiction as JurisdictionRules, {
            paymentFrequency: rent.paymentFrequency,
            startDate: rent.startDate,
            endDate: rent.endDate,
            address: rent.unit.property.address,
            city: rent.unit.property.city,
          });
        }
      }
      const settings = await getSystemSettings();
      const witnessRows = await prisma.agreementWitness.findMany({
        where: { agreementId: agreement.id },
        orderBy: { side: 'asc' },
      });
      // The tenant sees their own witness's address and the landlord's witness by name only.
      const witnessSignatures = witnessRows.map((w) => {
        const view = serializeWitness(w);
        return viewer === 'TENANT' && w.side === 'LANDLORD' ? { ...view, email: null } : view;
      });
      return NextResponse.json({
        data: {
          ...serializeAgreement(agreement, viewer),
          witnessSignatures,
          witnessEsign: {
            enabled: settings.witnessEsignEnabled && agreement.source === 'GENERATED',
            mustSign: settings.witnessEsignEnabled && settings.witnessesMustSign,
            linkDays: settings.witnessLinkDays,
          },
        },
        findings,
      });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN', 'MANAGER', 'LANDLORD', 'TENANT'] },
);

// Starts the agreement: generated from a template, or an existing agreement uploaded as a file.
// Generating takes the credits the admin set (when charging is on) in the same transaction that
// saves the draft. An uploaded agreement goes straight to the tenant to confirm.
export const POST = withAuth(
  async (req, { session }, ctx: RouteCtx) => {
    const { id } = await ctx.params;
    try {
      const validated = await validateBody(req, createAgreementSchema);
      if (!validated.success) return validated.response;
      const body = validated.data;

      const access = await accessibleRent(session, id);
      if (typeof access === 'string') return denied(access);
      const { rent } = access;
      if (rent.status === 'TERMINATED' || rent.status === 'EXPIRED') {
        return NextResponse.json(
          { error: 'This rent has ended, so it cannot have a new agreement', code: 'RENT_ENDED' },
          { status: 409 },
        );
      }

      const settings = await getSystemSettings();
      const chargeable =
        session.role !== 'ADMIN' &&
        (body.source === 'GENERATED' ? settings.chargeForAgreements : settings.chargeForUploads);

      let data: Omit<Prisma.RentAgreementUncheckedCreateInput, 'rentId' | 'createdById'>;
      let findings: unknown[] = [];
      if (body.source === 'GENERATED') {
        const prepared = await prepareGeneration(session, rent, body, settings);
        if (!prepared.ok) {
          return NextResponse.json(
            { error: prepared.error, code: prepared.code, findings: prepared.findings },
            { status: prepared.status },
          );
        }
        findings = prepared.findings;
        data = {
          source: 'GENERATED',
          status: 'DRAFT',
          templateId: prepared.template.id,
          templateKey: prepared.template.key,
          templateVersion: prepared.template.version,
          jurisdictionId: prepared.jurisdiction.id,
          choices: prepared.choices as Prisma.InputJsonValue,
          clauses: prepared.built.clauses as unknown as Prisma.InputJsonValue,
          specialConditions: body.specialConditions?.trim() || null,
          landlordName: prepared.landlordName,
          agentName: prepared.agentName,
          agencyFee: body.agencyFee ?? null,
          legalFee: body.legalFee ?? null,
          witnesses: (body.witnesses ?? undefined) as Prisma.InputJsonValue | undefined,
          witnessRequired: prepared.template.witnessRequired,
        };
      } else {
        if (!canManageProperty(session, rent.unit.property)) return denied('FORBIDDEN');
        if (!parseFileUrl(body.fileUrl)) {
          return NextResponse.json(
            { error: 'Upload the agreement as a file', code: 'BAD_FILE' },
            { status: 400 },
          );
        }
        await assertOwnsFileUrls([body.fileUrl], session.sub, 'rents');
        data = {
          source: 'UPLOADED',
          status: 'ISSUED',
          fileUrl: body.fileUrl,
          witnesses: (body.witnesses ?? undefined) as Prisma.InputJsonValue | undefined,
          issuedAt: new Date(),
        };
      }

      if (chargeable) await prepareCredits(session.sub);
      const created = await prisma.$transaction(async (tx) => {
        // One agreement per rent: the checks below and the insert happen under the rent's row lock.
        await tx.$queryRaw`SELECT "id" FROM "Rent" WHERE "id" = ${id} FOR UPDATE`;
        if (await currentAgreement(id, tx)) return 'EXISTS' as const;
        let credits = { cost: 0, entryId: null as string | null };
        if (chargeable) {
          const spent = await spendCreditsIn(
            tx,
            session.sub,
            SERVICE_KEY,
            data.source === 'GENERATED' ? 'Rent agreement made' : 'Rent agreement uploaded',
          );
          credits = { cost: spent.cost, entryId: spent.entry.id };
        }
        const agreement = await tx.rentAgreement.create({
          data: {
            ...data,
            rentId: id,
            createdById: session.sub,
            creditsCharged: credits.cost,
            creditEntryId: credits.entryId,
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: session.sub,
            action: 'RENT_AGREEMENT_CREATED',
            entityType: 'RentAgreement',
            entityId: agreement.id,
            metadata: { rentId: id, source: agreement.source, credits: credits.cost } as object,
          },
        });
        return agreement;
      });
      if (created === 'EXISTS') {
        return NextResponse.json(
          {
            error: 'This rent already has an agreement. Withdraw it first to start another.',
            code: 'AGREEMENT_EXISTS',
          },
          { status: 409 },
        );
      }

      // An uploaded agreement is with the tenant at once; a generated one waits as a draft.
      if (created.status === 'ISSUED') {
        const where = `unit ${rent.unit.unitNumber} at ${rent.unit.property.name}`;
        await notifyAndEmail(rent.tenantId, {
          title: 'Rent agreement to confirm',
          body: `Your landlord uploaded the rent agreement for ${where}. Read it and confirm it with your name.`,
          link: `/dashboard/tenants/${id}`,
        });
      }

      return NextResponse.json(
        { data: serializeAgreement(created, 'TEAM'), findings },
        { status: 201 },
      );
    } catch (err) {
      if (err instanceof CreditError) {
        return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
      }
      return handleFileError(err);
    }
  },
  { roles: ['ADMIN', 'MANAGER', 'LANDLORD'] },
);

// Changes a draft (anything but its template), or, once it has been issued, only the witnesses.
export const PATCH = withAuth(
  async (req, { session }, ctx: RouteCtx) => {
    const { id } = await ctx.params;
    try {
      const validated = await validateBody(req, updateAgreementSchema);
      if (!validated.success) return validated.response;
      const body = validated.data;

      const access = await accessibleRent(session, id);
      if (typeof access === 'string') return denied(access);
      const { rent } = access;

      const settings = await getSystemSettings();
      const result = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Rent" WHERE "id" = ${id} FOR UPDATE`;
        const current = await currentAgreement(id, tx);
        if (!current)
          return {
            ok: false,
            status: 404,
            error: 'This rent has no agreement',
            code: 'NO_AGREEMENT',
          } as const;
        if (current.status === 'EXECUTED') {
          return {
            ok: false,
            status: 409,
            error: 'A signed agreement cannot be changed',
            code: 'EXECUTED',
          } as const;
        }

        const onlyWitnesses = Object.keys(body).every((k) => k === 'witnesses');
        if (current.status !== 'DRAFT') {
          if (!onlyWitnesses) {
            return {
              ok: false,
              status: 409,
              error: 'This agreement has been sent. Only the witnesses can change now.',
              code: 'NOT_DRAFT',
            } as const;
          }
          const updated = await tx.rentAgreement.update({
            where: { id: current.id },
            data: { witnesses: body.witnesses as Prisma.InputJsonValue },
          });
          return { ok: true, updated } as const;
        }

        let data: Prisma.RentAgreementUncheckedUpdateInput = {
          ...(body.witnesses !== undefined
            ? { witnesses: body.witnesses as Prisma.InputJsonValue }
            : {}),
        };
        if (current.source === 'GENERATED') {
          const choices = (body.choices ?? current.choices ?? {}) as ClauseChoices;
          const prepared = await prepareGeneration(
            session,
            rent,
            {
              templateId: current.templateId ?? '',
              landlordName: body.landlordName ?? current.landlordName ?? undefined,
              agencyFee: body.agencyFee !== undefined ? body.agencyFee : current.agencyFee,
              legalFee: body.legalFee !== undefined ? body.legalFee : current.legalFee,
              choices,
            },
            settings,
            { skipUsableCheck: true },
          );
          if (!prepared.ok) return prepared;
          data = {
            ...data,
            choices: prepared.choices as Prisma.InputJsonValue,
            clauses: prepared.built.clauses as unknown as Prisma.InputJsonValue,
            landlordName: prepared.landlordName,
            agentName: prepared.agentName,
            agencyFee: body.agencyFee !== undefined ? body.agencyFee : current.agencyFee,
            legalFee: body.legalFee !== undefined ? body.legalFee : current.legalFee,
            ...(body.specialConditions !== undefined
              ? { specialConditions: body.specialConditions?.trim() || null }
              : {}),
          };
        }
        const updated = await tx.rentAgreement.update({ where: { id: current.id }, data });
        await tx.auditLog.create({
          data: {
            actorId: session.sub,
            action: 'RENT_AGREEMENT_UPDATED',
            entityType: 'RentAgreement',
            entityId: current.id,
            metadata: { rentId: id, fields: Object.keys(body) } as object,
          },
        });
        return { ok: true, updated } as const;
      });

      if (result.ok) {
        return NextResponse.json({ data: serializeAgreement(result.updated, 'TEAM') });
      }
      return NextResponse.json(
        {
          error: result.error,
          code: result.code,
          ...('findings' in result && result.findings ? { findings: result.findings } : {}),
        },
        { status: result.status },
      );
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN', 'MANAGER', 'LANDLORD'] },
);
