import { expect, type Page } from '@playwright/test';

// Matches prisma/seed.ts. All seeded demo accounts share this password.
export const SEED_PASSWORD = 'Password123!';

export const SEED_USERS = {
  admin: { email: 'admin@proplity.com', dashboardPath: '/admin' },
  manager: { email: 'manager@proplity.com', dashboardPath: '/dashboard' },
  landlord: { email: 'landlord@proplity.com', dashboardPath: '/dashboard' },
  tenant: { email: 'tenant@proplity.com', dashboardPath: '/dashboard' },
  vendor: { email: 'vendor@proplity.com', dashboardPath: '/dashboard' },
} as const;

export type SeedRole = keyof typeof SEED_USERS;

export async function loginAs(page: Page, role: SeedRole) {
  const { email, dashboardPath } = SEED_USERS[role];
  await page.goto('/login');
  await page.getByPlaceholder('Enter your email').fill(email);
  await page.getByPlaceholder('Enter your password').fill(SEED_PASSWORD);
  await page.getByRole('button', { name: 'Sign In', exact: false }).click();
  await page.waitForURL(`**${dashboardPath}**`, { timeout: 15_000 });
  await expect(page).toHaveURL(new RegExp(dashboardPath.replace('/', '\\/')));
}
