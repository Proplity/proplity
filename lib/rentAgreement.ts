import type { AgreementTemplate, Jurisdiction, Prisma, RentAgreement } from '@prisma/client';
import { prisma } from '@/lib/db';
import { canManageProperty } from '@/lib/api/propertyAccess';
import { getSystemSettings } from '@/lib/systemSettings';
import { listJurisdictions, listUsableTemplates } from '@/lib/agreements';
import { buildAgreement, type AgreementOffers, type BuiltAgreement } from '@/lib/agreementBuild';
import type { ClauseChoices, TemplateClause } from '@/lib/agreementFields';
import {
  checkTenancyRules,
  jurisdictionFor,
  type JurisdictionRules,
  type RuleFinding,
} from '@/lib/tenancyRules';

type Settings = Awaited<ReturnType<typeof getSystemSettings>>;
type Actor = {
  sub: string;
  role: 'ADMIN' | 'MANAGER' | 'LANDLORD' | 'TENANT' | 'VENDOR';
  scope?: string[];
};

export type AgreementFailure = {
  ok: false;
  status: number;
  code: string;
  error: string;
  findings?: RuleFinding[];
};

export type GenerationInput = {
  templateId: string;
  landlordName?: string;
  agencyFee?: number | null;
  legalFee?: number | null;
  choices?: ClauseChoices;
};

export const offersOf = (settings: Settings): AgreementOffers => ({
  caution: settings.agreementCautionFee,
  agency: settings.agreementAgencyFee,
  legal: settings.agreementLegalFee,
});

const fail = (status: number, code: string, error: string, findings?: RuleFinding[]) =>
  ({ ok: false, status, code, error, findings }) as const satisfies AgreementFailure;

const RENT_FOR_AGREEMENT = {
  unit: {
    include: {
      property: {
        include: {
          manager: { select: { id: true, name: true } },
          landlord: { select: { id: true, name: true } },
        },
      },
    },
  },
  tenant: { select: { id: true, name: true, email: true, phoneNumber: true } },
} satisfies Prisma.RentInclude;

export function loadRentForAgreement(rentId: string) {
  return prisma.rent.findUnique({ where: { id: rentId }, include: RENT_FOR_AGREEMENT });
}

export type RentForAgreement = NonNullable<Awaited<ReturnType<typeof loadRentForAgreement>>>;

/** The one agreement of a rent that is not void, if it has one. */
export function currentAgreement(
  rentId: string,
  db: Prisma.TransactionClient | typeof prisma = prisma,
) {
  return db.rentAgreement.findFirst({
    where: { rentId, status: { not: 'VOID' } },
    orderBy: { createdAt: 'desc' },
  });
}

/** Who the agreement names as the landlord, and the manager noted as acting for them. */
export function resolveParties(
  rent: RentForAgreement,
  actor: Actor,
  settings: Settings,
  typed?: string,
) {
  const property = rent.unit.property;
  // A manager acts for the owner; a landlord signing for themselves has no agent.
  const agentName = actor.role === 'LANDLORD' ? null : (property.manager?.name ?? null);
  if (property.landlord) {
    return { ok: true, landlordName: property.landlord.name, agentName } as const;
  }
  if (!settings.agreementLandlordNameByManager) {
    return fail(
      422,
      'LANDLORD_REQUIRED',
      'This property has no landlord account. Add the owner to the property before making an agreement.',
    );
  }
  if (!typed) {
    return fail(
      422,
      'LANDLORD_NAME_REQUIRED',
      "Type the owner's name: this property has no landlord account.",
    );
  }
  return { ok: true, landlordName: typed, agentName } as const;
}

/**
 * Everything needed to make or preview a generated agreement, or the reason it cannot be made:
 * the caller's right to manage the property, the place's rules, a template that may be used there,
 * who the landlord is, the fees on offer, the manager's choices against the template, and the
 * legal findings (a BLOCK stops it). Used by preview, create, edit and issue.
 */
export async function prepareGeneration(
  actor: Actor,
  rent: RentForAgreement,
  input: GenerationInput,
  settings: Settings,
  opts: { skipUsableCheck?: boolean } = {},
) {
  const property = rent.unit.property;
  if (!canManageProperty(actor, property)) return fail(403, 'FORBIDDEN', 'Forbidden');

  const jurisdictions = await listJurisdictions();
  const jurisdiction = jurisdictionFor(property, jurisdictions);
  if (!jurisdiction) {
    return fail(
      422,
      'NO_JURISDICTION',
      'No jurisdiction covers this property. Ask an admin to add one.',
    );
  }

  let template = await prisma.agreementTemplate.findUnique({ where: { id: input.templateId } });
  if (!template) return fail(404, 'TEMPLATE_NOT_FOUND', 'Template not found');
  if (!opts.skipUsableCheck) {
    const usable = await listUsableTemplates(settings);
    const defaults = jurisdictions.find((j) => j.isDefault);
    const allowed = usable.find(
      (t) =>
        t.id === template!.id &&
        (t.jurisdictionId === jurisdiction.id || t.jurisdictionId === defaults?.id),
    );
    if (!allowed) {
      return fail(
        422,
        'TEMPLATE_NOT_AVAILABLE',
        'That template cannot be used for this property. It may not be approved yet, or it is for another place.',
      );
    }
    template = allowed;
  }

  const parties = resolveParties(rent, actor, settings, input.landlordName?.trim());
  if (!parties.ok) return parties;

  const offers = offersOf(settings);
  if ((input.agencyFee ?? 0) > 0 && !offers.agency) {
    return fail(400, 'FEE_NOT_OFFERED', 'An agency fee is not offered on agreements');
  }
  if ((input.legalFee ?? 0) > 0 && !offers.legal) {
    return fail(400, 'FEE_NOT_OFFERED', 'A legal fee is not offered on agreements');
  }

  const clauses = template.clauses as unknown as TemplateClause[];
  const byId = new Map(clauses.map((c) => [c.id, c]));
  const choices = input.choices ?? {};
  for (const id of [...(choices.omit ?? []), ...(choices.include ?? [])]) {
    if (byId.get(id)?.mode !== 'OPTIONAL') {
      return fail(400, 'BAD_CHOICES', 'Only optional clauses can be left out or put in');
    }
  }
  for (const id of Object.keys(choices.edits ?? {})) {
    if (byId.get(id)?.mode !== 'EDITABLE') {
      return fail(400, 'BAD_CHOICES', 'Only editable clauses can be reworded');
    }
  }

  const rules = jurisdiction as JurisdictionRules;
  const built = buildAgreement({
    clauses,
    jurisdiction: rules,
    rent: {
      ...rent,
      paymentFrequency: rent.paymentFrequency,
      lateFeeType: rent.lateFeeType,
    },
    unitNumber: rent.unit.unitNumber,
    property,
    tenant: rent.tenant,
    landlordName: parties.landlordName,
    agentName: parties.agentName,
    agencyFee: input.agencyFee ?? null,
    legalFee: input.legalFee ?? null,
    offers,
    today: new Date(),
    choices,
  });
  if (built.missing.length > 0) {
    return fail(
      422,
      'UNKNOWN_FIELD',
      `The wording uses ${built.missing.map((m) => `{{${m}}}`).join(', ')}, which this agreement has no value for`,
    );
  }

  const findings = checkTenancyRules(rules, {
    paymentFrequency: rent.paymentFrequency,
    startDate: rent.startDate,
    endDate: rent.endDate,
    address: property.address,
    city: property.city,
  });
  const blocking = findings.filter((f) => f.mode === 'BLOCK');
  if (blocking.length > 0) {
    return fail(422, 'TENANCY_RULE', blocking.map((f) => f.message).join(' '), findings);
  }

  const prepared: Prepared = {
    ok: true,
    template,
    jurisdiction,
    landlordName: parties.landlordName,
    agentName: parties.agentName,
    built,
    findings,
    choices,
  };
  return prepared;
}

export type Prepared = {
  ok: true;
  template: AgreementTemplate;
  jurisdiction: Jurisdiction;
  landlordName: string;
  agentName: string | null;
  built: BuiltAgreement;
  /** The legal findings that warn (a blocking one stops the agreement instead). */
  findings: RuleFinding[];
  choices: ClauseChoices;
};

/** What a person sees of an agreement. The tenant never sees a draft or the property team's internals. */
export function serializeAgreement(a: RentAgreement, viewer: 'TEAM' | 'TENANT') {
  const base = {
    id: a.id,
    rentId: a.rentId,
    source: a.source,
    status: a.status,
    templateKey: a.templateKey,
    templateVersion: a.templateVersion,
    clauses: a.clauses,
    specialConditions: a.specialConditions,
    landlordName: a.landlordName,
    agentName: a.agentName,
    witnesses: a.witnesses,
    witnessRequired: a.witnessRequired,
    fileUrl: a.fileUrl,
    confirmedAt: a.confirmedAt,
    confirmedName: a.confirmedName,
    stampDutyStatus: a.stampDutyStatus,
    stampDutyReference: a.stampDutyReference,
    stampDutyAmount: a.stampDutyAmount,
    stampDutyReceiptUrl: a.stampDutyReceiptUrl,
    stampedAt: a.stampedAt,
    issuedAt: a.issuedAt,
    executedAt: a.executedAt,
    createdAt: a.createdAt,
  };
  if (viewer === 'TENANT') return base;
  return {
    ...base,
    choices: a.choices,
    agencyFee: a.agencyFee,
    legalFee: a.legalFee,
    creditsCharged: a.creditsCharged,
    confirmedIp: a.confirmedIp,
    voidReason: a.voidReason,
  };
}
