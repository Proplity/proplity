// Captures the account-lifecycle screenshots used by /proplity-guide.
// Usage: E2E_BASE_URL=http://localhost:3022 node scripts/capture-guide-screenshots.mjs
// Needs: a seeded database and the app running with NEXT_PUBLIC_EMAIL_INBOX_ENABLED=true.
import { chromium } from '@playwright/test';
import { copyFileSync, mkdirSync } from 'node:fs';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3022';
const OUT = 'public/screenshots';
const DOCS = 'docs/screenshots';
mkdirSync(OUT, { recursive: true });
mkdirSync(DOCS, { recursive: true });

const stamp = Date.now();
const PW = 'Password123!';
const results = [];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, baseURL: BASE });
const page = await ctx.newPage();

async function shot(name, fn) {
  try {
    if (fn) await fn();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/${name}.png` });
    copyFileSync(`${OUT}/${name}.png`, `${DOCS}/${name}.png`);
    results.push(`ok   ${name}`);
  } catch (e) {
    results.push(`FAIL ${name}: ${String(e).split('\n')[0]}`);
  }
}

async function fillDetails(first, last, email, phone) {
  await page.getByPlaceholder('First name').fill(first);
  await page.getByPlaceholder('Last name').fill(last);
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByPlaceholder('+234 803 000 0000').fill(phone);
  await page.locator('select').first().selectOption('Lagos');
  const pw = page.locator('input[type="password"]');
  await pw.nth(0).fill(PW);
  await pw.nth(1).fill(PW);
  if (await page.locator('input[type="checkbox"]').count())
    await page.locator('input[type="checkbox"]').check();
}

async function openEmailAndGetLink(subject, hrefPart) {
  await page.getByRole('button', { name: 'Open sent emails panel' }).click();
  await page.getByRole('button', { name: subject }).first().click();
  const link = page.locator(`a[href*="${hrefPart}"]`).first();
  await link.waitFor();
  return link.getAttribute('href');
}

async function login(email) {
  await page.goto('/login');
  await page.getByPlaceholder('Enter your email').fill(email);
  await page.getByPlaceholder('Enter your password').fill(PW);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL('**/dashboard**', { timeout: 20000 });
}

// ---- Login, forgot password
await page.goto('/login');
await shot('auth_01_login_desktop');
await shot('auth_02_forgot_password', async () => {
  await page.goto('/forgot-password');
  await page.getByPlaceholder('Enter your email').fill('tenant@proplity.com');
});
await shot('auth_03_forgot_password_sent', async () => {
  await page
    .getByRole('button', { name: /send|reset/i })
    .first()
    .click();
  await page.waitForTimeout(1500);
});

// ---- Registration: role selection and each role
await page.goto('/register');
await shot('reg_01_role_selection');

await shot('reg_02_tenant_form', async () => {
  await page.getByRole('button', { name: /Tenant Looking for or currently renting/i }).click();
  await fillDetails('Chioma', 'Okonjo', `chioma_${stamp}@example.com`, '+234 803 555 1234');
});
await shot('reg_03_tenant_check_email', async () => {
  await page.getByRole('button', { name: 'Create Free Account' }).click();
  await page.getByRole('heading', { name: 'Check Your Email' }).waitFor();
});
let tenantVerify;
try {
  tenantVerify = await openEmailAndGetLink(/Verify your Proplity account/i, '/verify-email');
  await shot('reg_04_email_inbox_widget');
  await page.goto(tenantVerify);
  await shot('reg_05_verify_email_page');
  await page.getByRole('button', { name: 'Activate Account' }).click();
  await shot('reg_06_account_activated', async () => {
    await page.getByText(/Account Activated/i).waitFor();
  });
} catch (e) {
  results.push(`FAIL verify flow: ${String(e).split('\n')[0]}`);
}

const landlordEmail = `landlord_${stamp}@example.com`;
await page.goto('/register');
await shot('reg_07_landlord_form_two_steps', async () => {
  await page.getByRole('button', { name: /Landlord I own rental properties/i }).click();
  await fillDetails('Babajide', 'Adeleke', landlordEmail, '+234 802 345 6789');
});
await shot('reg_08_landlord_check_email', async () => {
  await page.getByRole('button', { name: 'Create Account' }).click();
  await page.getByRole('heading', { name: 'Check Your Email' }).waitFor();
});
try {
  const href = await openEmailAndGetLink(/Verify your Proplity account/i, '/verify-email');
  await page.goto(href);
  await page.getByRole('button', { name: 'Activate Account' }).click();
  await page.getByText(/Account Activated/i).waitFor();
  await login(landlordEmail);
  await shot('reg_09_landlord_dashboard_setup_banner');
} catch (e) {
  results.push(`FAIL landlord first login: ${String(e).split('\n')[0]}`);
}

await page.context().clearCookies();
await page.goto('/register');
await shot('reg_10_vendor_form', async () => {
  await page
    .getByRole('button', { name: /Service Provider/i })
    .first()
    .click();
  await fillDetails('Tunde', 'Bakare', `vendor_${stamp}@example.com`, '+234 805 111 2222');
});

// ---- Manager invitation: landlord invites by email, manager registers with the link
await page.context().clearCookies();
try {
  await login('landlord@proplity.com');
  await page.locator('text=Manager Access Codes').scrollIntoViewIfNeeded();
  await shot('invite_01_landlord_access_codes', async () => {
    await page.getByRole('button', { name: /Invite via Email/i }).click();
    await page.getByPlaceholder(/email/i).last().fill(`manager_${stamp}@example.com`);
  });
  await page.getByRole('button', { name: /Send Invit/i }).click();
  await page.waitForTimeout(1500);
  await shot('invite_02_invite_sent');
  const href = await openEmailAndGetLink(/invited you to manage/i, '/register');
  await page.context().clearCookies();
  await shot('invite_03_invite_email', async () => {});
  await page.goto(href);
  await shot('invite_04_register_prefilled_code', async () => {
    await page.getByText(/Code verified/i).waitFor({ timeout: 10000 });
  });
} catch (e) {
  results.push(`FAIL invite flow: ${String(e).split('\n')[0]}`);
}

// ---- Tenant profile completion (ID document upload)
await page.context().clearCookies();
try {
  await login('tenant@proplity.com');
  await shot('profile_01_complete_profile_id_upload', async () => {
    await page.goto('/dashboard/profile/complete');
    await page.waitForTimeout(1000);
  });
} catch (e) {
  results.push(`FAIL profile: ${String(e).split('\n')[0]}`);
}

await browser.close();
console.log(results.join('\n'));
