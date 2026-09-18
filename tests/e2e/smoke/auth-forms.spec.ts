import { test, expect } from '@playwright/test';

// Checks the login/register/forgot-password forms render, link to each
// other correctly, and enforce client-side required fields -- none of
// which touches the database, so this runs anywhere.

test('login page renders and requires email + password', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible();

  await page.getByRole('button', { name: 'Sign In' }).click();
  // The browser's native required-field validation should block the
  // submit -- the page never navigates away from /login.
  await expect(page).toHaveURL(/\/login/);
  const email = page.getByPlaceholder('Enter your email');
  const isValid = await email.evaluate((el: HTMLInputElement) => el.checkValidity());
  expect(isValid).toBe(false);
});

test('login page links to register and forgot password', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: /sign up for free/i }).click();
  await expect(page).toHaveURL(/\/register/);

  await page.goto('/login');
  await page.getByRole('button', { name: /forgot password/i }).click();
  await expect(page).toHaveURL(/\/forgot-password/);
});

test('login shows an inline error for bad credentials', async ({ page }) => {
  await page.goto('/login');
  await page.getByPlaceholder('Enter your email').fill('nobody@example.com');
  await page.getByPlaceholder('Enter your password').fill('WrongPassword123!');
  await page.getByRole('button', { name: 'Sign In' }).click();
  // Whether the account exists or not, an inline error should replace the
  // form silently hanging -- this exercises the client wiring even where
  // the database itself isn't reachable (the request still resolves with
  // an error response rather than hanging forever).
  await expect(page.locator('text=/incorrect|invalid|not found|error/i').first()).toBeVisible({
    timeout: 15_000,
  });
});

test('forgot-password page renders its form', async ({ page }) => {
  await page.goto('/forgot-password');
  await expect(page.getByPlaceholder(/email/i)).toBeVisible();
});
