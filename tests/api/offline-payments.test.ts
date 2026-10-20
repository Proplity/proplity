import crypto from 'crypto';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { InvoiceStatus, InvoiceType, Role } from '@prisma/client';
import { resetDb, testPrisma } from '../helpers/db';
import {
  createInvoice,
  createLease,
  createMaintenanceRequest,
  createProperty,
  createUnit,
  createUser,
} from '../helpers/fixtures';
import { authCookie } from '../helpers/auth';
import { apiFetch } from '../helpers/client';

const PNG = new TextEncoder().encode('\x89PNG test');

type User = { id: string; role: Role };
const cookieOf = (u: User) => authCookie(u.id, u.role);

async function uploadProof(cookie: string): Promise<string> {
  const sign = await apiFetch('/api/v1/uploads/sign', {
    method: 'POST',
    cookie,
    body: {
      folder: 'reconciliation',
      fileName: 'receipt.png',
      contentType: 'image/png',
      size: PNG.byteLength,
    },
  });
  expect(sign.status).toBe(200);
  const form = new FormData();
  form.append('fileId', sign.body.data.plan.fileId);
  form.append('file', new Blob([PNG as unknown as BlobPart], { type: 'image/png' }), 'receipt.png');
  const put = await apiFetch('/api/v1/uploads/file', { method: 'POST', cookie, body: form });
  expect(put.status).toBe(201);
  return sign.body.data.file.url as string;
}

function signWebhookBody(rawBody: string) {
  return crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY!)
    .update(rawBody)
    .digest('hex');
}

/** A property team (manager and landlord), a tenant on a lease, and a vendor with a billed job. */
async function world(opts: { amount?: number } = {}) {
  const manager = await createUser(Role.MANAGER, { name: 'Mary Manager' });
  const landlord = await createUser(Role.LANDLORD, { name: 'Lola Landlord' });
  const property = await createProperty({ managerId: manager.id, landlordId: landlord.id });
  const unit = await createUnit(property.id);
  const tenant = await createUser(Role.TENANT, { name: 'Tunde Tenant' });
  const lease = await createLease(unit.id, tenant.id);
  const vendor = await createUser(Role.VENDOR, { name: 'Vera Vendor' });
  await testPrisma.vendorProfile.create({
    data: { userId: vendor.id, businessName: 'Vera Pipes Ltd', verificationStatus: 'VERIFIED' },
  });
  const job = await createMaintenanceRequest(unit.id, tenant.id, {
    vendorId: vendor.id,
    status: 'COMPLETED',
    title: 'Fix the tap',
  });
  const vendorInvoice = await createInvoice({
    maintenanceRequestId: job.id,
    type: InvoiceType.MAINTENANCE,
    amount: opts.amount ?? 50_000,
    status: InvoiceStatus.UNPAID,
  });
  const rentInvoice = await createInvoice({
    leaseId: lease.id,
    type: InvoiceType.RENT,
    amount: 200_000,
    status: InvoiceStatus.UNPAID,
  });
  return {
    manager,
    landlord,
    property,
    unit,
    tenant,
    lease,
    vendor,
    job,
    vendorInvoice,
    rentInvoice,
    cookies: {
      manager: await cookieOf(manager),
      landlord: await cookieOf(landlord),
      tenant: await cookieOf(tenant),
      vendor: await cookieOf(vendor),
    },
  };
}

let refCounter = 0;
const transfer = (invoiceId: string, extra: object = {}) => ({
  invoiceId,
  amount: 50_000,
  bankName: 'GTBank',
  senderAccountName: 'Lola Landlord',
  referenceNumber: `REF-${Date.now()}-${++refCounter}`,
  paymentDate: new Date().toISOString(),
  ...extra,
});

const submit = (cookie: string, body: object) =>
  apiFetch('/api/v1/bank-transfers', { method: 'POST', cookie, body });
const reconcile = (cookie: string, id: string, body: object) =>
  apiFetch(`/api/v1/bank-transfers/${id}/reconcile`, { method: 'POST', cookie, body });
const attention = async (user: User) => {
  const res = await apiFetch<{ data: { id: string; count: number }[] }>(
    '/api/v1/dashboard/attention',
    { cookie: await cookieOf(user) },
  );
  expect(res.status).toBe(200);
  return res.body.data;
};

describe('offline payments: recording and confirming', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('will not let the person who recorded a payment confirm it, but lets them withdraw it', async () => {
    const w = await world();
    const proof = await uploadProof(w.cookies.manager);
    const created = await submit(
      w.cookies.manager,
      transfer(w.vendorInvoice.id, { proofFileUrl: proof }),
    );
    expect(created.status).toBe(201);
    const id = created.body.data.id;

    // Their own entry: no confirming it.
    const self = await reconcile(w.cookies.manager, id, { action: 'APPROVE' });
    expect(self.status).toBe(403);
    expect(self.body.error).toContain('Someone else must confirm');
    expect(
      (await testPrisma.bankTransferSubmission.findUniqueOrThrow({ where: { id } })).status,
    ).toBe('PENDING');
    expect(await testPrisma.payment.count({ where: { invoiceId: w.vendorInvoice.id } })).toBe(0);

    // Strangers and the wrong roles cannot confirm either.
    const stranger = await createUser(Role.MANAGER);
    expect((await reconcile(await cookieOf(stranger), id, { action: 'APPROVE' })).status).toBe(403);
    expect((await reconcile(w.cookies.tenant, id, { action: 'APPROVE' })).status).toBe(403);
    expect((await reconcile(w.cookies.vendor, id, { action: 'APPROVE' })).status).toBe(403);

    // Withdrawing (rejecting with a reason) one's own entry is allowed.
    const withdrawn = await reconcile(w.cookies.manager, id, {
      action: 'REJECT',
      rejectionReason: 'Entered by mistake',
    });
    expect(withdrawn.status).toBe(200);
    expect(
      (await testPrisma.bankTransferSubmission.findUniqueOrThrow({ where: { id } })).status,
    ).toBe('REJECTED');
  });

  it('a second person confirms it: the invoice is paid, a receipt exists and everyone concerned is told', async () => {
    const w = await world();
    const proof = await uploadProof(w.cookies.manager);
    const created = await submit(
      w.cookies.manager,
      transfer(w.vendorInvoice.id, { proofFileUrl: proof }),
    );
    expect(created.status).toBe(201);
    const id = created.body.data.id;

    // The landlord (not the submitter) is told, with a link their role can open.
    const told = await testPrisma.notification.findFirst({
      where: { recipientId: w.landlord.id, title: 'Bank transfer to confirm' },
    });
    expect(told?.link).toBe('/dashboard/reconciliation');
    expect(
      await testPrisma.notification.count({
        where: { recipientId: w.manager.id, title: 'Bank transfer to confirm' },
      }),
    ).toBe(0);
    expect((await attention(w.landlord)).find((r) => r.id === 'transfers-to-confirm')?.count).toBe(
      1,
    );
    // The one who recorded it is not asked to confirm their own entry.
    expect((await attention(w.manager)).some((r) => r.id === 'transfers-to-confirm')).toBe(false);

    // The vendor cannot read the proof until it is confirmed.
    expect((await apiFetch(proof, { cookie: w.cookies.vendor })).status).toBe(404);

    const ok = await reconcile(w.cookies.landlord, id, { action: 'APPROVE' });
    expect(ok.status).toBe(200);
    const payment = ok.body.data.payment;
    expect(payment.receiptNumber).toMatch(/^RCT-[0-9A-F]{10}$/);
    const invoice = await testPrisma.invoice.findUniqueOrThrow({
      where: { id: w.vendorInvoice.id },
    });
    expect(invoice.status).toBe('PAID');
    expect((await attention(w.landlord)).some((r) => r.id === 'transfers-to-confirm')).toBe(false);

    const vendorNote = await testPrisma.notification.findFirst({
      where: { recipientId: w.vendor.id, title: `Payment received: ${invoice.invoiceNumber}` },
    });
    expect(vendorNote?.link).toBe(`/receipts/${payment.id}`);
    const submitterNote = await testPrisma.notification.findFirst({
      where: { recipientId: w.manager.id, title: 'Bank transfer payment confirmed' },
    });
    expect(submitterNote?.link).toBe(`/receipts/${payment.id}`);

    // Confirmed: the vendor who was paid can now read the proof, a stranger still cannot.
    expect((await apiFetch(proof, { cookie: w.cookies.vendor })).status).toBe(200);
    expect(
      (await apiFetch(proof, { cookie: await cookieOf(await createUser(Role.VENDOR)) })).status,
    ).toBe(404);
  });

  it('refuses an amount above what is owing and a bank reference used before', async () => {
    const w = await world();
    const tooMuch = await submit(
      w.cookies.manager,
      transfer(w.vendorInvoice.id, { amount: 50_001 }),
    );
    expect(tooMuch.status).toBe(400);

    const body = transfer(w.vendorInvoice.id, { amount: 10_000 });
    expect((await submit(w.cookies.manager, body)).status).toBe(201);
    expect((await submit(w.cookies.landlord, body)).status).toBe(409);
  });

  it('lets a tenant record their own transfer, which the property team then confirms', async () => {
    const w = await world();
    const created = await submit(
      w.cookies.tenant,
      transfer(w.rentInvoice.id, { amount: 200_000, senderAccountName: 'Tunde Tenant' }),
    );
    expect(created.status).toBe(201);
    // The tenant cannot confirm their own, and the manager can.
    expect(
      (await reconcile(w.cookies.tenant, created.body.data.id, { action: 'APPROVE' })).status,
    ).toBe(403);
    const ok = await reconcile(w.cookies.manager, created.body.data.id, { action: 'APPROVE' });
    expect(ok.status).toBe(200);
    expect(
      (await testPrisma.invoice.findUniqueOrThrow({ where: { id: w.rentInvoice.id } })).status,
    ).toBe('PAID');
    expect(
      await testPrisma.notification.count({
        where: { recipientId: w.tenant.id, title: 'Bank transfer payment confirmed' },
      }),
    ).toBe(1);
  });

  it('tells the admins instead when the submitter is the only one on the property team', async () => {
    const landlord = await createUser(Role.LANDLORD);
    const property = await createProperty({ landlordId: landlord.id });
    const unit = await createUnit(property.id);
    const tenant = await createUser(Role.TENANT);
    const lease = await createLease(unit.id, tenant.id);
    const invoice = await createInvoice({
      leaseId: lease.id,
      amount: 90_000,
      type: InvoiceType.RENT,
    });
    const admin = await createUser(Role.ADMIN);

    const created = await submit(
      await cookieOf(landlord),
      transfer(invoice.id, { amount: 90_000 }),
    );
    expect(created.status).toBe(201);
    const told = await testPrisma.notification.findFirst({
      where: { recipientId: admin.id, title: 'Bank transfer to confirm' },
    });
    expect(told?.link).toBe('/admin/payments');
    expect(
      (await attention(admin)).find((r) => r.id === 'admin-transfers')?.count,
    ).toBeGreaterThanOrEqual(1);
    // The admin can confirm it.
    const ok = await reconcile(await cookieOf(admin), created.body.data.id, { action: 'APPROVE' });
    expect(ok.status).toBe(200);
  });
});

describe('offline payments: who can list transfers', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('scopes the list by role and refuses everyone else (a vendor used to get every transfer)', async () => {
    const w = await world();
    const other = await world();
    await submit(w.cookies.tenant, transfer(w.rentInvoice.id, { amount: 1000 }));
    await submit(other.cookies.tenant, transfer(other.rentInvoice.id, { amount: 1000 }));

    const list = (cookie: string) =>
      apiFetch<{ data: { id: string }[] }>('/api/v1/bank-transfers', { cookie });

    const asTenant = await list(w.cookies.tenant);
    expect(asTenant.body.data).toHaveLength(1);
    const asManager = await list(w.cookies.manager);
    expect(asManager.body.data).toHaveLength(1);
    expect(asManager.body.data[0].id).toBe(asTenant.body.data[0].id);
    const asAdmin = await list(await cookieOf(await createUser(Role.ADMIN)));
    expect(asAdmin.body.data).toHaveLength(2);

    expect((await list(w.cookies.vendor)).status).toBe(403);
    expect((await apiFetch('/api/v1/bank-transfers')).status).toBe(401);
  });
});

describe('receipts', () => {
  beforeAll(async () => {
    await resetDb();
  });

  async function paidVendorInvoice() {
    const w = await world();
    const proof = await uploadProof(w.cookies.manager);
    const created = await submit(
      w.cookies.manager,
      transfer(w.vendorInvoice.id, { proofFileUrl: proof }),
    );
    const ok = await reconcile(w.cookies.landlord, created.body.data.id, { action: 'APPROVE' });
    return { w, proof, payment: ok.body.data.payment as { id: string; receiptNumber: string } };
  }

  it('is for the payer, the one paid, the property team and admins only', async () => {
    const { w, payment } = await paidVendorInvoice();
    const get = (cookie?: string) => apiFetch(`/api/v1/payments/${payment.id}/receipt`, { cookie });

    for (const cookie of [
      w.cookies.vendor,
      w.cookies.manager,
      w.cookies.landlord,
      await cookieOf(await createUser(Role.ADMIN)),
    ]) {
      expect((await get(cookie)).status).toBe(200);
    }
    // The tenant is not a party to the vendor's bill, and strangers see "not found", not "forbidden".
    expect((await get(w.cookies.tenant)).status).toBe(404);
    expect((await get(await cookieOf(await createUser(Role.VENDOR)))).status).toBe(404);
    expect((await get(await cookieOf(await createUser(Role.MANAGER)))).status).toBe(404);
    expect((await get()).status).toBe(401);
    expect(
      (await apiFetch('/api/v1/payments/not-a-real-id/receipt', { cookie: w.cookies.vendor }))
        .status,
    ).toBe(404);
  });

  it('says who paid whom, how, and who confirmed it, without private details', async () => {
    const { w, proof, payment } = await paidVendorInvoice();
    const res = await apiFetch(`/api/v1/payments/${payment.id}/receipt`, {
      cookie: w.cookies.vendor,
    });
    const r = res.body.data;
    expect(r.receiptNumber).toBe(payment.receiptNumber);
    expect(r.amount).toBe(50_000);
    expect(r.payee.name).toBe('Vera Pipes Ltd');
    expect(r.payer.name).toBe('Lola Landlord');
    expect(r.method).toBe('Bank transfer');
    expect(r.invoice.balance).toBe(0);
    expect(r.transfer).toMatchObject({
      bankName: 'GTBank',
      recordedBy: 'Mary Manager',
      confirmedBy: 'Lola Landlord',
    });
    expect(r.proofFileUrl).toBe(proof);
    const text = JSON.stringify(res.body);
    for (const secret of ['@test.local', 'passwordHash', 'rawProviderPayload', 'phoneNumber']) {
      expect(text).not.toContain(secret);
    }
  });

  it('shows a note a person typed on a receipt, never the automatic one (ISS-118)', async () => {
    const receiptNotes = async (cookie: string, paymentId: string) =>
      (await apiFetch(`/api/v1/payments/${paymentId}/receipt`, { cookie })).body.data.notes;

    // Confirmed with no note typed: the stored note is automatic and the receipt shows none.
    const { w, payment } = await paidVendorInvoice();
    const stored = await testPrisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(stored.notes).toMatch(/^Confirmed from bank transfer reference /);
    expect(stored.notes).not.toContain('Reconciled by');
    expect(await receiptNotes(w.cookies.vendor, payment.id)).toBeNull();

    // A payment confirmed before the wording changed still shows nothing.
    await testPrisma.payment.update({
      where: { id: payment.id },
      data: { notes: 'Reconciled by MANAGER from bank transfer ref ABC123' },
    });
    expect(await receiptNotes(w.cookies.vendor, payment.id)).toBeNull();

    // A note the confirming person wrote is shown as written.
    const created = await submit(w.cookies.manager, transfer(w.rentInvoice.id, { amount: 1000 }));
    const ok = await reconcile(w.cookies.landlord, created.body.data.id, {
      action: 'APPROVE',
      notes: 'Part payment, balance promised on Friday',
    });
    expect(await receiptNotes(w.cookies.tenant, ok.body.data.payment.id)).toBe(
      'Part payment, balance promised on Friday',
    );
  });

  it('shows a rent receipt to the tenant who paid and not to the vendor', async () => {
    const w = await world();
    const created = await submit(
      w.cookies.tenant,
      transfer(w.rentInvoice.id, { amount: 200_000, senderAccountName: 'Tunde Tenant' }),
    );
    const ok = await reconcile(w.cookies.manager, created.body.data.id, { action: 'APPROVE' });
    const id = ok.body.data.payment.id;
    const asTenant = await apiFetch(`/api/v1/payments/${id}/receipt`, { cookie: w.cookies.tenant });
    expect(asTenant.status).toBe(200);
    expect(asTenant.body.data.payer.name).toBe('Tunde Tenant');
    expect(asTenant.body.data.payee.name).toBe('Lola Landlord');
    expect(
      (await apiFetch(`/api/v1/payments/${id}/receipt`, { cookie: w.cookies.vendor })).status,
    ).toBe(404);
  });

  it('sends a signed-out visitor to sign in and back, not straight to the page', async () => {
    const res = await apiFetch('/receipts/some-payment-id');
    expect([302, 307, 308]).toContain(res.status);
    expect(res.headers.get('location')).toContain('from=%2Freceipts%2Fsome-payment-id');
  });

  it('gives every payment a receipt number, even one recorded without any transfer', async () => {
    const w = await world();
    const payment = await testPrisma.payment.create({
      data: { invoiceId: w.rentInvoice.id, amount: 1000, paymentMethod: 'CASH', provider: 'CASH' },
    });
    expect(payment.receiptNumber).toMatch(/^RCT-[0-9A-F]{10}$/);
    const other = await testPrisma.payment.create({
      data: { invoiceId: w.rentInvoice.id, amount: 1000, paymentMethod: 'CASH', provider: 'CASH' },
    });
    expect(other.receiptNumber).not.toBe(payment.receiptNumber);
  });
});

describe('payments: what the API never returns, and who is told', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('never returns the provider payload (payer email, card details) in any invoice, lease or transfer response', async () => {
    const w = await world();
    const secretPayload = JSON.stringify({
      data: {
        customer: { email: 'card.holder@example.com' },
        authorization: { last4: 'ZZ-CARD-MARKER' },
      },
    });
    const payment = await testPrisma.payment.create({
      data: {
        invoiceId: w.rentInvoice.id,
        amount: 5000,
        paymentMethod: 'CREDIT_CARD',
        provider: 'PAYSTACK',
        transactionRef: 'ps-ref-1',
        rawProviderPayload: secretPayload,
        virtualAccountNumber: '0123456789',
      },
    });
    const vendorPayment = await testPrisma.payment.create({
      data: {
        invoiceId: w.vendorInvoice.id,
        amount: 5000,
        paymentMethod: 'CREDIT_CARD',
        provider: 'PAYSTACK',
        transactionRef: 'ps-ref-2',
        rawProviderPayload: secretPayload,
      },
    });

    const calls: [string, string][] = [
      ['/api/v1/invoices', w.cookies.tenant],
      ['/api/v1/invoices', w.cookies.manager],
      ['/api/v1/invoices', w.cookies.vendor],
      [`/api/v1/invoices/${w.rentInvoice.id}`, w.cookies.tenant],
      [`/api/v1/invoices/${w.rentInvoice.id}`, w.cookies.manager],
      [`/api/v1/leases/${w.lease.id}`, w.cookies.tenant],
      [`/api/v1/leases/${w.lease.id}`, w.cookies.manager],
      [`/api/v1/maintenance/requests/${w.job.id}`, w.cookies.manager],
      [`/api/v1/maintenance/requests/${w.job.id}`, w.cookies.vendor],
    ];
    for (const [url, cookie] of calls) {
      const res = await apiFetch(url, { cookie });
      expect(res.status, url).toBe(200);
      const text = JSON.stringify(res.body);
      expect(text, url).not.toContain('rawProviderPayload');
      expect(text, url).not.toContain('card.holder@example.com');
      expect(text, url).not.toContain('ZZ-CARD-MARKER');
      expect(text, url).not.toContain('virtualAccountNumber');
    }
    // The fields a screen needs are still there, with the receipt number.
    const list = await apiFetch('/api/v1/invoices', { cookie: w.cookies.tenant });
    const row = list.body.data.find((i: { id: string }) => i.id === w.rentInvoice.id);
    expect(row.payments[0]).toMatchObject({
      id: payment.id,
      amount: 5000,
      transactionRef: 'ps-ref-1',
      receiptNumber: payment.receiptNumber,
    });
    expect(vendorPayment.receiptNumber).toMatch(/^RCT-/);
  });

  it('tells the vendor, with the receipt, when the manager pays their invoice by card', async () => {
    const w = await world({ amount: 30_000 });
    const rawBody = JSON.stringify({
      event: 'charge.success',
      data: {
        reference: `card-${w.vendorInvoice.id}`,
        amount: 30_000 * 100,
        channel: 'card',
        paid_at: new Date().toISOString(),
        metadata: { invoiceId: w.vendorInvoice.id },
      },
    });
    const res = await apiFetch('/api/v1/payments/webhook', {
      method: 'POST',
      headers: { 'x-paystack-signature': signWebhookBody(rawBody) },
      rawBody,
    });
    expect(res.status).toBe(200);
    const payment = await testPrisma.payment.findFirstOrThrow({
      where: { invoiceId: w.vendorInvoice.id },
    });
    const note = await testPrisma.notification.findFirst({
      where: { recipientId: w.vendor.id, title: { startsWith: 'Payment received:' } },
    });
    expect(note?.link).toBe(`/receipts/${payment.id}`);
    expect(
      (await apiFetch(`/api/v1/payments/${payment.id}/receipt`, { cookie: w.cookies.vendor }))
        .status,
    ).toBe(200);
  });

  it('will not let one person mark a tenant or vendor invoice paid by hand (ISS-117)', async () => {
    const w = await world({ amount: 40_000 });
    for (const [invoice, owed] of [
      [w.vendorInvoice, 40_000],
      [w.rentInvoice, 200_000],
    ] as const) {
      for (const who of [w.cookies.manager, w.cookies.landlord]) {
        const res = await apiFetch(`/api/v1/invoices/${invoice.id}/payments`, {
          method: 'POST',
          cookie: who,
          body: { amount: owed, method: 'CASH', reference: `cash-${invoice.id}` },
        });
        expect(res.status).toBe(409);
        expect(res.body.error).toContain('paid another way');
      }
      expect(await testPrisma.payment.count({ where: { invoiceId: invoice.id } })).toBe(0);
      expect(
        (await testPrisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).status,
      ).toBe('UNPAID');
    }
  });

  it("a tenant's rent entered by the team is only paid once someone else confirms it (ISS-117)", async () => {
    const w = await world();
    const created = await submit(
      w.cookies.manager,
      transfer(w.rentInvoice.id, { amount: 200_000, senderAccountName: 'Tunde Tenant' }),
    );
    expect(created.status).toBe(201);
    const id = created.body.data.id;

    // Recorded, not paid: the invoice has not moved and the recorder cannot confirm it.
    expect(
      (await testPrisma.invoice.findUniqueOrThrow({ where: { id: w.rentInvoice.id } })).status,
    ).toBe('UNPAID');
    expect((await reconcile(w.cookies.manager, id, { action: 'APPROVE' })).status).toBe(403);

    const ok = await reconcile(w.cookies.landlord, id, { action: 'APPROVE' });
    expect(ok.status).toBe(200);
    expect(
      (await testPrisma.invoice.findUniqueOrThrow({ where: { id: w.rentInvoice.id } })).status,
    ).toBe('PAID');
    const told = await testPrisma.notification.findFirst({
      where: { recipientId: w.tenant.id, title: 'Payment recorded' },
    });
    expect(told?.link).toBe(`/receipts/${ok.body.data.payment.id}`);
  });
});

async function setRules(data: {
  requireSecondPersonForTenantPayments?: boolean;
  requireSecondPersonForVendorPayments?: boolean;
}) {
  await testPrisma.systemSettings.upsert({
    where: { id: 'global' },
    update: data,
    create: { id: 'global', ...data },
  });
}

describe('the two-person rule is an admin switch (tenant payments and vendor payments)', () => {
  beforeAll(async () => {
    await resetDb();
  });
  afterEach(async () => {
    await setRules({
      requireSecondPersonForTenantPayments: true,
      requireSecondPersonForVendorPayments: true,
    });
  });

  it('shows the rules to the team and an admin only, on by default, and an admin changes each one alone', async () => {
    const w = await world();
    const admin = await createUser(Role.ADMIN);
    const adminCookie = await cookieOf(admin);
    const rules = (cookie: string) => apiFetch('/api/v1/settings/payment-rules', { cookie });

    for (const cookie of [w.cookies.manager, w.cookies.landlord, adminCookie]) {
      const res = await rules(cookie);
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({
        requireSecondPersonForTenantPayments: true,
        requireSecondPersonForVendorPayments: true,
      });
    }
    expect((await rules(w.cookies.tenant)).status).toBe(403);
    expect((await rules(w.cookies.vendor)).status).toBe(403);
    expect((await apiFetch('/api/v1/settings/payment-rules')).status).toBe(401);

    const patch = (cookie: string, body: object) =>
      apiFetch('/api/v1/admin/settings', { method: 'PATCH', cookie, body });
    expect(
      (await patch(w.cookies.manager, { requireSecondPersonForTenantPayments: false })).status,
    ).toBe(403);
    expect((await patch(adminCookie, { requireSecondPersonForVendorPayments: false })).status).toBe(
      200,
    );
    expect((await rules(w.cookies.manager)).body.data).toEqual({
      requireSecondPersonForTenantPayments: true,
      requireSecondPersonForVendorPayments: false,
    });
  });

  it("with the tenant switch off, the team's own entry on a tenant's invoice counts at once and leaves a trail", async () => {
    const w = await world();
    await setRules({ requireSecondPersonForTenantPayments: false });

    const created = await submit(
      w.cookies.manager,
      transfer(w.rentInvoice.id, { amount: 200_000, senderAccountName: 'Tunde Tenant' }),
    );
    expect(created.status).toBe(201);
    expect(created.body.data.status).toBe('APPROVED');
    expect(created.body.data.paymentId).toBeTruthy();

    expect(
      (await testPrisma.invoice.findUniqueOrThrow({ where: { id: w.rentInvoice.id } })).status,
    ).toBe('PAID');
    const payment = await testPrisma.payment.findUniqueOrThrow({
      where: { id: created.body.data.paymentId },
    });
    expect(payment.receiptNumber).toMatch(/^RCT-/);
    expect(
      (await apiFetch(`/api/v1/payments/${payment.id}/receipt`, { cookie: w.cookies.tenant }))
        .status,
    ).toBe(200);

    // The audit row says the recorder confirmed it themselves, so the trail is not hidden.
    const audit = await testPrisma.auditLog.findFirstOrThrow({
      where: { action: 'BANK_TRANSFER_RECONCILED', entityId: created.body.data.id },
    });
    expect(audit.actorId).toBe(w.manager.id);
    expect(audit.metadata).toMatchObject({ confirmedByRecorder: true });

    // Nobody is asked to confirm it, the recorder is not told about their own entry, the tenant is.
    expect(
      await testPrisma.notification.count({
        where: { title: 'Bank transfer to confirm', recipientId: { in: [w.landlord.id] } },
      }),
    ).toBe(0);
    expect(
      await testPrisma.notification.count({
        where: { recipientId: w.manager.id, title: 'Bank transfer payment confirmed' },
      }),
    ).toBe(0);
    const told = await testPrisma.notification.findFirst({
      where: { recipientId: w.tenant.id, title: 'Payment recorded' },
    });
    expect(told?.link).toBe(`/receipts/${payment.id}`);
  });

  it("a tenant's own transfer still waits for the team, whatever the switches say", async () => {
    const w = await world();
    await setRules({
      requireSecondPersonForTenantPayments: false,
      requireSecondPersonForVendorPayments: false,
    });
    const created = await submit(
      w.cookies.tenant,
      transfer(w.rentInvoice.id, { amount: 200_000, senderAccountName: 'Tunde Tenant' }),
    );
    expect(created.status).toBe(201);
    expect(created.body.data.status).toBe('PENDING');
    expect(
      (await testPrisma.invoice.findUniqueOrThrow({ where: { id: w.rentInvoice.id } })).status,
    ).toBe('UNPAID');
  });

  it('the two switches are independent: tenant off leaves vendor payments waiting for a second person', async () => {
    const w = await world();
    await setRules({ requireSecondPersonForTenantPayments: false });
    const created = await submit(w.cookies.manager, transfer(w.vendorInvoice.id));
    expect(created.status).toBe(201);
    expect(created.body.data.status).toBe('PENDING');
    expect(
      (await reconcile(w.cookies.manager, created.body.data.id, { action: 'APPROVE' })).status,
    ).toBe(403);
  });

  it("with the vendor switch off, the team's own entry on a vendor's bill counts at once and the vendor is told", async () => {
    const w = await world({ amount: 40_000 });
    await setRules({ requireSecondPersonForVendorPayments: false });
    const created = await submit(
      w.cookies.manager,
      transfer(w.vendorInvoice.id, { amount: 40_000 }),
    );
    expect(created.status).toBe(201);
    expect(created.body.data.status).toBe('APPROVED');
    expect(
      (await testPrisma.invoice.findUniqueOrThrow({ where: { id: w.vendorInvoice.id } })).status,
    ).toBe('PAID');
    const note = await testPrisma.notification.findFirst({
      where: { recipientId: w.vendor.id, title: { startsWith: 'Payment received:' } },
    });
    expect(note?.link).toBe(`/receipts/${created.body.data.paymentId}`);
  });

  it('switching it off later lets the recorder confirm an entry that was already waiting', async () => {
    const w = await world();
    const created = await submit(w.cookies.manager, transfer(w.vendorInvoice.id));
    const id = created.body.data.id;
    expect(created.body.data.status).toBe('PENDING');
    expect((await reconcile(w.cookies.manager, id, { action: 'APPROVE' })).status).toBe(403);

    await setRules({ requireSecondPersonForVendorPayments: false });
    const ok = await reconcile(w.cookies.manager, id, { action: 'APPROVE' });
    expect(ok.status).toBe(200);
    expect(
      (await testPrisma.bankTransferSubmission.findUniqueOrThrow({ where: { id } })).status,
    ).toBe('APPROVED');
  });
});
