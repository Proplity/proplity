import { test, expect } from '@playwright/test';

// Needs NEXT_PUBLIC_EMAIL_INBOX_ENABLED=true (see lib/email.ts). Skips
// itself otherwise rather than failing.

test('the sent-emails widget shows a real password-reset email with a working link', async ({
  page,
}) => {
  test.skip(
    process.env.NEXT_PUBLIC_EMAIL_INBOX_ENABLED !== 'true',
    'Email inbox widget is not enabled on this run',
  );

  await page.goto('/forgot-password');
  await page.getByPlaceholder('Enter your email').fill('tenant@proplity.com');
  await page.getByRole('button', { name: 'Send Reset Link' }).click();
  await page.waitForTimeout(1000);

  const openWidget = page.getByRole('button', { name: 'Open sent emails panel' });
  await expect(openWidget).toBeVisible();
  await openWidget.click();

  await expect(page.getByText('Sent Emails (testing)')).toBeVisible();
  // .first(): newest is unshifted to the top, but a re-run against the same
  // long-lived dev server (or a CI retry) can leave earlier matching rows
  // in the in-memory list -- match count isn't what this test is about.
  const row = page.getByRole('button', { name: /Reset your Proplity password/ }).first();
  await expect(row).toBeVisible();
  await row.click();

  const link = page.locator('a[href*="/reset-password"]').first();
  await expect(link).toBeVisible();
  const href = await link.getAttribute('href');
  expect(href).toContain('token=');
});
