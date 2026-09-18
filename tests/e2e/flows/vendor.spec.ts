import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';

// Needs a reachable, seeded database. prisma/seed.ts assigns vendor@proplity.com
// an IN_PROGRESS "Kitchen Sink Leaking" job -- this walks the same path a
// real vendor takes to get paid for it.

test('vendor can open a job and submit an invoice', async ({ page }) => {
  await loginAs(page, 'vendor');

  await page.getByText('Kitchen Sink Leaking').click();
  await expect(page.getByRole('heading', { name: 'Kitchen Sink Leaking' })).toBeVisible();

  await page.getByRole('button', { name: /mark complete & create invoice/i }).click();
  await expect(page.getByRole('heading', { name: 'INVOICE' })).toBeVisible();

  await page.getByPlaceholder('Item description').first().fill('Replaced pipe junction seal');
  await page.getByRole('button', { name: /submit invoice/i }).click();

  // Successful submission returns to the dashboard job list.
  await expect(page.getByText('Kitchen Sink Leaking')).toBeVisible({ timeout: 15_000 });
});
