import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';

// A manager opens a rent and the Renew form; an admin finds the renewal and reminder settings.
// Needs a reachable, seeded database. Read-only: nothing is saved or renewed.

test('manager opens the Renew form on a rent and cancels it', async ({ page }) => {
  await loginAs(page, 'manager');
  await page.goto('/dashboard/tenants');
  await page.locator('tbody tr').first().click();
  await expect(page).toHaveURL(/\/dashboard\/tenants\/[^/]+$/);

  await page.getByRole('button', { name: 'Renew Rent', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Renew Rent', exact: true })).toBeVisible();
  await expect(page.getByText('New Start Date')).toBeVisible();
  // With the admin's renewal switch on (the default), the new agreement can be prepared with it.
  await expect(page.getByLabel('Prepare the new agreement from this one')).toBeChecked();
  await page.getByRole('button', { name: 'Confirm Renewal' }).waitFor();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Renew Rent', exact: true })).toBeHidden();
});

test('admin sees the renewal, reminder and automatic renewal settings', async ({ page }) => {
  await loginAs(page, 'admin');
  await page.goto('/admin/agreements');
  await expect(page.getByText('Renew a rent with a new agreement', { exact: true })).toBeVisible();
  await expect(
    page.getByText('Send agreement and renewal reminders', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Rents can renew automatically', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Remind this many days before a rent ends')).toHaveValue(
    /^\d+(, \d+)*$/,
  );
  await expect(page.getByLabel('Prepare the renewal this many days before')).toBeVisible();
});
