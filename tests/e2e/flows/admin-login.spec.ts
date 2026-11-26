import { test, expect } from '@playwright/test';
import { SEED_PASSWORD, loginAs } from '../helpers/auth';

// Administrators sign in at /admin/login and only there; everyone else signs in at /login and
// cannot use the admin page. Needs a reachable, seeded database.

async function submit(page: import('@playwright/test').Page, email: string) {
  await page.getByPlaceholder('Enter your email').fill(email);
  await page.getByPlaceholder('Enter your password').fill(SEED_PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();
}

test('an administrator signs in on the admin page and lands in the admin area', async ({
  page,
}) => {
  await loginAs(page, 'admin');
  await expect(page).toHaveURL(/\/admin/);
});

test('the public sign-in refuses an administrator', async ({ page }) => {
  await page.goto('/login');
  await submit(page, 'admin@proplity.com');
  await expect(page.getByText('Invalid email or password').first()).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test('the admin sign-in refuses everyone else', async ({ page }) => {
  await page.goto('/admin/login');
  await submit(page, 'tenant@proplity.com');
  // Not getByRole('alert'): Next's own route announcer has that role too.
  await expect(page.getByText('Invalid email or password')).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/login/);
});

test('a signed-out visitor to the admin area is sent to the admin sign-in page, then back', async ({
  page,
}) => {
  await page.goto('/admin/users');
  await expect(page).toHaveURL(/\/admin\/login\?from=%2Fadmin%2Fusers/);
  await submit(page, 'admin@proplity.com');
  await page.waitForURL('**/admin/users');
});

test('signing out of the admin area returns to the admin sign-in page', async ({ page }) => {
  await loginAs(page, 'admin');
  await page.getByTitle('Sign Out').first().click();
  await page.getByRole('button', { name: 'Confirm sign out' }).click();
  await page.waitForURL('**/admin/login');
});
