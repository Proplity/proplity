import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runOverdueFlagger } from '@/lib/workers/overdueFlagger';
import { runAutopayCharger } from '@/lib/workers/autopayCharger';
import { prisma } from '@/lib/db';

vi.mock('@/lib/db', () => {
  const mockDb = {
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
    autoPayMandate: {
      update: vi.fn(),
      // the charger claims a mandate before charging it
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    payment: {
      create: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    // The charger reads the platform settings (the admin switch) first; tests set what they need.
    systemSettings: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(async (callback: (tx: typeof mockDb) => Promise<unknown>) =>
      callback(mockDb),
    ),
  };
  return { prisma: mockDb };
});

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

    vi.mocked(prisma.invoice.findMany).mockResolvedValueOnce([
      candidateInvoice,
    ] as unknown as InvoicesFindMany);

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

    vi.mocked(prisma.invoice.findMany).mockResolvedValueOnce([
      candidateInvoice,
    ] as unknown as InvoicesFindMany);
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

    vi.mocked(prisma.invoice.findMany).mockResolvedValueOnce([
      candidateInvoice,
    ] as unknown as InvoicesFindMany);
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

    vi.mocked(prisma.invoice.findMany).mockResolvedValueOnce([
      candidateMaintenance,
    ] as unknown as InvoicesFindMany);

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

    vi.mocked(prisma.invoice.findMany).mockResolvedValueOnce([
      candidateInvoice,
    ] as unknown as InvoicesFindMany);
    // Simulate that late fee already exists with marker
    vi.mocked(prisma.invoice.findFirst).mockResolvedValueOnce({
      id: 'fee-existing',
      description: 'Late fee for [late-fee-for:inv-repeated]',
    } as unknown as InvoiceFindFirst);

    const result = await runOverdueFlagger();
    expect(result.lateFeesCreated).toBe(0);
    expect(prisma.invoice.create).not.toHaveBeenCalled();
  });

  describe('Auto-Pay Mandate Recurring Charging Worker (ISS-011)', () => {
    it('runs in disabled mode by default: audits eligible invoices and makes zero mutations', async () => {
      const originalEnv = process.env.AUTOPAY_WORKER_ENABLED;
      delete process.env.AUTOPAY_WORKER_ENABLED;

      const dueInvoice = {
        id: 'inv-due-1',
        amount: 250_000,
        leaseId: 'lease-autopay-1',
        status: 'UNPAID',
        dueDate: new Date(Date.now() - MS_PER_DAY),
        payments: [],
        lease: {
          id: 'lease-autopay-1',
          status: 'ACTIVE',
          tenantId: 'tenant-123',
          tenant: { id: 'tenant-123', email: 'tenant@example.com', name: 'Test Tenant' },
          autoPayMandates: [
            {
              id: 'mandate-1',
              status: 'ACTIVE',
              paymentMethodToken: 'AUTH_test_card_token_123',
            },
          ],
        },
      };

      vi.mocked(prisma.invoice.findMany).mockResolvedValueOnce([
        dueInvoice,
      ] as unknown as InvoicesFindMany);

      const result = await runAutopayCharger();

      expect(result.enabled).toBe(false);
      expect(result.eligibleCount).toBe(1);
      expect(result.processedCount).toBe(0);
      expect(result.successfulCount).toBe(0);
      expect(result.details[0].status).toBe('DISABLED');
      expect(result.details[0].amount).toBe(250_000);
      expect(prisma.invoice.update).not.toHaveBeenCalled();

      process.env.AUTOPAY_WORKER_ENABLED = originalEnv;
    });

    it('processes eligible due invoice when enabled in mock gateway environment', async () => {
      const originalEnv = process.env.AUTOPAY_WORKER_ENABLED;
      const originalMock = process.env.NEXT_PUBLIC_PAYMENTS_MOCK_ENABLED;
      process.env.AUTOPAY_WORKER_ENABLED = 'true';
      process.env.NEXT_PUBLIC_PAYMENTS_MOCK_ENABLED = 'true';
      // Both gates open: the deployment allows it and an admin switched it on (ADR-0015).
      vi.mocked(prisma.systemSettings.findUnique).mockResolvedValueOnce({
        autopayChargingEnabled: true,
      } as Awaited<ReturnType<typeof prisma.systemSettings.findUnique>>);

      const dueInvoice = {
        id: 'inv-due-2',
        amount: 300_000,
        leaseId: 'lease-autopay-2',
        status: 'OVERDUE',
        dueDate: new Date(Date.now() - 3 * MS_PER_DAY),
        payments: [],
        lease: {
          id: 'lease-autopay-2',
          status: 'ACTIVE',
          tenantId: 'tenant-456',
          tenant: { id: 'tenant-456', email: 'autopay@example.com', name: 'Autopay User' },
          autoPayMandates: [
            {
              id: 'mandate-2',
              status: 'ACTIVE',
              paymentMethodToken: 'AUTH_valid_token_456',
            },
          ],
        },
      };

      vi.mocked(prisma.invoice.findMany).mockResolvedValueOnce([
        dueInvoice,
      ] as unknown as InvoicesFindMany);

      const result = await runAutopayCharger();

      expect(result.enabled).toBe(true);
      expect(result.processedCount).toBe(1);
      expect(result.successfulCount).toBe(1);
      expect(result.failedCount).toBe(0);
      expect(result.details[0].status).toBe('SUCCESS');

      process.env.AUTOPAY_WORKER_ENABLED = originalEnv;
      process.env.NEXT_PUBLIC_PAYMENTS_MOCK_ENABLED = originalMock;
    });

    // Charging needs BOTH gates open (ADR-0015): the environment allows it and an admin has
    // switched it on. Either one closed, and the job only reports.
    it.each([
      { name: 'the admin switch is off', env: 'true', switchedOn: false },
      { name: 'the deployment does not allow it', env: undefined, switchedOn: true },
    ])('does not charge when $name', async ({ env, switchedOn }) => {
      const originalEnv = process.env.AUTOPAY_WORKER_ENABLED;
      if (env === undefined) delete process.env.AUTOPAY_WORKER_ENABLED;
      else process.env.AUTOPAY_WORKER_ENABLED = env;
      vi.mocked(prisma.systemSettings.findUnique).mockResolvedValueOnce({
        autopayChargingEnabled: switchedOn,
      } as Awaited<ReturnType<typeof prisma.systemSettings.findUnique>>);
      vi.mocked(prisma.invoice.update).mockClear();
      vi.mocked(prisma.payment.create).mockClear();

      vi.mocked(prisma.invoice.findMany).mockResolvedValueOnce([
        {
          id: 'inv-gate',
          amount: 100_000,
          leaseId: 'lease-gate',
          status: 'UNPAID',
          dueDate: new Date(Date.now() - MS_PER_DAY),
          payments: [],
          lease: {
            id: 'lease-gate',
            status: 'ACTIVE',
            tenantId: 'tenant-gate',
            tenant: { id: 'tenant-gate', email: 'gate@example.com', name: 'Gate' },
            autoPayMandates: [{ id: 'm-gate', status: 'ACTIVE', paymentMethodToken: 'AUTH_x' }],
          },
        },
      ] as unknown as InvoicesFindMany);

      const result = await runAutopayCharger();

      expect(result.enabled).toBe(false);
      expect(result.processedCount).toBe(0);
      expect(result.message).toMatch(/Platform Settings/);
      expect(prisma.invoice.update).not.toHaveBeenCalled();
      expect(prisma.payment.create).not.toHaveBeenCalled();

      if (originalEnv === undefined) delete process.env.AUTOPAY_WORKER_ENABLED;
      else process.env.AUTOPAY_WORKER_ENABLED = originalEnv;
    });
  });
});
