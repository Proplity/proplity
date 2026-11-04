import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';

// A manager opens a tenant's rent, sees the rent agreement card and starts making an agreement.
// Needs a reachable, seeded database. Read-only: nothing is saved.

test('manager sees the rent agreement card and opens the agreement form', async ({ page }) => {
  await loginAs(page, 'manager');
  await page.goto('/dashboard/tenants');
  await page.locator('tbody tr').first().click();
  await expect(page).toHaveURL(/\/dashboard\/tenants\/[^/]+$/);

  await expect(page.getByRole('heading', { name: 'Rent Agreement', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Create from a template' }).click();

  await expect(page).toHaveURL(/\/agreement$/);
  await expect(page.getByRole('heading', { name: 'Rent agreement', exact: true })).toBeVisible();
  // Either a template can be chosen, or the page says none has been approved yet.
  await expect(page.getByText(/No agreement template is available|Preview/).first()).toBeVisible();
});
