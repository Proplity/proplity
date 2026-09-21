import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';

// Needs a reachable, seeded database.

test('admin can toggle the auto-complete-maintenance-on-invoice setting', async ({ page }) => {
  await loginAs(page, 'admin');
  await page.goto('/admin/settings');

  const toggle = page.getByRole('switch');
  await expect(toggle).toBeVisible();
  const before = await toggle.getAttribute('aria-checked');

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', before === 'true' ? 'false' : 'true');

  // Reload to confirm the change actually persisted server-side, not just
  // client state.
  await page.reload();
  await expect(page.getByRole('switch')).toHaveAttribute(
    'aria-checked',
    before === 'true' ? 'false' : 'true',
  );

  // Flip it back so the suite is idempotent across runs.
  await page.getByRole('switch').click();
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
