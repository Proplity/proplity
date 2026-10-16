import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runOverdueFlagger } from '@/lib/workers/overdueFlagger';
import { prisma } from '@/lib/db';

vi.mock('@/lib/db', () => ({
  prisma: {
    invoice: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    notice: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}));

type InvoicesFindMany = Awaited<ReturnType<typeof prisma.invoice.findMany>>;
type InvoiceFindFirst = Awaited<ReturnType<typeof prisma.invoice.findFirst>>;

describe('Anomaly Testing: Financial Invariants and Overdue Calculations', () => {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('respects lease grace period: does not flag invoice before grace period expires', async () => {
    const now = new Date();
    // Due 2 days ago, but lease has 7 days grace period -> 5 days remaining in grace
    const candidateInvoice = {
      id: 'inv-grace',
      invoiceNumber: 'INV-1001',
      type: 'RENT',
      status: 'UNPAID',
      dueDate: new Date(now.getTime() - 2 * MS_PER_DAY),
      amount: 150_000,
      leaseId: 'lease-1',
      lease: {
        gracePeriodDays: 7,
        lateFeeType: 'PERCENTAGE',
        lateFeePercentage: 5,
        lateFeeFlatAmount: 0,
      },
    };

    vi.mocked(prisma.invoice.findMany).mockResolvedValueOnce([candidateInvoice] as unknown as InvoicesFindMany);

    const result = await runOverdueFlagger();
    expect(result.flagged).toBe(0);
    expect(result.lateFeesCreated).toBe(0);
    expect(prisma.invoice.update).not.toHaveBeenCalled();
  });

  it('flags invoice and generates percentage late fee once grace period expires', async () => {
    const now = new Date();
    // Due 10 days ago with 7 days grace period -> 3 days overdue past grace
    const candidateInvoice = {
      id: 'inv-overdue',
      invoiceNumber: 'INV-1002',
      type: 'RENT',
      status: 'UNPAID',
      dueDate: new Date(now.getTime() - 10 * MS_PER_DAY),
      amount: 200_000,
      leaseId: 'lease-2',
      lease: {
        gracePeriodDays: 7,
        lateFeeType: 'PERCENTAGE',
        lateFeePercentage: 5, // 5% of 200,000 = 10,000
        lateFeeFlatAmount: 0,
      },
    };

    vi.mocked(prisma.invoice.findMany).mockResolvedValueOnce([candidateInvoice] as unknown as InvoicesFindMany);
    vi.mocked(prisma.notice.findFirst).mockResolvedValueOnce(null);
    vi.mocked(prisma.invoice.findFirst).mockResolvedValueOnce(null); // No existing late fee

    const result = await runOverdueFlagger();
    expect(result.flagged).toBe(1);
    expect(result.remindersSent).toBe(1);
    expect(result.lateFeesCreated).toBe(1);

    expect(prisma.invoice.update).toHaveBeenCalledWith({
      where: { id: 'inv-overdue' },
      data: { status: 'OVERDUE' },
    });

    expect(prisma.invoice.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'LATE_FEE',
        amount: 10_000,
        leaseId: 'lease-2',
        description: expect.stringContaining('[late-fee-for:inv-overdue]'),
      }),
    });
  });

  it('generates FIXED late fee amount when lateFeeType is FIXED', async () => {
    const now = new Date();
    const candidateInvoice = {
      id: 'inv-fixed',
      invoiceNumber: 'INV-1003',
      type: 'RENT',
      status: 'OVERDUE',
      dueDate: new Date(now.getTime() - 15 * MS_PER_DAY),
      amount: 500_000,
      leaseId: 'lease-3',
      lease: {
        gracePeriodDays: 5,
        lateFeeType: 'FIXED',
        lateFeePercentage: 0,
        lateFeeFlatAmount: 15_000, // Flat 15,000
      },
    };

    vi.mocked(prisma.invoice.findMany).mockResolvedValueOnce([candidateInvoice] as unknown as InvoicesFindMany);
    vi.mocked(prisma.invoice.findFirst).mockResolvedValueOnce(null);

    const result = await runOverdueFlagger();
    expect(result.lateFeesCreated).toBe(1);

    expect(prisma.invoice.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'LATE_FEE',
        amount: 15_000,
      }),
    });
  });

  it('never assesses late fees on MAINTENANCE or SECURITY_DEPOSIT invoices', async () => {
    const now = new Date();
    const candidateMaintenance = {
      id: 'inv-maint',
      invoiceNumber: 'INV-1004',
      type: 'MAINTENANCE',
      status: 'UNPAID',
      dueDate: new Date(now.getTime() - 5 * MS_PER_DAY),
      amount: 45_000,
      leaseId: 'lease-4',
      lease: {
        gracePeriodDays: 0,
        lateFeeType: 'FIXED',
        lateFeeFlatAmount: 5000,
      },
    };

    vi.mocked(prisma.invoice.findMany).mockResolvedValueOnce([candidateMaintenance] as unknown as InvoicesFindMany);

    const result = await runOverdueFlagger();
    expect(result.flagged).toBe(1);
    expect(result.lateFeesCreated).toBe(0); // Late fee not created for maintenance
    expect(prisma.invoice.create).not.toHaveBeenCalled();
  });

  it('is strictly idempotent: does not duplicate late fees on consecutive worker passes', async () => {
    const now = new Date();
    const candidateInvoice = {
      id: 'inv-repeated',
      invoiceNumber: 'INV-1005',
      type: 'RENT',
      status: 'OVERDUE',
      dueDate: new Date(now.getTime() - 20 * MS_PER_DAY),
      amount: 100_000,
      leaseId: 'lease-5',
      lease: {
        gracePeriodDays: 5,
        lateFeeType: 'FIXED',
        lateFeeFlatAmount: 5000,
      },
    };

    vi.mocked(prisma.invoice.findMany).mockResolvedValueOnce([candidateInvoice] as unknown as InvoicesFindMany);
    // Simulate that late fee already exists with marker
    vi.mocked(prisma.invoice.findFirst).mockResolvedValueOnce({
      id: 'fee-existing',
      description: 'Late fee for [late-fee-for:inv-repeated]',
    } as unknown as InvoiceFindFirst);

    const result = await runOverdueFlagger();
    expect(result.lateFeesCreated).toBe(0);
    expect(prisma.invoice.create).not.toHaveBeenCalled();
  });
});
