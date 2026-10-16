import crypto from 'crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { Role } from '@prisma/client';
import { resetDb, testPrisma } from '../helpers/db';
import {
  createUser,
  createProperty,
  createUnit,
  createLease,
  createMaintenanceRequest,
  createInvoice,
} from '../helpers/fixtures';
import { authCookie } from '../helpers/auth';
import { apiFetch } from '../helpers/client';

function signWebhookBody(rawBody: string) {
  const secret = process.env.PAYSTACK_SECRET_KEY!;
  return crypto.createHmac('sha512', secret).update(rawBody).digest('hex');
}

describe('invoices: list scoping', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('scopes by role across lease/maintenanceRequest/userId, and admin sees all', async () => {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });
    const unit = await createUnit(property.id);
    const tenant = await createUser(Role.TENANT);
    const lease = await createLease(unit.id, tenant.id);
    const vendor = await createUser(Role.VENDOR);
    const request = await createMaintenanceRequest(unit.id, tenant.id, { vendorId: vendor.id });

    await createInvoice({ leaseId: lease.id, description: 'rent invoice' });
    await createInvoice({
      maintenanceRequestId: request.id,
      type: 'MAINTENANCE',
      description: 'job invoice',
    });
    const otherTenant = await createUser(Role.TENANT);
    await createInvoice({ userId: otherTenant.id, description: 'direct invoice, unrelated' });

    const tenantCookie = await authCookie(tenant.id, tenant.role);
    const tenantRes = await apiFetch<{ data: { description: string }[] }>('/api/v1/invoices', {
      cookie: tenantCookie,
    });
    expect(tenantRes.body.data.map((i) => i.description).sort()).toEqual(
      ['job invoice', 'rent invoice'].sort(),
    );

    const vendorCookie = await authCookie(vendor.id, vendor.role);
    const vendorRes = await apiFetch<{ data: { description: string }[] }>('/api/v1/invoices', {
      cookie: vendorCookie,
    });
    expect(vendorRes.body.data.map((i) => i.description)).toEqual(['job invoice']);

    const managerCookie = await authCookie(manager.id, manager.role);
    const managerRes = await apiFetch<{ data: { description: string }[] }>('/api/v1/invoices', {
      cookie: managerCookie,
    });
    expect(managerRes.body.data.map((i) => i.description).sort()).toEqual(
      ['job invoice', 'rent invoice'].sort(),
    );

    const admin = await createUser(Role.ADMIN);
    const adminCookie = await authCookie(admin.id, admin.role);
    const adminRes = await apiFetch('/api/v1/invoices', { cookie: adminCookie });
    expect(adminRes.body.data.length).toBe(3);
  });
});

describe('invoices: create', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('rejects TENANT and LANDLORD callers outright (only ADMIN/MANAGER/VENDOR may create)', async () => {
    const tenant = await createUser(Role.TENANT);
    const landlord = await createUser(Role.LANDLORD);
    for (const user of [tenant, landlord]) {
      const cookie = await authCookie(user.id, user.role);
      const res = await apiFetch('/api/v1/invoices', {
        method: 'POST',
        cookie,
        body: { userId: user.id, type: 'RENT', amount: 1000, dueDate: new Date().toISOString() },
      });
      expect(res.status).toBe(403);
    }
  });

  it("requires at least one of leaseId/maintenanceRequestId/userId (Prisma can't express this)", async () => {
    const admin = await createUser(Role.ADMIN);
    const cookie = await authCookie(admin.id, admin.role);
    const res = await apiFetch('/api/v1/invoices', {
      method: 'POST',
      cookie,
      body: { type: 'RENT', amount: 1000, dueDate: new Date().toISOString() },
    });
    expect(res.status).toBe(400);
  });

  it('restricts a VENDOR to MAINTENANCE invoices on their own assigned request', async () => {
    const property = await createProperty();
    const unit = await createUnit(property.id);
    const tenant = await createUser(Role.TENANT);
    const vendor = await createUser(Role.VENDOR);
    const otherVendor = await createUser(Role.VENDOR);
    const request = await createMaintenanceRequest(unit.id, tenant.id, { vendorId: vendor.id });
    const vendorCookie = await authCookie(vendor.id, vendor.role);

    const wrongType = await apiFetch('/api/v1/invoices', {
      method: 'POST',
      cookie: vendorCookie,
      body: {
        maintenanceRequestId: request.id,
        type: 'RENT',
        amount: 5000,
        dueDate: new Date().toISOString(),
      },
    });
    expect(wrongType.status).toBe(403);

    const otherVendorCookie = await authCookie(otherVendor.id, otherVendor.role);
    const notAssigned = await apiFetch('/api/v1/invoices', {
      method: 'POST',
      cookie: otherVendorCookie,
      body: {
        maintenanceRequestId: request.id,
        type: 'MAINTENANCE',
        amount: 5000,
        dueDate: new Date().toISOString(),
      },
    });
    expect(notAssigned.status).toBe(403);

    const ok = await apiFetch('/api/v1/invoices', {
      method: 'POST',
      cookie: vendorCookie,
      body: {
        maintenanceRequestId: request.id,
        type: 'MAINTENANCE',
        amount: 5000,
        dueDate: new Date().toISOString(),
      },
    });
    expect(ok.status).toBe(201);
    expect(ok.body.data.invoiceNumber).toMatch(/^INV-/);
  });
});

describe('invoices: create is scoped for managers (ISS-050)', () => {
  beforeAll(async () => {
    await resetDb();
  });

  async function setup() {
    const manager = await createUser(Role.MANAGER);
    const otherManager = await createUser(Role.MANAGER);
    const tenant = await createUser(Role.TENANT);
    const mine = await createProperty({ managerId: manager.id });
    const theirs = await createProperty({ managerId: otherManager.id });
    const myLease = await createLease((await createUnit(mine.id)).id, tenant.id);
    const theirLease = await createLease((await createUnit(theirs.id)).id, tenant.id);
    const theirJob = await createMaintenanceRequest((await createUnit(theirs.id)).id, tenant.id);
    return {
      manager,
      tenant,
      myLease,
      theirLease,
      theirJob,
      cookie: await authCookie(manager.id, manager.role),
    };
  }

  const body = (extra: Record<string, unknown>) => ({
    type: 'UTILITY',
    amount: 5000,
    dueDate: new Date().toISOString(),
    ...extra,
  });

  it('lets a manager invoice a lease on a property they manage', async () => {
    const { cookie, myLease } = await setup();
    const res = await apiFetch('/api/v1/invoices', {
      method: 'POST',
      cookie,
      body: body({ leaseId: myLease.id }),
    });
    expect(res.status).toBe(201);
  });

  it("refuses another manager's lease and maintenance request", async () => {
    const { cookie, theirLease, theirJob } = await setup();
    const a = await apiFetch('/api/v1/invoices', {
      method: 'POST',
      cookie,
      body: body({ leaseId: theirLease.id }),
    });
    expect(a.status).toBe(403);
    const b = await apiFetch('/api/v1/invoices', {
      method: 'POST',
      cookie,
      body: body({ type: 'MAINTENANCE', maintenanceRequestId: theirJob.id }),
    });
    expect(b.status).toBe(403);
  });

  it('refuses billing an arbitrary user, subscription invoices and pre-paid invoices', async () => {
    const { cookie, tenant, myLease } = await setup();
    const user = await apiFetch('/api/v1/invoices', {
      method: 'POST',
      cookie,
      body: body({ userId: tenant.id }),
    });
    expect(user.status).toBe(403);
    const sub = await apiFetch('/api/v1/invoices', {
      method: 'POST',
      cookie,
      body: body({ leaseId: myLease.id, type: 'SUBSCRIPTION' }),
    });
    expect(sub.status).toBe(403);
    const paid = await apiFetch('/api/v1/invoices', {
      method: 'POST',
      cookie,
      body: body({ leaseId: myLease.id, status: 'PAID' }),
    });
    expect(paid.status).toBe(400);
  });

  it('still lets an admin invoice any user', async () => {
    const admin = await createUser(Role.ADMIN);
    const tenant = await createUser(Role.TENANT);
    const res = await apiFetch('/api/v1/invoices', {
      method: 'POST',
      cookie: await authCookie(admin.id, admin.role),
      body: body({ userId: tenant.id }),
    });
    expect(res.status).toBe(201);
  });
});

describe('invoices: [id] access and PATCH', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('canAccessInvoice covers direct owner, lease tenant/manager, and maintenance tenant/vendor/manager; forbids a stranger', async () => {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });
    const unit = await createUnit(property.id);
    const tenant = await createUser(Role.TENANT);
    const lease = await createLease(unit.id, tenant.id);
    const invoice = await createInvoice({ leaseId: lease.id });
    const stranger = await createUser(Role.TENANT);

    for (const user of [tenant, manager]) {
      const cookie = await authCookie(user.id, user.role);
      const res = await apiFetch(`/api/v1/invoices/${invoice.id}`, { cookie });
      expect(res.status).toBe(200);
    }

    const strangerCookie = await authCookie(stranger.id, stranger.role);
    const forbidden = await apiFetch(`/api/v1/invoices/${invoice.id}`, { cookie: strangerCookie });
    expect(forbidden.status).toBe(403);
  });

  it('lets a direct userId-owner see their own invoice with no lease/maintenanceRequest involved', async () => {
    const directOwner = await createUser(Role.TENANT);
    const invoice = await createInvoice({ userId: directOwner.id, type: 'ASSOCIATION_FEE' });
    const cookie = await authCookie(directOwner.id, directOwner.role);
    const res = await apiFetch(`/api/v1/invoices/${invoice.id}`, { cookie });
    expect(res.status).toBe(200);
  });

  it('PATCH is ADMIN/MANAGER only', async () => {
    const tenant = await createUser(Role.TENANT);
    const invoice = await createInvoice({ userId: tenant.id });
    const tenantCookie = await authCookie(tenant.id, tenant.role);
    const forbidden = await apiFetch(`/api/v1/invoices/${invoice.id}`, {
      method: 'PATCH',
      cookie: tenantCookie,
      body: { status: 'CANCELLED' },
    });
    expect(forbidden.status).toBe(403);

    const admin = await createUser(Role.ADMIN);
    const adminCookie = await authCookie(admin.id, admin.role);
    const allowed = await apiFetch(`/api/v1/invoices/${invoice.id}`, {
      method: 'PATCH',
      cookie: adminCookie,
      body: { status: 'CANCELLED' },
    });
    expect(allowed.status).toBe(200);
    expect(allowed.body.data.status).toBe('CANCELLED');
  });

  it("PATCH also requires the MANAGER to actually manage the invoice's property, not just hold the role", async () => {
    const realManager = await createUser(Role.MANAGER);
    const strangerManager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: realManager.id });
    const unit = await createUnit(property.id);
    const tenant = await createUser(Role.TENANT);
    const lease = await createLease(unit.id, tenant.id);
    const invoice = await createInvoice({ leaseId: lease.id });

    const strangerCookie = await authCookie(strangerManager.id, strangerManager.role);
    const forbidden = await apiFetch(`/api/v1/invoices/${invoice.id}`, {
      method: 'PATCH',
      cookie: strangerCookie,
      body: { status: 'PAID' },
    });
    expect(forbidden.status).toBe(403);

    // Confirm the invoice was genuinely untouched, not just that the response was 403.
    const stillUnpaid = await testPrisma.invoice.findUnique({ where: { id: invoice.id } });
    expect(stillUnpaid?.status).not.toBe('PAID');

    const realManagerCookie = await authCookie(realManager.id, realManager.role);
    const allowed = await apiFetch(`/api/v1/invoices/${invoice.id}`, {
      method: 'PATCH',
      cookie: realManagerCookie,
      body: { status: 'CANCELLED' },
    });
    expect(allowed.status).toBe(200);
  });

  it('PATCH on a userId-only invoice (no property at all) is ADMIN-only, even for a MANAGER', async () => {
    const manager = await createUser(Role.MANAGER);
    const otherUser = await createUser(Role.TENANT);
    const invoice = await createInvoice({ userId: otherUser.id, type: 'ASSOCIATION_FEE' });
    const cookie = await authCookie(manager.id, manager.role);
    const res = await apiFetch(`/api/v1/invoices/${invoice.id}`, {
      method: 'PATCH',
      cookie,
      body: { status: 'CANCELLED' },
    });
    expect(res.status).toBe(403);
  });
});

describe('payments: initialize', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('requires authentication', async () => {
    const res = await apiFetch('/api/v1/payments/initialize', {
      method: 'POST',
      body: { invoiceId: 'whatever' },
    });
    expect(res.status).toBe(401);
  });

  it('404s for a missing invoice', async () => {
    const tenant = await createUser(Role.TENANT);
    const cookie = await authCookie(tenant.id, tenant.role);
    const res = await apiFetch('/api/v1/payments/initialize', {
      method: 'POST',
      cookie,
      body: { invoiceId: 'does-not-exist' },
    });
    expect(res.status).toBe(404);
  });

  it('forbids a caller who is neither the payer nor an admin', async () => {
    const owner = await createUser(Role.TENANT);
    const stranger = await createUser(Role.TENANT);
    const invoice = await createInvoice({ userId: owner.id });
    const cookie = await authCookie(stranger.id, stranger.role);
    const res = await apiFetch('/api/v1/payments/initialize', {
      method: 'POST',
      cookie,
      body: { invoiceId: invoice.id },
    });
    expect(res.status).toBe(403);
  });

  it('refuses to re-initialize an already-PAID invoice', async () => {
    const owner = await createUser(Role.TENANT);
    const invoice = await createInvoice({ userId: owner.id, status: 'PAID' });
    const cookie = await authCookie(owner.id, owner.role);
    const res = await apiFetch('/api/v1/payments/initialize', {
      method: 'POST',
      cookie,
      body: { invoiceId: invoice.id },
    });
    expect(res.status).toBe(409);
  });

  // The real call to Paystack's API (the 201/success path) needs a genuine
  // test-mode account and is explicitly documented as untested -- see
  // CLAUDE.md and out/phase-10-test-suite-plan.md. Not attempted here: it
  // would be a real network call from inside an automated test.
});

describe('payments: webhook (HMAC-SHA512 verification)', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('rejects a request with no signature header', async () => {
    const res = await apiFetch('/api/v1/payments/webhook', {
      method: 'POST',
      body: { event: 'charge.success', data: {} },
    });
    expect(res.status).toBe(401);
  });

  it('rejects a request with an invalid signature', async () => {
    const res = await apiFetch('/api/v1/payments/webhook', {
      method: 'POST',
      body: { event: 'charge.success', data: {} },
      headers: { 'x-paystack-signature': 'not-a-real-signature-'.padEnd(128, '0') },
    });
    expect(res.status).toBe(401);
  });

  it('rejects a payload missing invoiceId in metadata, even with a valid signature', async () => {
    const rawBody = JSON.stringify({ event: 'charge.success', data: { metadata: {} } });
    const res = await apiFetch('/api/v1/payments/webhook', {
      method: 'POST',
      headers: { 'x-paystack-signature': signWebhookBody(rawBody) },
      rawBody,
    });
    expect(res.status).toBe(400);
  });

  it('creates a real Payment and flips the invoice to PAID on a valid charge.success, and is idempotent on redelivery', async () => {
    const owner = await createUser(Role.TENANT);
    const invoice = await createInvoice({ userId: owner.id, amount: 25_000 });
    const reference = `test-ref-${invoice.id}`;

    const payload = {
      event: 'charge.success',
      data: {
        reference,
        amount: 2_500_000, // kobo
        channel: 'card',
        paid_at: new Date().toISOString(),
        metadata: { invoiceId: invoice.id },
      },
    };
    const rawBody = JSON.stringify(payload);
    const signature = signWebhookBody(rawBody);

    const first = await apiFetch('/api/v1/payments/webhook', {
      method: 'POST',
      headers: { 'x-paystack-signature': signature },
      rawBody,
    });
    expect(first.status).toBe(200);

    const updatedInvoice = await testPrisma.invoice.findUnique({ where: { id: invoice.id } });
    expect(updatedInvoice?.status).toBe('PAID');

    const payment = await testPrisma.payment.findFirst({ where: { transactionRef: reference } });
    expect(payment).not.toBeNull();
    expect(payment?.amount).toBe(25_000);
    expect(payment?.paymentMethod).toBe('CREDIT_CARD');

    // Redelivery of the exact same event must not double-credit.
    const second = await apiFetch('/api/v1/payments/webhook', {
      method: 'POST',
      headers: { 'x-paystack-signature': signature },
      rawBody,
    });
    expect(second.status).toBe(200);
    const paymentsForRef = await testPrisma.payment.count({ where: { transactionRef: reference } });
    expect(paymentsForRef).toBe(1);
  });
});

describe('vendor invoices: who pays, one per job (ISS-051)', () => {
  beforeAll(async () => {
    await resetDb();
  });

  async function setup() {
    const manager = await createUser(Role.MANAGER);
    const landlord = await createUser(Role.LANDLORD);
    const property = await createProperty({ managerId: manager.id, landlordId: landlord.id });
    const unit = await createUnit(property.id);
    const tenant = await createUser(Role.TENANT);
    const vendor = await createUser(Role.VENDOR);
    const request = await createMaintenanceRequest(unit.id, tenant.id, { vendorId: vendor.id });
    return { manager, landlord, tenant, vendor, request };
  }

  const post = (cookie: string, maintenanceRequestId: string, amount = 5000) =>
    apiFetch('/api/v1/invoices', {
      method: 'POST',
      cookie,
      body: {
        maintenanceRequestId,
        type: 'MAINTENANCE',
        amount,
        dueDate: new Date().toISOString(),
      },
    });

  it("lets the property's manager and landlord start payment, but not others", async () => {
    const { manager, landlord, tenant, vendor, request } = await setup();
    const invoice = await post(await authCookie(vendor.id, vendor.role), request.id);
    expect(invoice.status).toBe(201);
    const invoiceId = invoice.body.data.id;

    const outsider = await createUser(Role.MANAGER);
    for (const [who, allowed] of [
      [manager, true],
      [landlord, true],
      [outsider, false],
      [tenant, false],
      [vendor, false],
    ] as const) {
      const res = await apiFetch('/api/v1/payments/initialize', {
        method: 'POST',
        cookie: await authCookie(who.id, who.role),
        body: { invoiceId },
      });
      // Authorised callers get past the permission check and are then stopped by
      // the provider (503 not configured, 502 rejected the test key); others get 403.
      if (allowed) expect([502, 503], who.role).toContain(res.status);
      else expect(res.status, who.role).toBe(403);
    }
  });

  it('allows one live invoice per job; a cancelled one frees it', async () => {
    const { vendor, request } = await setup();
    const cookie = await authCookie(vendor.id, vendor.role);
    const first = await post(cookie, request.id);
    expect(first.status).toBe(201);
    expect((await post(cookie, request.id)).status).toBe(409);

    await testPrisma.invoice.update({
      where: { id: first.body.data.id },
      data: { status: 'CANCELLED' },
    });
    expect((await post(cookie, request.id, 6000)).status).toBe(201);
  });

  it('does not create a second invoice when completing a job that already has one', async () => {
    const { vendor, request } = await setup();
    const cookie = await authCookie(vendor.id, vendor.role);
    await testPrisma.systemSettings
      .updateMany({ data: { autoCompleteMaintenanceOnInvoice: false } })
      .catch(() => undefined);
    expect((await post(cookie, request.id, 4000)).status).toBe(201);
    const done = await apiFetch(`/api/v1/maintenance/requests/${request.id}`, {
      method: 'PATCH',
      cookie,
      body: { status: 'COMPLETED', completionProofUrl: '/proof.jpg', finalCost: 4000 },
    });
    expect(done.status).toBe(200);
    expect(await testPrisma.invoice.count({ where: { maintenanceRequestId: request.id } })).toBe(1);
  });
});

describe('payments: amounts, part payments and concurrent delivery (ISS-052)', () => {
  beforeAll(async () => {
    await resetDb();
  });

  async function deliver(invoiceId: string, reference: string, naira: number, extra = {}) {
    const rawBody = JSON.stringify({
      event: 'charge.success',
      data: {
        reference,
        amount: naira * 100,
        channel: 'card',
        paid_at: new Date().toISOString(),
        metadata: { invoiceId, ...extra },
      },
    });
    return apiFetch('/api/v1/payments/webhook', {
      method: 'POST',
      headers: { 'x-paystack-signature': signWebhookBody(rawBody) },
      rawBody,
    });
  }

  it('marks an invoice PARTIALLY_PAID, then PAID once the balance is cleared', async () => {
    const owner = await createUser(Role.TENANT);
    const invoice = await createInvoice({ userId: owner.id, amount: 100_000 });

    expect((await deliver(invoice.id, `p1-${invoice.id}`, 40_000)).status).toBe(200);
    let row = await testPrisma.invoice.findUnique({ where: { id: invoice.id } });
    expect(row?.status).toBe('PARTIALLY_PAID');

    expect((await deliver(invoice.id, `p2-${invoice.id}`, 60_000)).status).toBe(200);
    row = await testPrisma.invoice.findUnique({ where: { id: invoice.id } });
    expect(row?.status).toBe('PAID');
  });

  it('credits once when the same event is delivered concurrently', async () => {
    const owner = await createUser(Role.TENANT);
    const invoice = await createInvoice({ userId: owner.id, amount: 30_000 });
    const ref = `race-${invoice.id}`;
    const results = await Promise.all([1, 2, 3, 4].map(() => deliver(invoice.id, ref, 30_000)));
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(await testPrisma.payment.count({ where: { transactionRef: ref } })).toBe(1);
  });

  it('flags an amount that differs from what was requested, and an overpayment', async () => {
    const owner = await createUser(Role.TENANT);
    const invoice = await createInvoice({ userId: owner.id, amount: 50_000 });
    await deliver(invoice.id, `mm-${invoice.id}`, 70_000, { expectedAmount: 50_000 });
    const actions = (await testPrisma.auditLog.findMany({ where: { entityId: invoice.id } })).map(
      (a) => a.action,
    );
    expect(actions).toContain('PAYMENT_AMOUNT_MISMATCH');
    expect(actions).toContain('PAYMENT_EXCEEDS_INVOICE');
  });

  it('keeps a cancelled invoice cancelled, records the money and flags it', async () => {
    const owner = await createUser(Role.TENANT);
    const invoice = await createInvoice({
      userId: owner.id,
      amount: 20_000,
      status: 'CANCELLED',
    });
    await deliver(invoice.id, `cx-${invoice.id}`, 20_000);
    const row = await testPrisma.invoice.findUnique({ where: { id: invoice.id } });
    expect(row?.status).toBe('CANCELLED');
    expect(await testPrisma.payment.count({ where: { invoiceId: invoice.id } })).toBe(1);
    const flagged = await testPrisma.auditLog.findFirst({
      where: { entityId: invoice.id, action: 'PAYMENT_ON_CANCELLED_INVOICE' },
    });
    expect(flagged).not.toBeNull();
  });

  it('initialize refuses a cancelled invoice and charges only the outstanding balance', async () => {
    const owner = await createUser(Role.TENANT);
    const cancelled = await createInvoice({
      userId: owner.id,
      amount: 10_000,
      status: 'CANCELLED',
    });
    const cookie = await authCookie(owner.id, owner.role);
    const refused = await apiFetch('/api/v1/payments/initialize', {
      method: 'POST',
      cookie,
      body: { invoiceId: cancelled.id },
    });
    expect(refused.status).toBe(409);

    const partly = await createInvoice({ userId: owner.id, amount: 80_000 });
    await testPrisma.payment.create({ data: { invoiceId: partly.id, amount: 30_000 } });
    const tooMuch = await apiFetch('/api/v1/payments/initialize', {
      method: 'POST',
      cookie,
      body: { invoiceId: partly.id, amount: 60_000 },
    });
    // 503 when no provider key is configured in this environment; the
    // balance check runs before that, so an excessive amount is a 400.
    expect(tooMuch.status).toBe(400);
  });
});

describe('subscriptions: checkout, me, and webhook activation', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('checkout is MANAGER/LANDLORD only', async () => {
    const tenant = await createUser(Role.TENANT);
    const cookie = await authCookie(tenant.id, tenant.role);
    const res = await apiFetch('/api/v1/subscriptions/checkout', {
      method: 'POST',
      cookie,
      body: { tier: 'PRO' },
    });
    expect(res.status).toBe(403);
  });

  it('FREE tier activates immediately with no invoice/payment involved', async () => {
    const landlord = await createUser(Role.LANDLORD);
    const cookie = await authCookie(landlord.id, landlord.role);
    const res = await apiFetch('/api/v1/subscriptions/checkout', {
      method: 'POST',
      cookie,
      body: { tier: 'FREE' },
    });
    expect(res.status).toBe(201);
    expect(res.body.data.activated).toBe(true);

    const subscription = await testPrisma.subscription.findUnique({
      where: { userId: landlord.id },
    });
    expect(subscription?.tier).toBe('FREE');
    expect(subscription?.status).toBe('ACTIVE');

    const invoiceCount = await testPrisma.invoice.count({ where: { userId: landlord.id } });
    expect(invoiceCount).toBe(0);
  });

  it('PRO tier creates a real SUBSCRIPTION invoice with server-computed (not client-supplied) pricing', async () => {
    const manager = await createUser(Role.MANAGER);
    const cookie = await authCookie(manager.id, manager.role);

    const monthly = await apiFetch('/api/v1/subscriptions/checkout', {
      method: 'POST',
      cookie,
      body: { tier: 'PRO', billingCycle: 'monthly' },
    });
    expect(monthly.status).toBe(201);
    expect(monthly.body.data.amount).toBe(29_999);

    const invoice = await testPrisma.invoice.findUnique({
      where: { id: monthly.body.data.invoiceId },
    });
    expect(invoice?.type).toBe('SUBSCRIPTION');
    expect(invoice?.userId).toBe(manager.id);
    expect(invoice?.amount).toBe(29_999);

    const yearly = await apiFetch('/api/v1/subscriptions/checkout', {
      method: 'POST',
      cookie,
      body: { tier: 'PRO', billingCycle: 'yearly' },
    });
    expect(yearly.status).toBe(201);
    expect(yearly.body.data.amount).toBe(23_999 * 12);
  });

  it('GET /me defaults to a real FREE row for a user who never subscribed', async () => {
    const landlord = await createUser(Role.LANDLORD);
    const cookie = await authCookie(landlord.id, landlord.role);
    const res = await apiFetch('/api/v1/subscriptions/me', { cookie });
    expect(res.status).toBe(200);
    expect(res.body.data.tier).toBe('FREE');
  });

  it('a paid PRO invoice activates the subscription via the webhook, with the right tier/cycle read back from the invoice', async () => {
    const manager = await createUser(Role.MANAGER);
    const cookie = await authCookie(manager.id, manager.role);

    const checkout = await apiFetch('/api/v1/subscriptions/checkout', {
      method: 'POST',
      cookie,
      body: { tier: 'PRO', billingCycle: 'yearly' },
    });
    expect(checkout.status).toBe(201);
    const invoiceId = checkout.body.data.invoiceId;

    const payload = {
      event: 'charge.success',
      data: {
        reference: `sub-ref-${invoiceId}`,
        amount: checkout.body.data.amount * 100,
        channel: 'card',
        paid_at: new Date().toISOString(),
        metadata: { invoiceId },
      },
    };
    const rawBody = JSON.stringify(payload);
    const res = await apiFetch('/api/v1/payments/webhook', {
      method: 'POST',
      headers: { 'x-paystack-signature': signWebhookBody(rawBody) },
      rawBody,
    });
    expect(res.status).toBe(200);

    const subscription = await testPrisma.subscription.findUnique({
      where: { userId: manager.id },
    });
    expect(subscription?.tier).toBe('PRO');
    expect(subscription?.status).toBe('ACTIVE');
    expect(subscription?.currentPeriodEnd).not.toBeNull();
    // Yearly cycle -> period end roughly a year out, not a month.
    const daysOut = (subscription!.currentPeriodEnd!.getTime() - Date.now()) / 86_400_000;
    expect(daysOut).toBeGreaterThan(300);

    const me = await apiFetch('/api/v1/subscriptions/me', { cookie });
    expect(me.body.data.tier).toBe('PRO');
  });
});

// A card payment on a lease whose signed webhook body carries a reusable
// Paystack authorization -- the only thing auto-pay may be set up with (ISS-056).
async function seedCardAuthorization(leaseId: string, code = 'AUTH_test_123') {
  const invoice = await createInvoice({ leaseId, amount: 10_000, status: 'PAID' });
  await testPrisma.payment.create({
    data: {
      invoiceId: invoice.id,
      amount: 10_000,
      provider: 'PAYSTACK',
      transactionRef: `seed-${invoice.id}`,
      rawProviderPayload: JSON.stringify({
        data: {
          authorization: { reusable: true, authorization_code: code, last4: '4081' },
        },
      }),
    },
  });
  return code;
}

describe('payments: autopay', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('is TENANT-only', async () => {
    const manager = await createUser(Role.MANAGER);
    const cookie = await authCookie(manager.id, manager.role);
    const res = await apiFetch('/api/v1/payments/autopay', { cookie });
    expect(res.status).toBe(403);
  });

  it('rejects creating a mandate on a lease the caller does not own', async () => {
    const property = await createProperty();
    const unit = await createUnit(property.id);
    const owner = await createUser(Role.TENANT);
    const intruder = await createUser(Role.TENANT);
    const lease = await createLease(unit.id, owner.id);

    const cookie = await authCookie(intruder.id, intruder.role);
    const res = await apiFetch('/api/v1/payments/autopay', {
      method: 'POST',
      cookie,
      body: { leaseId: lease.id, paymentMethodToken: 'tok_test_123' },
    });
    expect(res.status).toBe(403);
  });

  it("creates a mandate, lists only the caller's ACTIVE mandates, and DELETE soft-cancels rather than removing the row", async () => {
    const property = await createProperty();
    const unit = await createUnit(property.id);
    const tenant = await createUser(Role.TENANT);
    const lease = await createLease(unit.id, tenant.id);
    const cookie = await authCookie(tenant.id, tenant.role);

    const token = await seedCardAuthorization(lease.id);
    const created = await apiFetch<{ data: { id: string; status: string } }>(
      '/api/v1/payments/autopay',
      {
        method: 'POST',
        cookie,
        body: { leaseId: lease.id, paymentMethodToken: token },
      },
    );
    expect(created.status).toBe(201);
    expect(created.body.data.status).toBe('ACTIVE');

    const list = await apiFetch<{ data: { id: string }[] }>('/api/v1/payments/autopay', {
      cookie,
    });
    expect(list.body.data.map((m) => m.id)).toEqual([created.body.data.id]);

    const deleted = await apiFetch(`/api/v1/payments/autopay?id=${created.body.data.id}`, {
      method: 'DELETE',
      cookie,
    });
    expect(deleted.status).toBe(200);
    expect(deleted.body.data.status).toBe('CANCELLED');

    // Soft-cancel, not a hard delete -- the row must still exist.
    const stillThere = await testPrisma.autoPayMandate.findUnique({
      where: { id: created.body.data.id },
    });
    expect(stillThere).not.toBeNull();
    expect(stillThere?.status).toBe('CANCELLED');

    // A cancelled mandate no longer shows up in the active list.
    const listAfter = await apiFetch('/api/v1/payments/autopay', { cookie });
    expect(listAfter.body.data.length).toBe(0);
  });

  it('only accepts a card token Paystack gave us for this lease, and only on an active lease (ISS-056)', async () => {
    const property = await createProperty();
    const unit = await createUnit(property.id);
    const tenant = await createUser(Role.TENANT);
    const lease = await createLease(unit.id, tenant.id);
    const cookie = await authCookie(tenant.id, tenant.role);
    const post = (token: string, leaseId = lease.id) =>
      apiFetch('/api/v1/payments/autopay', {
        method: 'POST',
        cookie,
        body: { leaseId, paymentMethodToken: token },
      });

    // No card payment yet: nothing to set up with.
    expect((await post('AUTH_made_up')).status).toBe(400);

    const real = await seedCardAuthorization(lease.id, 'AUTH_real_card');
    expect((await post('AUTH_made_up')).status).toBe(400);
    expect((await post(real)).status).toBe(201);

    // Another tenant's lease token is not valid here either.
    const other = await createLease((await createUnit(property.id)).id, tenant.id);
    const otherToken = await seedCardAuthorization(other.id, 'AUTH_other_card');
    expect((await post(otherToken)).status).toBe(400);

    // An ended lease cannot take a mandate.
    await testPrisma.lease.update({ where: { id: other.id }, data: { status: 'TERMINATED' } });
    expect((await post(otherToken, other.id)).status).toBe(409);
  });

  it('keeps one active mandate per lease: a new one replaces the old', async () => {
    const property = await createProperty();
    const unit = await createUnit(property.id);
    const tenant = await createUser(Role.TENANT);
    const lease = await createLease(unit.id, tenant.id);
    const cookie = await authCookie(tenant.id, tenant.role);
    const token = await seedCardAuthorization(lease.id);
    const post = () =>
      apiFetch('/api/v1/payments/autopay', {
        method: 'POST',
        cookie,
        body: { leaseId: lease.id, paymentMethodToken: token },
      });

    const first = await post();
    const second = await post();
    expect(second.status).toBe(201);
    const rows = await testPrisma.autoPayMandate.findMany({ where: { leaseId: lease.id } });
    expect(rows.filter((r) => r.status === 'ACTIVE')).toHaveLength(1);
    expect(rows.find((r) => r.id === first.body.data.id)?.status).toBe('CANCELLED');
    expect(rows.find((r) => r.id === second.body.data.id)?.status).toBe('ACTIVE');

    // The database itself refuses a second active one.
    await expect(
      testPrisma.autoPayMandate.create({
        data: { leaseId: lease.id, paymentMethodToken: token, status: 'ACTIVE' },
      }),
    ).rejects.toThrow();
  });
});

describe('subscriptions: downgrading to FREE keeps the paid period (ISS-056)', () => {
  beforeAll(async () => {
    await resetDb();
  });

  const free = (cookie: string, confirmDowngrade?: boolean) =>
    apiFetch('/api/v1/subscriptions/checkout', {
      method: 'POST',
      cookie,
      body: { tier: 'FREE', ...(confirmDowngrade ? { confirmDowngrade } : {}) },
    });

  it('asks for confirmation, then keeps the paid plan until the period ends and reverts after', async () => {
    const landlord = await createUser(Role.LANDLORD);
    const cookie = await authCookie(landlord.id, landlord.role);
    const paidUntil = new Date(Date.now() + 20 * 86_400_000);
    await testPrisma.subscription.create({
      data: { userId: landlord.id, tier: 'PRO', status: 'ACTIVE', currentPeriodEnd: paidUntil },
    });

    const asked = await free(cookie);
    expect(asked.status).toBe(409);
    expect(asked.body.code).toBe('DOWNGRADE_NEEDS_CONFIRMATION');
    expect(
      (await testPrisma.subscription.findUnique({ where: { userId: landlord.id } }))?.tier,
    ).toBe('PRO');

    const confirmed = await free(cookie, true);
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.data.scheduled).toBe(true);
    const row = await testPrisma.subscription.findUnique({ where: { userId: landlord.id } });
    expect(row?.tier).toBe('PRO'); // still paid
    expect(row?.cancelAtPeriodEnd).toBe(true);

    const during = await apiFetch('/api/v1/subscriptions/me', { cookie });
    expect(during.body.data.tier).toBe('PRO');

    // After the paid period, the plan is Free.
    await testPrisma.subscription.update({
      where: { userId: landlord.id },
      data: { currentPeriodEnd: new Date(Date.now() - 1000) },
    });
    const after = await apiFetch('/api/v1/subscriptions/me', { cookie });
    expect(after.body.data.tier).toBe('FREE');
  });

  it('switches straight to FREE when nothing is paid for', async () => {
    const landlord = await createUser(Role.LANDLORD);
    const cookie = await authCookie(landlord.id, landlord.role);
    const res = await free(cookie);
    expect(res.status).toBe(201);
    expect(res.body.data.activated).toBe(true);
  });
});
