// Captures the listing-quality screens used by /proplity-guide and
// docs/proplity-step-by-step-role-guide.md: the "Possible duplicate" badge in the
// admin queue, the photo gallery on the public property page, and the
// neighbourhood report editor.
// Usage: E2E_BASE_URL=http://localhost:3022 node scripts/capture-listing-screenshots.mjs
// Needs: a seeded database (prisma/seed.ts) and the app running against it.
// It edits the seeded data: it adds one second listing at an existing address
// and sets gallery photos on one published listing.
import { chromium } from '@playwright/test';
import { copyFileSync, mkdirSync } from 'node:fs';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3022';
const OUT = 'public/screenshots';
const DOCS = 'docs/screenshots';
mkdirSync(OUT, { recursive: true });
mkdirSync(DOCS, { recursive: true });

const results = [];
const browser = await chromium.launch();

async function login(role, email, dashboard) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, baseURL: BASE });
  const page = await ctx.newPage();
  await page.goto('/login');
  await page.getByPlaceholder('Enter your email').fill(email);
  await page.getByPlaceholder('Enter your password').fill('Password123!');
  await page.getByRole('button', { name: 'Sign In', exact: false }).click();
  await page.waitForURL(`**${dashboard}**`, { timeout: 20000 });
  return { ctx, page };
}

async function shot(page, name, fn) {
  try {
    await fn();
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/${name}.png` });
    copyFileSync(`${OUT}/${name}.png`, `${DOCS}/${name}.png`);
    results.push(`ok   ${name}`);
  } catch (e) {
    results.push(`FAIL ${name}: ${String(e).split('\n')[0]}`);
  }
}

// --- manager: a second listing at an existing address, then the report editor
const mgr = await login('manager', 'manager@proplity.com', '/dashboard');
const mineRes = await mgr.page.request.get('/api/v1/properties?scope=mine');
if (!mineRes.ok()) throw new Error(`mine failed: ${mineRes.status()} ${await mineRes.text()}`);
const mine = (await mineRes.json()).data;
const base = mine.find((p) => !p.name.includes('(second listing)')) ?? mine[0];
await mgr.page.request.post('/api/v1/properties', {
  data: { name: `${base.name} (second listing)`, address: base.address, city: base.city },
});

await mgr.page.request.put(`/api/v1/properties/${base.id}/neighbourhood-report`, {
  data: {
    security: {
      rating: 8,
      status: 'Gated, guarded 24 hours',
      features: ['Perimeter fence', 'CCTV at the gate', 'Night guard'],
      notes: 'No reported break-ins in the last 12 months.',
    },
    electricity: {
      rating: 6,
      status: 'Grid with generator backup',
      features: ['Prepaid meter', 'Shared 60 kVA generator'],
    },
  },
});

await shot(mgr.page, 'landlord_02c_neighbourhood_editor', async () => {
  await mgr.page.goto(`/dashboard/properties/${base.id}/neighbourhood`);
  await mgr.page.getByRole('heading', { name: 'Neighbourhood report' }).waitFor();
  await mgr.page.waitForLoadState('networkidle');
});
await mgr.ctx.close();

// --- admin: gallery photos on a published listing, then the queue and the public page
const adm = await login('admin', 'admin@proplity.com', '/admin');
const published = (await (await adm.page.request.get('/api/v1/properties?limit=20')).json())
  .data[0];
const photos = [1, 2, 3, 4, 5].map((n) => `/sample-listing/photo-${n}.svg`); // clearly-labelled sample images
await adm.page.request.patch(`/api/v1/properties/${published.id}`, {
  data: { imageUrl: photos[0], photoUrls: photos },
});

await shot(adm.page, 'admin_09_duplicate_listing', async () => {
  await adm.page.goto('/admin/properties');
  await adm.page.getByRole('button', { name: /^All \(/ }).click();
  await adm.page
    .getByPlaceholder(/Search by name/)
    .fill(base.address.split(' ').slice(0, 2).join(' '));
  await adm.page.getByText('Possible duplicate').first().waitFor();
});
await shot(adm.page, 'public_property_gallery', async () => {
  await adm.page.goto(`/properties/${published.id}`);
  await adm.page.getByRole('button', { name: /more/ }).waitFor();
  await adm.page.waitForLoadState('networkidle');
});
await adm.ctx.close();

await browser.close();
console.log(results.join('\n'));
