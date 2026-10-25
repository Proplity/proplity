import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';

// A manager previews a file of properties and units before anything is saved. Needs a reachable,
// seeded database. The preview never writes, so this leaves the seeded data alone.

const csv = (...rows: string[]) =>
  ['propertyName,address,city,unitNumber,rentAmount', ...rows].join('\n');

test('the import screen previews a file, lists problems by row and keeps Import off until it is clean', async ({
  page,
}) => {
  await loginAs(page, 'manager');
  await page.goto('/dashboard/properties');
  await page.getByRole('link', { name: 'Import from a file' }).click();
  await expect(page).toHaveURL(/\/dashboard\/properties\/import/);

  const chooser = page.getByLabel('Spreadsheet of properties, units and tenants');

  await chooser.setInputFiles({
    name: 'portfolio.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      csv('E2E Court,1 Test Road,Lagos,1A,2500000', 'E2E Court,1 Test Road,Lagos,1B,3000000'),
    ),
  });
  await expect(page.getByText('E2E Court', { exact: true })).toBeVisible();
  await expect(page.getByText('New, management only')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Import 2 units' })).toBeEnabled();

  await chooser.setInputFiles({
    name: 'bad.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      csv('E2E Court,1 Test Road,Lagos,1A,2500000', 'E2E Court,1 Test Road,Lagos,1B,lots'),
    ),
  });
  await expect(page.getByText(/Row 3: rentAmount must be a positive number/)).toBeVisible();
  await expect(page.getByRole('button', { name: /^Import \d+ unit/ })).toBeDisabled();
});
