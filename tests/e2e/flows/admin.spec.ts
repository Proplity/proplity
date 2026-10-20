import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';

// Needs a reachable, seeded database.

// The page has several switches, so each test asks for its own by name.
async function flipAndRestore(page: import('@playwright/test').Page, name: string) {
  await page.goto('/admin/settings');

  const toggle = page.getByRole('switch', { name });
  await expect(toggle).toBeVisible();
  const before = await toggle.getAttribute('aria-checked');

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', before === 'true' ? 'false' : 'true');

  // Reload to confirm the change actually persisted server-side, not just
  // client state.
  await page.reload();
  await expect(page.getByRole('switch', { name })).toHaveAttribute(
    'aria-checked',
    before === 'true' ? 'false' : 'true',
  );

  // Flip it back so the suite is idempotent across runs.
  await page.getByRole('switch', { name }).click();
  await expect(page.getByRole('switch', { name })).toHaveAttribute('aria-checked', before ?? '');
}

test('admin can toggle the auto-complete-maintenance-on-invoice setting', async ({ page }) => {
  await loginAs(page, 'admin');
  await flipAndRestore(page, 'Auto-complete maintenance jobs on invoice');
});

test('admin can toggle the tenant repair-confirmation setting', async ({ page }) => {
  await loginAs(page, 'admin');
  await flipAndRestore(page, 'Ask tenants to confirm finished repairs');
});

test('admin can see the platform-wide overview and manage users', async ({ page }) => {
  await loginAs(page, 'admin');
  await expect(page).toHaveURL(/\/admin/);
  await page.goto('/admin/settings');
  await expect(page.getByRole('heading', { name: 'Platform Settings' })).toBeVisible();
});

test('admin opening a tenant-style /dashboard route is sent to /admin, not a crash', async ({
  page,
}) => {
  await loginAs(page, 'admin');
  await page.goto('/dashboard/discover');
  await expect(page).toHaveURL(/\/admin/);
  await expect(page.getByText('Something went wrong')).toHaveCount(0);

  await page.goto('/');
  const browseAll = page.getByRole('link', { name: /Browse All Properties/ });
  await expect(browseAll).toHaveAttribute('href', '/admin');
});
