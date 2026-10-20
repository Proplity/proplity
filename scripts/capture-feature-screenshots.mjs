// Captures the feature screens added to /proplity-guide in October 2026: the property
// page tools (photos, staged edits, announcements, equipment, unit import), the tenant
// record, dashboard breakdown pages, account settings, the admin review drawer and
// duplicate merge, tenant extras (auto-pay, gate passes, neighbourhood report), vendor
// invoices, marketing pages and the phone layout.
// Usage: E2E_BASE_URL=http://localhost:3030 node scripts/capture-feature-screenshots.mjs
// Needs: a freshly seeded database (pnpm db:seed && pnpm db:seed2) and the app running
// against it with NEXT_PUBLIC_EMAIL_INBOX_ENABLED=true. It approves the seeded listings,
// adds one second listing at an existing address (for the duplicate screen) and may
// change a few records, so run it against a throwaway database.
import { chromium } from '@playwright/test';
import { copyFileSync, mkdirSync } from 'node:fs';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3030';
const OUT = 'public/screenshots';
const DOCS = 'docs/screenshots';
mkdirSync(OUT, { recursive: true });
mkdirSync(DOCS, { recursive: true });

const PW = 'Password123!';
const results = [];
const browser = await chromium.launch();

async function login(email, viewport = { width: 1400, height: 900 }) {
  const ctx = await browser.newContext({ viewport, baseURL: BASE });
  const page = await ctx.newPage();
  await page.goto('/login');
  await page.getByPlaceholder('Enter your email').fill(email);
  await page.getByPlaceholder('Enter your password').fill(PW);
  await page.getByRole('button', { name: 'Sign In', exact: false }).click();
  await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 25000 });
  return { ctx, page };
}

async function shot(page, name, fn, { tall = false } = {}) {
  try {
    const original = page.viewportSize();
    if (tall)
      await page.setViewportSize({ width: original.width, height: tall === true ? 2000 : tall });
    if (fn) await fn();
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${OUT}/${name}.png` });
    if (tall) await page.setViewportSize(original);
    copyFileSync(`${OUT}/${name}.png`, `${DOCS}/${name}.png`);
    results.push(`ok   ${name}`);
  } catch (e) {
    results.push(`FAIL ${name}: ${String(e).split('\n')[0]}`);
  }
}

// Mutating API calls need an Origin header (cross-origin writes are blocked), as a browser sends.
const write = (page, method, path, data) =>
  page.request.fetch(path, { method, data, headers: { Origin: BASE } });

const settle = async (page) => {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
};
const closeModal = async (page) => {
  const btn = page.getByRole('button', { name: /^(Cancel|Close)$/ }).first();
  if (await btn.isVisible().catch(() => false)) await btn.click();
  else await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
};

// ---------------------------------------------------------------- admin: set up data
const admin = await login('admin@proplity.com');
const list = (await (await admin.page.request.get('/api/v1/properties?scope=mine')).json()).data;
for (const p of list.filter((x) => x.moderationStatus !== 'APPROVED')) {
  await write(admin.page, 'PATCH', `/api/v1/properties/${p.id}/moderation`, {
    data: { status: 'APPROVED', moderationNotes: 'Verified on site' },
  });
}
const base = list.find((p) => !p.name.includes('(second listing)')) ?? list[0];
// Clearly-labelled sample photos so the gallery and photo manager have something to show.
const photos = [1, 2, 3, 4, 5].map((n) => `/sample-listing/photo-${n}.svg`);
await write(admin.page, 'PATCH', `/api/v1/properties/${base.id}`, {
  data: { imageUrl: photos[0], photoUrls: photos },
});

// ---------------------------------------------------------------- manager
const mgr = await login('manager@proplity.com');
const mine = (await (await mgr.page.request.get('/api/v1/properties?scope=mine')).json()).data;
const pid = mine.find((p) => p.id === base.id)?.id ?? mine[0].id;
const propUrl = `/dashboard/properties/${pid}`;
const mp = mgr.page;

// Fill the listing with realistic content so the screens are not all empty states.
// Skipped on a re-run so a second pass does not pile up duplicates.
const firstRun = !mine.some((p) => p.name.includes('(second listing)'));
if (firstRun) {
  await write(mp, 'POST', `/api/v1/properties/${pid}/equipment`, {
    type: 'GENERATOR',
    serialNumber: 'GEN-60KVA-0142',
    installedAt: '2025-03-01',
    warrantyExpiresAt: '2027-03-01',
  });
  await write(mp, 'POST', `/api/v1/properties/${pid}/equipment`, {
    type: 'INVERTER',
    serialNumber: 'INV-5K-8831',
    installedAt: '2025-06-15',
    warrantyExpiresAt: '2026-12-15',
  });
  await write(mp, 'POST', `/api/v1/properties/${pid}/announcements`, {
    title: 'Water tank cleaning on Saturday',
    body: 'The water supply will be off from 9am to 12pm while the tank is cleaned. Please store water ahead.',
    isPinned: true,
  });
  await write(mp, 'PUT', `/api/v1/properties/${pid}/neighbourhood-report`, {
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
  });
  // A second listing at the same address, so the admin duplicate screens have a candidate.
  await write(mp, 'POST', '/api/v1/properties', {
    name: `${base.name} (second listing)`,
    address: base.address,
    city: base.city,
  });
  // A staged edit on the published listing, so "changes waiting for approval" shows up.
  await write(mp, 'PATCH', `/api/v1/properties/${pid}`, {
    description: 'Refurbished common areas, new gate and a 24-hour guard post.',
  });
}

// An unpaid rent invoice, so the tenant has something to pay and a card to reuse for auto-pay.
const leaseRows = (await (await mp.request.get('/api/v1/leases')).json()).data ?? [];
const tenantLease = leaseRows.find(
  (l) => l.status === 'ACTIVE' && l.tenant?.email === 'tenant@proplity.com',
);
if (tenantLease) {
  const invs = (await (await mp.request.get('/api/v1/invoices')).json()).data ?? [];
  if (!invs.some((i) => i.leaseId === tenantLease.id && i.status === 'UNPAID')) {
    await write(mp, 'POST', '/api/v1/invoices', {
      leaseId: tenantLease.id,
      type: 'RENT',
      amount: 150000,
      dueDate: new Date(Date.now() + 5 * 86400000).toISOString(),
      description: 'Monthly rent',
    });
  }
}

await shot(
  mp,
  'feat_pd_manager',
  async () => {
    await mp.goto(propUrl);
    await settle(mp);
  },
  { tall: 2000 },
);
await shot(mp, 'feat_pd_photos_modal', async () => {
  await mp.goto(propUrl);
  await settle(mp);
  await mp.getByRole('button', { name: /Manage Photos/ }).click();
});
await closeModal(mp);
await shot(mp, 'feat_pd_edit_modal', async () => {
  await mp.goto(propUrl);
  await settle(mp);
  await mp.getByRole('button', { name: /Edit Property/ }).click();
  await mp.waitForTimeout(600);
});
await closeModal(mp);
await shot(mp, 'feat_pd_announcement_modal', async () => {
  await mp.goto(propUrl);
  await settle(mp);
  await mp.getByRole('button', { name: /New Announcement/ }).click();
});
await closeModal(mp);
await shot(mp, 'feat_pd_equipment_modal', async () => {
  await mp.goto(propUrl);
  await settle(mp);
  await mp.getByText('+ Add').first().click();
});
await closeModal(mp);
await shot(mp, 'feat_pd_import_units', async () => {
  await mp.goto(propUrl);
  await settle(mp);
  await mp
    .getByText(/Import Units/)
    .first()
    .click();
});
await closeModal(mp);
await shot(
  mp,
  'feat_tenant_detail',
  async () => {
    await mp.goto(propUrl);
    await settle(mp);
    await mp
      .getByRole('button', { name: /View Tenant/ })
      .first()
      .click();
    await mp.waitForURL(/\/dashboard\/tenants\//, { timeout: 30000 });
    await mp.getByText('Loading tenant…').waitFor({ state: 'detached', timeout: 30000 });
    await settle(mp);
  },
  { tall: 2400 },
);
await shot(
  mp,
  'feat_account_settings',
  async () => {
    await mp.goto('/dashboard/settings');
    await settle(mp);
  },
  { tall: 1500 },
);
await shot(
  mp,
  'feat_account_setup_verification',
  async () => {
    await mp.goto('/dashboard/settings');
    await settle(mp);
    await mp.getByRole('button', { name: /Setup & Verification/ }).click();
    await settle(mp);
  },
  { tall: 760 },
);
await shot(
  mp,
  'feat_account_bank_accounts',
  async () => {
    await mp.goto('/dashboard/settings');
    await settle(mp);
    await mp.getByRole('button', { name: /Payout & Bank Accounts/ }).click();
    await settle(mp);
  },
  { tall: 760 },
);
await shot(
  mp,
  'feat_breakdown_properties',
  async () => {
    await mp.goto('/dashboard/breakdown/properties');
    await settle(mp);
  },
  { tall: 1500 },
);
await shot(mp, 'feat_notifications_page', async () => {
  await mp.goto('/dashboard/notifications');
  await settle(mp);
});

await mgr.ctx.close();

// ---------------------------------------------------------------- admin
const ap = admin.page;
await shot(
  ap,
  'feat_admin_properties_queue',
  async () => {
    await ap.goto('/admin/properties');
    await ap.getByRole('button', { name: /^All \(/ }).click();
    await settle(ap);
  },
  { tall: 1500 },
);
await shot(
  ap,
  'feat_admin_properties_table',
  async () => {
    await ap.goto('/admin/properties');
    await ap.getByRole('button', { name: /^All \(/ }).click();
    await ap.getByTitle('Switch to Table view').click();
    await settle(ap);
  },
  { tall: 1100 },
);
await shot(ap, 'feat_admin_review_drawer', async () => {
  await ap.goto('/admin/properties');
  await ap.getByRole('button', { name: /^All \(/ }).click();
  await settle(ap);
  await ap
    .getByRole('button', { name: /^Review( Details)?$/ })
    .first()
    .click();
  await ap.waitForTimeout(900);
});
await ap.keyboard.press('Escape');
await shot(ap, 'feat_admin_merge_modal', async () => {
  await ap.goto('/admin/properties');
  await ap.getByRole('button', { name: /^All \(/ }).click();
  await settle(ap);
  await ap.getByTitle('Merge Duplicate').first().click();
  await ap.waitForTimeout(900);
});
await shot(
  ap,
  'feat_admin_property_full',
  async () => {
    await ap.goto(`/admin/properties/${pid}`);
    await settle(ap);
  },
  { tall: 1800 },
);
await shot(
  ap,
  'feat_admin_breakdown_users',
  async () => {
    await ap.goto('/admin/breakdown/users');
    await settle(ap);
  },
  { tall: 1300 },
);
await shot(
  ap,
  'feat_admin_breakdown_transactions',
  async () => {
    await ap.goto('/admin/breakdown/transactions');
    await settle(ap);
  },
  { tall: 1300 },
);
await shot(ap, 'feat_admin_notifications_page', async () => {
  await ap.goto('/admin/notifications');
  await settle(ap);
});
await admin.ctx.close();

// ---------------------------------------------------------------- landlord
const ll = await login('landlord@proplity.com');
for (const type of ['tenants', 'rent', 'maintenance', 'renewals']) {
  await shot(
    ll.page,
    `feat_breakdown_${type}`,
    async () => {
      await ll.page.goto(`/dashboard/breakdown/${type}`);
      await settle(ll.page);
    },
    { tall: 1400 },
  );
}
await shot(
  ll.page,
  'feat_landlord_property_detail',
  async () => {
    const mineL = (await (await ll.page.request.get('/api/v1/properties?scope=mine')).json()).data;
    await ll.page.goto(`/dashboard/properties/${mineL[0].id}`);
    await settle(ll.page);
  },
  { tall: 2000 },
);
await shot(ll.page, 'feat_landlord_rentals', async () => {
  await ll.page.goto('/dashboard/rentals');
  await settle(ll.page);
});
await ll.ctx.close();

// ---------------------------------------------------------------- tenant
const tn = await login('tenant@proplity.com');
const tp = tn.page;
// Pay one invoice with the mock card so a reusable card exists for auto-pay.
await tp.goto('/dashboard');
await settle(tp);
const payBtn = tp.getByRole('button', { name: 'Pay Rent Online' });
if (await payBtn.isEnabled().catch(() => false)) {
  await payBtn.click();
  await tp.waitForURL(/mock-checkout/, { timeout: 30000 }).catch(() => undefined);
  await tp
    .getByRole('button', { name: /^Pay ₦/ })
    .click()
    .catch(() => undefined);
  await tp.waitForTimeout(2500);
}
await tp.goto('/dashboard');
await settle(tp);
// A re-run may find auto-pay already on; cancel it so the set-up step can be shown again.
const cancelAuto = tp.getByRole('button', { name: 'Cancel Auto-Pay' });
if (await cancelAuto.isVisible().catch(() => false)) {
  await cancelAuto.click();
  await tp.waitForTimeout(1500);
}
await shot(tp, 'feat_tenant_autopay_setup', async () => {
  await tp.getByRole('button', { name: 'Setup Auto-Pay' }).click();
  await tp.getByText(/Auto-pay each rent invoice|No saved card/).waitFor();
  await tp.getByText(/Auto-pay each rent invoice|No saved card/).scrollIntoViewIfNeeded();
});
await tp
  .getByRole('button', { name: 'Enable Auto-Pay' })
  .click()
  .catch(() => undefined);
await tp.waitForTimeout(1500);
await shot(tp, 'feat_tenant_autopay_active', async () => {
  await tp.getByText(/Auto-pay is active/).waitFor({ timeout: 10000 });
  await tp.getByText(/Auto-pay is active/).scrollIntoViewIfNeeded();
});
// A guest access code for the unit, so the Access Codes card shows one.
const leases = (await (await tp.request.get('/api/v1/leases')).json()).data ?? [];
const active = leases.find((l) => l.status === 'ACTIVE') ?? leases[0];
if (active) {
  await write(tp, 'POST', '/api/v1/access-codes', {
    data: {
      unitId: active.unitId,
      code: '482915',
      guestName: 'Delivery rider',
      validFrom: new Date().toISOString(),
      validUntil: new Date(Date.now() + 86400000).toISOString(),
    },
  });
}
await tp.goto('/dashboard');
await settle(tp);
await shot(tp, 'feat_tenant_dashboard_full', null, { tall: 2600 });
await shot(tp, 'feat_tenant_access_codes', async () => {
  await tp.getByRole('heading', { name: 'Access Codes' }).scrollIntoViewIfNeeded();
});
await shot(
  tp,
  'feat_tenant_neighbourhood_report',
  async () => {
    await tp.goto('/dashboard/neighbourhood-report');
    await settle(tp);
  },
  { tall: 1800 },
);
await shot(tp, 'feat_tenant_notifications', async () => {
  await tp.goto('/dashboard/notifications');
  await settle(tp);
});
await tn.ctx.close();

// ---------------------------------------------------------------- vendor
const vd = await login('vendor@proplity.com');
// Bill one of the vendor's jobs so the Invoices page shows a real row.
{
  const jobs =
    (await (await vd.page.request.get('/api/v1/maintenance/requests')).json()).data ?? [];
  const me = (await (await vd.page.request.get('/api/v1/auth/me')).json()).data ?? {};
  const job = jobs.find((j) => j.vendorId === me.id || j.vendor?.id === me.id) ?? jobs[0];
  const have = (await (await vd.page.request.get('/api/v1/invoices')).json()).data ?? [];
  if (job && have.length === 0) {
    await write(vd.page, 'POST', '/api/v1/invoices', {
      maintenanceRequestId: job.id,
      type: 'MAINTENANCE',
      amount: 35000,
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString(),
      description: 'Labour and parts: kitchen sink trap replacement',
    });
  }
}
await shot(vd.page, 'feat_vendor_invoices', async () => {
  await vd.page.goto('/dashboard/vendor/invoices');
  await settle(vd.page);
});
await vd.ctx.close();

// ---------------------------------------------------------------- marketing
const mk = await browser.newContext({ viewport: { width: 1400, height: 900 }, baseURL: BASE });
const mkp = await mk.newPage();
for (const [name, path] of [
  ['feat_marketing_pricing', '/pricing'],
  ['feat_marketing_for_landlords', '/for-landlords'],
  ['feat_marketing_for_tenants', '/for-tenants'],
  ['feat_marketing_for_vendors', '/for-vendors'],
  ['feat_marketing_about', '/about'],
  ['feat_marketing_contact', '/contact'],
]) {
  await shot(
    mkp,
    name,
    async () => {
      await mkp.goto(path);
      await settle(mkp);
    },
    { tall: 1800 },
  );
}
await mk.close();

// ---------------------------------------------------------------- phone layout
const mb = await login('tenant@proplity.com', { width: 390, height: 844 });
await shot(mb.page, 'feat_mobile_tenant_tabbar', async () => {
  await mb.page.goto('/dashboard');
  await settle(mb.page);
});
await shot(mb.page, 'feat_mobile_more_sheet', async () => {
  await mb.page.getByRole('button', { name: /More/ }).last().click();
  await mb.page.waitForTimeout(700);
});
await mb.ctx.close();
const mm = await login('manager@proplity.com', { width: 390, height: 844 });
await shot(
  mm.page,
  'feat_mobile_manager_property',
  async () => {
    await mm.page.goto(propUrl);
    await settle(mm.page);
  },
  { tall: 2600 },
);
await mm.ctx.close();

await browser.close();
console.log(results.join('\n'));
