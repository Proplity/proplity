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
    await createInvoice({ maintenanceRequestId: request.id, type: 'MAINTENANCE', description: 'job invoice' });
    const otherTenant = await createUser(Role.TENANT);
    await createInvoice({ userId: otherTenant.id, description: 'direct invoice, unrelated' });

    const tenantCookie = await authCookie(tenant.id, tenant.role);
    const tenantRes = await apiFetch('/api/v1/invoices', { cookie: tenantCookie });
    expect(tenantRes.body.data.map((i: any) => i.description).sort()).toEqual(
      ['job invoice', 'rent invoice'].sort(),
    );

    const vendorCookie = await authCookie(vendor.id, vendor.role);
    const vendorRes = await apiFetch('/api/v1/invoices', { cookie: vendorCookie });
    expect(vendorRes.body.data.map((i: any) => i.description)).toEqual(['job invoice']);

    const managerCookie = await authCookie(manager.id, manager.role);
    const managerRes = await apiFetch('/api/v1/invoices', { cookie: managerCookie });
    expect(managerRes.body.data.map((i: any) => i.description).sort()).toEqual(
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

  it('requires at least one of leaseId/maintenanceRequestId/userId (Prisma can\'t express this)', async () => {
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
      body: { maintenanceRequestId: request.id, type: 'RENT', amount: 5000, dueDate: new Date().toISOString() },
    });
    expect(wrongType.status).toBe(403);

    const otherVendorCookie = await authCookie(otherVendor.id, otherVendor.role);
    const notAssigned = await apiFetch('/api/v1/invoices', {
      method: 'POST',
      cookie: otherVendorCookie,
      body: { maintenanceRequestId: request.id, type: 'MAINTENANCE', amount: 5000, dueDate: new Date().toISOString() },
    });
    expect(notAssigned.status).toBe(403);

    const ok = await apiFetch('/api/v1/invoices', {
      method: 'POST',
      cookie: vendorCookie,
      body: { maintenanceRequestId: request.id, type: 'MAINTENANCE', amount: 5000, dueDate: new Date().toISOString() },
    });
    expect(ok.status).toBe(201);
    expect(ok.body.data.invoiceNumber).toMatch(/^INV-/);
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

  it('creates a mandate, lists only the caller\'s ACTIVE mandates, and DELETE soft-cancels rather than removing the row', async () => {
    const property = await createProperty();
    const unit = await createUnit(property.id);
    const tenant = await createUser(Role.TENANT);
    const lease = await createLease(unit.id, tenant.id);
    const cookie = await authCookie(tenant.id, tenant.role);

    const created = await apiFetch('/api/v1/payments/autopay', {
      method: 'POST',
      cookie,
      body: { leaseId: lease.id, paymentMethodToken: 'tok_test_123' },
    });
    expect(created.status).toBe(201);
    expect(created.body.data.status).toBe('ACTIVE');

    const list = await apiFetch('/api/v1/payments/autopay', { cookie });
    expect(list.body.data.map((m: any) => m.id)).toEqual([created.body.data.id]);

    const deleted = await apiFetch(`/api/v1/payments/autopay?id=${created.body.data.id}`, {
      method: 'DELETE',
      cookie,
    });
    expect(deleted.status).toBe(200);
    expect(deleted.body.data.status).toBe('CANCELLED');

    // Soft-cancel, not a hard delete -- the row must still exist.
    const stillThere = await testPrisma.autoPayMandate.findUnique({ where: { id: created.body.data.id } });
    expect(stillThere).not.toBeNull();
    expect(stillThere?.status).toBe('CANCELLED');

    // A cancelled mandate no longer shows up in the active list.
    const listAfter = await apiFetch('/api/v1/payments/autopay', { cookie });
    expect(listAfter.body.data.length).toBe(0);
  });
});
