import { test, expect, type Page } from '@playwright/test';
import { loginAs } from '../helpers/auth';

// A manager buys a pack of credits with a card. Needs a seeded database and the mock card gateway
// (NEXT_PUBLIC_PAYMENTS_MOCK_ENABLED=true, no real PAYSTACK_SECRET_KEY): it skips itself otherwise.

const balanceOf = (page: Page) =>
  page.evaluate(
    async () => (await (await fetch('/api/v1/credits/me')).json()).data.balance as number,
  );

test('a manager buys a credit pack through the mock checkout and the balance grows', async ({
  page,
}) => {
  test.skip(
    process.env.NEXT_PUBLIC_PAYMENTS_MOCK_ENABLED !== 'true',
    'Payments mock is not enabled on this run',
  );

  await loginAs(page, 'manager');
  const before = await balanceOf(page);

  await page.getByTestId('buy-credits-open').click();
  const dialog = page.getByTestId('buy-credits-dialog');
  await expect(dialog.getByTestId('buy-pack-credits-20')).toBeVisible();
  await page.getByTestId('buy-pack-credits-5').click();

  await expect(page).toHaveURL(/\/dev\/mock-checkout\?/);
  await expect(page.getByText('₦2,500', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /^Pay ₦/ }).click();
  await expect(page).toHaveURL(/\/dashboard\/payment-history/, { timeout: 10_000 });

  await expect.poll(() => balanceOf(page), { timeout: 10_000 }).toBe(before + 5);
});
