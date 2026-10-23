import { createHmac } from 'crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { Role, InvoiceType, InvoiceStatus } from '@prisma/client';
import { resetDb, testPrisma } from '../helpers/db';
import {
  createUser,
  createProperty,
  createUnit,
  createRent,
  createInvoice,
  createMaintenanceRequest,
  createBankAccount,
  setSystemSettings,
} from '../helpers/fixtures';
import { authCookie } from '../helpers/auth';
import { apiFetch } from '../helpers/client';

const CRON_SECRET = 'test_only_cron_secret_do_not_use_in_production';
const PAYSTACK_KEY = 'test_only_paystack_secret_do_not_use_in_production';

async function jobSetup(opts: { cost?: number } = {}) {
  const landlord = await createUser(Role.LANDLORD);
  const vendor = await createUser(Role.VENDOR);
  const tenant = await createUser(Role.TENANT);
  await createBankAccount(vendor.id);
  const property = await createProperty({ landlordId: landlord.id });
  const unit = await createUnit(property.id);
  const mr = await createMaintenanceRequest(unit.id, tenant.id, { vendorId: vendor.id });
  if (opts.cost !== undefined) {
    await testPrisma.maintenanceRequest.update({
      where: { id: mr.id },
      data: { finalCost: opts.cost },
    });
  }
  const invoice = await createInvoice({
    maintenanceRequestId: mr.id,
    amount: 40_000,
    type: InvoiceType.MAINTENANCE,
    status: InvoiceStatus.PAID,
  });
  return { landlord, vendor, tenant, property, unit, mr, invoice };
}

describe('vendor payouts: safety (ISS-062, ISS-063, ISS-064)', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('only the vendor assigned to the job can be paid for it', async () => {
    const { landlord, mr, invoice } = await jobSetup();
    const other = await createUser(Role.VENDOR);
    await createBankAccount(other.id);
    const res = await apiFetch('/api/v1/vendor-payouts', {
      method: 'POST',
      cookie: await authCookie(landlord.id, landlord.role),
      body: {
        vendorId: other.id,
        invoiceId: invoice.id,
        maintenanceRequestId: mr.id,
        amount: 1000,
      },
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('assigned');
  });

  it('a payout with no invoice needs a recorded job cost and cannot exceed it', async () => {
    const noCost = await jobSetup();
    const lcookie = await authCookie(noCost.landlord.id, noCost.landlord.role);
    const a = await apiFetch('/api/v1/vendor-payouts', {
      method: 'POST',
      cookie: lcookie,
      body: { vendorId: noCost.vendor.id, maintenanceRequestId: noCost.mr.id, amount: 100 },
    });
    expect(a.status).toBe(400);

    const costed = await jobSetup({ cost: 5000 });
    const c2 = await authCookie(costed.landlord.id, costed.landlord.role);
    const ok = await apiFetch('/api/v1/vendor-payouts', {
      method: 'POST',
      cookie: c2,
      body: { vendorId: costed.vendor.id, maintenanceRequestId: costed.mr.id, amount: 4000 },
    });
    expect(ok.status).toBe(201);
    const over = await apiFetch('/api/v1/vendor-payouts', {
      method: 'POST',
      cookie: c2,
      body: { vendorId: costed.vendor.id, maintenanceRequestId: costed.mr.id, amount: 2000 },
    });
    expect(over.status).toBe(400);
    expect(over.body.error).toContain('cannot exceed');
  });

  it('parallel payout requests cannot together exceed the invoice amount', async () => {
    const { landlord, vendor, invoice } = await jobSetup();
    const cookie = await authCookie(landlord.id, landlord.role);
    const attempts = await Promise.all(
      [1, 2, 3].map(() =>
        apiFetch('/api/v1/vendor-payouts', {
          method: 'POST',
          cookie,
          body: { vendorId: vendor.id, invoiceId: invoice.id, amount: 25_000 },
        }),
      ),
    );
    expect(attempts.filter((r) => r.status === 201).length).toBe(1);
    const rows = await testPrisma.vendorPayout.findMany({ where: { invoiceId: invoice.id } });
    expect(rows.length).toBe(1);
  });

  it('processing the same payout twice at once disburses it once', async () => {
    const { landlord, vendor, invoice } = await jobSetup();
    const cookie = await authCookie(landlord.id, landlord.role);
    const created = await apiFetch('/api/v1/vendor-payouts', {
      method: 'POST',
      cookie,
      body: { vendorId: vendor.id, invoiceId: invoice.id, amount: 30_000 },
    });
    expect(created.status).toBe(201);
    const id = created.body.data.id;
    const runs = await Promise.all(
      [1, 2].map(() =>
        apiFetch(`/api/v1/vendor-payouts/${id}`, {
          method: 'PATCH',
          cookie,
          body: { action: 'PROCESS' },
        }),
      ),
    );
    expect(runs.map((r) => r.status).sort()).toEqual([200, 409]);
    const audits = await testPrisma.auditLog.count({
      where: { entityId: id, action: 'VENDOR_PAYOUT_COMPLETED' },
    });
    expect(audits).toBe(1);
  });

  it('transfer webhooks settle a PROCESSING payout and a reversal fails it', async () => {
    const { landlord, vendor, invoice } = await jobSetup();
    const payout = await testPrisma.vendorPayout.create({
      data: {
        vendorId: vendor.id,
        invoiceId: invoice.id,
        amount: 10_000,
        status: 'PROCESSING',
        reference: `po-test-${Date.now()}`,
        initiatedById: landlord.id,
      },
    });
    const send = (event: string) => {
      const rawBody = JSON.stringify({ event, data: { reference: payout.reference } });
      return apiFetch('/api/v1/payments/webhook', {
        method: 'POST',
        rawBody,
        headers: {
          'x-paystack-signature': createHmac('sha512', PAYSTACK_KEY).update(rawBody).digest('hex'),
        },
      });
    };
    expect((await send('transfer.success')).status).toBe(200);
    expect((await testPrisma.vendorPayout.findUnique({ where: { id: payout.id } }))?.status).toBe(
      'COMPLETED',
    );
    expect((await send('transfer.reversed')).status).toBe(200);
    expect((await testPrisma.vendorPayout.findUnique({ where: { id: payout.id } }))?.status).toBe(
      'FAILED',
    );
  });
});

describe('bank transfer proofs: safety (ISS-066)', () => {
  beforeAll(async () => {
    await resetDb();
  });

  async function pendingProof(amount: number, invoiceAmount = 50_000) {
    const landlord = await createUser(Role.LANDLORD);
    const tenant = await createUser(Role.TENANT);
    const property = await createProperty({ landlordId: landlord.id });
    const unit = await createUnit(property.id);
    const rent = await createRent(unit.id, tenant.id);
    const invoice = await createInvoice({ rentId: rent.id, amount: invoiceAmount });
    const sub = await testPrisma.bankTransferSubmission.create({
      data: {
        invoiceId: invoice.id,
        submittedById: tenant.id,
        amount,
        bankName: 'Test Bank',
        senderAccountName: 'Tenant',
        referenceNumber: `REF-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        paymentDate: new Date(),
        status: 'PENDING',
      },
    });
    return { landlord, invoice, sub, cookie: await authCookie(landlord.id, landlord.role) };
  }

  it('refuses to approve a transfer larger than the outstanding balance', async () => {
    const { sub, cookie } = await pendingProof(80_000);
    const res = await apiFetch(`/api/v1/bank-transfers/${sub.id}/reconcile`, {
      method: 'POST',
      cookie,
      body: { action: 'APPROVE' },
    });
    expect(res.status).toBe(409);
    expect(res.body.error).toContain('outstanding balance');
  });

  it('an approve and a reject racing leave one consistent outcome', async () => {
    const { sub, invoice, cookie } = await pendingProof(50_000);
    const results = await Promise.all([
      apiFetch(`/api/v1/bank-transfers/${sub.id}/reconcile`, {
        method: 'POST',
        cookie,
        body: { action: 'APPROVE' },
      }),
      apiFetch(`/api/v1/bank-transfers/${sub.id}/reconcile`, {
        method: 'POST',
        cookie,
        body: { action: 'REJECT', rejectionReason: 'Not found' },
      }),
    ]);
    expect(results.filter((r) => r.status === 200).length).toBe(1);
    const row = await testPrisma.bankTransferSubmission.findUnique({ where: { id: sub.id } });
    const payments = await testPrisma.payment.count({ where: { invoiceId: invoice.id } });
    // approved <=> a payment exists
    expect(row?.status === 'APPROVED').toBe(payments === 1);
  });

  it('a second approval of the same proof is refused', async () => {
    const { sub, cookie } = await pendingProof(50_000);
    const first = await apiFetch(`/api/v1/bank-transfers/${sub.id}/reconcile`, {
      method: 'POST',
      cookie,
      body: { action: 'APPROVE' },
    });
    expect(first.status).toBe(200);
    const second = await apiFetch(`/api/v1/bank-transfers/${sub.id}/reconcile`, {
      method: 'POST',
      cookie,
      body: { action: 'APPROVE' },
    });
    expect(second.status).toBe(409);
  });
});

describe('auto-pay charger: safety (ISS-065)', () => {
  beforeAll(async () => {
    await resetDb();
    // The test server allows charging (AUTOPAY_WORKER_ENABLED); the admin switch is the second gate.
    await setSystemSettings({ autopayChargingEnabled: true });
  });

  function runWorker() {
    return apiFetch('/api/v1/cron/autopay-charger', {
      method: 'POST',
      headers: { 'x-cron-secret': CRON_SECRET },
    });
  }

  async function dueInvoice(token = 'AUTH_test') {
    const landlord = await createUser(Role.LANDLORD);
    const tenant = await createUser(Role.TENANT);
    const property = await createProperty({ landlordId: landlord.id });
    const unit = await createUnit(property.id);
    const rent = await createRent(unit.id, tenant.id);
    await testPrisma.rent.update({ where: { id: rent.id }, data: { status: 'ACTIVE' } });
    const mandate = await testPrisma.autoPayMandate.create({
      data: { rentId: rent.id, paymentMethodToken: token },
    });
    const invoice = await createInvoice({
      rentId: rent.id,
      amount: 60_000,
      dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });
    return { tenant, mandate, invoice };
  }

  it('overlapping runs charge an invoice once', async () => {
    const { invoice } = await dueInvoice();
    await Promise.all([runWorker(), runWorker()]);
    const payments = await testPrisma.payment.findMany({ where: { invoiceId: invoice.id } });
    expect(payments.length).toBe(1);
    expect(payments[0].transactionRef).toContain(invoice.id);
    expect((await testPrisma.invoice.findUnique({ where: { id: invoice.id } }))?.status).toBe(
      'PAID',
    );
  });

  it('a declined card is counted, the tenant is told, and the mandate pauses after 3 declines', async () => {
    const { tenant, mandate } = await dueInvoice('DECLINE_TEST');
    for (let i = 0; i < 3; i++) {
      await testPrisma.autoPayMandate.update({
        where: { id: mandate.id },
        data: { lastAttemptAt: null },
      });
      await runWorker();
    }
    const row = await testPrisma.autoPayMandate.findUnique({ where: { id: mandate.id } });
    expect(row?.consecutiveFailures).toBe(3);
    expect(row?.status).toBe('PAUSED');
    const notes = await testPrisma.notification.count({ where: { recipientId: tenant.id } });
    expect(notes).toBeGreaterThanOrEqual(3);
  });
});
