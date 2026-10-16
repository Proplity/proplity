// Captures the admin screens used by /proplity-guide and docs/proplity-step-by-step-role-guide.md.
// Usage: E2E_BASE_URL=http://localhost:3022 node scripts/capture-admin-screenshots.mjs
// Needs: a seeded database (prisma/seed.ts) and the app running against it.
// It performs one real suspend + reactivate so the audit log has entries to show.
import { chromium } from '@playwright/test';
import { copyFileSync, mkdirSync } from 'node:fs';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3022';
const OUT = 'public/screenshots';
const DOCS = 'docs/screenshots';
mkdirSync(OUT, { recursive: true });
mkdirSync(DOCS, { recursive: true });

const results = [];
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, baseURL: BASE });
const page = await ctx.newPage();

async function shot(name, fn) {
  try {
    if (fn) await fn();
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/${name}.png` });
    copyFileSync(`${OUT}/${name}.png`, `${DOCS}/${name}.png`);
    results.push(`ok   ${name}`);
  } catch (e) {
    results.push(`FAIL ${name}: ${String(e).split('\n')[0]}`);
  }
}

await page.goto('/login');
await page.getByPlaceholder('Enter your email').fill('admin@proplity.com');
await page.getByPlaceholder('Enter your password').fill('Password123!');
await page.getByRole('button', { name: 'Sign In', exact: false }).click();
await page.waitForURL('**/admin**', { timeout: 20000 });

await shot('admin_01_overview', async () => {
  await page.goto('/admin');
  await page.waitForLoadState('networkidle');
});
await shot('admin_03_reports', async () => {
  await page.goto('/admin/reports');
  await page.waitForLoadState('networkidle');
});
await shot('admin_05_notifications', async () => {
  await page.goto('/admin/notifications');
  await page.waitForLoadState('networkidle');
});
await shot('admin_06_properties', async () => {
  await page.goto('/admin/properties');
  await page.waitForLoadState('networkidle');
});
await shot('admin_04_settings', async () => {
  await page.goto('/admin/settings');
  await page.waitForLoadState('networkidle');
});

// Users: show tenants, then walk through a real suspension of one named tenant
// so the audit log has entries to show. Each step waits for the list to settle.
const row = () => page.locator('tr', { hasText: 'tunde@email.com' });
await shot('admin_02_users', async () => {
  await page.goto('/admin/users');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'Tenant', exact: true }).click();
  await page.getByPlaceholder(/Search by name/).fill('tunde');
  await row().waitFor();
  await page.waitForLoadState('networkidle');
});
await shot('admin_07_user_suspend', async () => {
  await row().getByRole('button', { name: 'Suspend' }).click();
  await page.locator('textarea').fill('Reported for sharing an account with another person');
});
await page.getByRole('button', { name: 'Confirm' }).click();
await row().getByRole('button', { name: 'Reactivate' }).waitFor();
await row().getByRole('button', { name: 'Reactivate' }).click();
await page.locator('textarea').fill('Account owner confirmed their identity');
await page.getByRole('button', { name: 'Confirm' }).click();
await row().getByRole('button', { name: 'Suspend' }).waitFor();

await shot('admin_08_security', async () => {
  await page.goto('/admin/security');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: /User reactivated/ }).first().click();
});

console.log(results.join('\n'));
await browser.close();
