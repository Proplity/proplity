import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';

// ISS-016: a manager can open a property's neighbourhood report editor and
// save a change. Needs a reachable, seeded database.
test('manager saves a neighbourhood report note', async ({ page }) => {
  await loginAs(page, 'manager');
  await page.goto('/dashboard/properties');
  await page
    .getByRole('button', { name: /^View Details$/ })
    .first()
    .click();
  await page.getByRole('link', { name: /Neighbourhood report/ }).click();
  await expect(page.getByRole('heading', { name: 'Neighbourhood report' })).toBeVisible();

  const note = `Checked ${Date.now()}`;
  await page
    .locator('section', { hasText: 'Security' })
    .first()
    .locator('textarea')
    .last()
    .fill(note);
  await page.getByRole('button', { name: 'Save report' }).click();
  await expect(page.getByText('Report saved.')).toBeVisible();

  await page.reload();
  await expect(page.locator('textarea').filter({ hasText: note })).toHaveCount(1);
});
