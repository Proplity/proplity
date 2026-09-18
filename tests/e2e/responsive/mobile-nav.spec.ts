import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';

// Regression coverage for mobile-responsiveness fixes: the public
// marketing nav had no way to reach its links on a phone (everything was
// `hidden md:flex` with no hamburger); the admin sidebar was a fixed
// 256px column with no responsive behavior at all; and the dashboard
// sidebar (tenant/landlord/manager/vendor) has since been replaced below
// `lg` with a floating bottom tab bar (see app/dashboard/MobileTabBar.tsx),
// matching the pattern requested from another in-house project.

test.use({ viewport: { width: 375, height: 812 } });

test.describe('marketing nav (no database needed)', () => {
  test('mobile menu reveals all nav links', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Contact Us' })).toBeHidden();

    await page.getByRole('button', { name: 'Open menu' }).click();
    const menu = page.locator('#mobile-menu');
    await expect(menu.getByRole('link', { name: 'For Landlords' })).toBeVisible();
    await expect(menu.getByRole('link', { name: 'For Tenants' })).toBeVisible();
    await expect(menu.getByRole('link', { name: 'For Service Providers' })).toBeVisible();
    await expect(menu.getByRole('link', { name: 'Contact Us' })).toBeVisible();
    await expect(menu.getByRole('link', { name: 'About Us' })).toBeVisible();
    await expect(menu.getByRole('link', { name: 'Pricing' })).toBeVisible();

    await menu.getByRole('link', { name: 'Pricing' }).click();
    await expect(page).toHaveURL(/\/pricing/);
  });

  test('no horizontal overflow on marketing pages at phone width', async ({ page }) => {
    for (const path of ['/', '/about', '/contact', '/pricing']) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${path} should not scroll horizontally`).toBeLessThanOrEqual(1);
    }
  });
});

test.describe('dashboard bottom tab bar (needs a reachable, seeded database)', () => {
  test('mobile shows a floating bottom tab bar instead of the sidebar', async ({ page }) => {
    await loginAs(page, 'tenant');
    await expect(page.locator('aside')).toBeHidden();
    await expect(page.getByRole('navigation', { name: 'Dashboard navigation' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Browse' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Payments' })).toBeVisible();

    await page.getByRole('link', { name: 'Payments' }).click();
    await expect(page).toHaveURL(/\/dashboard\/payment-history/);
  });

  test('"More" sheet holds overflow tabs plus quick actions', async ({ page }) => {
    await loginAs(page, 'manager');
    await page.getByRole('button', { name: 'More' }).click();
    await expect(page.getByRole('link', { name: 'Maintenance' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'List Property' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open AI Chat' })).toBeVisible();

    await page.getByRole('link', { name: 'Maintenance' }).click();
    await expect(page).toHaveURL(/\/dashboard\/maintenance/);
  });

  test('a role with exactly 3 tabs gets no "More" button', async ({ page }) => {
    await loginAs(page, 'vendor');
    await expect(page.getByRole('button', { name: 'More' })).toBeHidden();
  });

  test('desktop viewport keeps the static sidebar and hides the tab bar', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAs(page, 'landlord');
    await expect(page.getByRole('navigation', { name: 'Dashboard navigation' })).toBeHidden();
    await expect(page.getByRole('link', { name: 'Tenants' })).toBeVisible();
  });
});

test.describe('admin sidebar drawer (needs a reachable, seeded database)', () => {
  test('sidebar is hidden until the hamburger is opened, then closes on link click', async ({
    page,
  }) => {
    await loginAs(page, 'admin');
    await expect(page.locator('aside')).not.toBeInViewport();

    await page.getByRole('button', { name: 'Open menu' }).click();
    await expect(page.getByRole('link', { name: 'Platform Settings' })).toBeVisible();

    await page.getByRole('link', { name: 'Platform Settings' }).click();
    await expect(page).toHaveURL(/\/admin\/settings/);
    await expect(page.locator('aside')).not.toBeInViewport();
  });

  test('desktop viewport keeps the sidebar static with no hamburger', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAs(page, 'admin');
    await expect(page.getByRole('button', { name: 'Open menu' })).toBeHidden();
    await expect(page.getByRole('link', { name: 'User Management' })).toBeVisible();
  });
});
