import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';

// Server-side totals for the tenant and vendor dashboards (ISS-049): they only
// see their own records, but a long tenancy or a busy vendor passes one page
// (20) of invoices or jobs, so the totals are summed in the database.

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const num = (v: unknown) => Number(v ?? 0);

export async function tenantDashboardSummary(userId: string) {
  const mine: Prisma.InvoiceWhereInput = {
    OR: [{ lease: { tenantId: userId } }, { maintenanceRequest: { tenantId: userId } }, { userId }],
  };

  const [balanceRows, nextDue, payments] = await Promise.all([
    // Same rule the dashboard always used: every non-cancelled invoice, less
    // what has been paid against it.
    prisma.$queryRaw<{ balance: number }[]>(Prisma.sql`
      SELECT COALESCE(SUM(GREATEST(0, i."amount" - COALESCE(p.paid, 0))), 0) AS balance
      FROM "Invoice" i
      LEFT JOIN (SELECT "invoiceId", SUM("amount") AS paid FROM "Payment" GROUP BY "invoiceId") p
        ON p."invoiceId" = i."id"
      LEFT JOIN "Lease" l ON l."id" = i."leaseId"
      LEFT JOIN "MaintenanceRequest" m ON m."id" = i."maintenanceRequestId"
      WHERE i."status" <> 'CANCELLED'
        AND (l."tenantId" = ${userId} OR m."tenantId" = ${userId} OR i."userId" = ${userId})`),
    prisma.invoice.findFirst({
      where: { AND: [mine, { status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] } }] },
      orderBy: { dueDate: 'asc' },
      select: { id: true, dueDate: true, amount: true, status: true },
    }),
    prisma.payment.findMany({
      where: { invoice: mine },
      orderBy: { paidAt: 'desc' },
      take: 3,
      select: {
        id: true,
        amount: true,
        paidAt: true,
        invoice: { select: { invoiceNumber: true, type: true } },
      },
    }),
  ]);

  return {
    money: { balance: num(balanceRows[0]?.balance) },
    nextDue,
    recentPayments: payments.map((p) => ({
      id: p.id,
      amount: p.amount,
      paidAt: p.paidAt,
      invoiceNumber: p.invoice.invoiceNumber,
      type: p.invoice.type,
    })),
  };
}

export async function vendorDashboardSummary(userId: string, now = new Date()) {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const weekAgo = new Date(now.getTime() - 7 * MS_PER_DAY);
  const jobs: Prisma.MaintenanceRequestWhereInput = { vendorId: userId };

  const [byStatus, month, week, pending, paid, rating, onTime] = await Promise.all([
    prisma.maintenanceRequest.groupBy({ by: ['status'], where: jobs, _count: { _all: true } }),
    prisma.maintenanceRequest.aggregate({
      where: { ...jobs, status: 'COMPLETED', completedAt: { gte: monthStart } },
      _count: { _all: true },
      _sum: { finalCost: true },
    }),
    prisma.maintenanceRequest.aggregate({
      where: { ...jobs, status: 'COMPLETED', completedAt: { gte: weekAgo } },
      _count: { _all: true },
      _sum: { finalCost: true },
    }),
    prisma.invoice.aggregate({
      where: {
        maintenanceRequest: { ...jobs, status: 'COMPLETED' },
        status: { notIn: ['PAID', 'CANCELLED'] },
      },
      _sum: { amount: true },
    }),
    prisma.invoice.aggregate({
      where: { maintenanceRequest: { ...jobs, status: 'COMPLETED' }, status: 'PAID' },
      _sum: { amount: true },
    }),
    prisma.vendorRating.aggregate({
      where: { vendorId: userId },
      _avg: { rating: true },
      _count: { _all: true },
    }),
    prisma.$queryRaw<{ eligible: number; onTime: number }[]>(Prisma.sql`
      SELECT COUNT(*)::int AS eligible,
             COUNT(*) FILTER (WHERE "completedAt" <= "scheduledFor")::int AS "onTime"
      FROM "MaintenanceRequest"
      WHERE "vendorId" = ${userId} AND "status" = 'COMPLETED'
        AND "scheduledFor" IS NOT NULL AND "completedAt" IS NOT NULL`),
  ]);

  const count = (s: string) => byStatus.find((g) => g.status === s)?._count._all ?? 0;
  const total = byStatus.reduce((n, g) => n + g._count._all, 0);
  const completed = count('COMPLETED');
  const eligible = onTime[0]?.eligible ?? 0;

  return {
    jobs: {
      total,
      scheduled: count('SCHEDULED'),
      inProgress: count('IN_PROGRESS'),
      completed,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      onTimeRate: eligible > 0 ? Math.round(((onTime[0]?.onTime ?? 0) / eligible) * 100) : null,
    },
    earnings: {
      completedThisMonth: month._count._all,
      thisMonth: num(month._sum.finalCost),
      completedThisWeek: week._count._all,
      thisWeek: num(week._sum.finalCost),
      pendingPayments: num(pending._sum.amount),
      totalPaid: num(paid._sum.amount),
    },
    rating: { average: rating._avg.rating, count: rating._count._all },
  };
}
