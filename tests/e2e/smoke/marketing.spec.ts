import { test, expect } from '@playwright/test';

// These pages are fully static/server-rendered marketing content -- no
// database round trip involved -- so this spec runs anywhere, including
// environments with no DATABASE_URL access. Headings here are taglines
// (e.g. "Where Property Meets Simplicity"), not literal page names, so
// this only checks that a real heading rendered -- not its wording.
const PAGES = [
  '/',
  '/about',
  '/contact',
  '/pricing',
  '/for-landlords',
  '/for-tenants',
  '/for-vendors',
];

for (const path of PAGES) {
  test(`marketing page ${path} loads`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  });
}

test('homepage links to About, Contact and Pricing', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: /about/i }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /contact/i }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /pricing/i }).first()).toBeVisible();
});
