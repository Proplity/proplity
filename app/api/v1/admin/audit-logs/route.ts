import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { parsePagination, buildMeta } from '@/lib/api/pagination';
import { handleApiError } from '@/lib/api/errors';

// Read side of the AuditLog model, with filters, paging and readable names
// (ISS-055). Filters: action (exact), entityType, entityId, actor (name or
// email contains), q (action contains), from / to (YYYY-MM-DD, inclusive).
// `?facets=1` also returns the distinct actions and entity types for the
// filter dropdowns.

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** A human label for the thing an entry is about, looked up in one query per type. */
async function entityLabels(rows: { entityType: string; entityId: string }[]) {
  const ids = (type: string) => [
    ...new Set(rows.filter((r) => r.entityType === type).map((r) => r.entityId)),
  ];
  const labels = new Map<string, string>();
  const key = (type: string, id: string) => `${type}:${id}`;

  const [users, invoices, properties, vendors, requests] = await Promise.all([
    ids('User').length
      ? prisma.user.findMany({
          where: { id: { in: ids('User') } },
          select: { id: true, name: true, email: true },
        })
      : [],
    ids('Invoice').length
      ? prisma.invoice.findMany({
          where: { id: { in: ids('Invoice') } },
          select: { id: true, invoiceNumber: true },
        })
      : [],
    ids('Property').length
      ? prisma.property.findMany({
          where: { id: { in: ids('Property') } },
          select: { id: true, name: true },
        })
      : [],
    ids('VendorProfile').length
      ? prisma.vendorProfile.findMany({
          where: { id: { in: ids('VendorProfile') } },
          select: { id: true, businessName: true },
        })
      : [],
    ids('MaintenanceRequest').length
      ? prisma.maintenanceRequest.findMany({
          where: { id: { in: ids('MaintenanceRequest') } },
          select: { id: true, title: true },
        })
      : [],
  ]);
  for (const u of users) labels.set(key('User', u.id), `${u.name} (${u.email})`);
  for (const i of invoices) labels.set(key('Invoice', i.id), i.invoiceNumber);
  for (const p of properties) labels.set(key('Property', p.id), p.name);
  for (const v of vendors) labels.set(key('VendorProfile', v.id), v.businessName);
  for (const m of requests) labels.set(key('MaintenanceRequest', m.id), m.title);
  return (type: string, id: string) => labels.get(key(type, id)) ?? null;
}

export const GET = withAuth(
  async (req) => {
    try {
      const { searchParams } = req.nextUrl;
      const { skip, take, page, limit } = parsePagination(searchParams);

      const action = searchParams.get('action');
      const entityType = searchParams.get('entityType');
      const entityId = searchParams.get('entityId');
      const actor = searchParams.get('actor')?.trim();
      const q = searchParams.get('q')?.trim();
      const from = searchParams.get('from');
      const to = searchParams.get('to');

      const createdAt: Prisma.DateTimeFilter = {};
      if (from && DAY_RE.test(from)) createdAt.gte = new Date(`${from}T00:00:00.000Z`);
      if (to && DAY_RE.test(to))
        createdAt.lt = new Date(new Date(`${to}T00:00:00.000Z`).getTime() + 86_400_000);

      const where: Prisma.AuditLogWhereInput = {
        ...(action ? { action } : {}),
        ...(entityType ? { entityType } : {}),
        ...(entityId ? { entityId } : {}),
        ...(q ? { action: { contains: q, mode: 'insensitive' } } : {}),
        ...(actor
          ? {
              actor: {
                OR: [
                  { name: { contains: actor, mode: 'insensitive' } },
                  { email: { contains: actor, mode: 'insensitive' } },
                ],
              },
            }
          : {}),
        ...(Object.keys(createdAt).length ? { createdAt } : {}),
      };

      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          skip,
          take,
          include: { actor: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.auditLog.count({ where }),
      ]);

      const labelFor = await entityLabels(logs);
      const data = logs.map((l) => ({ ...l, entityLabel: labelFor(l.entityType, l.entityId) }));

      let facets: { actions: string[]; entityTypes: string[] } | undefined;
      if (searchParams.get('facets')) {
        const [actions, entityTypes] = await Promise.all([
          prisma.auditLog.groupBy({ by: ['action'], orderBy: { action: 'asc' } }),
          prisma.auditLog.groupBy({ by: ['entityType'], orderBy: { entityType: 'asc' } }),
        ]);
        facets = {
          actions: actions.map((a) => a.action),
          entityTypes: entityTypes.map((e) => e.entityType),
        };
      }

      return NextResponse.json({ data, meta: buildMeta(total, page, limit), facets });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN'] },
);
