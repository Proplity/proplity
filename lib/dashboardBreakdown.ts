import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';

// Server-side numbers for the pages opened from a dashboard card (ISS-049).
// The long tables on those pages are paged lists; everything that is a total,
// bucket or chart comes from here so it stays right at any size.

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const num = (v: unknown) => Number(v ?? 0);

export async function ownerBreakdownSummary(userId: string, now = new Date()) {
  const scope = { OR: [{ managerId: userId }, { landlordId: userId }] };
  const propertySql = Prisma.sql`(pr."managerId" = ${userId} OR pr."landlordId" = ${userId})`;
  const invoiceWhere: Prisma.InvoiceWhereInput = {
    OR: [
      { rent: { unit: { property: scope } } },
      { maintenanceRequest: { unit: { property: scope } } },
    ],
  };
  const sixMonthsAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  const [
    properties,
    rentStatusCounts,
    unpaidRentRows,
    collectedAll,
    collectedMonth,
    pendingRows,
    billedRows,
    collectedRows,
    byPropertyRows,
    methodRows,
    openByPriority,
    renewals,
    payments,
  ] = await Promise.all([
    prisma.property.findMany({ where: scope, select: { units: { select: { status: true } } } }),
    prisma.rent.groupBy({
      by: ['status'],
      where: { unit: { property: scope } },
      _count: { _all: true },
    }),
    // Earliest unpaid due date per active rent -> due / overdue.
    prisma.$queryRaw<{ rentId: string; due: Date }[]>(Prisma.sql`
      SELECT i."rentId" AS "rentId", MIN(i."dueDate") AS due
      FROM "Invoice" i
      JOIN "Rent" l ON l."id" = i."rentId" AND l."status" = 'ACTIVE'
      JOIN "Unit" u ON u."id" = l."unitId"
      JOIN "Property" pr ON pr."id" = u."propertyId"
      WHERE i."status" NOT IN ('PAID', 'CANCELLED') AND ${propertySql}
      GROUP BY i."rentId"`),
    prisma.payment.aggregate({ _sum: { amount: true }, where: { invoice: invoiceWhere } }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { invoice: invoiceWhere, paidAt: { gte: monthStart, lt: monthEnd } },
    }),
    prisma.$queryRaw<{ pending: number }[]>(Prisma.sql`
      SELECT COALESCE(SUM(GREATEST(0, i."amount" - COALESCE(p.paid, 0))), 0) AS pending
      FROM "Invoice" i
      LEFT JOIN (SELECT "invoiceId", SUM("amount") AS paid FROM "Payment" GROUP BY "invoiceId") p
        ON p."invoiceId" = i."id"
      WHERE i."status" NOT IN ('PAID', 'CANCELLED')
        AND (
          i."rentId" IN (SELECT l."id" FROM "Rent" l JOIN "Unit" u ON u."id" = l."unitId"
            JOIN "Property" pr ON pr."id" = u."propertyId" WHERE ${propertySql})
          OR i."maintenanceRequestId" IN (SELECT m."id" FROM "MaintenanceRequest" m
            JOIN "Unit" u ON u."id" = m."unitId" JOIN "Property" pr ON pr."id" = u."propertyId"
            WHERE ${propertySql})
        )`),
    prisma.$queryRaw<{ m: string; v: number }[]>(Prisma.sql`
      SELECT to_char(date_trunc('month', i."dueDate"), 'YYYY-MM') AS m, SUM(i."amount") AS v
      FROM "Invoice" i
      JOIN "Rent" l ON l."id" = i."rentId" JOIN "Unit" u ON u."id" = l."unitId"
      JOIN "Property" pr ON pr."id" = u."propertyId"
      WHERE i."dueDate" >= ${sixMonthsAgo} AND i."dueDate" < ${monthEnd} AND ${propertySql}
      GROUP BY m`),
    prisma.$queryRaw<{ m: string; v: number }[]>(Prisma.sql`
      SELECT to_char(date_trunc('month', p."paidAt"), 'YYYY-MM') AS m, SUM(p."amount") AS v
      FROM "Payment" p
      JOIN "Invoice" i ON i."id" = p."invoiceId"
      JOIN "Rent" l ON l."id" = i."rentId" JOIN "Unit" u ON u."id" = l."unitId"
      JOIN "Property" pr ON pr."id" = u."propertyId"
      WHERE p."paidAt" >= ${sixMonthsAgo} AND p."paidAt" < ${monthEnd} AND ${propertySql}
      GROUP BY m`),
    prisma.$queryRaw<{ name: string; amount: number }[]>(Prisma.sql`
      SELECT pr."name" AS name, SUM(p."amount") AS amount
      FROM "Payment" p
      JOIN "Invoice" i ON i."id" = p."invoiceId"
      JOIN "Rent" l ON l."id" = i."rentId" JOIN "Unit" u ON u."id" = l."unitId"
      JOIN "Property" pr ON pr."id" = u."propertyId"
      WHERE ${propertySql}
      GROUP BY pr."id", pr."name" ORDER BY amount DESC LIMIT 12`),
    prisma.payment.groupBy({
      by: ['paymentMethod'],
      where: { invoice: invoiceWhere },
      _count: { _all: true },
    }),
    prisma.maintenanceRequest.groupBy({
      by: ['priority'],
      where: { status: { notIn: ['COMPLETED', 'CANCELLED'] }, unit: { property: scope } },
      _count: { _all: true },
    }),
    prisma.rent.findMany({
      where: {
        status: 'ACTIVE',
        unit: { property: scope },
        endDate: { gte: now, lte: new Date(now.getTime() + 180 * MS_PER_DAY) },
      },
      orderBy: { endDate: 'asc' },
      take: 200,
      select: {
        id: true,
        endDate: true,
        rentAmount: true,
        tenant: { select: { name: true } },
        unit: { select: { unitNumber: true, property: { select: { name: true } } } },
      },
    }),
    prisma.payment.findMany({
      where: { invoice: invoiceWhere },
      orderBy: { paidAt: 'desc' },
      take: 100,
      select: {
        id: true,
        amount: true,
        paidAt: true,
        paymentMethod: true,
        invoice: {
          select: {
            rent: {
              select: {
                tenant: { select: { name: true } },
                unit: { select: { property: { select: { name: true } } } },
              },
            },
          },
        },
      },
    }),
  ]);

  // Properties by occupancy.
  let fully = 0;
  let partial = 0;
  for (const p of properties) {
    const occupied = p.units.filter((u) => u.status === 'OCCUPIED').length;
    if (p.units.length > 0 && occupied === p.units.length) fully++;
    else if (occupied > 0) partial++;
  }

  const rentCount = (...s: string[]) =>
    rentStatusCounts.filter((g) => s.includes(g.status)).reduce((n, g) => n + g._count._all, 0);
  const activeRents = rentCount('ACTIVE');

  // Rent status of active rents; rents with no unpaid invoice are "paid".
  const rentStatusByRent: Record<string, 'due' | 'overdue'> = {};
  for (const r of unpaidRentRows) {
    rentStatusByRent[r.rentId] = new Date(r.due) < now ? 'overdue' : 'due';
  }
  const overdue = Object.values(rentStatusByRent).filter((s) => s === 'overdue').length;
  const due = Object.values(rentStatusByRent).length - overdue;

  const collected = num(collectedAll._sum.amount);
  const pending = num(pendingRows[0]?.pending);
  const priority = (...p: string[]) =>
    openByPriority.filter((g) => p.includes(g.priority)).reduce((n, g) => n + g._count._all, 0);

  const billedBy = Object.fromEntries(billedRows.map((r) => [r.m, num(r.v)]));
  const collectedBy = Object.fromEntries(collectedRows.map((r) => [r.m, num(r.v)]));
  const trend = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (5 - i), 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    return {
      month: d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }),
      expected: billedBy[key] ?? 0,
      collected: collectedBy[key] ?? 0,
    };
  });

  const renewalRows = renewals.map((l) => ({
    id: l.id,
    endDate: l.endDate,
    rentAmount: l.rentAmount,
    tenant: l.tenant?.name ?? null,
    property: l.unit?.property?.name ?? null,
    unitNumber: l.unit?.unitNumber ?? null,
    daysLeft: Math.ceil((l.endDate.getTime() - now.getTime()) / MS_PER_DAY),
  }));

  return {
    properties: {
      count: properties.length,
      fully,
      partial,
      vacant: properties.length - fully - partial,
    },
    rents: {
      active: activeRents,
      terminated: rentCount('TERMINATED', 'EXPIRED'),
      paid: activeRents - due - overdue,
      due,
      overdue,
      rentStatusByRent,
    },
    money: {
      collected,
      collectedThisMonth: num(collectedMonth._sum.amount),
      pending,
      collectionRate:
        collected + pending > 0 ? Math.round((collected / (collected + pending)) * 100) : 0,
      paymentCount: methodRows.reduce((n, r) => n + r._count._all, 0),
      trend,
      byProperty: byPropertyRows.map((r) => ({ name: r.name, amount: num(r.amount) })),
      methods: methodRows.map((r) => ({ name: r.paymentMethod, count: r._count._all })),
    },
    maintenance: {
      open: priority('LOW', 'MEDIUM', 'HIGH', 'EMERGENCY'),
      high: priority('HIGH', 'EMERGENCY'),
      medium: priority('MEDIUM'),
      low: priority('LOW'),
    },
    renewals: {
      count: renewalRows.length,
      urgent: renewalRows.filter((r) => r.daysLeft < 30).length,
      soon: renewalRows.filter((r) => r.daysLeft >= 30 && r.daysLeft < 90).length,
      later: renewalRows.filter((r) => r.daysLeft >= 90).length,
      rows: renewalRows,
    },
    payments: payments.map((p) => ({
      id: p.id,
      amount: p.amount,
      paidAt: p.paidAt,
      method: p.paymentMethod,
      tenant: p.invoice.rent?.tenant.name ?? null,
      property: p.invoice.rent?.unit.property.name ?? null,
    })),
  };
}

/** Platform-wide counts and totals behind the admin dashboard cards. */
export async function adminBreakdownSummary() {
  const [users, moderation, collected, pendingRows, cancelled, openByPriority, payments] =
    await Promise.all([
      prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
      prisma.property.groupBy({ by: ['moderationStatus'], _count: { _all: true } }),
      prisma.payment.aggregate({ _sum: { amount: true }, _count: { _all: true } }),
      prisma.$queryRaw<{ pending: number }[]>(Prisma.sql`
        SELECT COALESCE(SUM(GREATEST(0, i."amount" - COALESCE(p.paid, 0))), 0) AS pending
        FROM "Invoice" i
        LEFT JOIN (SELECT "invoiceId", SUM("amount") AS paid FROM "Payment" GROUP BY "invoiceId") p
          ON p."invoiceId" = i."id"
        WHERE i."status" NOT IN ('PAID', 'CANCELLED')`),
      prisma.invoice.aggregate({ _sum: { amount: true }, where: { status: 'CANCELLED' } }),
      prisma.maintenanceRequest.groupBy({
        by: ['priority'],
        where: { status: { notIn: ['COMPLETED', 'CANCELLED'] } },
        _count: { _all: true },
      }),
      prisma.payment.count(),
    ]);

  const role = (r: string) => users.find((g) => g.role === r)?._count._all ?? 0;
  const mod = (...s: string[]) =>
    moderation.filter((g) => s.includes(g.moderationStatus)).reduce((n, g) => n + g._count._all, 0);
  const prio = (...p: string[]) =>
    openByPriority.filter((g) => p.includes(g.priority)).reduce((n, g) => n + g._count._all, 0);

  return {
    users: {
      total: users.reduce((n, g) => n + g._count._all, 0),
      manager: role('MANAGER'),
      landlord: role('LANDLORD'),
      tenant: role('TENANT'),
      vendor: role('VENDOR'),
    },
    properties: {
      total: moderation.reduce((n, g) => n + g._count._all, 0),
      approved: mod('APPROVED'),
      pending: mod('PENDING_REVIEW'),
      flagged: mod('FLAGGED', 'REJECTED'),
    },
    money: {
      collected: num(collected._sum.amount),
      pending: num(pendingRows[0]?.pending),
      cancelled: num(cancelled._sum.amount),
      paymentCount: payments,
    },
    maintenance: {
      open: prio('LOW', 'MEDIUM', 'HIGH', 'EMERGENCY'),
      high: prio('HIGH', 'EMERGENCY'),
      medium: prio('MEDIUM'),
      low: prio('LOW'),
    },
  };
}
