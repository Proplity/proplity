import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';

// An admin opens the stamp duty queue and the rent agreement rules. Needs a reachable, seeded
// database. Read-only: nothing is saved.

test('admin sees the stamp duty queue and its switch and rates', async ({ page }) => {
  await loginAs(page, 'admin');
  await page.getByRole('link', { name: 'Stamp duty' }).first().click();
  await expect(page).toHaveURL(/\/admin\/stamp-duty$/);
  await expect(page.getByRole('heading', { name: 'Stamp duty' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'To do' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText(/Nothing here|Unit /).first()).toBeVisible();
  await page.getByRole('tab', { name: 'Done' }).click();
  await expect(page.getByRole('tab', { name: 'Done' })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: 'Refunds' }).click();
  await expect(page.getByRole('tab', { name: 'Refunds' })).toHaveAttribute('aria-selected', 'true');
  await expect(
    page.getByText(/No refunds are owed|Mark as refunded|Paid back on/).first(),
  ).toBeVisible();

  await page.goto('/admin/agreements');
  await expect(page.getByText('People can pay stamp duty through Proplity')).toBeVisible();
  await expect(page.getByLabel('Stamp duty service fee (₦)')).toBeVisible();
  await page.getByRole('tab', { name: 'Jurisdictions' }).click();
  await page.getByRole('button', { name: 'Edit' }).first().click();
  await expect(page.getByText('Stamp duty rates (used to quote')).toBeVisible();
});
