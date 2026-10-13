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
