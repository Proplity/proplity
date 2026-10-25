import crypto from 'crypto';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Role } from '@prisma/client';
import { resetDb, testPrisma } from '../helpers/db';
import { createUser, setSystemSettings } from '../helpers/fixtures';
import { authCookie } from '../helpers/auth';
import { apiFetch } from '../helpers/client';
import { creditBalance } from '../../lib/credits';

// Owner request of 2026-10-25: managers and landlords can buy credits, and the admin can switch
// buying on and off. The price and the credits come from the pack the admin edits; the credits are
// added only when the card payment is confirmed, and only once.

let refCounter = 0;

const post = (cookie: string, path: string, body: unknown) =>
  apiFetch(path, { method: 'POST', cookie, body });

async function login(role: Role = Role.MANAGER) {
  const user = await createUser(role);
  return { user, cookie: await authCookie(user.id, user.role) };
}

async function addPack(
  key: string,
  overrides: Partial<{ credits: number; price: number; isActive: boolean }> = {},
) {
  return testPrisma.creditPack.create({
    data: {
      key,
      name: `${key} pack`,
      credits: overrides.credits ?? 10,
      price: overrides.price ?? 4000,
      isActive: overrides.isActive ?? true,
      sortOrder: 10,
    },
  });
}

/** Paystack telling us a card payment landed on an invoice. */
function payInvoice(invoiceId: string, amount: number, reference?: string) {
  const ref = reference ?? `credit-ref-${invoiceId}-${++refCounter}`;
  const rawBody = JSON.stringify({
    event: 'charge.success',
    data: {
      reference: ref,
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

const entriesOf = (userId: string) =>
  testPrisma.creditEntry.findMany({ where: { userId, reason: 'PURCHASE' } });

describe('the credit shop', () => {
  beforeAll(async () => {
    await resetDb();
  });
  beforeEach(async () => {
    await setSystemSettings({ id: 'global', creditPurchaseEnabled: true });
  });

  it('lists the starting packs to a manager or landlord, with their balance', async () => {
    const { cookie } = await login();
    const res = await apiFetch('/api/v1/credits/packs', { cookie });
    expect(res.status).toBe(200);
    expect(res.body.data.enabled).toBe(true);
    expect(res.body.data.cardsAvailable).toBe(true);
    expect(res.body.data.balance).toBe(0);
    const keys = res.body.data.packs.map((p: { key: string }) => p.key);
    expect(keys).toEqual(expect.arrayContaining(['credits-5', 'credits-20', 'credits-50']));
    expect(
      (await apiFetch('/api/v1/credits/packs', { cookie: (await login(Role.LANDLORD)).cookie }))
        .status,
    ).toBe(200);
  });

  it('is closed to tenants and to a visitor who is not signed in', async () => {
    const tenant = await login(Role.TENANT);
    expect((await apiFetch('/api/v1/credits/packs', { cookie: tenant.cookie })).status).toBe(403);
    expect((await post(tenant.cookie, '/api/v1/credits/checkout', { packKey: 'x' })).status).toBe(
      403,
    );
    expect((await apiFetch('/api/v1/credits/packs')).status).toBe(401);
  });

  it('shows no packs and refuses to sell any while the admin has buying switched off', async () => {
    await setSystemSettings({ id: 'global', creditPurchaseEnabled: false });
    const { cookie } = await login();
    const list = await apiFetch('/api/v1/credits/packs', { cookie });
    expect(list.body.data.enabled).toBe(false);
    expect(list.body.data.packs).toEqual([]);
    const res = await post(cookie, '/api/v1/credits/checkout', { packKey: 'credits-5' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CREDIT_PURCHASE_OFF');
    expect(await testPrisma.invoice.count({ where: { type: 'CREDIT_PURCHASE' } })).toBe(0);
  });

  it('prices the invoice from the pack, never from the request', async () => {
    await addPack('shop-a', { credits: 12, price: 4500 });
    const { user, cookie } = await login();
    const sneaky = await post(cookie, '/api/v1/credits/checkout', {
      packKey: 'shop-a',
      amount: 1,
      credits: 9999,
    });
    expect(sneaky.status).toBe(400);

    const res = await post(cookie, '/api/v1/credits/checkout', { packKey: 'shop-a' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ amount: 4500, credits: 12, packName: 'shop-a pack' });
    const invoice = await testPrisma.invoice.findUniqueOrThrow({
      where: { id: res.body.data.invoiceId },
    });
    expect(invoice).toMatchObject({
      type: 'CREDIT_PURCHASE',
      amount: 4500,
      userId: user.id,
      status: 'UNPAID',
    });
    // Nothing is credited before the payment is confirmed.
    expect(await creditBalance(user.id)).toBe(0);
  });

  it('refuses an unknown pack and a pack that is not on sale', async () => {
    await addPack('shop-off', { isActive: false });
    const { cookie } = await login();
    expect((await post(cookie, '/api/v1/credits/checkout', { packKey: 'nope' })).status).toBe(404);
    expect((await post(cookie, '/api/v1/credits/checkout', { packKey: 'shop-off' })).status).toBe(
      404,
    );
  });

  it('returns the same invoice when the same pack is asked for twice', async () => {
    await addPack('shop-b');
    const { user, cookie } = await login();
    const first = await post(cookie, '/api/v1/credits/checkout', { packKey: 'shop-b' });
    const second = await post(cookie, '/api/v1/credits/checkout', { packKey: 'shop-b' });
    expect(second.body.data.invoiceId).toBe(first.body.data.invoiceId);
    expect(await testPrisma.creditPurchase.count({ where: { userId: user.id } })).toBe(1);
  });

  it('cancels an unpaid invoice made at an old price and makes a new one', async () => {
    const pack = await addPack('shop-c', { price: 3000 });
    const { cookie } = await login();
    const first = await post(cookie, '/api/v1/credits/checkout', { packKey: 'shop-c' });
    await testPrisma.creditPack.update({ where: { id: pack.id }, data: { price: 3500 } });
    const second = await post(cookie, '/api/v1/credits/checkout', { packKey: 'shop-c' });
    expect(second.body.data.invoiceId).not.toBe(first.body.data.invoiceId);
    expect(second.body.data.amount).toBe(3500);
    const old = await testPrisma.invoice.findUniqueOrThrow({
      where: { id: first.body.data.invoiceId },
    });
    expect(old.status).toBe('CANCELLED');
  });

  it('lets only the buyer start the card payment for the invoice', async () => {
    await addPack('shop-d');
    const buyer = await login();
    const other = await login();
    const res = await post(buyer.cookie, '/api/v1/credits/checkout', { packKey: 'shop-d' });
    const init = (cookie: string) =>
      post(cookie, '/api/v1/payments/initialize', { invoiceId: res.body.data.invoiceId });
    expect((await init(other.cookie)).status).toBe(403);
    // The buyer gets as far as the provider (which is not reachable from the test server).
    expect((await init(buyer.cookie)).status).not.toBe(403);
  });
});

describe('credits arriving with the payment', () => {
  beforeAll(async () => {
    await resetDb();
  });
  beforeEach(async () => {
    await setSystemSettings({ id: 'global', creditPurchaseEnabled: true });
  });

  it('adds the credits when the payment is confirmed, and tells the buyer', async () => {
    await addPack('pay-a', { credits: 15, price: 6000 });
    const { user, cookie } = await login();
    const res = await post(cookie, '/api/v1/credits/checkout', { packKey: 'pay-a' });
    const paid = await payInvoice(res.body.data.invoiceId, 6000);
    expect(paid.status).toBe(200);

    expect(await creditBalance(user.id)).toBe(15);
    const [entry] = await entriesOf(user.id);
    expect(entry).toMatchObject({ delta: 15, reason: 'PURCHASE' });
    expect(entry.note).toContain('pay-a pack');
    const purchase = await testPrisma.creditPurchase.findUniqueOrThrow({
      where: { invoiceId: res.body.data.invoiceId },
    });
    expect(purchase.creditedAt).not.toBeNull();
    expect(purchase.creditEntryId).toBe(entry.id);
    const invoice = await testPrisma.invoice.findUniqueOrThrow({
      where: { id: res.body.data.invoiceId },
    });
    expect(invoice.status).toBe('PAID');
    expect(
      await testPrisma.notification.count({
        where: { recipientId: user.id, title: 'Credits added' },
      }),
    ).toBe(1);
    // The shop shows the new balance.
    const shop = await apiFetch('/api/v1/credits/packs', { cookie });
    expect(shop.body.data.balance).toBe(15);
  });

  it('adds them once when Paystack delivers the same payment again', async () => {
    await addPack('pay-b', { credits: 8, price: 2000 });
    const { user, cookie } = await login();
    const res = await post(cookie, '/api/v1/credits/checkout', { packKey: 'pay-b' });
    const ref = `same-delivery-${Date.now()}`;
    expect((await payInvoice(res.body.data.invoiceId, 2000, ref)).status).toBe(200);
    const again = await payInvoice(res.body.data.invoiceId, 2000, ref);
    expect(again.body.duplicate).toBe(true);
    expect(await entriesOf(user.id)).toHaveLength(1);
    expect(await creditBalance(user.id)).toBe(8);
  });

  it('adds them once when two payments finish the invoice at the same time', async () => {
    await addPack('pay-c', { credits: 6, price: 1000 });
    const { user, cookie } = await login();
    const res = await post(cookie, '/api/v1/credits/checkout', { packKey: 'pay-c' });
    const results = await Promise.all([
      payInvoice(res.body.data.invoiceId, 1000),
      payInvoice(res.body.data.invoiceId, 1000),
      payInvoice(res.body.data.invoiceId, 1000),
    ]);
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(await entriesOf(user.id)).toHaveLength(1);
    expect(await creditBalance(user.id)).toBe(6);
  });

  it('adds nothing for a part payment, then the credits when the rest arrives', async () => {
    await addPack('pay-d', { credits: 20, price: 8000 });
    const { user, cookie } = await login();
    const res = await post(cookie, '/api/v1/credits/checkout', { packKey: 'pay-d' });
    await payInvoice(res.body.data.invoiceId, 3000);
    expect(await creditBalance(user.id)).toBe(0);
    await payInvoice(res.body.data.invoiceId, 5000);
    expect(await creditBalance(user.id)).toBe(20);
  });

  it('gives what the pack was when it was bought, even if the admin changes it afterwards', async () => {
    const pack = await addPack('pay-e', { credits: 10, price: 5000 });
    const { user, cookie } = await login();
    const res = await post(cookie, '/api/v1/credits/checkout', { packKey: 'pay-e' });
    await testPrisma.creditPack.update({
      where: { id: pack.id },
      data: { credits: 100, price: 9000 },
    });
    await payInvoice(res.body.data.invoiceId, 5000);
    expect(await creditBalance(user.id)).toBe(10);
  });

  it('still credits a purchase that was started before the admin switched buying off', async () => {
    await addPack('pay-f', { credits: 4, price: 900 });
    const { user, cookie } = await login();
    const res = await post(cookie, '/api/v1/credits/checkout', { packKey: 'pay-f' });
    await setSystemSettings({ id: 'global', creditPurchaseEnabled: false });
    await payInvoice(res.body.data.invoiceId, 900);
    expect(await creditBalance(user.id)).toBe(4);
  });

  it('does not credit a cancelled invoice, and flags the payment for an admin', async () => {
    const pack = await addPack('pay-g', { credits: 7, price: 700 });
    const { user, cookie } = await login();
    const res = await post(cookie, '/api/v1/credits/checkout', { packKey: 'pay-g' });
    await testPrisma.creditPack.update({ where: { id: pack.id }, data: { price: 800 } });
    await post(cookie, '/api/v1/credits/checkout', { packKey: 'pay-g' });
    await payInvoice(res.body.data.invoiceId, 700);
    expect(await creditBalance(user.id)).toBe(0);
    expect(
      await testPrisma.auditLog.count({
        where: { action: 'PAYMENT_ON_CANCELLED_INVOICE', entityId: res.body.data.invoiceId },
      }),
    ).toBe(1);
  });

  it('puts a team member’s purchase on the company account, where the partner sees it', async () => {
    await addPack('pay-h', { credits: 9, price: 2500 });
    const partner = await createUser(Role.MANAGER);
    const org = await testPrisma.organisation.create({
      data: { name: 'Diya & Co', ownerId: partner.id },
    });
    await testPrisma.user.update({ where: { id: partner.id }, data: { organisationId: org.id } });
    const member = await createUser(Role.MANAGER, { organisationId: org.id });
    const memberCookie = await authCookie(member.id, member.role);

    const res = await post(memberCookie, '/api/v1/credits/checkout', { packKey: 'pay-h' });
    await payInvoice(res.body.data.invoiceId, 2500);

    expect(await creditBalance(partner.id)).toBe(9);
    expect(await creditBalance(member.id)).toBe(9);
    const [entry] = await entriesOf(partner.id);
    expect(entry.createdById).toBe(member.id);
    expect(await entriesOf(member.id)).toHaveLength(0);
  });
});

describe('the admin’s credit packs', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('lets only an admin list, add, change and remove packs, and logs it', async () => {
    const admin = await login(Role.ADMIN);
    const manager = await login(Role.MANAGER);
    expect((await apiFetch('/api/v1/admin/credit-packs', { cookie: manager.cookie })).status).toBe(
      403,
    );

    const list = await apiFetch('/api/v1/admin/credit-packs', { cookie: admin.cookie });
    expect(list.status).toBe(200);
    expect(list.body.data.map((p: { key: string }) => p.key)).toContain('credits-20');

    const created = await post(admin.cookie, '/api/v1/admin/credit-packs', {
      key: 'big-bundle',
      name: 'Big bundle',
      credits: 500,
      price: 70_000,
    });
    expect(created.status).toBe(201);
    const id = created.body.data.id;

    const changed = await apiFetch(`/api/v1/admin/credit-packs/${id}`, {
      method: 'PATCH',
      cookie: admin.cookie,
      body: { price: 65_000, isActive: false },
    });
    expect(changed.status).toBe(200);
    expect(changed.body.data).toMatchObject({ price: 65_000, isActive: false });

    // A pack that is switched off is no longer sold.
    const shop = await apiFetch('/api/v1/credits/packs', { cookie: manager.cookie });
    expect(shop.body.data.packs.map((p: { key: string }) => p.key)).not.toContain('big-bundle');

    const removed = await apiFetch(`/api/v1/admin/credit-packs/${id}`, {
      method: 'DELETE',
      cookie: admin.cookie,
    });
    expect(removed.status).toBe(200);

    const actions = (await testPrisma.auditLog.findMany({ where: { entityId: id } })).map(
      (a) => a.action,
    );
    expect(actions).toEqual(
      expect.arrayContaining(['CREDIT_PACK_CREATED', 'CREDIT_PACK_UPDATED', 'CREDIT_PACK_DELETED']),
    );
  });

  it('refuses a bad key, a duplicate key, and sizes or prices that are not whole numbers', async () => {
    const admin = await login(Role.ADMIN);
    const make = (body: Record<string, unknown>) =>
      post(admin.cookie, '/api/v1/admin/credit-packs', {
        key: 'valid-key',
        name: 'Pack',
        credits: 5,
        price: 1000,
        ...body,
      });
    expect((await make({ key: 'Bad Key!' })).status).toBe(400);
    expect((await make({ credits: 2.5 })).status).toBe(400);
    expect((await make({ price: 0 })).status).toBe(400);
    expect((await make({})).status).toBe(201);
    expect((await make({})).status).toBeGreaterThanOrEqual(400);
  });

  it('switches buying on and off through the platform settings', async () => {
    const admin = await login(Role.ADMIN);
    const off = await apiFetch('/api/v1/admin/settings', {
      method: 'PATCH',
      cookie: admin.cookie,
      body: { creditPurchaseEnabled: false },
    });
    expect(off.status).toBe(200);
    expect(off.body.data.creditPurchaseEnabled).toBe(false);
    const shop = await apiFetch('/api/v1/credits/packs', {
      cookie: (await login(Role.MANAGER)).cookie,
    });
    expect(shop.body.data.enabled).toBe(false);
    await apiFetch('/api/v1/admin/settings', {
      method: 'PATCH',
      cookie: admin.cookie,
      body: { creditPurchaseEnabled: true },
    });
  });
});
