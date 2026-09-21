import { test, expect } from '@playwright/test';
import { loginAs, SEED_USERS, SEED_PASSWORD } from '../helpers/auth';

// Needs a reachable, seeded database.

async function firstPropertyId(request: import('@playwright/test').APIRequestContext) {
  const res = await request.get('/api/v1/properties');
  const body = await res.json();
  return body.data[0].id as string;
}

test('signed-out visitor: Schedule Inspection asks to sign in, then lands on that exact page', async ({
  page,
  request,
}) => {
  const propertyId = await firstPropertyId(request);
  await page.goto(`/properties/${propertyId}`);

  await page.getByRole('button', { name: 'Schedule Inspection' }).click();
  await expect(page.getByText('Login Required')).toBeVisible();

  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(
    new RegExp(`/login\\?from=.*properties%2F${propertyId}%2Fschedule-viewing`),
  );

  await page.getByPlaceholder('Enter your email').fill(SEED_USERS.tenant.email);
  await page.getByPlaceholder('Enter your password').fill(SEED_PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();

  await page.waitForFunction(() => !location.pathname.startsWith('/login'));
  await expect(page).toHaveURL(
    `http://localhost:3000/dashboard/properties/${propertyId}/schedule-viewing`.replace(
      'http://localhost:3000',
      '',
    ),
    { timeout: 10_000 },
  );
});

test('signed-in tenant: Schedule Inspection and Apply skip the login prompt entirely', async ({
  page,
  request,
}) => {
  const propertyId = await firstPropertyId(request);
  await loginAs(page, 'tenant');

  await page.goto(`/properties/${propertyId}`);
  await page.getByRole('button', { name: 'Schedule Inspection' }).click();
  await expect(page).toHaveURL(new RegExp(`/dashboard/properties/${propertyId}/schedule-viewing`));

  await page.goto(`/properties/${propertyId}`);
  await page.getByRole('button', { name: 'Apply for this Property' }).click();
  await expect(page).toHaveURL(new RegExp(`/dashboard/properties/${propertyId}/apply`));
});

test('signed-in tenant: property page nav CTA says Go to Dashboard, not Get Started', async ({
  page,
  request,
}) => {
  const propertyId = await firstPropertyId(request);
  await loginAs(page, 'tenant');
  await page.goto(`/properties/${propertyId}`);
  const cta = page.getByRole('link', { name: 'Go to Dashboard' });
  await expect(cta).toBeVisible();
  await expect(cta).toHaveAttribute('href', '/dashboard');
});

test('signed-in user sees "Go to Dashboard" (not "Get Started") on marketing pages', async ({
  page,
}) => {
  await loginAs(page, 'tenant');
  for (const path of ['/pricing', '/about', '/contact', '/for-landlords']) {
    await page.goto(path);
    const cta = page.getByRole('link', { name: 'Go to Dashboard' });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute('href', '/dashboard');
  }
});

test('signed-out visitor still sees "Get Started" -> /login on marketing pages', async ({
  page,
}) => {
  await page.goto('/pricing');
  const cta = page.getByRole('link', { name: 'Get Started' }).first();
  await expect(cta).toHaveAttribute('href', '/login');
});
