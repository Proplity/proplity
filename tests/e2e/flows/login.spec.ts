import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';

// Needs a reachable, seeded database (prisma/seed.ts) -- set DATABASE_URL
// to a real Postgres instance and run `pnpm db:seed` first.

for (const role of ['admin', 'manager', 'landlord', 'tenant', 'vendor'] as const) {
  test(`${role} can log in and reaches their dashboard`, async ({ page }) => {
    await loginAs(page, role);
  });
}

test('logging out returns to the login page', async ({ page }) => {
  await loginAs(page, 'tenant');
  await page.getByTitle('Sign Out').click();
  await page.getByRole('button', { name: 'Confirm sign out' }).click();
  await expect(page).toHaveURL(/\/login/);
});
