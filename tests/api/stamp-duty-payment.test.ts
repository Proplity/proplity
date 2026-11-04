import crypto from 'crypto';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Role } from '@prisma/client';
import { resetDb, testPrisma } from '../helpers/db';
import {
  createUser,
  createProperty,
  createUnit,
  createRent,
  seedPlans,
  setSystemSettings,
} from '../helpers/fixtures';
import { authCookie } from '../helpers/auth';
import { apiFetch } from '../helpers/client';
import { ensureDefaultAgreementData } from '../../lib/agreements';

// Owner request of 2026-10-25: stamp duty can be paid through Proplity, and the admin can switch
// that on and off. Proplity quotes it from the place's rates, the person pays by card, and an admin
// pays the authority and records the receipt.

const PDF = new TextEncoder().encode('%PDF-1.4 stamp receipt');
let templateId = '';
let n = 0;
let refCounter = 0;

async function world() {
  const manager = await createUser(Role.MANAGER, { name: 'Bola Adeyemi' });
  const landlord = await createUser(Role.LANDLORD, { name: 'Mr Bello' });
  const tenant = await createUser(Role.TENANT, {
    name: 'Ada Okafor',
    email: `ada-${++n}@stamp.test`,
  });
  const property = await createProperty({
    managerId: manager.id,
    landlordId: landlord.id,
    name: `Stamp Court ${n}`,
  });
  const unit = await createUnit(property.id, { unitNumber: `S${n}` });
  const rent = await createRent(unit.id, tenant.id, {
    status: 'PENDING',
    rentAmount: 2_500_000,
    paymentFrequency: 'ANNUAL',
    startDate: new Date('2026-12-01T00:00:00Z'),
    endDate: new Date('2027-11-30T00:00:00Z'),
    deposit: 250_000,
  });
  return {
    manager,
    landlord,
    tenant,
    rent,
    m: await authCookie(manager.id, manager.role),
    t: await authCookie(tenant.id, tenant.role),
  };
}
type World = Awaited<ReturnType<typeof world>>;

const base = (w: World) => `/api/v1/rents/${w.rent.id}/agreement`;
const pay = (w: World, cookie: string, method: 'GET' | 'POST' = 'POST') =>
  apiFetch(`${base(w)}/stamp-duty/pay`, { method, cookie });
const sign = (w: World, cookie: string, fullName: string) =>
  apiFetch(`/api/v1/rents/${w.rent.id}/sign`, { method: 'POST', cookie, body: { fullName } });

/** A signed (executed) agreement. */
async function executed(w: World) {
  expect(
    (
      await apiFetch(base(w), {
        method: 'POST',
        cookie: w.m,
        body: { source: 'GENERATED', templateId },
      })
    ).status,
  ).toBe(201);
  await apiFetch(`${base(w)}/issue`, { method: 'POST', cookie: w.m, body: {} });
  await sign(w, w.t, 'Ada Okafor');
  await sign(w, w.m, 'Bola Adeyemi');
  return testPrisma.rentAgreement.findFirstOrThrow({ where: { rentId: w.rent.id } });
}

function webhookPay(invoiceId: string, amount: number, reference?: string) {
  const rawBody = JSON.stringify({
    event: 'charge.success',
    data: {
      reference: reference ?? `stamp-ref-${invoiceId}-${++refCounter}`,
      amount: amount * 100,
      channel: 'card',
      paid_at: new Date().toISOString(),
      metadata: { invoiceId },
    },
  });
  const signature = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY!)
    .update(rawBody)
    .digest('hex');
  return apiFetch('/api/v1/payments/webhook', {
    method: 'POST',
    headers: { 'x-paystack-signature': signature },
    rawBody,
  });
}

async function uploadReceipt(cookie: string) {
  const signed = await apiFetch('/api/v1/uploads/sign', {
    method: 'POST',
    cookie,
    body: {
      folder: 'rents',
      fileName: 'receipt.pdf',
      contentType: 'application/pdf',
      size: PDF.byteLength,
    },
  });
  const form = new FormData();
  form.append('fileId', signed.body.data.plan.fileId);
  form.append('file', new Blob([PDF as unknown as BlobPart], { type: 'application/pdf' }), 'r.pdf');
  await apiFetch('/api/v1/uploads/file', { method: 'POST', cookie, body: form });
  return signed.body.data.file.url as string;
}

const on = (extra: Record<string, unknown> = {}) =>
  setSystemSettings({
    id: 'global',
    agreementTemplatesNeedApproval: false,
    rentActivationRule: 'INDEPENDENT',
    chargeForAgreements: false,
    witnessesMustSign: false,
    stampDutyPaymentEnabled: true,
    stampDutyServiceFee: 1000,
    ...extra,
  });

describe('paying stamp duty through Proplity', () => {
  let admin: { id: string; role: Role };
  let adminCookie = '';

  beforeAll(async () => {
    await resetDb();
    await seedPlans();
    await ensureDefaultAgreementData();
    templateId = (
      await testPrisma.agreementTemplate.findFirstOrThrow({ where: { key: 'lagos-residential' } })
    ).id;
    admin = await createUser(Role.ADMIN);
    adminCookie = await authCookie(admin.id, admin.role);
  });
  beforeEach(async () => {
    await on();
    await testPrisma.jurisdiction.updateMany({
      where: { key: 'lagos' },
      data: {
        advanceRentMaxMonths: 12,
        advanceRentMode: 'WARN',
        stampDutyBasis: 'TERM_RENT',
        stampDutyTiers: [
          { upToYears: 7, ratePercent: 0.78 },
          { upToYears: 21, ratePercent: 3 },
          { upToYears: null, ratePercent: 6 },
        ],
      },
    });
  });

  it('is switched off by default, and says so', async () => {
    await on({ stampDutyPaymentEnabled: false });
    const w = await world();
    await executed(w);
    const offer = await pay(w, w.m, 'GET');
    expect(offer.body.data.enabled).toBe(false);
    const res = await pay(w, w.m);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('STAMP_DUTY_PAYMENT_OFF');
    expect(await testPrisma.stampDutyOrder.count()).toBe(0);
  });

  it('quotes the duty from the place’s rates plus the admin’s fee', async () => {
    const w = await world();
    await executed(w);
    const offer = await pay(w, w.m, 'GET');
    expect(offer.status).toBe(200);
    expect(offer.body.data).toMatchObject({ enabled: true, canPay: true, order: null });
    expect(offer.body.data.quote).toMatchObject({
      termYears: 1,
      ratePercent: 0.78,
      basisAmount: 2_500_000,
      dutyAmount: 19_500,
      serviceFee: 1000,
      total: 20_500,
    });
    // The tenant sees the same quote.
    expect((await pay(w, w.t, 'GET')).body.data.quote.total).toBe(20_500);
  });

  it('cannot be paid before the agreement is signed', async () => {
    const w = await world();
    await apiFetch(base(w), {
      method: 'POST',
      cookie: w.m,
      body: { source: 'GENERATED', templateId },
    });
    await apiFetch(`${base(w)}/issue`, { method: 'POST', cookie: w.m, body: {} });
    const offer = await pay(w, w.m, 'GET');
    expect(offer.body.data.canPay).toBe(false);
    expect(offer.body.data.reason).toMatch(/signed/);
    const res = await pay(w, w.m);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('NOT_SIGNED');
  });

  it('refuses a quote when the place has no rates', async () => {
    await testPrisma.jurisdiction.updateMany({
      where: { key: 'lagos' },
      data: { stampDutyTiers: [] },
    });
    const w = await world();
    await executed(w);
    const res = await pay(w, w.m);
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('NO_STAMP_RATE');
    const offer = await pay(w, w.m, 'GET');
    expect(offer.body.data.canPay).toBe(false);
  });

  it('makes an order and an invoice for the quote, kept out of the rent invoices', async () => {
    const w = await world();
    const agreement = await executed(w);
    const res = await pay(w, w.m);
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      status: 'AWAITING_PAYMENT',
      total: 20_500,
      dutyAmount: 19_500,
    });
    const invoice = await testPrisma.invoice.findUniqueOrThrow({
      where: { id: res.body.data.invoiceId },
    });
    expect(invoice).toMatchObject({
      type: 'STAMP_DUTY',
      amount: 20_500,
      userId: w.manager.id,
      rentId: null,
      status: 'UNPAID',
    });
    const order = await testPrisma.stampDutyOrder.findFirstOrThrow({
      where: { agreementId: agreement.id },
    });
    expect(order).toMatchObject({ dutyAmount: 19_500, serviceFee: 1000, ratePercent: 0.78 });

    // Only whoever asked can start paying the invoice.
    const init = (cookie: string) =>
      apiFetch('/api/v1/payments/initialize', {
        method: 'POST',
        cookie,
        body: { invoiceId: invoice.id },
      });
    expect((await init(w.t)).status).toBe(403);
    expect((await init(w.m)).status).not.toBe(403);
  });

  it('returns the same order when asked twice, and replaces it when the quote changed', async () => {
    const w = await world();
    await executed(w);
    const first = await pay(w, w.m);
    const again = await pay(w, w.m);
    expect(again.body.data.id).toBe(first.body.data.id);

    await on({ stampDutyServiceFee: 2500 });
    const changed = await pay(w, w.m);
    expect(changed.body.data.id).not.toBe(first.body.data.id);
    expect(changed.body.data.total).toBe(22_000);
    const old = await testPrisma.stampDutyOrder.findUniqueOrThrow({
      where: { id: first.body.data.id },
    });
    expect(old.status).toBe('CANCELLED');
    expect(
      (await testPrisma.invoice.findUniqueOrThrow({ where: { id: first.body.data.invoiceId } }))
        .status,
    ).toBe('CANCELLED');
  });

  it('lets the tenant pay for their own rent, but not a stranger', async () => {
    const w = await world();
    await executed(w);
    expect((await pay(w, w.t)).status).toBe(201);
    const stranger = await createUser(Role.MANAGER);
    expect((await pay(w, await authCookie(stranger.id, stranger.role))).status).toBe(403);
    const other = await createUser(Role.TENANT);
    expect((await pay(w, await authCookie(other.id, other.role))).status).toBe(403);
    expect((await pay(w, '')).status).toBe(401);
  });

  it('sends the paid order to the admins, marks the agreement in progress, and takes payment once', async () => {
    const w = await world();
    const agreement = await executed(w);
    const res = await pay(w, w.m);
    const ref = `stamp-once-${Date.now()}`;
    expect((await webhookPay(res.body.data.invoiceId, 20_500, ref)).status).toBe(200);
    expect((await webhookPay(res.body.data.invoiceId, 20_500, ref)).body.duplicate).toBe(true);

    const order = await testPrisma.stampDutyOrder.findUniqueOrThrow({
      where: { id: res.body.data.id },
    });
    expect(order.status).toBe('PAID');
    expect(order.paidAt).not.toBeNull();
    const row = await testPrisma.rentAgreement.findUniqueOrThrow({ where: { id: agreement.id } });
    expect(row).toMatchObject({ stampDutyStatus: 'IN_PROGRESS', stampDutyAmount: 19_500 });
    expect(
      await testPrisma.notification.count({
        where: { recipientId: admin.id, title: 'Stamp duty to process' },
      }),
    ).toBe(1);
    expect(
      await testPrisma.notification.count({
        where: { recipientId: w.manager.id, title: 'Stamp duty paid' },
      }),
    ).toBe(1);

    // Paid: no second order, and the team cannot overwrite Proplity's record by hand.
    const second = await pay(w, w.m);
    expect(second.status).toBe(409);
    expect(second.body.code).toBe('ALREADY_PAID');
    const manual = await apiFetch(`${base(w)}/stamp-duty`, {
      method: 'PATCH',
      cookie: w.m,
      body: { status: 'NOT_STARTED' },
    });
    expect(manual.status).toBe(409);
    expect(manual.body.code).toBe('STAMP_DUTY_IN_PROCESS');
    const offer = await pay(w, w.t, 'GET');
    expect(offer.body.data.order.status).toBe('PAID');
  });

  it('does not take a part payment as paid', async () => {
    const w = await world();
    await executed(w);
    const res = await pay(w, w.m);
    await webhookPay(res.body.data.invoiceId, 10_000);
    expect(
      (await testPrisma.stampDutyOrder.findUniqueOrThrow({ where: { id: res.body.data.id } }))
        .status,
    ).toBe('AWAITING_PAYMENT');
    await webhookPay(res.body.data.invoiceId, 10_500);
    expect(
      (await testPrisma.stampDutyOrder.findUniqueOrThrow({ where: { id: res.body.data.id } }))
        .status,
    ).toBe('PAID');
  });

  it('lets only an admin see the queue and work it', async () => {
    const w = await world();
    await executed(w);
    const res = await pay(w, w.m);
    await webhookPay(res.body.data.invoiceId, 20_500);

    expect((await apiFetch('/api/v1/admin/stamp-duty-orders', { cookie: w.m })).status).toBe(403);
    const queue = await apiFetch('/api/v1/admin/stamp-duty-orders', { cookie: adminCookie });
    expect(queue.status).toBe(200);
    const mine = queue.body.data.find((o: { id: string }) => o.id === res.body.data.id);
    expect(mine.agreement.rent.tenant.name).toBe('Ada Okafor');
    expect(mine.agreement.rent.unit.property.name).toContain('Stamp Court');
    expect(
      (await apiFetch('/api/v1/admin/stamp-duty-orders?status=BOGUS', { cookie: adminCookie }))
        .status,
    ).toBe(400);
    const done = await apiFetch(`/api/v1/admin/stamp-duty-orders/${res.body.data.id}/complete`, {
      method: 'POST',
      cookie: w.m,
      body: { reference: 'X', actualAmount: 1, receiptUrl: 'x' },
    });
    expect(done.status).toBe(403);
  });

  it('completes an order: the agreement is stamped with the reference, amount and receipt, and everyone is told', async () => {
    const w = await world();
    const agreement = await executed(w);
    const res = await pay(w, w.m);
    await webhookPay(res.body.data.invoiceId, 20_500);
    const receiptUrl = await uploadReceipt(adminCookie);
    const complete = (body: Record<string, unknown>) =>
      apiFetch(`/api/v1/admin/stamp-duty-orders/${res.body.data.id}/complete`, {
        method: 'POST',
        cookie: adminCookie,
        body: { reference: 'LIRS-778899', actualAmount: 19_500, receiptUrl, ...body },
      });

    expect((await complete({ reference: ' ' })).status).toBe(400);
    expect((await complete({ receiptUrl: 'https://example.com/r.pdf' })).status).toBe(400);
    const ok = await complete({});
    expect(ok.status).toBe(200);
    expect(ok.body.data.refundDue).toBe(0);

    const row = await testPrisma.rentAgreement.findUniqueOrThrow({ where: { id: agreement.id } });
    expect(row).toMatchObject({
      stampDutyStatus: 'STAMPED',
      stampDutyReference: 'LIRS-778899',
      stampDutyAmount: 19_500,
      stampDutyReceiptUrl: receiptUrl,
    });
    expect(row.stampedAt).not.toBeNull();
    const order = await testPrisma.stampDutyOrder.findUniqueOrThrow({
      where: { id: res.body.data.id },
    });
    expect(order).toMatchObject({
      status: 'COMPLETED',
      reference: 'LIRS-778899',
      completedById: admin.id,
    });
    for (const id of [w.manager.id, w.tenant.id]) {
      expect(
        await testPrisma.notification.count({
          where: { recipientId: id, title: 'Rent agreement stamped' },
        }),
      ).toBeGreaterThan(0);
    }
    expect(
      await testPrisma.auditLog.count({
        where: { entityId: order.id, action: 'STAMP_DUTY_COMPLETED' },
      }),
    ).toBe(1);

    // Done is done: not again, and not cancelled afterwards.
    expect((await complete({})).status).toBe(409);
    const late = await apiFetch(`/api/v1/admin/stamp-duty-orders/${order.id}/cancel`, {
      method: 'POST',
      cookie: adminCookie,
      body: { reason: 'oops' },
    });
    expect(late.status).toBe(409);
    expect((await pay(w, w.m)).body.code).toBe('ALREADY_STAMPED');
  });

  it('logs a refund when the authority charged less, and a shortfall when it charged more', async () => {
    const w = await world();
    await executed(w);
    const res = await pay(w, w.m);
    await webhookPay(res.body.data.invoiceId, 20_500);
    const receiptUrl = await uploadReceipt(adminCookie);
    const done = await apiFetch(`/api/v1/admin/stamp-duty-orders/${res.body.data.id}/complete`, {
      method: 'POST',
      cookie: adminCookie,
      body: { reference: 'R-1', actualAmount: 15_000, receiptUrl },
    });
    expect(done.body.data.refundDue).toBe(4500);
    const log = await testPrisma.auditLog.findFirstOrThrow({
      where: { entityId: res.body.data.id, action: 'STAMP_DUTY_REFUND_DUE' },
    });
    expect((log.metadata as { amount: number }).amount).toBe(4500);

    const w2 = await world();
    await executed(w2);
    const r2 = await pay(w2, w2.m);
    await webhookPay(r2.body.data.invoiceId, 20_500);
    await apiFetch(`/api/v1/admin/stamp-duty-orders/${r2.body.data.id}/complete`, {
      method: 'POST',
      cookie: adminCookie,
      body: {
        reference: 'R-2',
        actualAmount: 21_000,
        receiptUrl: await uploadReceipt(adminCookie),
      },
    });
    expect(
      await testPrisma.auditLog.count({
        where: { entityId: r2.body.data.id, action: 'STAMP_DUTY_SHORTFALL' },
      }),
    ).toBe(1);
  });

  it('cancels a paid order with a reason: refund logged, agreement back to not started, can be asked again', async () => {
    const w = await world();
    const agreement = await executed(w);
    const res = await pay(w, w.m);
    await webhookPay(res.body.data.invoiceId, 20_500);
    const cancel = (reason?: string) =>
      apiFetch(`/api/v1/admin/stamp-duty-orders/${res.body.data.id}/cancel`, {
        method: 'POST',
        cookie: adminCookie,
        body: reason === undefined ? {} : { reason },
      });
    expect((await cancel()).status).toBe(400);
    const out = await cancel('The document was refused');
    expect(out.status).toBe(200);
    expect(out.body.data.refundDue).toBe(true);

    const row = await testPrisma.rentAgreement.findUniqueOrThrow({ where: { id: agreement.id } });
    expect(row).toMatchObject({ stampDutyStatus: 'NOT_STARTED', stampDutyAmount: null });
    const log = await testPrisma.auditLog.findFirstOrThrow({
      where: { entityId: res.body.data.id, action: 'STAMP_DUTY_REFUND_DUE' },
    });
    expect((log.metadata as { amount: number }).amount).toBe(20_500);
    const told = await testPrisma.notification.findMany({
      where: { recipientId: w.manager.id, title: 'Stamp duty could not be done' },
    });
    expect(told).toHaveLength(1);
    expect(told[0].body).toContain('refunded');
    expect((await cancel('again')).status).toBe(409);

    // A new order can be made.
    const next = await pay(w, w.m);
    expect(next.status).toBe(201);
    expect(next.body.data.id).not.toBe(res.body.data.id);
  });

  it('withdraws an unpaid order and its invoice', async () => {
    const w = await world();
    await executed(w);
    const res = await pay(w, w.m);
    const out = await apiFetch(`/api/v1/admin/stamp-duty-orders/${res.body.data.id}/cancel`, {
      method: 'POST',
      cookie: adminCookie,
      body: { reason: 'Not wanted' },
    });
    expect(out.body.data.refundDue).toBe(false);
    expect(
      (await testPrisma.invoice.findUniqueOrThrow({ where: { id: res.body.data.invoiceId } }))
        .status,
    ).toBe('CANCELLED');
  });

  it('lists the refunds owed, and records each once it is paid back by hand', async () => {
    const w = await world();
    await executed(w);
    const res = await pay(w, w.m);
    await webhookPay(res.body.data.invoiceId, 20_500);
    const orderId = res.body.data.id as string;
    await apiFetch(`/api/v1/admin/stamp-duty-orders/${orderId}/cancel`, {
      method: 'POST',
      cookie: adminCookie,
      body: { reason: 'The document was refused' },
    });

    const list = (status?: string) =>
      apiFetch(`/api/v1/admin/stamp-duty-refunds${status ? `?status=${status}` : ''}`, {
        cookie: adminCookie,
      });
    const owed = (await list()).body.data.find((r: { orderId: string }) => r.orderId === orderId);
    expect(owed).toMatchObject({
      amount: 20_500,
      reason: 'The document was refused',
      refunded: null,
      buyer: { id: w.manager.id },
    });
    expect(owed.unit).toContain('Stamp Court');
    expect((await list('BOGUS')).status).toBe(400);
    expect((await apiFetch('/api/v1/admin/stamp-duty-refunds', { cookie: w.m })).status).toBe(403);

    const record = (cookie: string, body: unknown = { reference: 'PSTK-REFUND-1' }, id = orderId) =>
      apiFetch(`/api/v1/admin/stamp-duty-refunds/${id}/refunded`, {
        method: 'POST',
        cookie,
        body,
      });
    expect((await record(w.m)).status).toBe(403);
    expect((await record(adminCookie, { reference: 'x' })).status).toBe(400);
    expect((await record(adminCookie, { reference: 'PSTK-REFUND-1', extra: 1 })).status).toBe(400);
    expect((await record(adminCookie, undefined, crypto.randomUUID())).body.code).toBe(
      'NO_REFUND_DUE',
    );

    const done = await record(adminCookie);
    expect(done.status).toBe(200);
    expect(done.body.data).toMatchObject({ amount: 20_500, reference: 'PSTK-REFUND-1' });
    const told = await testPrisma.notification.findMany({
      where: { recipientId: w.manager.id, title: 'Your stamp duty refund was sent' },
    });
    expect(told).toHaveLength(1);
    expect(told[0].body).toContain('PSTK-REFUND-1');

    // Once only, even when asked twice at the same moment.
    const again = await record(adminCookie);
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('ALREADY_REFUNDED');
    expect(
      await testPrisma.auditLog.count({
        where: { entityId: orderId, action: 'STAMP_DUTY_REFUNDED' },
      }),
    ).toBe(1);

    const stillDue = (await list()).body.data.map((r: { orderId: string }) => r.orderId);
    expect(stillDue).not.toContain(orderId);
    const paidBack = (await list('REFUNDED')).body.data.find(
      (r: { orderId: string }) => r.orderId === orderId,
    );
    expect(paidBack.refunded).toMatchObject({ reference: 'PSTK-REFUND-1' });
  });

  it('records a refund only once when two admins click at the same moment', async () => {
    const w = await world();
    await executed(w);
    const res = await pay(w, w.m);
    await webhookPay(res.body.data.invoiceId, 20_500);
    await apiFetch(`/api/v1/admin/stamp-duty-orders/${res.body.data.id}/cancel`, {
      method: 'POST',
      cookie: adminCookie,
      body: { reason: 'Refused' },
    });
    const go = () =>
      apiFetch(`/api/v1/admin/stamp-duty-refunds/${res.body.data.id}/refunded`, {
        method: 'POST',
        cookie: adminCookie,
        body: { reference: 'PSTK-RACE' },
      });
    const results = await Promise.all([go(), go()]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(
      await testPrisma.auditLog.count({
        where: { entityId: res.body.data.id, action: 'STAMP_DUTY_REFUNDED' },
      }),
    ).toBe(1);
  });

  it('keeps the admin’s rates and switches in the settings and jurisdictions', async () => {
    const patch = (body: unknown) =>
      apiFetch('/api/v1/admin/settings', { method: 'PATCH', cookie: adminCookie, body });
    const ok = await patch({ stampDutyPaymentEnabled: true, stampDutyServiceFee: 1500 });
    expect(ok.body.data).toMatchObject({
      stampDutyPaymentEnabled: true,
      stampDutyServiceFee: 1500,
    });
    expect((await patch({ stampDutyServiceFee: -1 })).status).toBe(400);
    expect((await patch({ stampDutyServiceFee: 2.5 })).status).toBe(400);

    const lagos = await testPrisma.jurisdiction.findFirstOrThrow({ where: { key: 'lagos' } });
    const put = (body: unknown) =>
      apiFetch(`/api/v1/admin/jurisdictions/${lagos.id}`, {
        method: 'PATCH',
        cookie: adminCookie,
        body,
      });
    const saved = await put({
      stampDutyTiers: [
        { upToYears: 5, ratePercent: 1 },
        { upToYears: null, ratePercent: 4 },
      ],
      stampDutyBasis: 'ANNUAL_RENT',
    });
    expect(saved.status).toBe(200);
    expect(saved.body.data.stampDutyBasis).toBe('ANNUAL_RENT');
    expect(
      (
        await put({
          stampDutyTiers: [
            { upToYears: 9, ratePercent: 1 },
            { upToYears: 3, ratePercent: 2 },
          ],
        })
      ).status,
    ).toBe(400);
  });
});
