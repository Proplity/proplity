import { test, expect, type APIRequestContext } from '@playwright/test';

// Manager sign-up consumes a one-use invite code, so each run asks the seeded
// landlord for a fresh one instead of sharing DEMO-CODE (which a previous run,
// or a retry, may already have redeemed).
async function freshInviteCode(request: APIRequestContext, baseURL: string): Promise<string> {
  const headers = { Origin: baseURL };
  const login = await request.post('/api/v1/auth/login', {
    headers,
    data: { email: 'landlord@proplity.com', password: 'Password123!' },
  });
  expect(login.ok()).toBeTruthy();
  const created = await request.post('/api/v1/manager-codes', { headers, data: {} });
  expect(created.status()).toBe(201);
  return (await created.json()).data.code as string;
}

test.describe('Registration Flows End-to-End', () => {
  const timestamp = Date.now();

  test('Tenant registration flow with email activation', async ({ page }) => {
    const email = `tenant_${timestamp}@example.com`;

    await page.goto('/register');
    await expect(page.getByRole('heading', { name: 'Create Your Account' })).toBeVisible();

    // Step 1: Select Tenant
    await page.getByRole('button', { name: /Tenant Looking for or currently renting/i }).click();

    // Step 2: Fill Tenant Details
    await page.getByPlaceholder('First name').fill('Chidi');
    await page.getByPlaceholder('Last name').fill('Okafor');
    await page.getByPlaceholder('you@example.com').fill(email);
    await page.getByPlaceholder('+234 803 000 0000').fill('+234 801 234 5678');
    await page.locator('select').first().selectOption('Lagos');

    const passwordInputs = page.locator('input[type="password"]');
    await passwordInputs.nth(0).fill('Password123!');
    await passwordInputs.nth(1).fill('Password123!');

    await page.locator('input[type="checkbox"]').check();

    // Submit Tenant Registration
    await page.getByRole('button', { name: 'Create Free Account' }).click();

    // Confirmation screen
    await expect(page.getByRole('heading', { name: 'Check Your Email' })).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();

    // Verify through dev email widget if enabled
    if (process.env.NEXT_PUBLIC_EMAIL_INBOX_ENABLED === 'true') {
      const openWidget = page.getByRole('button', { name: 'Open sent emails panel' });
      await expect(openWidget).toBeVisible();
      await openWidget.click();

      const emailRow = page.getByRole('button', { name: /Verify your Proplity account/i }).first();
      await expect(emailRow).toBeVisible();
      await emailRow.click();

      const verifyLink = page.locator('a[href*="/verify-email"]').first();
      await expect(verifyLink).toBeVisible();
      const href = await verifyLink.getAttribute('href');
      expect(href).toContain('/verify-email?token=');

      // Navigate to the verification URL
      if (href) {
        await page.goto(href);
        // The page is a confirmation form (optional password fields), not an
        // auto-submit: the account activates when the button is pressed.
        await page.getByRole('button', { name: 'Activate Account' }).click();
        await expect(page.getByText(/Account Activated/i)).toBeVisible();
      }
    }
  });

  test('Streamlined Landlord registration (2 steps, no upfront banking or property)', async ({
    page,
  }) => {
    const email = `landlord_${timestamp}@example.com`;

    await page.goto('/register');

    // Step 1: Select Landlord
    await page.getByRole('button', { name: /Landlord I own rental properties/i }).click();

    // Step 2: Fill Landlord Details
    await page.getByPlaceholder('First name').fill('Babajide');
    await page.getByPlaceholder('Last name').fill('Adeleke');
    await page.getByPlaceholder('you@example.com').fill(email);
    await page.getByPlaceholder('+234 803 000 0000').fill('+234 802 345 6789');
    await page.locator('select').first().selectOption('Lagos');

    const passwordInputs = page.locator('input[type="password"]');
    await passwordInputs.nth(0).fill('Password123!');
    await passwordInputs.nth(1).fill('Password123!');

    await page.locator('input[type="checkbox"]').check();

    // Verify button says "Create Account" immediately (no Step 3 for Banking/Property)
    const submitBtn = page.getByRole('button', { name: 'Create Account' });
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    // Landlord account created and prompted to check email
    await expect(page.getByRole('heading', { name: 'Check Your Email' })).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();
  });

  test('Property Manager registration with an invite code', async ({ page, request, baseURL }) => {
    const code = await freshInviteCode(request, baseURL!);
    const email = `manager_${timestamp}@example.com`;

    await page.goto('/register');

    // Step 1: Select Property Manager
    await page.getByRole('button', { name: /Property Manager Manage properties/i }).click();

    // Step 2: Landlord Code verification
    await expect(page.getByText('Landlord Invitation Code', { exact: true })).toBeVisible();

    await page.getByPlaceholder('e.g. LLD-2847-XK or DEMO-CODE').fill(code);

    await page.getByRole('button', { name: 'Verify Code' }).click();

    // Verified feedback linked to Eleanor Sterling
    await expect(page.getByText('Code verified!')).toBeVisible();
    await expect(page.getByText('Eleanor Sterling')).toBeVisible();

    // Proceed to Step 3 (Details)
    await page.getByRole('button', { name: 'Continue to Details' }).click();

    // Step 3: Fill Manager Details
    await page.getByPlaceholder('First name').fill('Olumide');
    await page.getByPlaceholder('Last name').fill('Fashola');
    await page.getByPlaceholder('you@example.com').fill(email);
    await page.getByPlaceholder('+234 803 000 0000').fill('+234 803 456 7890');
    await page.locator('select').first().selectOption('Lagos');
    await page.getByPlaceholder('12345678901').fill('12345678901');

    const passwordInputs = page.locator('input[type="password"]');
    await passwordInputs.nth(0).fill('Password123!');
    await passwordInputs.nth(1).fill('Password123!');

    await page.locator('input[type="checkbox"]').check();

    await page.getByRole('button', { name: 'Create Account' }).click();
    await expect(page.getByRole('heading', { name: 'Check Your Email' })).toBeVisible();
  });

  test('Property Manager can register without a code and link to a landlord later (ISS-041)', async ({
    page,
  }) => {
    const email = `nocode_manager_${timestamp}@example.com`;
    await page.goto('/register');
    await page.getByRole('button', { name: /Property Manager Manage properties/i }).click();
    await page.getByRole('button', { name: /I don't have a code yet/i }).click();

    await expect(page.getByText('Not linked to a landlord yet.')).toBeVisible();
    await page.getByPlaceholder('First name').fill('Ngozi');
    await page.getByPlaceholder('Last name').fill('Eze');
    await page.getByPlaceholder('you@example.com').fill(email);
    await page.getByPlaceholder('+234 803 000 0000').fill('+234 803 456 1111');
    await page.locator('select').first().selectOption('Lagos');
    await page.getByPlaceholder('12345678901').fill('12345678901');
    const passwordInputs = page.locator('input[type="password"]');
    await passwordInputs.nth(0).fill('Password123!');
    await passwordInputs.nth(1).fill('Password123!');
    await page.locator('input[type="checkbox"]').check();
    await page.getByRole('button', { name: 'Create Account' }).click();
    await expect(page.getByRole('heading', { name: 'Check Your Email' })).toBeVisible();
  });

  test('Manager invitation direct link (/register?role=manager&code=…)', async ({
    page,
    request,
    baseURL,
  }) => {
    const code = await freshInviteCode(request, baseURL!);
    await page.goto(`/register?role=manager&code=${code}`);

    // Verify manager code is prefilled and verified automatically
    await expect(page.getByText('Code verified!')).toBeVisible();
    await expect(page.getByText('Eleanor Sterling')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue to Details' })).toBeEnabled();
  });

  test('Vendor / Service Provider registration (3 steps)', async ({ page }) => {
    const email = `vendor_${timestamp}@example.com`;

    await page.goto('/register');

    // Step 1: Select Service Provider
    await page.getByRole('button', { name: /Service Provider I offer maintenance/i }).click();

    // Step 2: Personal details
    await page.getByPlaceholder('First name').fill('Emeka');
    await page.getByPlaceholder('Last name').fill('Ibrahim');
    await page.getByPlaceholder('you@example.com').fill(email);
    await page.getByPlaceholder('+234 803 000 0000').fill('+234 805 678 9012');
    await page.locator('select').first().selectOption('Lagos');

    const passwordInputs = page.locator('input[type="password"]');
    await passwordInputs.nth(0).fill('Password123!');
    await passwordInputs.nth(1).fill('Password123!');

    await page.getByRole('button', { name: 'Next: Business Info' }).click();

    // Step 3: Business info
    await page.getByPlaceholder('e.g. AquaFix Plumbers').fill('Lagos QuickFix Repairs');
    await page
      .locator('select')
      .filter({ hasText: 'Select your primary service' })
      .selectOption('Plumbing');
    await page.locator('select').filter({ hasText: 'Less than 1 year' }).selectOption('3–5 years');
    await page.locator('input[type="checkbox"]').first().check(); // select first state in coverage
    await page.locator('input[type="checkbox"]').last().check(); // terms

    await page.getByRole('button', { name: 'Create Free Account' }).click();
    await expect(page.getByRole('heading', { name: 'Check Your Email' })).toBeVisible();
  });
});
