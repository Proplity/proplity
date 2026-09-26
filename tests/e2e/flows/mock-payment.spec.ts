import { test, expect, type APIRequestContext } from '@playwright/test';
import { loginAs, SEED_USERS, SEED_PASSWORD } from '../helpers/auth';

// Needs a reachable, seeded database, AND NEXT_PUBLIC_PAYMENTS_MOCK_ENABLED=true
// with no real PAYSTACK_SECRET_KEY configured (see lib/payments/mockGateway.ts).
// Skips itself when that isn't the case, rather than failing.

// Logs in as manager on `request` ONLY (a second /auth/login call on the
// same APIRequestContext would overwrite that session cookie, since it's
// the same cookie jar) -- the tenant is identified by email off the
// manager's own lease list instead of a second login.
async function createUnpaidInvoiceForTenant(
  request: APIRequestContext,
  baseURL: string,
  amount: number,
  description: string,
) {
  // /auth/login's CSRF check requires an Origin (or Referer) header matching
  // the request's own host -- present automatically on a browser-driven
  // fetch, but request.post() sends neither by default.
  const loginRes = await request.post('/api/v1/auth/login', {
    headers: { origin: baseURL },
    data: { email: SEED_USERS.manager.email, password: SEED_PASSWORD },
  });
  expect(loginRes.ok()).toBe(true);

  const leasesRes = await request.get('/api/v1/leases');
  const leases = (await leasesRes.json()).data as Array<{
    id: string;
    status: string;
    tenant: { email: string } | null;
  }>;
  const lease = leases.find(
    (l) => l.tenant?.email === SEED_USERS.tenant.email && l.status === 'ACTIVE',
  );
  if (!lease) throw new Error('No active lease found for the seeded tenant');

  const invoiceRes = await request.post('/api/v1/invoices', {
    data: {
      leaseId: lease.id,
      type: 'RENT',
      amount,
      dueDate: new Date().toISOString(),
      description,
    },
  });
  expect(invoiceRes.ok()).toBe(true);
  return (await invoiceRes.json()).data as { id: string; status: string };
}

test('paying through the mock checkout marks the invoice paid via the real webhook', async ({
  page,
  request,
  baseURL,
}) => {
  test.skip(
    process.env.NEXT_PUBLIC_PAYMENTS_MOCK_ENABLED !== 'true',
    'Payments mock is not enabled on this run',
  );

  const invoice = await createUnpaidInvoiceForTenant(
    request,
    baseURL!,
    45_000,
    'E2E mock payment test',
  );
  expect(invoice.status).toBe('UNPAID');

  await loginAs(page, 'tenant');
  await page.waitForTimeout(500); // let the dashboard's invoice list settle

  const payButton = page.getByRole('button', { name: 'Pay Rent Online' });
  await expect(payButton).toBeVisible();
  await payButton.click();

  await expect(page).toHaveURL(/\/dev\/mock-checkout\?/);
  await expect(page.getByText('TEST MODE')).toBeVisible();
  await expect(page.getByText('₦45,000', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: /^Pay ₦/ }).click();
  await expect(page).toHaveURL(/\/dashboard\/payment-history/, { timeout: 10_000 });

  const body = await page.evaluate(
    async (id) =>
      (await (await fetch('/api/v1/invoices')).json()).data.find((i: any) => i.id === id),
    invoice.id,
  );
  expect(body.status).toBe('PAID');
  expect(body.payments).toHaveLength(1);
  expect(body.payments[0].provider).toBe('PAYSTACK');
});

test('a simulated declined payment leaves the invoice unpaid', async ({
  page,
  request,
  baseURL,
}) => {
  test.skip(
    process.env.NEXT_PUBLIC_PAYMENTS_MOCK_ENABLED !== 'true',
    'Payments mock is not enabled on this run',
  );

  const invoice = await createUnpaidInvoiceForTenant(
    request,
    baseURL!,
    15_000,
    'E2E mock decline test',
  );

  await loginAs(page, 'tenant');
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Pay Rent Online' }).click();
  await expect(page).toHaveURL(/\/dev\/mock-checkout\?/);
  await page.getByRole('button', { name: /Simulate a declined payment/i }).click();
  await expect(page).toHaveURL(/\/dashboard\/payment-history/, { timeout: 10_000 });

  const body = await page.evaluate(
    async (id) =>
      (await (await fetch('/api/v1/invoices')).json()).data.find((i: any) => i.id === id),
    invoice.id,
  );
  expect(body.status).toBe('UNPAID');
});
