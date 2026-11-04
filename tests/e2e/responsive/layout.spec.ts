import { test, expect, type Page } from '@playwright/test';
import { loginAs } from '../helpers/auth';

// Layout regression guard for phones and tablets. Two things are checked on every page: the page
// itself must not scroll sideways, and no box that hides its overflow may be cutting its content
// off (a card that clips a long email or a row of badges does not scroll, so the first check
// alone cannot see it: that is how the tenant record's header lost its badges on a phone).
//
// Needs a reachable, seeded database for the signed-in pages. Run against a production build:
// `next dev` adds a role switcher and an inbox button that are not in production.

type Fit = { overflow: number; shell: number; cut: string[] };

async function measure(page: Page): Promise<Fit> {
  return page.evaluate(() => {
    const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    // The dashboards scroll inside their main area, not the page, so content pushed past the
    // right edge scrolls sideways in there while the page itself reports no overflow.
    let shell = 0;
    for (const el of Array.from(document.body.querySelectorAll<HTMLElement>('*'))) {
      const style = getComputedStyle(el);
      if (!/(auto|scroll)/.test(style.overflowX)) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < innerWidth * 0.9 || rect.height < innerHeight * 0.4) continue;
      shell = Math.max(shell, el.scrollWidth - el.clientWidth);
    }
    const cut: string[] = [];
    for (const el of Array.from(document.body.querySelectorAll<HTMLElement>('*'))) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const style = getComputedStyle(el);
      if (style.visibility === 'hidden' || style.display === 'none' || style.position === 'fixed') {
        continue;
      }
      const hides = /(hidden|clip)/.test(style.overflowX);
      if (hides && el.scrollWidth > el.clientWidth + 2 && !/ellipsis/.test(style.textOverflow)) {
        const text = (el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 40);
        cut.push(
          `${el.tagName.toLowerCase()} "${text}" (${el.scrollWidth}px in ${el.clientWidth}px)`,
        );
      }
      if (cut.length >= 5) break;
    }
    return { overflow, shell, cut };
  });
}

// `checkCut: false` is for the marketing pages, whose browser-frame mock-ups crop a miniature
// dashboard on purpose.
async function expectFits(page: Page, label: string, { checkCut = true } = {}) {
  // Let the page finish loading its data before measuring.
  await page.waitForLoadState('networkidle').catch(() => undefined);
  const fit = await measure(page);
  expect(fit.overflow, `${label} should not scroll sideways`).toBeLessThanOrEqual(1);
  expect(fit.shell, `${label} should not scroll sideways inside its main area`).toBeLessThanOrEqual(
    1,
  );
  if (checkCut) expect(fit.cut, `${label} should not cut its content off`).toEqual([]);
}

const PHONE = { width: 390, height: 844 };
const SMALL_PHONE = { width: 320, height: 640 };
const TABLET = { width: 768, height: 1024 };

test.describe('public pages', () => {
  for (const viewport of [SMALL_PHONE, PHONE]) {
    test(`fit a ${viewport.width}px screen`, async ({ page }) => {
      await page.setViewportSize(viewport);
      for (const path of [
        '/for-tenants',
        '/for-landlords',
        '/for-vendors',
        '/proplity-guide',
        '/contact',
      ]) {
        await page.goto(path);
        await expectFits(page, `${path} at ${viewport.width}px`, { checkCut: false });
      }
    });
  }
});

test.describe('signed-in pages on a phone (needs a seeded database)', () => {
  test.use({ viewport: PHONE });

  test('manager screens, the tenant record and the payment dialog fit', async ({ page }) => {
    await loginAs(page, 'manager');
    for (const path of [
      '/dashboard/schedules',
      '/dashboard/maintenance',
      '/dashboard/reconciliation',
      '/dashboard/tenants',
    ]) {
      await page.goto(path);
      await expectFits(page, path);
    }

    await page.getByRole('row').nth(1).click();
    await page.waitForURL(/\/dashboard\/tenants\/[^/]+$/);
    await expect(page.getByText('Rent Agreement Signature')).toBeVisible();
    await expectFits(page, 'the tenant record');

    const record = page.getByRole('button', { name: 'Record cash or transfer payment' });
    if (await record.isEnabled()) {
      await record.click();
      const dialog = page.getByRole('dialog', { name: 'Paid another way' });
      await expect(dialog).toBeVisible();
      const box = await dialog.boundingBox();
      expect(box?.x ?? -1, 'the dialog starts inside the screen').toBeGreaterThanOrEqual(0);
      expect(
        (box?.x ?? 0) + (box?.width ?? 0),
        'the dialog ends inside the screen',
      ).toBeLessThanOrEqual(PHONE.width);
    }
  });

  test('admin settings and bank transfers fit', async ({ page }) => {
    await loginAs(page, 'admin');
    for (const path of ['/admin/settings', '/admin/payments']) {
      await page.goto(path);
      await expectFits(page, path);
    }
  });

  test("a tenant's payment history and the property search fit", async ({ page }) => {
    await loginAs(page, 'tenant');
    for (const path of ['/dashboard/payment-history', '/dashboard/discover']) {
      await page.goto(path);
      await expectFits(page, path);
    }
  });
});

test.describe('the smallest phones (needs a seeded database)', () => {
  test.use({ viewport: SMALL_PHONE });

  test('the property search cards do not cut their price or trust score off', async ({ page }) => {
    await loginAs(page, 'tenant');
    await page.goto('/dashboard/discover');
    await expectFits(page, '/dashboard/discover at 320px');
  });
});

test.describe('tablet', () => {
  test.use({ viewport: TABLET });

  test('the maintenance board shows its columns without clipping them', async ({ page }) => {
    await loginAs(page, 'manager');
    await page.goto('/dashboard/maintenance');
    await expectFits(page, 'the maintenance board');
  });
});
