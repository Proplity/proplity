import { Prisma, type PaymentFrequency } from '@prisma/client';
import { prisma } from '@/lib/db';
import { termMonths } from '@/lib/agreementFields';
import { listJurisdictions, listUsableTemplates } from '@/lib/agreements';
import {
  checkTenancyRules,
  jurisdictionFor,
  type JurisdictionRules,
  type RuleFinding,
} from '@/lib/tenancyRules';
import { CreditError, prepareCredits, spendCreditsIn } from '@/lib/credits';
import { currentAgreement, loadRentForAgreement, prepareGeneration } from '@/lib/rentAgreement';
import type { ClauseChoices } from '@/lib/agreementFields';
import type { getSystemSettings } from '@/lib/systemSettings';

type Settings = Awaited<ReturnType<typeof getSystemSettings>>;
type Actor = {
  sub: string;
  role: 'ADMIN' | 'MANAGER' | 'LANDLORD' | 'TENANT' | 'VENDOR';
  scope?: string[];
};

const DAY = 24 * 60 * 60 * 1000;
const SERVICE_KEY = 'rent_agreement';

/** `date` moved on by whole months (UTC), keeping the day of the month where the month is long enough. */
export function addMonthsUtc(date: Date, months: number): Date {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(date.getUTCDate(), lastDay));
  return target;
}

/** The last day of a tenancy of `months` months that starts on `start`. */
export const renewalEndDate = (start: Date, months: number) =>
  new Date(addMonthsUtc(start, months).getTime() - DAY);

export type RenewalTerms = {
  startDate: Date;
  endDate: Date;
  rentAmount: number;
  deposit: number;
  paymentFrequency: PaymentFrequency;
};

/**
 * The terms a renewal starts with: the day after this rent ends, for the same length (or
 * `termMonths`), at the same rent plus `increasePercent`, with the same deposit and payment cycle.
 * Anything can be changed before the renewal is made.
 */
export function defaultRenewalTerms(
  rent: {
    startDate: Date;
    endDate: Date;
    rentAmount: number;
    deposit: number;
    paymentFrequency: PaymentFrequency;
  },
  opts: { increasePercent?: number; termMonths?: number | null } = {},
): RenewalTerms {
  const startDate = new Date(rent.endDate.getTime() + DAY);
  const months = opts.termMonths ?? termMonths(rent.startDate, rent.endDate);
  const endDate = renewalEndDate(startDate, months);
  return {
    startDate,
    endDate,
    rentAmount: Math.round(rent.rentAmount * (1 + (opts.increasePercent ?? 0) / 100)),
    deposit: rent.deposit,
    paymentFrequency: rent.paymentFrequency,
  };
}

export type RenewalFailure = {
  ok: false;
  status: number;
  code: string;
  error: string;
  findings?: RuleFinding[];
};

const fail = (
  status: number,
  code: string,
  error: string,
  findings?: RuleFinding[],
): RenewalFailure => ({
  ok: false,
  status,
  code,
  error,
  findings,
});

export type AgreementDraftResult =
  { drafted: true; agreementId: string } | { drafted: false; reason: string };

/**
 * Copies a rent into a new, pending rent for the next term (linked with `renewedFromId`), with its
 * first rent invoice, exactly as creating a rent does. The new rent keeps the old one's late-fee
 * terms, service charge and automatic-renewal choices. The old rent is left running; the renewal
 * takes the unit over on its start date (see `occupyUnitForRent`). When `copyAgreement` is on and
 * the old rent had a generated agreement, a draft is made for the new rent from the same template
 * (its newest usable version) and choices; if that cannot be done the renewal stands and the result
 * says why.
 */
export async function renewRent(args: {
  rentId: string;
  actor: Actor;
  terms: Partial<RenewalTerms>;
  copyAgreement: boolean;
  settings: Settings;
}): Promise<
  | { ok: true; rent: { id: string }; agreement: AgreementDraftResult; findings: RuleFinding[] }
  | RenewalFailure
> {
  const { rentId, actor, settings } = args;
  const old = await prisma.rent.findUnique({
    where: { id: rentId },
    include: { unit: { include: { property: true } }, renewedInto: { select: { id: true } } },
  });
  if (!old) return fail(404, 'NOT_FOUND', 'Rent not found');
  if (old.status !== 'ACTIVE') {
    return fail(409, 'NOT_ACTIVE', 'Only a rent that is running can be renewed');
  }
  if (old.renewedInto) {
    return fail(409, 'ALREADY_RENEWED', 'This rent has already been renewed');
  }

  const base = defaultRenewalTerms(old, {
    increasePercent: old.autoRenewIncreasePercent,
    termMonths: old.autoRenewTermMonths,
  });
  const terms: RenewalTerms = { ...base, ...stripUndefined(args.terms) };
  if (terms.endDate <= terms.startDate) {
    return fail(400, 'BAD_DATES', 'The new tenancy must end after it starts');
  }
  // The renewal follows the rent it renews: it cannot start before that one has run its course.
  const dayOf = (d: Date) => d.toISOString().slice(0, 10);
  if (dayOf(terms.startDate) < dayOf(old.endDate)) {
    return fail(400, 'STARTS_TOO_EARLY', 'The renewal cannot start before the current rent ends');
  }

  const jurisdiction = jurisdictionFor(old.unit.property, await listJurisdictions());
  const findings = jurisdiction
    ? checkTenancyRules(jurisdiction as JurisdictionRules, {
        paymentFrequency: terms.paymentFrequency,
        startDate: terms.startDate,
        endDate: terms.endDate,
        address: old.unit.property.address,
        city: old.unit.property.city,
      })
    : [];
  const blocking = findings.filter((f) => f.mode === 'BLOCK');
  if (blocking.length > 0) {
    return fail(422, 'TENANCY_RULE', blocking.map((f) => f.message).join(' '), findings);
  }

  let created: { id: string };
  try {
    created = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Rent" WHERE "id" = ${rentId} FOR UPDATE`;
      const rent = await tx.rent.create({
        data: {
          unitId: old.unitId,
          tenantId: old.tenantId,
          startDate: terms.startDate,
          endDate: terms.endDate,
          rentAmount: terms.rentAmount,
          deposit: terms.deposit,
          paymentFrequency: terms.paymentFrequency,
          serviceCharge: old.serviceCharge,
          gracePeriodDays: old.gracePeriodDays,
          lateFeeType: old.lateFeeType,
          lateFeePercentage: old.lateFeePercentage,
          lateFeeFlatAmount: old.lateFeeFlatAmount,
          autoRenew: old.autoRenew,
          autoRenewIncreasePercent: old.autoRenewIncreasePercent,
          autoRenewTermMonths: old.autoRenewTermMonths,
          renewedFromId: old.id,
          status: 'PENDING',
        },
      });
      await tx.invoice.create({
        data: {
          rentId: rent.id,
          type: 'RENT',
          amount: rent.rentAmount,
          dueDate: rent.startDate,
          description: 'Initial rent invoice',
        },
      });
      if (rent.serviceCharge > 0) {
        await tx.invoice.create({
          data: {
            rentId: rent.id,
            type: 'SERVICE_CHARGE',
            amount: rent.serviceCharge,
            dueDate: rent.startDate,
            description: 'Initial service charge invoice',
          },
        });
      }
      await tx.auditLog.create({
        data: {
          actorId: actor.sub,
          action: 'RENT_RENEWED',
          entityType: 'Rent',
          entityId: rent.id,
          metadata: { renewedFromId: old.id } as object,
        },
      });
      return rent;
    });
  } catch (err) {
    // renewedFromId is unique: a second renewal made at the same moment loses.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return fail(409, 'ALREADY_RENEWED', 'This rent has already been renewed');
    }
    throw err;
  }

  const agreement = args.copyAgreement
    ? await draftRenewalAgreement({ oldRentId: old.id, newRentId: created.id, actor, settings })
    : ({ drafted: false, reason: 'Not asked for' } as const);
  return { ok: true, rent: created, agreement, findings };
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}

/**
 * A draft agreement for a renewal, made from the previous agreement's template and choices. Never
 * throws for the expected reasons (no previous generated agreement, the template gone, a rule that
 * blocks it, not enough credits): the renewal stands and the reason comes back.
 */
export async function draftRenewalAgreement(args: {
  oldRentId: string;
  newRentId: string;
  actor: Actor;
  settings: Settings;
}): Promise<AgreementDraftResult> {
  const { oldRentId, newRentId, actor, settings } = args;
  const previous = await currentAgreement(oldRentId);
  if (!previous) return { drafted: false, reason: 'The previous rent had no agreement to copy' };
  if (previous.source !== 'GENERATED' || !previous.templateKey) {
    return {
      drafted: false,
      reason: 'The previous agreement was an uploaded file, so it cannot be copied',
    };
  }

  const usable = await listUsableTemplates(settings);
  const template = usable
    .filter((t) => t.key === previous.templateKey)
    .sort((a, b) => b.version - a.version)[0];
  if (!template) {
    return {
      drafted: false,
      reason:
        'The template used before is no longer available. Make the agreement from a template.',
    };
  }

  const rent = await loadRentForAgreement(newRentId);
  if (!rent) return { drafted: false, reason: 'The renewal was not found' };
  const prepared = await prepareGeneration(
    actor,
    rent,
    {
      templateId: template.id,
      landlordName: previous.landlordName ?? undefined,
      agencyFee: previous.agencyFee,
      legalFee: previous.legalFee,
      choices: (previous.choices ?? {}) as ClauseChoices,
    },
    settings,
  );
  if (!prepared.ok) return { drafted: false, reason: prepared.error };

  const chargeable = actor.role !== 'ADMIN' && settings.chargeForAgreements;
  try {
    if (chargeable) await prepareCredits(actor.sub);
    const agreement = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Rent" WHERE "id" = ${newRentId} FOR UPDATE`;
      if (await currentAgreement(newRentId, tx)) return null;
      let credits = { cost: 0, entryId: null as string | null };
      if (chargeable) {
        const spent = await spendCreditsIn(
          tx,
          actor.sub,
          SERVICE_KEY,
          'Rent agreement made (renewal)',
        );
        credits = { cost: spent.cost, entryId: spent.entry.id };
      }
      const created = await tx.rentAgreement.create({
        data: {
          rentId: newRentId,
          createdById: actor.sub,
          source: 'GENERATED',
          status: 'DRAFT',
          templateId: prepared.template.id,
          templateKey: prepared.template.key,
          templateVersion: prepared.template.version,
          jurisdictionId: prepared.jurisdiction.id,
          choices: prepared.choices as Prisma.InputJsonValue,
          clauses: prepared.built.clauses as unknown as Prisma.InputJsonValue,
          specialConditions: previous.specialConditions,
          landlordName: prepared.landlordName,
          agentName: prepared.agentName,
          agencyFee: previous.agencyFee,
          legalFee: previous.legalFee,
          witnessRequired: prepared.template.witnessRequired,
          creditsCharged: credits.cost,
          creditEntryId: credits.entryId,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.sub,
          action: 'RENT_AGREEMENT_CREATED',
          entityType: 'RentAgreement',
          entityId: created.id,
          metadata: {
            rentId: newRentId,
            source: 'GENERATED',
            credits: credits.cost,
            renewal: true,
          } as object,
        },
      });
      return created;
    });
    return agreement
      ? { drafted: true, agreementId: agreement.id }
      : { drafted: false, reason: 'The renewal already has an agreement' };
  } catch (err) {
    if (err instanceof CreditError) return { drafted: false, reason: err.message };
    throw err;
  }
}
