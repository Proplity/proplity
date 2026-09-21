import { test, expect } from '@playwright/test';

// Needs a reachable, seeded database.

async function loginAndExpireAccessToken(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByPlaceholder('Enter your email').fill('tenant@proplity.com');
  await page.getByPlaceholder('Enter your password').fill('Password123!');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL(/\/dashboard/);
  // Simulates the access token's 15-minute expiry without waiting 15
  // minutes: the refresh_token cookie (7 days, path-scoped to /api/v1/auth/
  // refresh) is left in place, matching a real idle-then-reload visitor.
  await page.context().clearCookies({ name: 'access_token' });
}

test('a page reload after the access token expires silently restores the session and returns to the same page', async ({
  page,
}) => {
  await loginAndExpireAccessToken(page);
  await page.goto('/dashboard/payment-history');
  await expect(page).toHaveURL(/\/dashboard\/payment-history$/, { timeout: 8_000 });

  const cookies = await page.context().cookies();
  expect(cookies.some((c) => c.name === 'access_token')).toBe(true);
});

test('a stray ?from= on the landing page does not redirect a signed-out visitor', async ({
  page,
}) => {
  await page.goto('/?from=%2Fdashboard%2Fpayment-history');
  await page.waitForTimeout(1500);
  await expect(page).toHaveURL(/\/\?from=/);
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
});

test('an off-site ?from= is never followed, even for a restored session', async ({
  page,
  baseURL,
}) => {
  await loginAndExpireAccessToken(page);
  await page.goto('/?from=' + encodeURIComponent('https://evil.example.com'));
  await page.waitForTimeout(1500);
  expect(new URL(page.url()).origin).toBe(new URL(baseURL!).origin);
});
