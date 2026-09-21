import { test, expect } from '@playwright/test';

// Needs a reachable, seeded database -- the landing page's featured
// section shows real published properties, not sample data.

test('featured property opens in a popup with arrows, and only View Details navigates', async ({
  page,
}) => {
  await page.goto('/');
  const section = page.locator('#properties');
  await section.scrollIntoViewIfNeeded();
  const cards = section.getByRole('button');
  await expect(cards.first()).toBeVisible();
  const total = await cards.count();
  expect(total).toBeGreaterThan(1);

  const firstTitle = await cards.first().locator('h3').innerText();
  await cards.first().click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('h3')).toHaveText(firstTitle);
  await expect(page).toHaveURL(/\/$/);

  await dialog.getByRole('button', { name: 'Next property' }).click();
  await expect(dialog.locator('h3')).not.toHaveText(firstTitle);
  await expect(dialog.getByText(`2 / ${total}`)).toBeVisible();

  await page.keyboard.press('ArrowLeft');
  await expect(dialog.locator('h3')).toHaveText(firstTitle);

  await dialog.getByRole('button', { name: 'Previous property' }).click();
  await expect(dialog.getByText(`${total} / ${total}`)).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  await cards.first().click();
  await dialog.getByRole('link', { name: /View Details/ }).click();
  await expect(page).toHaveURL(/\/properties\/[0-9a-f-]{36}$/);
  await expect(page.getByText('Property not found')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: firstTitle }).first()).toBeVisible();
});

test("a featured card's own View Details button goes straight to a real property page", async ({
  page,
}) => {
  await page.goto('/');
  const section = page.locator('#properties');
  await section
    .getByRole('link', { name: /View Details/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/properties\/[0-9a-f-]{36}$/);
  await expect(page.getByText('Property not found')).toHaveCount(0);
});
