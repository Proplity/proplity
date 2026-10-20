import { test, expect, type Page } from '@playwright/test';
import { loginAs } from '../helpers/auth';

// A property is viewed by one person at a time (ISS-104). The server's rule is covered in
// tests/api/viewings.test.ts; here the answers are mocked so the form's two reactions can be seen:
// booked times are marked, and a time lost to someone else sends the person back to choose again.
// Needs a reachable, seeded database for the sign-in.

async function openForm(page: Page, request: import('@playwright/test').APIRequestContext) {
  const list = await request.get('/api/v1/properties');
  const propertyId = (await list.json()).data[0].id as string;
  await loginAs(page, 'tenant');
  await page.goto(`/dashboard/properties/${propertyId}/schedule-viewing`);
  const day = new Date();
  day.setDate(day.getDate() + 4);
  if (day.getDay() === 0) day.setDate(day.getDate() + 1);
  const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
  return { key };
}

test('times someone else has booked are marked and cannot be chosen', async ({ page, request }) => {
  await page.route('**/viewings/availability**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: { date: new URL(route.request().url()).searchParams.get('date'), taken: ['10:00'] },
      }),
    }),
  );
  const { key } = await openForm(page, request);
  await page.getByLabel('Viewing date').fill(key);

  await expect(page.getByTestId('booked-times')).toContainText('10:00 AM');
  const booked = page.locator('#viewing-time option[value="10:00"]');
  await expect(booked).toBeDisabled();
  await expect(booked).toHaveText('10:00 AM (booked)');
  await expect(page.locator('#viewing-time option[value="10:30"]')).toBeEnabled();
});

test('a time taken while the form was open sends the person back to choose another', async ({
  page,
  request,
}) => {
  await page.route('**/viewings/availability**', (route) => {
    const date = new URL(route.request().url()).searchParams.get('date');
    // Free when the form first looks; taken by the time the person confirms.
    const taken = bookedNow ? ['10:30'] : [];
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { date, taken } }),
    });
  });
  let bookedNow = false;
  await page.route('**/api/v1/properties/*/viewings', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    bookedNow = true;
    return route.fulfill({
      status: 409,
      contentType: 'application/json',
      body: JSON.stringify({
        error: 'That time is already booked for this property. Please choose another time or day.',
        code: 'SLOT_TAKEN',
      }),
    });
  });

  const { key } = await openForm(page, request);
  await page.getByLabel('Viewing date').fill(key);
  await page.getByLabel('Start time').selectOption('10:30');
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.locator('input[type="text"]').first().fill('Jordan Hayes');
  await page.locator('input[type="email"]').fill('tenant@proplity.com');
  await page.locator('input[type="tel"]').fill('+234 803 555 1234');
  await page.locator('input[type="checkbox"]').check();
  await page.getByRole('button', { name: 'Confirm Viewing' }).click();

  // Back on the time step, the lost time is marked and the choice is cleared.
  await expect(page.getByText('That time was just booked by someone else')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Select a Time' })).toBeVisible();
  await expect(page.getByLabel('Start time')).toHaveValue('');
  await expect(page.locator('#viewing-time option[value="10:30"]')).toBeDisabled();
  // The server's own sentence is not shown on top of the form's.
  await expect(page.getByText('That time is already booked for this property')).toHaveCount(0);
});
