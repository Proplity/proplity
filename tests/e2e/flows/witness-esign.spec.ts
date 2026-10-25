import { test, expect } from '@playwright/test';

// The page a witness reaches from the emailed link. The API answers are mocked so the page can be
// seen in each state whatever the database holds; the API itself is covered by
// tests/api/witness-esign.test.ts.

const TOKEN = 'a'.repeat(64);

const readyBody = {
  state: 'READY',
  side: 'LANDLORD',
  witnessName: 'Chidi Obi',
  unit: 'A1',
  property: 'Sunrise Court',
  address: '12 Marina Road, Lagos',
  landlordName: 'Mr Bello',
  agentName: 'Bola Adeyemi',
  tenantName: 'Ada Okafor',
  clauses: [
    { id: 'parties', title: 'Parties', body: 'This agreement is between Mr Bello and Ada Okafor.' },
    { id: 'term', title: 'Term', body: 'One year from 1 December 2026.' },
  ],
  specialConditions: null,
  expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
};

test('a witness reads the agreement and signs with their name', async ({ page }) => {
  let signed = false;
  await page.route(`**/api/v1/witness/${TOKEN}`, async (route) => {
    if (route.request().method() === 'POST') {
      expect(route.request().postDataJSON()).toEqual({ fullName: 'Chidi Obi', confirm: true });
      signed = true;
      return route.fulfill({ status: 201, json: { data: { signed: true } } });
    }
    return route.fulfill({
      json: {
        data: signed
          ? {
              ...readyBody,
              state: 'SIGNED',
              signedAt: new Date().toISOString(),
              clauses: undefined,
            }
          : readyBody,
      },
    });
  });

  await page.goto(`/witness/${TOKEN}`);
  await expect(page.getByRole('heading', { name: 'Rent agreement', exact: true })).toBeVisible();
  await expect(page.getByText('This agreement is between Mr Bello and Ada Okafor.')).toBeVisible();

  const sign = page.getByRole('button', { name: 'Sign as witness' });
  await expect(sign).toBeDisabled();
  await page.getByLabel('Your full name').fill('Chidi Obi');
  await expect(sign).toBeDisabled();
  await page.getByRole('checkbox').check();
  await sign.click();

  await expect(page.getByRole('heading', { name: 'Thank you, Chidi Obi' })).toBeVisible();
  await expect(page.getByText('This agreement is between')).toHaveCount(0);
});

test('an expired or unknown link says so instead of showing an agreement', async ({ page }) => {
  await page.route(`**/api/v1/witness/${TOKEN}`, (route) =>
    route.fulfill({
      status: 410,
      json: { error: 'This link has expired. Ask for a new one.', code: 'LINK_EXPIRED' },
    }),
  );
  await page.goto(`/witness/${TOKEN}`);
  await expect(page.getByRole('heading', { name: "This link can't be used" })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('expired');
});
