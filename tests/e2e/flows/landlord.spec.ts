import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';

// Regression test for a gap found during the testing-guide audit: the
// landlord sidebar previously had no link to Tenants or Maintenance even
// though the backend already fully permitted it (see
// app/dashboard/DashboardChrome.tsx). Needs a reachable, seeded database.

test('landlord sidebar links to Tenants and Maintenance', async ({ page }) => {
  await loginAs(page, 'landlord');
  const nav = page.locator('nav');
  await expect(nav.getByRole('link', { name: 'Tenants' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Maintenance' })).toBeVisible();

  await nav.getByRole('link', { name: 'Tenants' }).click();
  await expect(page).toHaveURL(/\/dashboard\/tenants/);

  await nav.getByRole('link', { name: 'Maintenance' }).click();
  await expect(page).toHaveURL(/\/dashboard\/maintenance/);
});
