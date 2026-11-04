import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { DEFAULT_JURISDICTIONS, DEFAULT_TEMPLATES } from '@/lib/agreementDefaults';
import type { getSystemSettings } from '@/lib/systemSettings';

type Settings = Awaited<ReturnType<typeof getSystemSettings>>;

/**
 * Puts the starting jurisdictions and drafted templates in the tables the first time anything reads
 * them. Safe to call on every read and from simultaneous requests: both inserts skip rows that
 * exist. The templates are drafts, and the jurisdictions say they are not lawyer reviewed.
 */
export async function ensureDefaultAgreementData(): Promise<void> {
  if ((await prisma.jurisdiction.count()) > 0) return;
  await prisma.jurisdiction.createMany({
    data: DEFAULT_JURISDICTIONS.map((j) => ({
      ...j,
      states: [...j.states],
      excludedAreas: [...j.excludedAreas],
    })),
    skipDuplicates: true,
  });
  const rows = await prisma.jurisdiction.findMany({ select: { id: true, key: true } });
  const idOf = new Map(rows.map((r) => [r.key, r.id]));
  await prisma.agreementTemplate.createMany({
    data: DEFAULT_TEMPLATES.flatMap((t) => {
      const jurisdictionId = idOf.get(t.jurisdictionKey);
      return jurisdictionId
        ? [
            {
              key: t.key,
              name: t.name,
              version: 1,
              jurisdictionId,
              status: 'DRAFT' as const,
              clauses: t.clauses as unknown as Prisma.InputJsonValue,
              witnessRequired: t.witnessRequired,
              notes: t.notes,
            },
          ]
        : [];
    }),
    skipDuplicates: true,
  });
}

export async function listJurisdictions(opts: { includeInactive?: boolean } = {}) {
  await ensureDefaultAgreementData();
  return prisma.jurisdiction.findMany({
    where: opts.includeInactive ? {} : { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
}

/**
 * The templates a manager may make an agreement from: the newest version of each wording that is
 * approved, or, when the admin has switched the approval requirement off, the newest that is a
 * draft or approved. Archived versions are never usable.
 */
export async function listUsableTemplates(
  settings: Pick<Settings, 'agreementTemplatesNeedApproval'>,
  filter: { jurisdictionId?: string } = {},
) {
  await ensureDefaultAgreementData();
  const rows = await prisma.agreementTemplate.findMany({
    where: {
      ...(filter.jurisdictionId ? { jurisdictionId: filter.jurisdictionId } : {}),
      status: settings.agreementTemplatesNeedApproval ? 'APPROVED' : { in: ['DRAFT', 'APPROVED'] },
      jurisdiction: { isActive: true },
    },
    orderBy: [{ key: 'asc' }, { version: 'desc' }],
  });
  const newest = new Map<string, (typeof rows)[number]>();
  for (const row of rows) if (!newest.has(row.key)) newest.set(row.key, row);
  return [...newest.values()];
}
