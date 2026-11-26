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
  // Administrators sign in on their own page; the public one refuses them.
  await page.goto(role === 'admin' ? '/admin/login' : '/login');
  await page.getByPlaceholder('Enter your email').fill(email);
  await page.getByPlaceholder('Enter your password').fill(SEED_PASSWORD);
  await page.getByRole('button', { name: 'Sign In', exact: false }).click();
  // Not `**/admin**`: the admin sign-in page, /admin/login, matches that too, and returning while
  // still on it let the next navigation race the sign-in.
  await page.waitForURL(
    (url) =>
      url.pathname.startsWith(dashboardPath) &&
      !url.pathname.startsWith('/admin/login') &&
      url.pathname !== '/login',
    { timeout: 15_000 },
  );
}
