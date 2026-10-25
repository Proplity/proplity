import crypto from 'crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import type { Session } from '@/lib/api/withAuth';
import { propertyScopeWhere } from '@/lib/api/propertyAccess';
import { getSystemSettings } from '@/lib/systemSettings';
import { PlanLimitError, assertUnitCapacity } from '@/lib/plans';
import { mayInviteNewTenant, waitingTenantData } from '@/lib/tenantInvitations';
import type { PortfolioPreview, PortfolioSummary } from '@/lib/api/types';
import {
  propertyKey,
  type ImportIssue,
  type ImportUnit,
  type ParsedPortfolio,
} from '@/lib/portfolioImport';

// Checks a parsed file against the database (properties and units that already exist, tenants who
// already have accounts, the plan's unit limit) and, when asked, saves it. A preview and the real
// import run the same checks; the import runs them again inside the transaction that saves, under
// a per-person lock, so nothing changes between "looks fine" and "saved". It is all or nothing: a
// file with any problem saves nothing.

type Db = Prisma.TransactionClient;
type Settings = Awaited<ReturnType<typeof getSystemSettings>>;
type Actor = Pick<Session, 'sub' | 'role' | 'scope'>;

type PlannedProperty = {
  key: string;
  name: string;
  address: string;
  city: string;
  state: string | null;
  type: ParsedPortfolio['properties'][number]['type'];
  existingId: string | null;
  managementOnly: boolean;
  units: ImportUnit[];
};

type Plan = {
  properties: PlannedProperty[];
  issues: ImportIssue[];
  /** Tenants who have no account yet, by email. */
  newTenants: Map<string, { name: string; phoneNumber: string | null }>;
  /** Tenants who already have an account, by email. */
  existingTenants: Map<string, string>;
};

export class ImportHasIssuesError extends Error {
  constructor(readonly issues: ImportIssue[]) {
    super('The file has problems');
  }
}

class RollBack extends Error {}

async function buildPlan(
  db: Db,
  actor: Actor,
  parsed: ParsedPortfolio,
  settings: Settings,
): Promise<Plan> {
  const issues = [...parsed.issues];

  const mine = await db.property.findMany({
    where: { ...propertyScopeWhere(actor.scope), mergedIntoId: null },
    select: {
      id: true,
      name: true,
      address: true,
      city: true,
      managementOnly: true,
      moderationStatus: true,
      units: { select: { unitNumber: true } },
    },
  });
  const byKey = new Map(mine.map((p) => [propertyKey(p.name, p.address, p.city), p]));

  const emails = [
    ...new Set(
      parsed.properties.flatMap((p) =>
        p.units.flatMap((u) => (u.tenancy ? [u.tenancy.email] : [])),
      ),
    ),
  ];
  const known = new Map<string, { id: string; role: string }>();
  if (emails.length > 0) {
    const found = await db.$queryRaw<{ id: string; email: string; role: string }[]>`
      SELECT "id", "email", "role"::text AS "role" FROM "User" WHERE lower("email") = ANY(${emails}::text[])`;
    for (const u of found) known.set(u.email.toLowerCase(), { id: u.id, role: u.role });
  }

  const planned: PlannedProperty[] = [];
  const newTenants: Plan['newTenants'] = new Map();
  const existingTenants: Plan['existingTenants'] = new Map();

  for (const p of parsed.properties) {
    const match = byKey.get(p.key);
    const taken = new Set(match?.units.map((u) => u.unitNumber.toLowerCase()));
    // A property made by the file is kept for management only; one that already exists keeps its own
    // rules, so a new tenant on a public listing still needs the listing approved.
    const mayCreateTenants = mayInviteNewTenant(
      actor,
      {
        moderationStatus: match?.moderationStatus ?? 'PENDING_REVIEW',
        mergedIntoId: null,
        managementOnly: match ? match.managementOnly : true,
      },
      settings,
    );

    const units: ImportUnit[] = [];
    for (const unit of p.units) {
      if (taken.has(unit.unitNumber.toLowerCase())) {
        issues.push({
          row: unit.row,
          error: `Unit "${unit.unitNumber}" already exists at ${p.name}`,
        });
        continue;
      }
      const tenancy = unit.tenancy;
      if (tenancy) {
        const account = known.get(tenancy.email);
        if (account && account.role !== 'TENANT') {
          issues.push({
            row: unit.row,
            error: `${tenancy.email} already belongs to a ${account.role.toLowerCase()} account, so it cannot be a tenant`,
          });
          continue;
        }
        if (!account && !mayCreateTenants.allowed) {
          issues.push({
            row: unit.row,
            error: `${tenancy.email} has no Proplity account yet and ${mayCreateTenants.error.toLowerCase()}`,
          });
          continue;
        }
        if (account) existingTenants.set(tenancy.email, account.id);
        else if (!newTenants.has(tenancy.email)) {
          newTenants.set(tenancy.email, { name: tenancy.name, phoneNumber: tenancy.phoneNumber });
        }
      }
      units.push(unit);
    }

    if (units.length > 0) {
      planned.push({
        key: p.key,
        name: p.name,
        address: p.address,
        city: p.city,
        state: p.state,
        type: p.type,
        existingId: match?.id ?? null,
        managementOnly: match ? match.managementOnly : true,
        units,
      });
    }
  }

  issues.sort((a, b) => a.row - b.row);
  return { properties: planned, issues, newTenants, existingTenants };
}

function summarise(plan: Plan): PortfolioSummary {
  const units = plan.properties.flatMap((p) => p.units);
  const tenancies = units.filter((u) => u.tenancy);
  return {
    properties: plan.properties.length,
    newProperties: plan.properties.filter((p) => !p.existingId).length,
    existingProperties: plan.properties.filter((p) => p.existingId).length,
    units: units.length,
    tenancies: tenancies.length,
    activeTenancies: tenancies.filter((u) => u.tenancy?.active).length,
    newTenantAccounts: plan.newTenants.size,
    linkedTenantAccounts: plan.existingTenants.size,
  };
}

/** Whose plan the file's units count against: the person importing, as for any property they add. */
function ownerOf(actor: Actor) {
  return {
    managerId: actor.role === 'MANAGER' ? actor.sub : null,
    landlordId: actor.role === 'LANDLORD' ? actor.sub : null,
    createdById: actor.sub,
  };
}

export async function previewImport(
  actor: Actor,
  parsed: ParsedPortfolio,
): Promise<PortfolioPreview> {
  const settings = await getSystemSettings();
  const plan = await buildPlan(prisma, actor, parsed, settings);
  const summary = summarise(plan);

  // Ask the plan limit what it would say, without saving anything: it answers by throwing.
  let capacity: PortfolioPreview['capacity'] = null;
  if (summary.units > 0) {
    try {
      await prisma.$transaction(async (tx) => {
        await assertUnitCapacity(tx, {
          settings,
          property: ownerOf(actor),
          adding: summary.units,
          actor: { id: actor.sub, role: actor.role },
        });
        throw new RollBack();
      });
    } catch (err) {
      if (err instanceof PlanLimitError) {
        capacity = {
          blocking: err.code === 'PLAN_LIMIT',
          code: err.code,
          message: err.message,
          details: err.details,
        };
      } else if (!(err instanceof RollBack)) throw err;
    }
  }

  const sentToday =
    actor.role === 'ADMIN'
      ? 0
      : await prisma.auditLog.count({
          where: {
            actorId: actor.sub,
            action: 'TENANT_INVITED',
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
        });

  return {
    summary,
    properties: plan.properties.map((p) => ({
      name: p.name,
      address: p.address,
      city: p.city,
      existing: !!p.existingId,
      units: p.units.map((u) => ({
        row: u.row,
        unitNumber: u.unitNumber,
        rentAmount: u.rentAmount,
        paymentFrequency: u.paymentFrequency,
        tenant: u.tenancy
          ? {
              name: u.tenancy.name,
              email: u.tenancy.email,
              account: plan.newTenants.has(u.tenancy.email) ? 'NEW' : 'EXISTING',
              status: u.tenancy.active ? 'ACTIVE' : 'PENDING',
            }
          : null,
      })),
    })),
    issues: plan.issues,
    capacity,
    invitations: {
      toSend: summary.newTenantAccounts,
      dailyLimit: settings.tenantInvitesPerDay,
      remainingToday:
        actor.role === 'ADMIN' ? null : Math.max(0, settings.tenantInvitesPerDay - sentToday),
    },
    canImport: plan.issues.length === 0 && summary.units > 0 && !capacity?.blocking,
  };
}

export async function commitImport(
  actor: Actor,
  parsed: ParsedPortfolio,
  opts: { confirmOverage: boolean },
) {
  const settings = await getSystemSettings();
  const result = await prisma.$transaction(
    async (tx) => {
      // One person's imports queue, so two uploads of the same file cannot both pass the checks.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`portfolio-import:${actor.sub}`}))`;
      const plan = await buildPlan(tx, actor, parsed, settings);
      if (plan.issues.length > 0) throw new ImportHasIssuesError(plan.issues);
      const summary = summarise(plan);
      if (summary.units === 0) {
        throw new ImportHasIssuesError([{ row: 0, error: 'The file has no units to import' }]);
      }

      await assertUnitCapacity(tx, {
        settings,
        property: ownerOf(actor),
        adding: summary.units,
        actor: { id: actor.sub, role: actor.role },
        confirmOverage: opts.confirmOverage,
      });

      const owner =
        actor.role === 'LANDLORD'
          ? { landlordId: actor.sub, managerId: null }
          : { managerId: actor.sub, landlordId: null };

      const propertyId = new Map<string, string>();
      const newProperties = plan.properties.filter((p) => !p.existingId);
      for (const p of plan.properties) {
        propertyId.set(p.key, p.existingId ?? crypto.randomUUID());
      }
      if (newProperties.length > 0) {
        await tx.property.createMany({
          data: newProperties.map((p) => ({
            id: propertyId.get(p.key)!,
            name: p.name,
            address: p.address,
            city: p.city,
            state: p.state,
            type: p.type,
            managementOnly: true,
            isPublished: false,
            createdById: actor.sub,
            ...owner,
          })),
        });
      }

      const tenantId = new Map<string, string>(plan.existingTenants);
      if (plan.newTenants.size > 0) {
        const rows = [];
        for (const [email, person] of plan.newTenants) {
          const id = crypto.randomUUID();
          tenantId.set(email, id);
          rows.push({ id, ...(await waitingTenantData({ email, ...person })) });
        }
        await tx.user.createMany({ data: rows });
      }

      const units: Prisma.UnitCreateManyInput[] = [];
      const rents: Prisma.RentCreateManyInput[] = [];
      const invoices: Prisma.InvoiceCreateManyInput[] = [];
      const occupied: string[] = [];
      for (const p of plan.properties) {
        // Units added to a listing that is already public wait for approval, as units added by hand do.
        const waitsForApproval = !p.managementOnly && actor.role !== 'ADMIN';
        for (const u of p.units) {
          const unitId = crypto.randomUUID();
          units.push({
            id: unitId,
            propertyId: propertyId.get(p.key)!,
            unitNumber: u.unitNumber,
            bedrooms: u.bedrooms,
            bathrooms: u.bathrooms,
            squareFeet: u.squareFeet,
            rentAmount: u.rentAmount,
            listedPaymentFrequency: u.paymentFrequency,
            serviceCharge: u.serviceCharge,
            depositAmount: u.tenancy?.deposit,
            status: u.tenancy?.active ? 'OCCUPIED' : 'VACANT',
            ...(waitsForApproval ? { amenities: ['approval:pending'] } : {}),
          });
          const t = u.tenancy;
          if (!t) continue;
          const rentId = crypto.randomUUID();
          rents.push({
            id: rentId,
            unitId,
            tenantId: tenantId.get(t.email)!,
            startDate: t.startDate,
            endDate: t.endDate,
            rentAmount: u.rentAmount,
            serviceCharge: u.serviceCharge,
            paymentFrequency: u.paymentFrequency,
            deposit: t.deposit,
            status: t.active ? 'ACTIVE' : 'PENDING',
          });
          if (t.active) occupied.push(unitId);
          if (t.firstDueDate) {
            invoices.push({
              rentId,
              type: 'RENT',
              amount: u.rentAmount,
              dueDate: t.firstDueDate,
              description: t.active ? 'Rent invoice (added from a file)' : 'Initial rent invoice',
            });
            if (u.serviceCharge > 0) {
              invoices.push({
                rentId,
                type: 'SERVICE_CHARGE',
                amount: u.serviceCharge,
                dueDate: t.firstDueDate,
                description: t.active
                  ? 'Service charge invoice (added from a file)'
                  : 'Initial service charge invoice',
              });
            }
          }
        }
      }
      await tx.unit.createMany({ data: units });
      if (rents.length > 0) await tx.rent.createMany({ data: rents });
      if (invoices.length > 0) await tx.invoice.createMany({ data: invoices });

      await tx.auditLog.create({
        data: {
          actorId: actor.sub,
          action: 'PORTFOLIO_IMPORTED',
          entityType: 'User',
          entityId: actor.sub,
          metadata: { ...summary },
        },
      });

      return { summary, linkedTenantIds: [...plan.existingTenants.values()] };
    },
    { timeout: 120_000, maxWait: 15_000 },
  );
  return result;
}
