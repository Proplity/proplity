import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';

// Server-side dashboard totals (ISS-049). The dashboards used to add up the
// first page of invoices, leases and properties in the browser, which is
// silently wrong past 20 rows. These sum in the database instead, so the
// numbers stay right at any size.
//
// Definitions (kept identical to what the dashboards showed):
//   collected  = every Payment against the owner's invoices
//   pending    = sum over open (not PAID/CANCELLED) invoices of max(0, amount - paid)
//   occupancy  = OCCUPIED units / all units
//   month      = the calendar month in UTC

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function monthRange(now: Date) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, end };
}

const num = (v: unknown) => Number(v ?? 0);

/** Invoices on properties this user manages or owns (lease or maintenance link). */
function ownerInvoiceWhere(userId: string): Prisma.InvoiceWhereInput {
  const property = { OR: [{ managerId: userId }, { landlordId: userId }] };
  return {
    OR: [{ lease: { unit: { property } } }, { maintenanceRequest: { unit: { property } } }],
  };
}

export async function ownerDashboardSummary(userId: string, now = new Date()) {
  const propertyScope = { OR: [{ managerId: userId }, { landlordId: userId }] };
  const { start, end } = monthRange(now);
  const invoiceWhere = ownerInvoiceWhere(userId);

  const [
    propertyCount,
    units,
    activeLeaseCount,
    collectedAll,
    collectedMonth,
    pendingRows,
    perPropertyMoney,
    maintenanceCosts,
    pendingMaintenance,
    renewalWhere,
    recentPayments,
    recentCompletedMaintenance,
    recentLeases,
  ] = await Promise.all([
    prisma.property.count({ where: propertyScope }),
    prisma.unit.groupBy({
      by: ['status'],
      where: { property: propertyScope },
      _count: { _all: true },
      _sum: { rentAmount: true },
    }),
    prisma.lease.count({ where: { status: 'ACTIVE', unit: { property: propertyScope } } }),
    prisma.payment.aggregate({ _sum: { amount: true }, where: { invoice: invoiceWhere } }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { invoice: invoiceWhere, paidAt: { gte: start, lt: end } },
    }),
    prisma.$queryRaw<{ pending: number }[]>(Prisma.sql`
      SELECT COALESCE(SUM(GREATEST(0, i."amount" - COALESCE(p.paid, 0))), 0) AS pending
      FROM "Invoice" i
      LEFT JOIN (SELECT "invoiceId", SUM("amount") AS paid FROM "Payment" GROUP BY "invoiceId") p
        ON p."invoiceId" = i."id"
      WHERE i."status" NOT IN ('PAID', 'CANCELLED')
        AND (
          i."leaseId" IN (
            SELECT l."id" FROM "Lease" l
            JOIN "Unit" u ON u."id" = l."unitId"
            JOIN "Property" pr ON pr."id" = u."propertyId"
            WHERE pr."managerId" = ${userId} OR pr."landlordId" = ${userId})
          OR i."maintenanceRequestId" IN (
            SELECT m."id" FROM "MaintenanceRequest" m
            JOIN "Unit" u ON u."id" = m."unitId"
            JOIN "Property" pr ON pr."id" = u."propertyId"
            WHERE pr."managerId" = ${userId} OR pr."landlordId" = ${userId})
        )`),
    // Per property, lease invoices only (what the portfolio table and the CSV show).
    prisma.$queryRaw<{ propertyId: string; collected: number; pending: number }[]>(Prisma.sql`
      SELECT pr."id" AS "propertyId",
        COALESCE(SUM(COALESCE(p.paid, 0)), 0) AS collected,
        COALESCE(SUM(CASE WHEN i."status" NOT IN ('PAID', 'CANCELLED')
                          THEN GREATEST(0, i."amount" - COALESCE(p.paid, 0)) ELSE 0 END), 0) AS pending
      FROM "Property" pr
      JOIN "Unit" u ON u."propertyId" = pr."id"
      JOIN "Lease" l ON l."unitId" = u."id"
      JOIN "Invoice" i ON i."leaseId" = l."id"
      LEFT JOIN (SELECT "invoiceId", SUM("amount") AS paid FROM "Payment" GROUP BY "invoiceId") p
        ON p."invoiceId" = i."id"
      WHERE pr."managerId" = ${userId} OR pr."landlordId" = ${userId}
      GROUP BY pr."id"`),
    prisma.maintenanceRequest.aggregate({
      _sum: { finalCost: true },
      where: { status: 'COMPLETED', unit: { property: propertyScope } },
    }),
    prisma.maintenanceRequest.count({
      where: { status: { notIn: ['COMPLETED', 'CANCELLED'] }, unit: { property: propertyScope } },
    }),
    Promise.resolve({
      status: 'ACTIVE' as const,
      unit: { property: propertyScope },
      endDate: { gte: now, lte: new Date(now.getTime() + 60 * MS_PER_DAY) },
    }),
    prisma.payment.findMany({
      where: { invoice: invoiceWhere },
      orderBy: { paidAt: 'desc' },
      take: 5,
      include: {
        invoice: {
          select: {
            invoiceNumber: true,
            type: true,
            leaseId: true,
            lease: {
              select: {
                tenant: { select: { name: true } },
                unit: { select: { property: { select: { name: true } } } },
              },
            },
          },
        },
      },
    }),
    prisma.maintenanceRequest.findMany({
      where: {
        status: 'COMPLETED',
        completedAt: { not: null },
        unit: { property: propertyScope },
      },
      orderBy: { completedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        completedAt: true,
        finalCost: true,
        unit: { select: { property: { select: { name: true } } } },
      },
    }),
    prisma.lease.findMany({
      where: { status: 'ACTIVE', unit: { property: propertyScope } },
      orderBy: { startDate: 'desc' },
      take: 5,
      select: {
        id: true,
        startDate: true,
        tenant: { select: { name: true } },
        unit: { select: { property: { select: { name: true } } } },
      },
    }),
  ]);

  const upcomingRenewals = await prisma.lease.findMany({
    where: renewalWhere,
    orderBy: { endDate: 'asc' },
    take: 5,
    select: {
      id: true,
      endDate: true,
      tenant: { select: { name: true } },
      unit: { select: { unitNumber: true, property: { select: { name: true } } } },
    },
  });
  const upcomingRenewalCount = await prisma.lease.count({ where: renewalWhere });

  const totalUnits = units.reduce((s, g) => s + g._count._all, 0);
  const occupiedUnits = units.find((g) => g.status === 'OCCUPIED')?._count._all ?? 0;
  const totalListedRent = units.reduce((s, g) => s + num(g._sum.rentAmount), 0);

  // Per-property portfolio rows (units/occupancy/listed rent) are bounded by
  // the size of the owner's own portfolio.
  const properties = await prisma.property.findMany({
    where: propertyScope,
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      units: { select: { status: true, rentAmount: true } },
    },
  });
  // Managers on the owner's properties, for the landlord's "schedule a review" picker.
  const managers = await prisma.user.findMany({
    where: { managedProperties: { some: propertyScope } },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  const moneyByProperty = new Map(perPropertyMoney.map((r) => [r.propertyId, r]));

  return {
    properties: {
      count: propertyCount,
      rows: properties.map((p) => {
        const occupied = p.units.filter((u) => u.status === 'OCCUPIED').length;
        const money = moneyByProperty.get(p.id);
        return {
          id: p.id,
          name: p.name,
          units: p.units.length,
          occupied,
          occupancy: p.units.length > 0 ? Math.round((occupied / p.units.length) * 100) : 0,
          listedRent: p.units.reduce((s, u) => s + u.rentAmount, 0),
          collected: num(money?.collected),
          pending: num(money?.pending),
        };
      }),
    },
    units: {
      total: totalUnits,
      occupied: occupiedUnits,
      occupancyRate: totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0,
      totalListedRent,
    },
    managers,
    leases: { active: activeLeaseCount, upcomingRenewalCount },
    money: {
      collected: num(collectedAll._sum.amount),
      collectedThisMonth: num(collectedMonth._sum.amount),
      pending: num(pendingRows[0]?.pending),
      maintenanceCosts: num(maintenanceCosts._sum.finalCost),
    },
    maintenance: { pending: pendingMaintenance },
    upcomingRenewals,
    recentPayments: recentPayments.map((p) => ({
      id: p.id,
      amount: p.amount,
      paidAt: p.paidAt,
      invoiceNumber: p.invoice.invoiceNumber,
      type: p.invoice.type,
      leaseId: p.invoice.leaseId,
      tenant: p.invoice.lease?.tenant.name ?? null,
      property: p.invoice.lease?.unit.property.name ?? null,
    })),
    recentCompletedMaintenance,
    recentLeases,
  };
}

export async function adminDashboardSummary(now = new Date()) {
  const weekAgo = new Date(now.getTime() - 7 * MS_PER_DAY);

  const [
    usersByRole,
    newUsers,
    propertyCount,
    newProperties,
    collected,
    openMaintenance,
    pendingReview,
    overdueInvoices,
    cancelledMaintenance,
  ] = await Promise.all([
    prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
    prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.property.count(),
    prisma.property.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.payment.aggregate({ _sum: { amount: true } }),
    prisma.maintenanceRequest.count({ where: { status: { notIn: ['COMPLETED', 'CANCELLED'] } } }),
    prisma.property.findMany({
      where: { moderationStatus: 'PENDING_REVIEW' },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, name: true, createdAt: true },
    }),
    prisma.invoice.findMany({
      where: { status: 'OVERDUE' },
      orderBy: { dueDate: 'desc' },
      take: 5,
      select: { id: true, invoiceNumber: true, dueDate: true },
    }),
    prisma.maintenanceRequest.findMany({
      where: { status: 'CANCELLED' },
      orderBy: { updatedAt: 'desc' },
      take: 5,
      select: { id: true, title: true, updatedAt: true },
    }),
  ]);

  const byRole: Record<string, number> = {};
  for (const g of usersByRole) byRole[g.role] = g._count._all;
  const totalUsers = usersByRole.reduce((s, g) => s + g._count._all, 0);

  const attentionItems = [
    ...pendingReview.map((p) => ({
      title: `Property awaiting review: ${p.name}`,
      time: p.createdAt,
      severity: 'high' as const,
      href: '/admin/properties',
    })),
    ...overdueInvoices.map((i) => ({
      title: `Invoice ${i.invoiceNumber} overdue`,
      time: i.dueDate,
      severity: 'high' as const,
      href: null as string | null,
    })),
    ...cancelledMaintenance.map((r) => ({
      title: `Maintenance request cancelled: ${r.title}`,
      time: r.updatedAt,
      severity: 'medium' as const,
      href: null as string | null,
    })),
  ]
    .sort((a, b) => b.time.getTime() - a.time.getTime())
    .slice(0, 5);

  return {
    users: { total: totalUsers, byRole, newThisWeek: newUsers },
    properties: { total: propertyCount, newThisWeek: newProperties },
    money: { collected: num(collected._sum.amount) },
    maintenance: { open: openMaintenance },
    attentionItems,
  };
}

// ── Admin reports (ISS-049, part 2) ─────────────────────────────────────────
// Everything on the Reports page, computed in the database. Period-based
// series are bucketed by UTC month; the caller picks the month range.

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** `YYYY-MM` -> first instant of that month (UTC). */
function monthStart(key: string): Date {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1));
}

export function parseMonthRange(from: string | null, to: string | null) {
  if (!from || !to || !MONTH_RE.test(from) || !MONTH_RE.test(to)) return null;
  const start = monthStart(from);
  const endInclusive = monthStart(to);
  if (endInclusive < start) return null;
  const end = new Date(Date.UTC(endInclusive.getUTCFullYear(), endInclusive.getUTCMonth() + 1, 1));
  // A report window is a few months to a year; refuse anything silly.
  if (end.getTime() - start.getTime() > 400 * MS_PER_DAY) return null;
  return { start, end };
}

type MonthRow = { m: string; v: number };

export async function adminReportsSummary(start: Date, end: Date) {
  const [
    billedRows,
    collectedRows,
    newUserRows,
    createdRows,
    resolvedRows,
    revenueByType,
    paymentTotals,
    recentPayments,
    invoiceCounts,
    pendingRows,
    maintenanceByStatus,
    highPriorityOpen,
    resolution,
    usersByRoleStatus,
    propertyTotal,
    propertyApproved,
    propertiesByType,
    stateRows,
    unitTotals,
  ] = await Promise.all([
    prisma.$queryRaw<MonthRow[]>(Prisma.sql`
      SELECT to_char(date_trunc('month', "dueDate"), 'YYYY-MM') AS m, SUM("amount") AS v
      FROM "Invoice" WHERE "dueDate" >= ${start} AND "dueDate" < ${end} GROUP BY m`),
    prisma.$queryRaw<MonthRow[]>(Prisma.sql`
      SELECT to_char(date_trunc('month', "paidAt"), 'YYYY-MM') AS m, SUM("amount") AS v
      FROM "Payment" WHERE "paidAt" >= ${start} AND "paidAt" < ${end} GROUP BY m`),
    prisma.$queryRaw<{ m: string; role: string; v: number }[]>(Prisma.sql`
      SELECT to_char(date_trunc('month', "createdAt"), 'YYYY-MM') AS m, "role"::text AS role,
             COUNT(*)::int AS v
      FROM "User" WHERE "createdAt" >= ${start} AND "createdAt" < ${end} GROUP BY m, role`),
    prisma.$queryRaw<MonthRow[]>(Prisma.sql`
      SELECT to_char(date_trunc('month', "createdAt"), 'YYYY-MM') AS m, COUNT(*)::int AS v
      FROM "MaintenanceRequest" WHERE "createdAt" >= ${start} AND "createdAt" < ${end} GROUP BY m`),
    prisma.$queryRaw<MonthRow[]>(Prisma.sql`
      SELECT to_char(date_trunc('month', "completedAt"), 'YYYY-MM') AS m, COUNT(*)::int AS v
      FROM "MaintenanceRequest"
      WHERE "completedAt" IS NOT NULL AND "completedAt" >= ${start} AND "completedAt" < ${end}
      GROUP BY m`),
    prisma.$queryRaw<{ type: string; amount: number }[]>(Prisma.sql`
      SELECT i."type"::text AS type, SUM(p."amount") AS amount
      FROM "Payment" p JOIN "Invoice" i ON i."id" = p."invoiceId" GROUP BY i."type"`),
    prisma.payment.aggregate({ _sum: { amount: true }, _count: { _all: true } }),
    prisma.payment.findMany({
      orderBy: { paidAt: 'desc' },
      take: 50,
      select: {
        id: true,
        amount: true,
        paidAt: true,
        invoice: {
          select: {
            type: true,
            lease: {
              select: {
                tenant: { select: { name: true } },
                unit: { select: { property: { select: { name: true } } } },
              },
            },
          },
        },
      },
    }),
    prisma.invoice.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.$queryRaw<{ pending: number }[]>(Prisma.sql`
      SELECT COALESCE(SUM(GREATEST(0, i."amount" - COALESCE(p.paid, 0))), 0) AS pending
      FROM "Invoice" i
      LEFT JOIN (SELECT "invoiceId", SUM("amount") AS paid FROM "Payment" GROUP BY "invoiceId") p
        ON p."invoiceId" = i."id"
      WHERE i."status" NOT IN ('PAID', 'CANCELLED')`),
    prisma.maintenanceRequest.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.maintenanceRequest.count({
      where: {
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
        priority: { in: ['HIGH', 'EMERGENCY'] },
      },
    }),
    prisma.$queryRaw<{ days: number | null }[]>(Prisma.sql`
      SELECT AVG(EXTRACT(EPOCH FROM ("completedAt" - "createdAt")) / 86400) AS days
      FROM "MaintenanceRequest" WHERE "status" = 'COMPLETED' AND "completedAt" IS NOT NULL`),
    prisma.user.groupBy({ by: ['role', 'status'], _count: { _all: true } }),
    prisma.property.count(),
    prisma.property.count({ where: { moderationStatus: 'APPROVED' } }),
    prisma.property.groupBy({ by: ['type'], _count: { _all: true } }),
    prisma.$queryRaw<
      {
        state: string | null;
        total: number;
        approved: number;
        pending: number;
        units: number;
        occupied: number;
        avgRent: number | null;
      }[]
    >(Prisma.sql`
      SELECT pr."state" AS state,
        COUNT(DISTINCT pr."id")::int AS total,
        COUNT(DISTINCT pr."id") FILTER (WHERE pr."moderationStatus" = 'APPROVED')::int AS approved,
        COUNT(DISTINCT pr."id") FILTER (WHERE pr."moderationStatus" = 'PENDING_REVIEW')::int AS pending,
        COUNT(u."id")::int AS units,
        COUNT(u."id") FILTER (WHERE u."status" = 'OCCUPIED')::int AS occupied,
        AVG(u."rentAmount") AS "avgRent"
      FROM "Property" pr LEFT JOIN "Unit" u ON u."propertyId" = pr."id"
      GROUP BY pr."state"`),
    prisma.unit.aggregate({ _count: { _all: true }, _avg: { rentAmount: true } }),
  ]);

  const occupiedUnits = await prisma.unit.count({ where: { status: 'OCCUPIED' } });

  const byMonth = (rows: MonthRow[]) => Object.fromEntries(rows.map((r) => [r.m, num(r.v)]));
  const newUsersByMonth: Record<string, Record<string, number>> = {};
  for (const r of newUserRows) (newUsersByMonth[r.m] ??= {})[r.role] = num(r.v);

  const invoiceTotal = invoiceCounts.reduce((s, g) => s + g._count._all, 0);
  const cancelledInvoices = invoiceCounts.find((g) => g.status === 'CANCELLED')?._count._all ?? 0;
  const maintenanceCount = (status: string) =>
    maintenanceByStatus.find((g) => g.status === status)?._count._all ?? 0;
  const maintenanceTotal = maintenanceByStatus.reduce((s, g) => s + g._count._all, 0);

  const usersByRole: Record<string, number> = {};
  const statusByRole: Record<string, { active: number; pending: number; other: number }> = {};
  let usersTotal = 0;
  for (const g of usersByRoleStatus) {
    const n = g._count._all;
    usersTotal += n;
    usersByRole[g.role] = (usersByRole[g.role] ?? 0) + n;
    const row = (statusByRole[g.role] ??= { active: 0, pending: 0, other: 0 });
    if (g.status === 'ACTIVE') row.active += n;
    else if (g.status === 'PENDING_VERIFICATION') row.pending += n;
    else row.other += n;
  }

  return {
    totals: {
      collected: num(paymentTotals._sum.amount),
      paymentCount: paymentTotals._count._all,
      avgTransactionValue:
        paymentTotals._count._all > 0
          ? num(paymentTotals._sum.amount) / paymentTotals._count._all
          : 0,
      pending: num(pendingRows[0]?.pending),
      invoiceCount: invoiceTotal,
      cancelledInvoices,
    },
    series: {
      billed: byMonth(billedRows),
      collected: byMonth(collectedRows),
      newUsers: newUsersByMonth,
      maintenanceCreated: byMonth(createdRows),
      maintenanceResolved: byMonth(resolvedRows),
    },
    revenueByType: revenueByType.map((r) => ({ type: r.type, amount: num(r.amount) })),
    recentPayments: recentPayments.map((p) => ({
      id: p.id,
      amount: p.amount,
      paidAt: p.paidAt,
      type: p.invoice.type,
      tenant: p.invoice.lease?.tenant.name ?? null,
      property: p.invoice.lease?.unit.property.name ?? null,
    })),
    users: { total: usersTotal, byRole: usersByRole, statusByRole },
    maintenance: {
      total: maintenanceTotal,
      completed: maintenanceCount('COMPLETED'),
      open: maintenanceTotal - maintenanceCount('COMPLETED') - maintenanceCount('CANCELLED'),
      highPriorityOpen,
      avgResolutionDays: num(resolution[0]?.days),
    },
    properties: {
      total: propertyTotal,
      approved: propertyApproved,
      byType: Object.fromEntries(propertiesByType.map((g) => [g.type, g._count._all])),
      byState: stateRows.map((r) => ({
        state: r.state ?? 'Unknown',
        total: r.total,
        approved: r.approved,
        pending: r.pending,
        avgRent: num(r.avgRent),
        occupancy: r.units > 0 ? (r.occupied / r.units) * 100 : 0,
      })),
    },
    units: {
      total: unitTotals._count._all,
      occupied: occupiedUnits,
      avgOccupancy: unitTotals._count._all > 0 ? (occupiedUnits / unitTotals._count._all) * 100 : 0,
      avgRent: num(unitTotals._avg.rentAmount),
    },
  };
}
