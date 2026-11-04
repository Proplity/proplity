import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';

// An admin opens the rent agreement settings. Needs a reachable, seeded database; the starting
// jurisdictions and draft templates are created the first time the page reads them. Read-only.

test('admin sees the agreement rules, the starting jurisdictions and the draft templates', async ({
  page,
}) => {
  await loginAs(page, 'admin');
  await page.goto('/admin/agreements');
  await expect(page.getByRole('heading', { name: 'Rent agreements' })).toBeVisible();

  await expect(page.getByText('Templates must be approved before use')).toBeVisible();

  await page.getByRole('tab', { name: 'Jurisdictions' }).click();
  await expect(page.getByText('Lagos State').first()).toBeVisible();
  await expect(page.getByText('Not reviewed by a lawyer').first()).toBeVisible();

  await page.getByRole('tab', { name: 'Templates' }).click();
  await expect(page.getByText('Residential tenancy agreement (Lagos State)')).toBeVisible();
  await expect(page.getByText('Draft').first()).toBeVisible();
});
