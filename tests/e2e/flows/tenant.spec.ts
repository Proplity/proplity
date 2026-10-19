import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';

// Needs a reachable, seeded database -- prisma/seed.ts gives
// tenant@proplity.com an active lease, which the maintenance request form
// requires.

test('tenant can submit a maintenance request', async ({ page }) => {
  await loginAs(page, 'tenant');
  await page.goto('/dashboard/maintenance-request/new');

  await page.getByRole('button', { name: 'Plumbing' }).click();
  await page.getByPlaceholder(/kitchen faucet is leaking/i).fill('E2E test: leaking tap');
  await page
    .getByPlaceholder(/please describe the issue/i)
    .fill('Automated end-to-end test submission -- safe to ignore/delete.');

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: /submit request/i }).click();

  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
});

test('tenant can view payment history', async ({ page }) => {
  await loginAs(page, 'tenant');
  await page.getByRole('link', { name: 'Payment History' }).click();
  await expect(page).toHaveURL(/\/dashboard\/payment-history/);
});

test('tenant can book a viewing on a future date (ISS-042)', async ({ page, request }) => {
  const list = await request.get('/api/v1/properties');
  const propertyId = (await list.json()).data[0].id as string;

  await loginAs(page, 'tenant');
  await page.goto(`/dashboard/properties/${propertyId}/schedule-viewing`);

  // The date field starts from tomorrow; pick a weekday inside the allowed range.
  const date = page.getByLabel('Viewing date');
  await expect(date).toBeVisible();
  const day = new Date();
  day.setDate(day.getDate() + 3);
  if (day.getDay() === 0) day.setDate(day.getDate() + 1);
  const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
  await date.fill(key);
  await page.getByLabel('Start time').selectOption('10:00');
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.locator('input[type="text"]').first().fill('Jordan Hayes');
  await page.locator('input[type="email"]').fill('tenant@proplity.com');
  await page.locator('input[type="tel"]').fill('+234 803 555 1234');
  await page.locator('input[type="checkbox"]').check();
  await page.getByRole('button', { name: 'Confirm Viewing' }).click();

  // Either booked, or already booked for that day by an earlier run.
  await expect(page.getByText(/Viewing Requested!|already booked/i)).toBeVisible({
    timeout: 15_000,
  });
});
