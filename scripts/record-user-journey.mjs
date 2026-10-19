// Records one continuous walkthrough of Proplity, start to finish, driven only by what a person
// can do in a browser: clicking, typing, choosing files and following links. No database edits,
// no API calls and no direct jumps to deep pages that a user would reach by clicking.
//
// The story: a property manager lists a property with photos, it stays hidden from the public until
// the admin approves and the manager publishes it, a visitor finds it, registers as a tenant, applies and
// books a viewing, the manager approves the application and starts the tenancy, both sign, the tenant pays
// rent, reports a repair and rates the vendor, the manager sends a vendor who completes and bills the job,
// and the manager pays. Messaging, the property tools, the admin console, the public pages, the phone view
// and the guide follow. A step that cannot be done fails the run: it is a product bug, not a script gap.
//
// Usage:   E2E_BASE_URL=http://localhost:3030 node scripts/record-user-journey.mjs
// Needs:   the app on `next dev` (local file storage is refused in production builds) against a freshly
//          seeded database (pnpm db:seed2), with NEXT_PUBLIC_STORAGE_ENABLED=true, STORAGE_PROVIDER=local,
//          NEXT_PUBLIC_EMAIL_INBOX_ENABLED=true and NEXT_PUBLIC_PAYMENTS_MOCK_ENABLED=true (no real Paystack
//          key). Run it on a throwaway database: it creates real records.
// Options: JOURNEY_FAST=1 skips the pacing (to debug a step quickly, no video worth keeping);
//          JOURNEY_ACTS=3,4 runs only those acts (the database must already hold the earlier state);
//          JOURNEY_NO_VIDEO=1 does not record.
// Output:  public/videos/proplity-complete-userflow.webm and the chapter list in the two player pages.
import { chromium } from '@playwright/test';
import {
  copyFileSync,
  mkdirSync,
  statSync,
  readFileSync,
  writeFileSync,
  existsSync,
} from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.E2E_BASE_URL || 'http://localhost:3030';
const FAST = process.env.JOURNEY_FAST === '1';
const NO_VIDEO = process.env.JOURNEY_NO_VIDEO === '1' || FAST;
const ONLY_ACTS = process.env.JOURNEY_ACTS ? process.env.JOURNEY_ACTS.split(',').map(Number) : null;
const PW = 'Password123!';
const PUBLIC_VIDEO_DIR = resolve(__dirname, '../public/videos');
const RAW_VIDEO_DIR = resolve(__dirname, '../out/video');
const ASSET_DIR = resolve(__dirname, '../out/journey-assets');
mkdirSync(PUBLIC_VIDEO_DIR, { recursive: true });
mkdirSync(RAW_VIDEO_DIR, { recursive: true });
mkdirSync(ASSET_DIR, { recursive: true });

// The people and the property in the story.
const NEW_TENANT = {
  first: 'Chioma',
  last: 'Eze',
  email: 'chioma.eze@example.com',
  phone: '+234 802 345 6789',
};
const PROPERTY = { address: '7 Glover Road, Ikoyi', city: 'Lagos', state: 'Lagos' };

const CURSOR_SCRIPT = `
(function() {
  function init() {
    if (document.getElementById('playwright-cursor')) return;

    // 1. Virtual Cursor
    const cursor = document.createElement('div');
    cursor.id = 'playwright-cursor';
    cursor.style.cssText = 'position:fixed;top:0;left:0;width:28px;height:28px;z-index:9999999;pointer-events:none;transform:translate(720px, 450px);will-change:transform;transition:transform 0.04s cubic-bezier(0.16, 1, 0.3, 1);';
    cursor.innerHTML = \`
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" style="filter: drop-shadow(0 4px 10px rgba(0,0,0,0.85));">
        <path d="M5.5 3.5L18.5 11.5L12 13L9.5 19.5L5.5 3.5Z" fill="#2563eb" stroke="#ffffff" stroke-width="1.8" stroke-linejoin="round"/>
      </svg>
      <div id="playwright-ripple" style="position:absolute;top:2px;left:2px;width:26px;height:26px;border-radius:50%;background:rgba(37,99,235,0.7);transform:scale(0);opacity:0;pointer-events:none;transition:none;"></div>
    \`;
    document.body.appendChild(cursor);

    // 2. Premium HUD Pill Banner
    const hud = document.createElement('div');
    hud.id = 'playwright-hud';
    hud.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:9999998;background:rgba(15,23,42,0.96);backdrop-filter:blur(16px);border:1px solid rgba(59,130,246,0.45);border-radius:9999px;padding:9px 24px;color:#ffffff;font-family:system-ui,-apple-system,sans-serif;font-size:14px;font-weight:700;box-shadow:0 12px 32px -4px rgba(0,0,0,0.8);display:flex;align-items:center;gap:12px;pointer-events:none;transition:all 0.3s ease;';
    hud.innerHTML = \`
      <span style="width:10px;height:10px;border-radius:50%;background:#3b82f6;display:inline-block;box-shadow:0 0 12px #3b82f6;"></span>
      <span id="playwright-hud-text">Proplity Master Userflow Walkthrough</span>
    \`;
    document.body.appendChild(hud);

    window.addEventListener('mousemove', (e) => {
      cursor.style.transform = 'translate(' + e.clientX + 'px, ' + e.clientY + 'px)';
    }, { passive: true });

    window.addEventListener('mousedown', () => {
      const ripple = document.getElementById('playwright-ripple');
      if (ripple) {
        ripple.style.transition = 'none';
        ripple.style.transform = 'scale(0)';
        ripple.style.opacity = '1';
        setTimeout(() => {
          ripple.style.transition = 'transform 0.35s ease-out, opacity 0.35s ease-out';
          ripple.style.transform = 'scale(2.8)';
          ripple.style.opacity = '0';
        }, 15);
      }
    }, { passive: true });
  }

  window.__initOverlay = init;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
`;

async function makeSampleImages() {
  // Plain labelled pictures, drawn in a throwaway page, to upload as listing photos and an ID scan.
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 800 } });
  const files = {};
  const items = [
    ['living', 'Living room', '#c9d8ee'],
    ['kitchen', 'Kitchen', '#eadfca'],
    ['bedroom', 'Bedroom', '#ddd3ee'],
    ['bathroom', 'Bathroom', '#cfe6e1'],
    ['exterior', 'Building exterior', '#d9e8c6'],
    ['id-card', 'Sample ID card', '#f3e6c9'],
    ['sink-before', 'Leaking sink trap (before)', '#ecd5d5'],
    ['sink-after', 'Sink trap replaced (after)', '#d5ecde'],
    ['still-wet', 'Cabinet floor still wet', '#e8e2d0'],
    ['sink-fixed', 'Dried out and sealed (second visit)', '#d0e6ec'],
    ['transfer-receipt', 'Bank transfer receipt (GTBank)', '#e3ecd5'],
  ];
  for (const [key, label, bg] of items) {
    await p.setContent(
      `<body style="margin:0;display:flex;align-items:center;justify-content:center;width:1200px;height:800px;background:${bg};font-family:sans-serif"><div style="text-align:center"><div style="font-size:64px;color:#1f2a44">${label}</div><div style="font-size:24px;color:#55607a;margin-top:12px">Sample image for the walkthrough</div></div></body>`,
    );
    files[key] = resolve(ASSET_DIR, `${key}.png`);
    await p.screenshot({ path: files[key] });
  }
  await b.close();
  return files;
}

async function main() {
  console.log(
    `🎬 Recording the Proplity user journey against ${BASE}${FAST ? ' (fast, not recorded)' : ''}`,
  );
  const images = await makeSampleImages();
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    baseURL: BASE,
    ...(NO_VIDEO
      ? {}
      : { recordVideo: { dir: RAW_VIDEO_DIR, size: { width: 1280, height: 720 } } }),
  });
  const page = await context.newPage();
  await page.addInitScript(CURSOR_SCRIPT);
  // The dev server's floating badge is not part of the product.
  await page.addInitScript(() => {
    const style = document.createElement('style');
    style.textContent = 'nextjs-portal{display:none!important}';
    document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style));
  });

  let mouseX = 640;
  let mouseY = 360;
  const chapters = [];
  const recStart = Date.now();

  const pause = (ms) => page.waitForTimeout(FAST ? Math.min(ms, 60) : ms);

  function chapter(icon, name, accent) {
    const sec = Math.floor((Date.now() - recStart) / 1000);
    const timeStr = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
    chapters.push({ timeSec: sec, timeStr, icon, name, accentColor: accent });
    console.log(`⏱ [${timeStr}] ${icon} ${name}`);
  }

  async function smoothMove(x, y) {
    const steps = FAST ? 1 : 14;
    const sx = mouseX;
    const sy = mouseY;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const e = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      await page.mouse.move(Math.round(sx + (x - sx) * e), Math.round(sy + (y - sy) * e));
      if (!FAST) await page.waitForTimeout(14);
    }
    mouseX = x;
    mouseY = y;
  }

  async function moveTo(locator) {
    // A page that re-renders under the pointer (a form after hydration) is tried once more.
    try {
      await locator.scrollIntoViewIfNeeded({ timeout: 8000 });
    } catch {
      await page.waitForTimeout(600);
      await locator.scrollIntoViewIfNeeded({ timeout: 8000 });
    }
    const box = await locator.boundingBox();
    if (box)
      await smoothMove(Math.round(box.x + box.width / 2), Math.round(box.y + box.height / 2));
  }

  // A real click: move the pointer to the control, then click it. It fails the run if the
  // control is not there, so a changed screen is noticed instead of silently skipped.
  async function click(locator, { settle = 350 } = {}) {
    await locator.first().waitFor({ state: 'visible', timeout: 15000 });
    await moveTo(locator.first());
    await pause(120);
    await locator.first().click({ timeout: 8000 });
    await pause(settle);
  }

  // A click that saves something: wait for the request it sends to finish (the first call to a
  // route can be slow on the dev server) before the story moves on.
  async function submit(locator, { settle = 600 } = {}) {
    const done = page.waitForResponse(
      (r) => r.request().method() !== 'GET' && r.url().includes('/api/'),
      { timeout: 60000 },
    );
    done.catch(() => {});
    await click(locator, { settle: 100 });
    const res = await done;
    if (!res.ok())
      throw new Error(`Saving failed: ${res.request().method()} ${res.url()} -> ${res.status()}`);
    await pause(settle);
  }

  async function type(locator, text, delay = 22) {
    await locator.first().waitFor({ state: 'visible', timeout: 15000 });
    await moveTo(locator.first());
    await locator.first().click();
    await locator.first().fill('');
    if (FAST) await locator.first().fill(text);
    else await locator.first().pressSequentially(text, { delay });
    await pause(150);
  }

  async function select(locator, value) {
    await locator.first().waitFor({ state: 'visible', timeout: 15000 });
    await moveTo(locator.first());
    await locator.first().selectOption(value);
    await pause(250);
  }

  async function hud(text, accent = '#3b82f6') {
    await page.evaluate(
      ({ t, c }) => {
        if (!document.getElementById('playwright-hud') && window.__initOverlay)
          window.__initOverlay();
        const text = document.getElementById('playwright-hud-text');
        const dot = document.querySelector('#playwright-hud span');
        if (text) text.textContent = t;
        if (dot) {
          dot.style.background = c;
          dot.style.boxShadow = `0 0 12px ${c}`;
        }
      },
      { t: text, c: accent },
    );
  }

  async function scroll(deltaY) {
    const steps = FAST ? 2 : 14;
    for (let i = 0; i < steps; i++) {
      await page.evaluate((y) => {
        window.scrollBy({ top: y, behavior: 'instant' });
        document.querySelectorAll('main').forEach((m) => {
          if (m.scrollHeight > m.clientHeight) m.scrollBy({ top: y, behavior: 'instant' });
        });
      }, deltaY / steps);
      if (!FAST) await page.waitForTimeout(18);
    }
    await pause(300);
  }

  async function toTop() {
    await page.evaluate(() => {
      window.scrollTo({ top: 0, behavior: 'instant' });
      document.querySelectorAll('main').forEach((m) => m.scrollTo({ top: 0, behavior: 'instant' }));
    });
    await pause(200);
  }

  // Sign in through the login form, as a person would.
  async function signIn(email, password = PW) {
    if (!page.url().includes('/login')) await page.goto('/login');
    // The form hydrates and the session check runs once the page loads; text typed before that is
    // wiped, so let the page settle first (the paced run never notices, a fast one does).
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await page.waitForTimeout(FAST ? 700 : 150);
    await type(page.getByPlaceholder('Enter your email'), email);
    await type(page.getByPlaceholder('Enter your password'), password);
    await click(page.getByRole('button', { name: 'Sign In' }), { settle: 800 });
    await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 25000 });
    await pause(900);
  }

  // Use the visible Log Out control, then land on the login page.
  async function signOut() {
    // A success message in the top-right corner can sit over the button; wait for it to go.
    await page
      .locator('[data-sonner-toast]')
      .first()
      .waitFor({ state: 'detached', timeout: 12000 })
      .catch(() => undefined);
    const logout = page.getByRole('button', { name: /^(Log Out|Sign Out)$/ });
    await click(logout.first(), { settle: 600 });
    // A "Sign out?" confirmation follows.
    await click(
      page
        .getByRole('heading', { name: 'Sign out?' })
        .locator('xpath=..')
        .getByRole('button', { name: 'Sign out' }),
      { settle: 600 },
    );
    await page.waitForURL((u) => u.pathname === '/login' || u.pathname === '/', { timeout: 15000 });
    await pause(500);
    if (!page.url().includes('/login')) await page.goto('/login');
  }

  // Open the Sent Emails panel (the stand-in for a real inbox), open the newest email whose subject
  // matches, and follow its link.
  async function followEmailLink(subjectPart, hrefPart) {
    await click(page.getByRole('button', { name: 'Open sent emails panel' }), { settle: 700 });
    const refresh = page.getByRole('button', { name: 'Refresh' });
    if (await refresh.isVisible().catch(() => false)) await click(refresh, { settle: 500 });
    await click(page.locator('button').filter({ hasText: subjectPart }), { settle: 900 });
    const link = page.locator(`a[href*="${hrefPart}"]`).first();
    await link.waitFor({ state: 'visible', timeout: 10000 });
    await link.evaluate((el) => el.removeAttribute('target'));
    await moveTo(link);
    await pause(500);
    await link.click();
    await page.waitForLoadState('domcontentloaded');
    await pause(900);
  }

  // Back to the public home page the way a visitor would: the logo on the login page or the nav.
  async function goHome() {
    const back = page.getByRole('link', { name: 'Back to home' });
    if (await back.count()) await click(back, { settle: 900 });
    else await click(page.getByRole('link', { name: /Proplity/ }).first(), { settle: 900 });
    await page.waitForURL((u) => u.pathname === '/');
    await pause(600);
  }

  // Fill whatever empty required-looking fields are visible in the current form step, choosing a
  // sensible value from each field's label. Logs what it filled so a changed form is noticed.
  async function fillEmptyFields(scope = page.locator('form'), values = {}) {
    const fields = scope.locator('input:visible, select:visible, textarea:visible');
    const n = await fields.count();
    const filled = [];
    for (let i = 0; i < n; i++) {
      const f = fields.nth(i);
      const info = await f.evaluate((el) => {
        const wrap = el.closest('div');
        const label = (
          wrap?.querySelector('label')?.textContent ||
          el.getAttribute('placeholder') ||
          ''
        ).trim();
        return {
          tag: el.tagName,
          type: el.getAttribute('type') || '',
          label,
          value: el.value,
          checked: el.checked,
        };
      });
      if (
        info.type === 'file' ||
        info.type === 'checkbox' ||
        info.type === 'radio' ||
        info.type === 'hidden'
      )
        continue;
      if (info.value) continue;
      const key = Object.keys(values).find((k) => new RegExp(k, 'i').test(info.label));
      if (info.tag === 'SELECT') {
        const opts = await f
          .locator('option')
          .evaluateAll((os) => os.map((o) => o.value).filter(Boolean));
        if (opts.length) await select(f, key ? values[key] : opts[0]);
      } else if (info.type === 'date') {
        const days = /end|expir|until|to\b/i.test(info.label) ? 21 + 365 : 21;
        await f.fill(new Date(Date.now() + days * 86400000).toISOString().slice(0, 10));
      } else if (info.type === 'number') {
        await type(f, key ? values[key] : '1500000');
      } else {
        await type(f, key ? values[key] : 'Kora Technologies');
      }
      filled.push(info.label || info.type);
    }
    console.log('   filled:', filled.join(' | '));
  }

  const acts = [];
  const act = (n, title, fn) => acts.push({ n, title, fn });

  // ---------------------------------------------------------------------------------------------
  act(1, 'A property manager lists a new property', async () => {
    chapter('👔', 'A property manager lists a new property with photos', '#3b82f6');
    await page.goto('/login');
    await hud('👔 A property manager signs in to list a new property', '#3b82f6');
    await signIn('manager@proplity.com');
    await hud('🏢 The manager dashboard: portfolio, tenants, maintenance and messages', '#3b82f6');
    await pause(1800);
    await scroll(300);
    await pause(1200);
    await toTop();

    await click(page.getByRole('link', { name: 'List Property' }), { settle: 900 });
    await page.waitForURL('**/dashboard/properties/new**');

    await hud('📋 Step 1 of 4: what kind of property and where it is', '#f59e0b');
    await click(page.getByRole('button', { name: 'Apartment/Flat' }));
    await type(page.getByPlaceholder(/Block 15/), PROPERTY.address);
    await type(page.getByPlaceholder(/Lagos/).first(), PROPERTY.city);
    await select(page.locator('select').first(), PROPERTY.state);
    await click(page.getByRole('button', { name: 'Next Step' }), { settle: 700 });

    await hud('🏢 Step 2 of 4: the units, their rent and the service charge', '#f59e0b');
    // The innermost matching box is the unit's own card (outer wrappers match too).
    const unitBox = (n) =>
      page
        .locator('div.rounded-lg.border', {
          has: page.getByRole('heading', { name: `Unit ${n}`, exact: true }),
        })
        .last();
    const fillUnit = async (n, u) => {
      const box = unitBox(n);
      await type(box.getByPlaceholder('e.g., 3B'), u.label);
      await type(box.getByPlaceholder('e.g., 3', { exact: true }), u.beds);
      await type(box.getByPlaceholder('e.g., 2', { exact: true }), u.baths);
      await type(box.getByPlaceholder('e.g., 1200'), u.sqft);
      await type(box.getByPlaceholder('e.g., 850000'), u.rent);
      await type(box.getByPlaceholder('e.g., 50000'), u.service);
    };
    await fillUnit(1, {
      label: 'Flat 1A',
      beds: '2',
      baths: '2',
      sqft: '950',
      rent: '3200000',
      service: '300000',
    });
    await click(page.getByRole('button', { name: 'Add Another Unit' }), { settle: 600 });
    await hud('➕ A second unit in the same building', '#f59e0b');
    await fillUnit(2, {
      label: 'Flat 2B',
      beds: '3',
      baths: '3',
      sqft: '1400',
      rent: '4800000',
      service: '400000',
    });
    await type(
      page.getByPlaceholder(/Describe the property/),
      'Quiet, gated block in Ikoyi with steady power, round-the-clock security and covered parking.',
      16,
    );
    await scroll(500);
    await hud('✨ Amenities and the utilities that are included', '#f59e0b');
    for (const name of ['24/7 Power Supply', 'Security/CCTV', 'Parking Space', 'Elevator']) {
      await click(page.getByRole('button', { name }), { settle: 200 });
    }
    await scroll(300);
    for (const name of ['Water Included', 'Waste Management Included']) {
      await click(page.getByRole('button', { name }), { settle: 200 });
    }
    await click(page.getByRole('button', { name: 'Next Step' }), { settle: 800 });

    await page.getByRole('heading', { name: 'Media Upload' }).waitFor();
    await toTop();
    await hud('📸 Step 3 of 4: photos of every room, and the building from outside', '#f59e0b');
    await pause(800);
    // The visible control is the "Upload Photos" label that wraps a hidden file input.
    const uploadInputs = page.locator('input[type="file"][accept="image/*"]');
    await moveTo(page.getByRole('heading', { name: /Photos of Every Room/ }));
    await uploadInputs
      .nth(0)
      .setInputFiles([images.living, images.kitchen, images.bedroom, images.bathroom]);
    await page.getByText('4 photos uploaded', { exact: true }).waitFor({ timeout: 30000 });
    await pause(900);
    await uploadInputs.nth(1).setInputFiles([images.exterior]);
    await page.getByText(/1 photo\(s\) uploaded successfully/).waitFor({ timeout: 30000 });
    await pause(1200);
    await click(page.getByRole('button', { name: 'Next Step' }), { settle: 800 });

    await page.getByRole('heading', { name: 'Review Your Listing' }).waitFor();
    await toTop();
    await hud('🚀 Step 4 of 4: review everything, then submit for admin verification', '#f59e0b');
    await pause(1500);
    if (process.env.JOURNEY_DEBUG) await page.screenshot({ path: '/tmp/claude-1000/step4a.png' });
    await scroll(500);
    await pause(1500);
    if (process.env.JOURNEY_DEBUG) await page.screenshot({ path: '/tmp/claude-1000/step4b.png' });
    await click(page.getByRole('button', { name: 'Submit for Verification' }), { settle: 1500 });
    await page.waitForURL((u) => u.pathname === '/dashboard', { timeout: 40000 });
    await hud('📨 Submitted: the listing now waits for an admin to review it', '#10b981');
    await pause(2000);
    await signOut();
  });

  // ---------------------------------------------------------------------------------------------
  act(2, 'Not public until it is approved', async () => {
    chapter('🌍', 'A visitor cannot see the new listing yet', '#10b981');
    await hud(
      '🌍 Meanwhile a visitor opens Proplity and looks at the featured properties',
      '#10b981',
    );
    await goHome();
    await page.locator('#properties').scrollIntoViewIfNeeded();
    await pause(1500);
    await scroll(250);
    await page.waitForFunction(
      () => !document.body.innerText.includes('Loading properties'),
      null,
      { timeout: 15000 },
    );
    const visible = await page.getByText(PROPERTY.address.split(',')[0]).count();
    if (visible > 0) throw new Error('The unapproved listing is visible on the public home page');
    await hud('🔒 Only approved listings are shown: the new one is not here yet', '#10b981');
    await pause(3500);
  });

  // ---------------------------------------------------------------------------------------------
  act(3, 'The admin reviews, approves and publishes', async () => {
    chapter('🛡', 'The admin reviews, approves and publishes the listing', '#a78bfa');
    await page.goto('/login');
    await hud('🛡 The platform admin signs in to the moderation queue', '#a78bfa');
    await signIn('admin@proplity.com');
    await pause(1500);
    await click(page.getByRole('link', { name: 'Properties' }).first(), { settle: 1200 });
    await page.waitForURL('**/admin/properties**');
    await hud(
      '🏘 Properties and Moderation: every listing waits here before it goes public',
      '#a78bfa',
    );
    await pause(1500);
    await click(page.getByRole('button', { name: /^Pending Review/ }), { settle: 900 });
    await hud('⏳ Pending Review: the new submission, with its owner and units', '#a78bfa');
    await pause(1800);
    const card = page.locator('div', {
      has: page.getByRole('heading', { name: new RegExp(PROPERTY.address.split(',')[0]) }),
    });
    await click(card.getByRole('button', { name: /^Review/ }).last(), { settle: 1200 });
    await hud(
      '📋 The review drawer: who submitted it, the units and the moderation notes',
      '#a78bfa',
    );
    await pause(2500);
    const drawer = page.getByRole('complementary', { name: 'Property Review Drawer' });
    await drawer.evaluate((el) => el.scrollBy({ top: 400, behavior: 'smooth' }));
    await pause(2200);
    await submit(drawer.getByRole('button', { name: 'Approve Listing' }), { settle: 800 });
    await drawer.waitFor({ state: 'hidden', timeout: 15000 });
    await hud('✅ Approved. The owner side now publishes it, so it is still private', '#10b981');
    await pause(2800);
    await signOut();
  });

  // ---------------------------------------------------------------------------------------------
  act(4, 'The manager publishes the approved listing', async () => {
    chapter('👔', 'The manager publishes the approved listing', '#3b82f6');
    await hud('👔 The manager gets the approval and opens the property to publish it', '#3b82f6');
    await signIn('manager@proplity.com');
    await click(page.getByRole('link', { name: 'My Properties' }), { settle: 1200 });
    await page.waitForURL('**/dashboard/properties');
    await pause(1200);
    const card = page
      .locator('div', {
        has: page.getByRole('heading', { name: new RegExp(PROPERTY.address.split(',')[0]) }),
      })
      .filter({ has: page.getByRole('button', { name: 'View Details' }) })
      .last();
    await click(card.getByRole('button', { name: 'View Details' }), { settle: 1500 });
    await page.waitForURL(/\/dashboard\/properties\/[^/]+$/);
    await hud('🏢 Listing Status: approved by the admin, not yet visible to the public', '#3b82f6');
    await pause(2200);
    await click(page.getByRole('button', { name: 'Publish Listing' }), { settle: 1500 });
    await hud('🌐 Published: the listing is now on the public marketplace', '#10b981');
    await pause(2500);
    await signOut();
  });

  // ---------------------------------------------------------------------------------------------
  // From wherever the visitor is: home page, featured properties, the preview and the full listing.
  async function openNewListing(narrate = true) {
    if (!page.url().endsWith('/') && !/\/$/.test(new URL(page.url()).pathname)) await goHome();
    await page.locator('#properties').scrollIntoViewIfNeeded();
    await page.getByText(PROPERTY.address.split(',')[0]).first().waitFor({ timeout: 20000 });
    await pause(1200);
    await click(page.getByText(PROPERTY.address.split(',')[0]).first(), { settle: 1200 });
    if (narrate)
      await hud('🏡 A preview of the listing; the visitor opens the full page', '#10b981');
    await pause(1500);
    await click(page.getByRole('dialog').getByRole('link', { name: /View/ }), { settle: 1500 });
    await page.waitForURL('**/properties/**');
  }

  act(5, 'A visitor finds the approved listing', async () => {
    chapter('🌍', 'A visitor finds the approved listing and opens it', '#10b981');
    await hud('🌍 Back on the public home page, the new listing is now there', '#10b981');
    await goHome();
    await openNewListing();
    await hud(
      '🖼 The public listing: photo gallery, units, amenities and the neighbourhood',
      '#10b981',
    );
    await pause(2000);
    await scroll(450);
    await pause(2000);
    await scroll(450);
    await pause(2000);
    await toTop();
  });

  // ---------------------------------------------------------------------------------------------
  act(6, 'The visitor signs up as a tenant', async () => {
    chapter('🏠', 'The visitor wants the property, so signs up as a tenant', '#10b981');
    if (!page.url().includes('/properties/')) {
      if (page.url() === 'about:blank' || page.url().includes('/login')) await goHome();
      await openNewListing(false);
    }
    await hud('🏠 The visitor likes it and tries to apply, which needs an account', '#10b981');
    await click(page.getByRole('button', { name: 'Apply for this Property' }), { settle: 900 });
    await hud('🔐 Applying needs an account, so Proplity asks the visitor to sign in', '#10b981');
    await pause(1800);
    await click(page.getByRole('button', { name: 'Sign In' }).last(), { settle: 1000 });
    await page.waitForURL('**/login**');
    await click(page.getByRole('link', { name: /Sign up for free/ }), { settle: 1000 });
    await page.waitForURL('**/register**');
    await hud('🧭 Choose a role: this visitor is looking for a home, so Tenant', '#10b981');
    await pause(1500);
    await click(page.getByRole('button', { name: /Tenant/ }).first(), { settle: 1000 });

    await hud('📝 The tenant sign-up form', '#10b981');
    await type(page.getByPlaceholder('First name'), NEW_TENANT.first);
    await type(page.getByPlaceholder('Last name'), NEW_TENANT.last);
    await type(page.getByPlaceholder('you@example.com'), NEW_TENANT.email);
    await type(page.getByPlaceholder('+234 803 000 0000'), NEW_TENANT.phone);
    await scroll(200);
    await select(page.locator('select').first(), 'Lagos');
    await type(page.getByPlaceholder('e.g. Software Engineer'), 'Software Engineer');
    await type(page.locator('input[type="password"]').nth(0), PW);
    await type(page.locator('input[type="password"]').nth(1), PW);
    await click(page.locator('input[type="checkbox"]').first(), { settle: 400 });
    await click(page.getByRole('button', { name: 'Create Free Account' }), { settle: 1500 });
    await page.getByRole('heading', { name: /Check your email/i }).waitFor({ timeout: 20000 });
    await hud(
      '📬 A verification email was sent. In testing the Sent Emails panel is the inbox',
      '#10b981',
    );
    await pause(1800);
    await followEmailLink('Verify', '/verify-email');
    await hud('✅ The link opens the activation page', '#10b981');
    await pause(1200);
    await click(page.getByRole('button', { name: 'Activate Account' }), { settle: 1500 });
    await page.getByRole('heading', { name: 'Account Activated' }).waitFor();
    await hud('🎉 Account activated: now sign in', '#10b981');
    await pause(1500);
    await click(page.getByRole('link', { name: /Sign In/ }).first(), { settle: 900 });
    await page.waitForURL('**/login**');
    await signIn(NEW_TENANT.email);
  });

  // ---------------------------------------------------------------------------------------------
  const signedInAs = async (email) => {
    if (page.url() === 'about:blank') await page.goto('/login');
    if (page.url().includes('/login')) await signIn(email);
  };

  act(7, 'The tenant applies, then books a viewing', async () => {
    chapter('🏠', 'The new tenant completes a profile, applies and books a viewing', '#10b981');
    await signedInAs(NEW_TENANT.email);
    // Sign-in must return the tenant to what they came to do: apply for this property.
    await page.waitForURL(/\/dashboard\/properties\/[^/]+\/apply|profile\/complete/, {
      timeout: 40000,
    });
    await page.waitForLoadState('networkidle');
    await hud(
      '➡️ Signed in: Proplity takes the tenant straight back to the application',
      '#10b981',
    );
    await pause(2000);
    await page.waitForLoadState('networkidle');
    await hud('🪪 First application: a one-time profile with emergency contact and ID', '#10b981');
    await pause(1500);
    await type(page.getByPlaceholder('+234 803 000 0000').first(), NEW_TENANT.phone);
    await type(page.getByPlaceholder('e.g. 1995'), '1994');
    await type(page.getByPlaceholder('Emergency contact full name'), 'Ngozi Eze');
    await type(page.getByPlaceholder('+234 803 000 0000').nth(1), '+234 803 111 2222');
    await type(page.getByPlaceholder('e.g., Parent, Sibling, Spouse'), 'Sister');
    await scroll(300);
    await hud('📎 A government ID scan is uploaded once and reused', '#10b981');
    await page.locator('input[type="file"]').setInputFiles(images['id-card']);
    await page.getByText('id-card.png').waitFor({ timeout: 30000 });
    await pause(1500);
    await click(page.locator('button[type="submit"]').last(), { settle: 1800 });
    await page
      .getByRole('heading', { name: 'Complete Your Profile' })
      .waitFor({ state: 'detached', timeout: 30000 });
    await page.waitForFunction(
      () => (document.querySelector('main')?.innerText ?? '').length > 80,
      null,
      { timeout: 30000 },
    );
    await pause(1000);
    await hud('📋 Application, step 1 of 3', '#10b981');
    await pause(1200);
    await fillEmptyFields();
    await click(page.getByRole('button', { name: 'Next Step' }), { settle: 900 });
    await hud('💼 Application, step 2 of 3: employment, income and move-in', '#10b981');
    await pause(1000);
    await fillEmptyFields(page.locator('form'), {
      'income|salary': '1800000',
      employer: 'Kora Technologies',
      'position|title|job': 'Product Engineer',
      'length|how long|years': '3 years',
    });
    await click(page.getByRole('button', { name: 'Next Step' }), { settle: 900 });
    await hud('✅ Application, step 3 of 3: review and submit', '#10b981');
    await pause(1200);
    await fillEmptyFields(page.locator('form'), {
      reason: 'My new office is in Ikoyi and I want a shorter commute',
      'anything else': 'Two adults, no pets. References available on request.',
    });
    await click(page.locator('form input[type="checkbox"]').first(), { settle: 400 });
    await click(page.getByRole('button', { name: 'Submit Application' }), { settle: 1500 });
    await page
      .getByText(/application (has been )?submitted|submitted successfully|Application Submitted/i)
      .first()
      .waitFor({ timeout: 20000 });
    await hud('📨 Application submitted: the manager reviews it next', '#10b981');
    await pause(2500);

    await click(page.getByRole('link', { name: 'Browse Properties' }), { settle: 1200 });
    await page.waitForURL('**/dashboard/discover**');
    await hud('🔍 While the manager reviews it, the tenant also books a viewing', '#10b981');
    await pause(1800);
    const card = page
      .locator('div.overflow-hidden', { hasText: PROPERTY.address.split(',')[0] })
      .filter({ has: page.getByRole('button', { name: 'Schedule Tour' }) })
      .last();
    await card.scrollIntoViewIfNeeded();
    await pause(1500);
    await hud('📅 Schedule Tour: pick a date and a start time', '#10b981');
    await click(card.getByRole('button', { name: 'Schedule Tour' }), { settle: 1200 });
    await page.getByRole('heading', { name: 'Select a Date' }).waitFor();
    // Three days out, moved off a Sunday: viewings run Monday to Saturday.
    const viewingDay = new Date();
    viewingDay.setDate(viewingDay.getDate() + 3);
    if (viewingDay.getDay() === 0) viewingDay.setDate(viewingDay.getDate() + 1);
    const viewingKey = [
      viewingDay.getFullYear(),
      String(viewingDay.getMonth() + 1).padStart(2, '0'),
      String(viewingDay.getDate()).padStart(2, '0'),
    ].join('-');
    await page.getByLabel('Viewing date').fill(viewingKey);
    await pause(800);
    await page.getByLabel('Start time').selectOption('10:00');
    await pause(800);
    await click(page.getByRole('button', { name: 'Continue' }), { settle: 800 });
    await hud('📝 Name, email and phone are already filled in from the account', '#10b981');
    await pause(1500);
    if (
      !(await page.locator('form input[type="email"]').first().inputValue()).includes(
        NEW_TENANT.email,
      )
    ) {
      throw new Error('The viewing form was not prefilled with the signed-in tenant details');
    }
    await type(
      page.locator('textarea'),
      'I would like to see the kitchen and the generator room.',
      16,
    );
    await click(page.locator('input[type="checkbox"]').first(), { settle: 400 });
    await click(page.getByRole('button', { name: 'Confirm Viewing' }), { settle: 1500 });
    await page.getByRole('heading', { name: 'Viewing Requested!' }).waitFor({ timeout: 15000 });
    await hud('✅ Viewing requested: the manager gets a notification', '#10b981');
    await pause(2500);
  });

  // ---------------------------------------------------------------------------------------------
  const openNewListingAsManager = async () => {
    await click(page.getByRole('link', { name: 'My Properties' }), { settle: 1200 });
    await page.waitForURL('**/dashboard/properties');
    const card = page
      .locator('div', {
        has: page.getByRole('heading', { name: new RegExp(PROPERTY.address.split(',')[0]) }),
      })
      .filter({ has: page.getByRole('button', { name: 'View Details' }) })
      .last();
    await click(card.getByRole('button', { name: 'View Details' }), { settle: 1500 });
    await page.waitForURL(/\/dashboard\/properties\/[^/]+$/);
    await page
      .getByRole('heading', { name: new RegExp(PROPERTY.address.split(',')[0]) })
      .first()
      .waitFor({ timeout: 40000 });
    await pause(1000);
  };

  act(8, 'The manager handles the viewing and the application', async () => {
    chapter('👔', 'The manager confirms the viewing and reviews the application', '#3b82f6');
    if (page.url() === 'about:blank') await page.goto('/login');
    if (page.url().includes('/login')) await signIn('manager@proplity.com');
    else {
      await signOut();
      await signIn('manager@proplity.com');
    }
    await hud('👔 The manager sees new activity on the dashboard', '#3b82f6');
    await pause(2000);
    await openNewListingAsManager();
    await hud('🏢 On the property page: viewing requests and rental applications', '#3b82f6');
    await pause(1500);
    await page.getByText('Chioma Eze').first().waitFor({ timeout: 30000 });
    await scroll(800);
    await hud('📅 The tenant asked to view the property: the manager confirms the slot', '#3b82f6');
    await pause(1500);
    await submit(page.getByRole('button', { name: 'Confirm', exact: true }), { settle: 1500 });
    await page.screenshot({ path: resolve(RAW_VIDEO_DIR, 'explore-8b.png') });
    await hud('✅ Viewing confirmed: the tenant is told', '#3b82f6');
    await pause(2000);
    await hud('📋 The rental application: the manager approves it', '#3b82f6');
    await submit(page.getByRole('button', { name: 'Approve', exact: true }).first(), {
      settle: 2000,
    });
    await pause(2500);
    await hud('✅ Approved: the applicant is ready for a tenancy', '#10b981');
    await pause(2000);
    await click(page.getByRole('link', { name: 'Create tenancy' }), { settle: 1500 });
    await page.waitForURL('**/dashboard/tenants/add**');
    await hud('📝 Create the tenancy: tenant details come from the application', '#3b82f6');
    await pause(1800);
    const isoIn = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
    // From an application the form opens at Lease Details: tenant, property and unit are already set.
    // Step 3: lease terms
    await page.getByRole('heading', { name: 'Lease Details' }).waitFor();
    await hud('🏠 The property, unit and tenant come from the application', '#3b82f6');
    await pause(1500);
    await hud('📄 Lease terms: start and end dates, rent and service charge', '#3b82f6');
    const dates = page.locator('input[type="date"]');
    await dates.nth(0).fill(isoIn(21));
    await pause(500);
    await dates.nth(1).fill(isoIn(21 + 365));
    await pause(1500);
    await click(page.getByRole('button', { name: /^Continue/ }), { settle: 900 });
    // Step 4: review and create
    await hud('🔎 Review everything, then create the tenancy', '#3b82f6');
    await pause(2200);
    await scroll(300);
    await pause(1500);
    await submit(page.getByRole('button', { name: 'Create Tenancy' }));
    await pause(2500);
    await page.screenshot({ path: resolve(RAW_VIDEO_DIR, 'explore-8a.png') });
  });

  // ---------------------------------------------------------------------------------------------
  act(9, 'The manager signs and activates the lease', async () => {
    chapter('📄', 'The manager opens the new tenancy, signs the lease and activates it', '#3b82f6');
    await signedInAs('manager@proplity.com');
    if (!page.url().endsWith('/dashboard/tenants')) {
      await click(page.getByRole('link', { name: 'Tenants' }).first(), { settle: 1200 });
      await page.waitForURL('**/dashboard/tenants');
    }
    await hud('👥 The Tenants list: the new tenancy is there, waiting to start', '#3b82f6');
    await pause(2200);
    await click(page.getByRole('row', { name: /Chioma Eze/ }), { settle: 1500 });
    await page.waitForURL(/\/dashboard\/tenants\/[^/]+$/);
    await page.getByText('Lease Agreement Signature').waitFor({ timeout: 40000 });
    await hud('📄 The tenancy record: lease terms, signatures, payments and documents', '#3b82f6');
    await pause(2200);
    await scroll(500);
    await hud('✍️ Both sides sign the lease: the manager types a full legal name', '#3b82f6');
    await type(page.getByPlaceholder('Full name'), 'Alex Vance');
    await pause(800);
    await submit(page.getByRole('button', { name: 'Sign Agreement' }));
    await page.getByText(/Signed by Alex Vance/).waitFor();
    await hud('✅ Signed by the manager; now it waits for the tenant', '#10b981');
    await pause(2200);
    await toTop();
    await pause(800);
    await hud('🟢 Activate the lease so the first rent invoice can be raised', '#3b82f6');
    await submit(page.getByRole('button', { name: 'Activate Lease' }));
    await pause(2500);
  });

  // ---------------------------------------------------------------------------------------------
  act(10, 'The tenant signs the lease and pays rent', async () => {
    chapter('🏠', 'The tenant signs the lease and pays the first rent', '#10b981');
    if (page.url() === 'about:blank') await page.goto('/login');
    if (page.url().includes('/login')) await signIn(NEW_TENANT.email);
    else {
      await signOut();
      await signIn(NEW_TENANT.email);
    }
    await hud('🏠 The tenant dashboard now shows a lease waiting to be signed', '#10b981');
    await page.getByText('Lease Agreement Signature').waitFor({ timeout: 40000 });
    await page.getByRole('heading', { name: 'Needs your attention' }).waitFor();
    await page.getByText('Lease to sign').waitFor();
    await hud('📌 Needs your attention: everything waiting on the tenant, in one list', '#10b981');
    await pause(3000);
    await scroll(250);
    await hud('✍️ The tenant types a full legal name to sign: that is the e-signature', '#10b981');
    await type(page.getByPlaceholder('Full name'), `${NEW_TENANT.first} ${NEW_TENANT.last}`);
    await pause(800);
    await submit(page.getByRole('button', { name: 'Sign Agreement' }));
    await page.getByText('Fully Executed').waitFor();
    await hud('✅ Fully Executed: both parties have signed the lease', '#10b981');
    await pause(2500);
    await toTop();
    await hud('🏠 My Rental Dashboard: property, balance, payments and maintenance', '#10b981');
    await pause(2200);
    await scroll(500);
    await pause(1800);
    await hud('💳 Rent and the service charge were invoiced when the lease started', '#10b981');
    await pause(2000);
    await click(page.getByRole('button', { name: 'Pay Rent Online' }), { settle: 1500 });
    await page.waitForURL('**/dev/mock-checkout**', { timeout: 40000 });
    await hud('💳 The payment page (a test checkout here, Paystack in production)', '#10b981');
    await pause(2500);
    await submit(page.getByRole('button', { name: /^Pay ₦/ }));
    await page.waitForURL('**/dashboard/payment-history', { timeout: 40000 });
    await hud('🧾 Payment History: the receipt is recorded and the balance drops', '#10b981');
    await pause(3000);
  });

  // ---------------------------------------------------------------------------------------------
  act(11, 'The tenant reports a repair', async () => {
    chapter('🔧', 'A month in, the tenant reports a repair', '#f59e0b');
    await signedInAs(NEW_TENANT.email);
    if (!/\/dashboard$/.test(new URL(page.url()).pathname)) {
      await click(page.getByRole('link', { name: 'My Dashboard' }), { settle: 1200 });
    }
    await hud(
      '🔧 Something breaks in the flat: the tenant reports it from the dashboard',
      '#f59e0b',
    );
    await pause(1800);
    await click(page.getByRole('button', { name: /Request Repair/ }), { settle: 1200 });
    await page.getByRole('heading', { name: 'Submit Maintenance Request' }).waitFor();
    await hud('📝 The request form: unit, category, priority and what is wrong', '#f59e0b');
    await pause(1800);
    await click(page.getByRole('button', { name: 'Plumbing' }), { settle: 500 });
    await click(page.getByRole('button', { name: 'High' }), { settle: 500 });
    await type(
      page.getByPlaceholder('e.g., Kitchen faucet is leaking'),
      'Kitchen sink is leaking under the cabinet',
    );
    await type(
      page.getByPlaceholder(/Please describe the issue/),
      'Water has been dripping since yesterday and the cabinet floor is wet. Please send a plumber.',
      16,
    );
    await scroll(300);
    await type(page.getByPlaceholder(/Master bedroom bathroom/), 'Kitchen sink');
    await scroll(300);
    await page
      .locator('input[type="date"]')
      .fill(new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10));
    await select(page.locator('select').last(), 'morning');
    await pause(800);
    await submit(page.getByRole('button', { name: 'Submit Request' }));
    await page.waitForURL((u) => u.pathname === '/dashboard', { timeout: 30000 });
    await hud('✅ Submitted: the manager is notified and the request is tracked', '#10b981');
    await pause(1500);
    await page
      .getByText('Kitchen sink is leaking under the cabinet')
      .first()
      .scrollIntoViewIfNeeded();
    await pause(2500);
  });

  // ---------------------------------------------------------------------------------------------
  act(12, 'The manager dispatches a vendor', async () => {
    chapter('👔', 'The manager sees the repair request and dispatches a vendor', '#3b82f6');
    if (page.url() === 'about:blank') await page.goto('/login');
    if (page.url().includes('/login')) await signIn('manager@proplity.com');
    else {
      await signOut();
      await signIn('manager@proplity.com');
    }
    await hud('👔 The manager has a new notification about the repair', '#3b82f6');
    await pause(1800);
    await page.getByText('Repair requests with no vendor').waitFor({ timeout: 20000 });
    await hud(
      '📌 Needs your attention: the repair waits for a vendor, with a link to it',
      '#3b82f6',
    );
    await pause(3000);
    await click(page.getByRole('link', { name: 'Maintenance' }).first(), { settle: 1200 });
    await page.waitForURL('**/dashboard/maintenance');
    await hud('🛠 The Maintenance board: new requests, in progress and completed', '#3b82f6');
    await pause(2200);
    const card = page
      .locator('div.rounded-lg', { hasText: 'Kitchen sink is leaking under the cabinet' })
      .filter({ has: page.getByRole('button', { name: 'View Details' }) })
      .last();
    await card.scrollIntoViewIfNeeded();
    await pause(1200);
    await click(card.getByRole('button', { name: 'View Details' }), { settle: 1500 });
    await page.getByRole('button', { name: '+ Assign Vendor' }).waitFor({ timeout: 40000 });
    await hud('📋 The request: tenant, unit, priority and photos', '#3b82f6');
    await pause(2200);
    await click(page.getByRole('button', { name: '+ Assign Vendor' }), { settle: 1200 });
    await hud('🧰 Pick a vendor by category, rating and completion rate', '#3b82f6');
    await pause(2000);
    await type(page.getByPlaceholder(/Search by business name/), 'Apex');
    await pause(1200);
    await submit(page.getByRole('button', { name: /Apex Repairs/ }));
    await page.getByRole('button', { name: 'Reassign Vendor' }).waitFor();
    await page.getByRole('button', { name: 'Reassign Vendor' }).scrollIntoViewIfNeeded();
    await hud('✅ Dispatched: the vendor is notified and the tenant sees who is coming', '#10b981');
    await pause(2800);
  });

  // ---------------------------------------------------------------------------------------------
  act(13, 'The vendor does the job and invoices', async () => {
    chapter('🧰', 'The vendor accepts the job, does the work and sends an invoice', '#f59e0b');
    if (page.url() === 'about:blank') await page.goto('/login');
    if (page.url().includes('/login')) await signIn('vendor@proplity.com');
    else {
      await signOut();
      await signIn('vendor@proplity.com');
    }
    await hud('🧰 The vendor dashboard: new jobs, active work and earnings', '#f59e0b');
    await pause(2200);
    const job = page
      .locator('div.rounded-lg', { hasText: 'Kitchen sink is leaking under the cabinet' })
      .filter({ has: page.getByRole('button', { name: 'View Details' }) })
      .last();
    await job.scrollIntoViewIfNeeded();
    await hud('🔔 A new job from the manager: a leaking kitchen sink', '#f59e0b');
    await pause(1800);
    await click(job.getByRole('button', { name: 'View Details' }), { settle: 1500 });
    await page.getByText('Update Job Status').waitFor({ timeout: 40000 });
    await hud('📋 The job: location, tenant contact, priority and the manager', '#f59e0b');
    await pause(2200);
    await scroll(400);
    await submit(page.getByRole('button', { name: 'Mark In Progress' }));
    await hud('▶️ The vendor starts the work: status moves to In Progress', '#f59e0b');
    await pause(2200);
    await type(
      page.getByPlaceholder(/Add notes about the work progress/),
      'Found a worn trap seal. Replacing it now.',
    );
    await submit(page.getByRole('button', { name: 'Save Notes' }));
    await hud('📝 A progress note the manager and tenant can follow', '#f59e0b');
    await pause(2200);
    await page.getByRole('heading', { name: 'Work Photos' }).scrollIntoViewIfNeeded();
    await hud('📸 Work Photos: the vendor shows the work, before and after', '#f59e0b');
    await pause(2200);
    await page
      .locator('input[type="file"][aria-label="Add before photos"]')
      .setInputFiles(images['sink-before']);
    await page.getByRole('button', { name: 'Open before photo 1' }).waitFor({ timeout: 30000 });
    await hud('📷 A photo of the leak before the work is saved on the job', '#f59e0b');
    await pause(2400);
    await click(page.getByRole('button', { name: /Mark Complete & Create Invoice/ }), {
      settle: 1500,
    });
    await page.getByText('Sending this invoice closes the job').waitFor({ timeout: 20000 });
    await hud(
      '🛑 Closing a job needs a photo of the finished work, so the invoice waits for one',
      '#ef4444',
    );
    await pause(3200);
    await click(page.getByRole('link', { name: 'Add photos to the job' }), { settle: 1500 });
    await page.getByRole('heading', { name: 'Work Photos' }).waitFor({ timeout: 40000 });
    await page.getByRole('heading', { name: 'Work Photos' }).scrollIntoViewIfNeeded();
    await page
      .locator('input[type="file"][aria-label="Add after photos"]')
      .setInputFiles(images['sink-after']);
    await page.getByRole('button', { name: 'Open after photo 1' }).waitFor({ timeout: 30000 });
    await hud('✅ The finished work is photographed: now the job can be closed', '#10b981');
    await pause(2400);
    await scroll(600);
    await click(page.getByRole('button', { name: /Mark Complete & Create Invoice/ }), {
      settle: 1500,
    });
    await hud('🧾 Work done: the vendor itemises the invoice', '#f59e0b');
    await pause(1800);
    await type(page.getByPlaceholder('Item description'), 'Replace kitchen sink trap and seal');
    const nums = page.locator('input[type="number"]');
    await nums.nth(0).fill('1');
    await nums.nth(1).fill('45000');
    await pause(1500);
    await type(
      page.getByPlaceholder(/Add any additional notes/),
      'Payment by bank transfer or online. Thank you.',
    );
    await submit(page.getByRole('button', { name: 'Submit Invoice' }));
    await hud('📤 Invoice sent to the manager, who can now pay it', '#10b981');
    await pause(3000);
  });

  // ---------------------------------------------------------------------------------------------
  act(14, 'The manager pays the vendor invoice', async () => {
    chapter('💳', 'The manager reviews the finished job and pays the vendor', '#3b82f6');
    if (page.url() === 'about:blank') await page.goto('/login');
    if (page.url().includes('/login')) await signIn('manager@proplity.com');
    else {
      await signOut();
      await signIn('manager@proplity.com');
    }
    await hud('👔 The manager is notified that the job is done', '#3b82f6');
    await pause(1800);
    await click(page.getByRole('link', { name: 'Maintenance' }).first(), { settle: 1200 });
    await page.waitForURL('**/dashboard/maintenance');
    await hud('🛠 The request moved to Completed on the board', '#3b82f6');
    await pause(1800);
    const card = page
      .locator('div.rounded-lg', { hasText: 'Kitchen sink is leaking under the cabinet' })
      .filter({ has: page.getByRole('button', { name: 'View Details' }) })
      .last();
    await card.scrollIntoViewIfNeeded();
    await pause(1200);
    await click(card.getByRole('button', { name: 'View Details' }), { settle: 1500 });
    await page.getByText('Cost Tracking').waitFor({ timeout: 40000 });
    await page.getByText('Vendor, after the work').scrollIntoViewIfNeeded();
    await hud('📸 The vendor’s before and after photos are on the request', '#3b82f6');
    await pause(2800);
    await page.getByRole('heading', { name: 'Sign-off' }).scrollIntoViewIfNeeded();
    await hud(
      '🧾 Sign-off: waiting for the tenant to say whether it is fixed. The manager can wait, or approve now',
      '#3b82f6',
    );
    await pause(3500);
    await page.getByText('Cost Tracking').scrollIntoViewIfNeeded();
    await hud('🧾 Cost Tracking: the vendor invoice is waiting to be paid', '#3b82f6');
    await pause(2500);
    await click(page.getByRole('button', { name: 'View invoice' }), { settle: 1200 });
    await page.getByText('Replace kitchen sink trap and seal').waitFor({ timeout: 10000 });
    await page.getByText('Vendor notes: Payment by bank transfer or online').waitFor();
    await hud('🔎 View invoice: the vendor’s itemised lines, VAT, total and notes', '#3b82f6');
    await pause(3500);
    await click(page.getByRole('button', { name: /^Pay ₦/ }), { settle: 1500 });
    await page.waitForURL('**/dev/mock-checkout**', { timeout: 40000 });
    await hud('💳 Pay the vendor through the same checkout', '#3b82f6');
    await pause(2200);
    await submit(page.getByRole('button', { name: /^Pay ₦/ }));
    await page.waitForURL('**/dashboard/**', { timeout: 40000 });
    await hud('✅ Paid: the job is closed, invoiced and settled', '#10b981');
    await pause(3000);
  });

  // ---------------------------------------------------------------------------------------------
  // The guest code the tenant makes, read from the screen so the gate check can use it later.
  let guestCode = null;

  act(15, 'The tenant is asked whether the repair is fixed', async () => {
    chapter(
      '🔧',
      'The tenant sees the repair completed and is asked whether it is fixed',
      '#10b981',
    );
    if (page.url() === 'about:blank') await page.goto('/login');
    if (page.url().includes('/login')) await signIn(NEW_TENANT.email);
    else {
      await signOut();
      await signIn(NEW_TENANT.email);
    }
    await hud('🏠 Back on the tenant dashboard: the repair request has moved on', '#10b981');
    await pause(2000);
    await page.getByRole('heading', { name: 'Access Codes' }).scrollIntoViewIfNeeded();
    await hud('🔑 Access codes: the tenant makes a one-time gate code for a guest', '#10b981');
    await pause(1500);
    await click(page.getByRole('button', { name: '+ New Guest Code' }), { settle: 800 });
    await type(page.getByPlaceholder('Guest name (optional)'), 'Dayo (cousin)');
    await pause(800);
    await submit(page.getByRole('button', { name: 'Create Code' }));
    await page.getByText('Dayo (cousin)').first().waitFor({ timeout: 20000 });
    guestCode = (
      await page
        .locator('div.rounded-lg.border', { hasText: 'Dayo (cousin)' })
        .last()
        .locator('p.text-2xl')
        .innerText()
    ).trim();
    if (!/^\d{6}$/.test(guestCode)) throw new Error(`Unexpected guest code: ${guestCode}`);
    await pause(2200);
    await hud('🚫 Changed plans? Revoke a code and the gate refuses it from then on', '#10b981');
    await click(page.getByRole('button', { name: '+ New Guest Code' }), { settle: 800 });
    await type(page.getByPlaceholder('Guest name (optional)'), 'Cleaner (Tuesday)');
    await submit(page.getByRole('button', { name: 'Create Code' }));
    const cleaner = page.locator('div.rounded-lg.border', { hasText: 'Cleaner (Tuesday)' }).last();
    await cleaner.waitFor({ timeout: 20000 });
    await pause(1500);
    await submit(cleaner.getByRole('button', { name: 'Revoke' }), { settle: 800 });
    await cleaner.getByText('Revoked', { exact: true }).waitFor({ timeout: 20000 });
    await pause(2200);
    await page.getByText('Maintenance Requests').first().scrollIntoViewIfNeeded();
    await pause(1500);
    await click(page.getByRole('button', { name: /View All/ }).last(), { settle: 1500 });
    await page.waitForURL('**/dashboard/tenant-maintenance');
    await page.getByText('Track and manage your maintenance requests').waitFor({ timeout: 40000 });
    await hud('🔧 My maintenance requests: every request and where it stands', '#10b981');
    await pause(2200);
    await click(page.getByRole('button', { name: /Kitchen sink is leaking/ }), { settle: 1200 });
    await page.getByText('Is it fixed?').waitFor({ timeout: 20000 });
    await hud(
      '🧰 The vendor says it is done, so the tenant is asked whether it is really fixed',
      '#f59e0b',
    );
    await pause(2600);
    await page.getByText('Vendor photos, after the work').scrollIntoViewIfNeeded();
    await hud(
      '📸 The vendor’s photos show what was done; the answer never affects payment',
      '#f59e0b',
    );
    await pause(2600);
    await click(page.getByRole('button', { name: 'Still a problem' }), { settle: 800 });
    await type(
      page.getByPlaceholder('What is still wrong?'),
      'The drip has stopped but the cabinet floor is still wet and there is a damp smell.',
      16,
    );
    await page
      .locator('input[type="file"][aria-label="Add photos (optional)"]')
      .setInputFiles(images['still-wet']);
    await page.getByRole('button', { name: 'Open your photo 1' }).waitFor({ timeout: 30000 });
    await hud('📷 A reason is required; photos are optional', '#f59e0b');
    await pause(2200);
    await submit(page.getByRole('button', { name: 'Send to my property team' }));
    await page.getByText('You said it is still a problem').first().waitFor({ timeout: 20000 });
    await hud('🚩 Sent: the property team decides what happens next', '#ef4444');
    await pause(3200);
  });

  // ---------------------------------------------------------------------------------------------
  act(16, 'The manager sends the repair back and the vendor fixes it again', async () => {
    chapter(
      '↩️',
      'The tenant says it is not fixed: the manager sends it back and the vendor fixes it again',
      '#ef4444',
    );
    if (page.url() === 'about:blank') await page.goto('/login');
    if (page.url().includes('/login')) await signIn('manager@proplity.com');
    else {
      await signOut();
      await signIn('manager@proplity.com');
    }
    await page
      .getByRole('link', { name: /Repairs the tenant says are not fixed/ })
      .waitFor({ timeout: 20000 });
    await hud('🚩 Needs your attention: the tenant says a repair is not fixed', '#ef4444');
    await pause(3000);
    await click(page.getByRole('link', { name: /Repairs the tenant says are not fixed/ }), {
      settle: 1500,
    });
    await page.getByText('What the tenant says').waitFor({ timeout: 40000 });
    await page.getByText('What the tenant says').scrollIntoViewIfNeeded();
    await hud(
      '📋 The tenant’s reason and photo, and three choices for the property team',
      '#ef4444',
    );
    await pause(3600);
    await page.getByRole('button', { name: 'Give to another vendor' }).waitFor();
    await page.getByRole('button', { name: 'Approve anyway' }).waitFor();
    await submit(page.getByRole('button', { name: 'Send back to vendor' }));
    await page
      .getByRole('heading', { name: 'Sign-off' })
      .waitFor({ state: 'detached', timeout: 20000 });
    await hud('↩️ Sent back: the job is open again and the vendor is told why', '#3b82f6');
    await pause(3000);

    await signOut();
    await signIn('vendor@proplity.com');
    await page.getByRole('link', { name: /Repairs sent back to you/ }).waitFor({ timeout: 20000 });
    await hud('🔔 The vendor sees the repair that came back', '#f59e0b');
    await pause(2600);
    await click(page.getByRole('link', { name: /Repairs sent back to you/ }), { settle: 1500 });
    await page.getByText('The tenant says this is still a problem').waitFor({ timeout: 40000 });
    await hud('🚩 The tenant’s reason and photo are on the job', '#ef4444');
    await pause(3200);
    await page.getByRole('heading', { name: 'Work Photos' }).scrollIntoViewIfNeeded();
    await page
      .locator('input[type="file"][aria-label="Add after photos"]')
      .setInputFiles(images['sink-fixed']);
    await page.getByRole('button', { name: 'Open after photo 2' }).waitFor({ timeout: 30000 });
    await hud('📷 The second visit is photographed', '#f59e0b');
    await pause(2200);
    await scroll(500);
    await hud('✅ The invoice is already sent, so the vendor just marks the work done', '#f59e0b');
    await pause(2200);
    await submit(page.getByRole('button', { name: 'Mark work done' }));
    await page
      .getByText('Waiting for the tenant to confirm the repair is fixed')
      .waitFor({ timeout: 20000 });
    await hud('📤 Done again: the tenant is asked once more, and payment is untouched', '#10b981');
    await pause(3000);
  });

  // ---------------------------------------------------------------------------------------------
  act(17, 'The tenant confirms, rates the vendor, and the manager approves', async () => {
    chapter(
      '✅',
      'The tenant confirms it is fixed and rates the vendor; the manager approves',
      '#10b981',
    );
    if (page.url() === 'about:blank') await page.goto('/login');
    if (page.url().includes('/login')) await signIn(NEW_TENANT.email);
    else {
      await signOut();
      await signIn(NEW_TENANT.email);
    }
    await page.getByRole('link', { name: /Repairs to confirm/ }).waitFor({ timeout: 20000 });
    await hud('🏠 The tenant is asked again: Repairs to confirm', '#10b981');
    await pause(2400);
    await click(page.getByRole('link', { name: /Repairs to confirm/ }), { settle: 1500 });
    await page.getByText('Is it fixed?').waitFor({ timeout: 40000 });
    await hud('🔧 This time it is fixed', '#10b981');
    await pause(2000);
    await submit(page.getByRole('button', { name: 'Confirm fixed' }));
    await page.getByText('You confirmed this repair is fixed').waitFor({ timeout: 20000 });
    await hud(
      '✅ Confirmed: recorded on the repair for the property team and the vendor',
      '#10b981',
    );
    await pause(2600);
    await scroll(300);
    await hud('⭐ The job is done, so the tenant rates the vendor', '#10b981');
    await click(page.getByRole('button', { name: '5 stars' }), { settle: 500 });
    await type(
      page.getByPlaceholder('Add a comment (optional)'),
      'Quick, tidy and fixed it properly on the second visit.',
    );
    await submit(page.getByRole('button', { name: 'Submit Rating' }));
    await page.getByText('Your rating').waitFor();
    await hud('✅ Rating saved: it feeds the vendor profile the manager sees', '#10b981');
    await pause(2800);

    await signOut();
    await signIn('manager@proplity.com');
    await click(page.getByRole('link', { name: 'Maintenance' }).first(), { settle: 1200 });
    await page.waitForURL('**/dashboard/maintenance');
    const card = page
      .locator('div.rounded-lg', { hasText: 'Kitchen sink is leaking under the cabinet' })
      .filter({ has: page.getByRole('button', { name: 'View Details' }) })
      .last();
    await card.scrollIntoViewIfNeeded();
    await click(card.getByRole('button', { name: 'View Details' }), { settle: 1500 });
    await page.getByRole('heading', { name: 'Sign-off' }).waitFor({ timeout: 40000 });
    await page.getByRole('heading', { name: 'Sign-off' }).scrollIntoViewIfNeeded();
    await hud('🧾 Sign-off: the tenant confirmed it is fixed, so the manager signs off', '#3b82f6');
    await pause(3000);
    await submit(page.getByRole('button', { name: 'Approve work' }));
    await page
      .getByText(/^Approved by/)
      .first()
      .waitFor({ timeout: 20000 });
    await hud(
      '✅ Approved: the sign-off is recorded. It never changes what the vendor is owed',
      '#10b981',
    );
    await pause(3200);
  });

  // ---------------------------------------------------------------------------------------------
  act(18, 'The tenant pays another way and the manager confirms it', async () => {
    chapter(
      '🏦',
      'The tenant pays by bank transfer; the manager confirms; a receipt is issued',
      '#10b981',
    );
    if (page.url() === 'about:blank') await page.goto('/login');
    if (page.url().includes('/login')) await signIn(NEW_TENANT.email);
    else {
      await signOut();
      await signIn(NEW_TENANT.email);
    }
    await click(page.getByRole('link', { name: 'Payment History' }).first(), { settle: 1500 });
    await page.waitForURL('**/dashboard/payment-history', { timeout: 40000 });
    await page.getByRole('button', { name: 'I paid by bank transfer' }).waitFor({ timeout: 40000 });
    await hud(
      '🧾 Payment History: every payment has a receipt, and an invoice can be paid another way',
      '#10b981',
    );
    await pause(3000);
    await click(page.getByRole('button', { name: 'I paid by bank transfer' }), { settle: 800 });
    const form = page.getByRole('dialog', { name: 'Paid another way' });
    await form.waitFor({ timeout: 20000 });
    await hud('🏦 Paid another way: the tenant records a transfer made outside the app', '#10b981');
    await pause(2200);
    await type(form.getByPlaceholder('e.g. GTBank'), 'GTBank');
    await type(form.getByPlaceholder('The transfer or session reference'), 'GTB-TRF-JOURNEY-4471');
    await hud('📎 The bank reference, and the receipt photo from the banking app', '#10b981');
    await form.locator('input[type="file"]').setInputFiles(images['transfer-receipt']);
    await form.getByText('transfer-receipt.png').waitFor({ timeout: 30000 });
    await pause(2000);
    await submit(form.getByRole('button', { name: 'Record payment' }));
    await page
      .getByRole('region', { name: 'Transfers you recorded' })
      .getByText('Waiting for your property team to confirm')
      .waitFor({ timeout: 30000 });
    await hud(
      '⏳ Recorded, but the invoice does not change until someone else confirms it',
      '#f59e0b',
    );
    await pause(3200);

    await signOut();
    await signIn('manager@proplity.com');
    await click(page.getByRole('link', { name: 'Bank Transfers' }).first(), { settle: 1500 });
    await page.waitForURL('**/dashboard/reconciliation', { timeout: 40000 });
    await page.getByText('GTB-TRF-JOURNEY-4471').waitFor({ timeout: 40000 });
    await hud(
      '👔 The manager sees the transfer waiting, with the tenant’s receipt photo',
      '#3b82f6',
    );
    await pause(3200);
    await submit(page.getByRole('button', { name: 'Confirm payment' }));
    await page.getByRole('tab', { name: 'Confirmed' }).click();
    await page
      .getByText(/^Receipt RCT-/)
      .first()
      .waitFor({ timeout: 30000 });
    await hud(
      '✅ Confirmed: the invoice is paid and a receipt exists. The tenant is told',
      '#10b981',
    );
    await pause(3200);

    await signOut();
    await signIn(NEW_TENANT.email);
    await click(page.getByRole('link', { name: 'Payment History' }).first(), { settle: 1500 });
    await page.waitForURL('**/dashboard/payment-history', { timeout: 40000 });
    await page
      .getByRole('link', { name: /^Receipt RCT-/ })
      .first()
      .waitFor({ timeout: 40000 });
    await hud('🧾 The payment now shows in history with its receipt', '#10b981');
    await pause(2500);
    await click(page.getByRole('link', { name: /^Receipt RCT-/ }).first(), { settle: 1500 });
    await page.waitForURL('**/receipts/**', { timeout: 40000 });
    await page.getByText('Bank transfer').first().waitFor({ timeout: 30000 });
    await hud(
      '🧾 The receipt: who paid whom, how, the reference, who confirmed it and what is left',
      '#10b981',
    );
    await pause(4000);
    await scroll(300);
    await pause(2200);
  });

  // ---------------------------------------------------------------------------------------------
  act(19, 'Tenant and manager message each other', async () => {
    chapter('💬', 'The tenant and the manager message each other', '#06b6d4');
    if (page.url() === 'about:blank') await page.goto('/login');
    if (page.url().includes('/login')) await signIn(NEW_TENANT.email);
    else {
      await signOut();
      await signIn(NEW_TENANT.email);
    }
    await hud(
      '💬 The tenant wants to thank the manager: Message Manager on the dashboard',
      '#06b6d4',
    );
    await pause(1800);
    await click(page.getByRole('button', { name: /Message Manager/ }), { settle: 1500 });
    await page.getByPlaceholder('Type your message...').waitFor({ timeout: 40000 });
    await hud(
      '💬 A private thread tied to the lease: messages, attachments and read receipts',
      '#06b6d4',
    );
    await pause(1800);
    await type(
      page.getByPlaceholder('Type your message...'),
      'Hello! Thank you for sending the plumber so quickly. The sink is fixed.',
    );
    await submit(page.getByTitle('Send message'));
    await hud('📨 Sent: the manager gets a notification', '#06b6d4');
    await pause(2500);
    await signOut();

    await signIn('manager@proplity.com');
    await hud('👔 The manager has a new message badge', '#3b82f6');
    await pause(1500);
    await click(page.getByRole('link', { name: 'Messages' }).first(), { settle: 1200 });
    await page.waitForURL('**/dashboard/messages');
    await click(page.getByRole('button', { name: /Chioma Eze/ }).first(), { settle: 1200 });
    await page
      .getByText(/Thank you for sending the plumber/)
      .last()
      .waitFor({ timeout: 30000 });
    await hud('👔 The manager opens the thread and replies', '#3b82f6');
    await pause(2200);
    await type(
      page.getByPlaceholder('Type your message...'),
      'Glad it is sorted, Chioma. Let us know if anything else comes up.',
    );
    await submit(page.getByTitle('Send message'));
    await hud('✅ Replied: both sides keep the whole history in one place', '#10b981');
    await pause(3000);
  });

  // ---------------------------------------------------------------------------------------------
  act(20, 'The manager uses the property tools', async () => {
    chapter(
      '🏢',
      'The manager works the property page: photos, private units, edits, notices and equipment',
      '#3b82f6',
    );
    if (page.url() === 'about:blank') await page.goto('/login');
    if (page.url().includes('/login')) await signIn('manager@proplity.com');
    else {
      await signOut();
      await signIn('manager@proplity.com');
    }
    await openNewListingAsManager();
    await hud('🏢 The property page: everything about one building in one place', '#3b82f6');
    await pause(2000);

    await click(page.getByRole('button', { name: 'Manage Photos' }), { settle: 1200 });
    const photoTitle = page.getByRole('heading', { name: 'Manage Photos & Media' });
    await photoTitle.waitFor();
    await hud('📷 Manage Photos & Media: cover image, gallery and a 360° tour link', '#3b82f6');
    await pause(3000);
    await click(photoTitle.locator('xpath=../../button'), { settle: 800 });

    await scroll(600);
    await hud('🔒 Make Private: Flat 2B leaves the marketplace but stays managed here', '#3b82f6');
    const flat2B = page
      .locator('div.p-6', { has: page.locator('p', { hasText: /^Unit Flat 2B$/ }) })
      .last();
    await flat2B.scrollIntoViewIfNeeded();
    await pause(1500);
    await click(flat2B.getByRole('button', { name: 'Make Private' }), { settle: 1500 });
    await page.getByText('Private (Selected Few)').first().waitFor({ timeout: 20000 });
    await pause(2200);

    await toTop();
    await hud('✏️ Edit Property: changes to a live listing are staged for admin review', '#3b82f6');
    await click(page.getByRole('button', { name: /Edit Property/ }), { settle: 1200 });
    await page.getByRole('heading', { name: 'Edit Property Details' }).waitFor();
    await pause(1200);
    const desc = page.locator('textarea').first();
    await type(
      desc,
      'Quiet, gated block in Ikoyi with steady power, 24-hour security, covered parking and a new rooftop terrace.',
      16,
    );
    await pause(1000);
    await submit(page.getByRole('button', { name: 'Submit for Review' }), { settle: 1500 });
    await hud(
      '📨 Staged: the live listing is unchanged until an admin approves the edit',
      '#3b82f6',
    );
    await pause(2800);

    await page.getByRole('heading', { name: 'Announcements' }).scrollIntoViewIfNeeded();
    await hud('📣 Announcements: a notice every resident of the property can read', '#3b82f6');
    await click(page.getByRole('button', { name: 'New Announcement' }), { settle: 800 });
    await type(page.getByPlaceholder('Title'), 'Water tank cleaning on Saturday');
    await type(
      page.getByPlaceholder('Message'),
      'Water will be off from 9am to 12pm. Please store water ahead.',
      16,
    );
    await submit(page.getByRole('button', { name: 'Post Announcement' }), { settle: 1200 });
    await pause(2200);

    await page.getByRole('heading', { name: 'Equipment' }).scrollIntoViewIfNeeded();
    await hud(
      '🔧 Equipment: generators, lifts and appliances tracked with serial numbers',
      '#3b82f6',
    );
    await click(page.getByRole('button', { name: '+ Add' }), { settle: 800 });
    await select(
      page.locator('select', { has: page.locator('option[value="GENERATOR"]') }),
      'GENERATOR',
    );
    await type(page.getByPlaceholder('Serial number (optional)'), 'GEN-IKY-0042');
    await submit(page.getByRole('button', { name: 'Add Equipment' }), { settle: 1200 });
    await pause(2200);

    await page.getByRole('heading', { name: 'Gate Check' }).scrollIntoViewIfNeeded();
    await hud(
      '🚪 Gate Check: the guard types the code the guest gives and sees at once whether to let them in',
      '#3b82f6',
    );
    await pause(1800);
    if (!guestCode)
      throw new Error(
        'The guest code from the tenant dashboard is missing (run acts 15 and 17 together)',
      );
    await select(page.getByLabel('Unit being visited'), { label: 'Unit Flat 1A' });
    await type(page.getByPlaceholder('Code from the guest'), guestCode);
    await submit(page.getByRole('button', { name: 'Check', exact: true }), { settle: 800 });
    await page.getByText('Let in: Dayo (cousin).').waitFor({ timeout: 20000 });
    await pause(2500);
    await hud('♻️ A one-time code is used up: the same code is refused the second time', '#3b82f6');
    await type(page.getByPlaceholder('Code from the guest'), guestCode);
    await submit(page.getByRole('button', { name: 'Check', exact: true }), { settle: 800 });
    await page.getByText(/Refused: the code was already used/).waitFor({ timeout: 20000 });
    await pause(2500);
    await click(page.getByRole('button', { name: 'Activity' }).first(), { settle: 1200 });
    await hud('📜 Activity: every check of the code is logged with the time', '#3b82f6');
    await pause(3000);

    await hud('👤 Each occupied unit links to its tenant record', '#3b82f6');
    await click(page.getByRole('button', { name: 'View Tenant' }).first(), { settle: 1500 });
    await page.waitForURL(/\/dashboard\/tenants\/[^/]+$/);
    await page.getByText('Lease Agreement Signature').waitFor({ timeout: 40000 });
    await pause(1800);
    await scroll(500);
    await hud(
      '📑 The tenant record: lease terms, signatures, late fees, violations and notes',
      '#3b82f6',
    );
    await pause(2500);
    await scroll(600);
    await pause(2500);
  });

  // ---------------------------------------------------------------------------------------------
  act(21, 'The admin approves the edit and tours the console', async () => {
    chapter('🛡', 'The admin approves the staged edit and checks the platform', '#a78bfa');
    if (page.url() === 'about:blank') await page.goto('/login');
    if (page.url().includes('/login')) await signIn('admin@proplity.com');
    else {
      await signOut();
      await signIn('admin@proplity.com');
    }
    await hud('🛡 The admin has a notification: a live listing was edited', '#a78bfa');
    await pause(1800);
    await click(page.getByRole('link', { name: 'Properties' }).first(), { settle: 1200 });
    await page.waitForURL('**/admin/properties**');
    await type(page.getByPlaceholder('Search listings…'), 'Glover');
    await pause(1200);
    const card = page.locator('div', {
      has: page.getByRole('heading', { name: new RegExp(PROPERTY.address.split(',')[0]) }),
    });
    await hud(
      '✏️ The listing is marked as edited: the live page stays unchanged until reviewed',
      '#a78bfa',
    );
    await pause(2200);
    await click(card.getByRole('button', { name: /^Review/ }).last(), { settle: 1200 });
    const drawer = page.getByRole('complementary', { name: 'Property Review Drawer' });
    await drawer.getByText('Proposed Edits Awaiting Review').waitFor({ timeout: 20000 });
    await drawer.getByText('Proposed Edits Awaiting Review').scrollIntoViewIfNeeded();
    await hud('🔎 The review drawer shows exactly what the manager wants to change', '#a78bfa');
    await pause(3500);
    await submit(drawer.getByRole('button', { name: 'Approve Edits' }), { settle: 1500 });
    await hud('✅ Edits approved and applied to the live listing in one step', '#10b981');
    await pause(2500);

    await hud('👥 User Management: every account, role and status', '#a78bfa');
    await click(page.getByRole('link', { name: 'User Management' }).first(), { settle: 1200 });
    await page.waitForURL('**/admin/users**');
    await type(page.getByPlaceholder('Search users…'), 'Chioma');
    await pause(2500);
    await hud('🔧 Suspend, reactivate or change a role, each with an audit trail', '#a78bfa');
    await pause(2500);

    await click(page.getByRole('link', { name: 'Reports' }).first(), { settle: 1200 });
    await page.waitForURL('**/admin/reports**');
    await hud('📈 Reports: collections, payment volume and trends by month', '#a78bfa');
    await pause(2500);
    await scroll(450);
    await pause(2500);

    await click(page.getByRole('link', { name: 'Security' }).first(), { settle: 1200 });
    await page.waitForURL('**/admin/security**');
    await hud(
      '🔐 Security: the audit log of every sensitive action, who did it and when',
      '#a78bfa',
    );
    await pause(2500);
    await scroll(400);
    await pause(2500);

    await click(page.getByRole('link', { name: 'Platform Settings' }).first(), { settle: 1200 });
    await page.waitForURL('**/admin/settings**');
    await hud('⚙️ Platform Settings: feature toggles and operating rules', '#a78bfa');
    await pause(2500);
    await scroll(450);
    await pause(2500);

    await click(page.getByRole('link', { name: 'System Overview' }).first(), { settle: 1200 });
    await hud('🏛 System Overview: the whole platform on one screen', '#a78bfa');
    await pause(3000);
  });

  // ---------------------------------------------------------------------------------------------
  act(22, 'The vendor is paid, then the public pages, the phone view and the guide', async () => {
    chapter('🔧', 'The vendor sees the payment arrive', '#ef4444');
    if (page.url() === 'about:blank') await page.goto('/login');
    if (page.url().includes('/login')) await signIn('vendor@proplity.com');
    else {
      await signOut();
      await signIn('vendor@proplity.com');
    }
    await hud('🔧 The vendor opens Invoices to see whether the manager has paid', '#ef4444');
    await pause(1500);
    await click(page.getByRole('link', { name: 'Invoices' }).first(), { settle: 1500 });
    await page.waitForURL('**/dashboard/vendor/invoices**');
    await page.getByText('Replace kitchen sink trap and seal').first().waitFor({ timeout: 30000 });
    await hud('🧾 Vendor Invoices: the job invoice and its payment status', '#ef4444');
    await pause(3500);
    await page
      .getByRole('link', { name: /^Receipt RCT-/ })
      .first()
      .waitFor({ timeout: 30000 });
    await hud(
      '🧾 The payment shows with its receipt, and the vendor was told when it arrived',
      '#ef4444',
    );
    await pause(3000);
    await signOut();

    chapter('🌍', 'The public pages for each kind of user', '#10b981');
    await goHome();
    await hud(
      '🌍 Back at the public site: pages for landlords, tenants and service providers',
      '#10b981',
    );
    await pause(1800);
    for (const [label, hudText] of [
      ['For Landlords', '🏗 For Landlords: portfolio, rent collection and reporting'],
      ['For Tenants', '🏠 For Tenants: search, apply, pay rent and report repairs'],
      ['For Service Providers', '🔧 For Service Providers: jobs, invoices and payouts'],
    ]) {
      // The header is rebuilt after each page change, so open the menu again and retry once if it
      // was replaced between the hover and the click.
      for (let attempt = 0; ; attempt++) {
        try {
          await page.waitForLoadState('networkidle');
          await page.getByRole('button', { name: 'Features' }).first().hover();
          await pause(500);
          await click(page.getByRole('link', { name: label }).first(), { settle: 1500 });
          break;
        } catch (err) {
          if (attempt >= 2) throw err;
          await pause(800);
        }
      }
      await hud(hudText, '#10b981');
      await pause(1800);
      await scroll(450);
      await pause(2000);
      await toTop();
    }

    chapter('📱', 'Proplity on a phone', '#06b6d4');
    await page.setViewportSize({ width: 390, height: 844 });
    await pause(1500);
    await hud('📱 Phone view: the links fold into a menu', '#06b6d4');
    await pause(1800);
    await click(page.getByRole('button', { name: 'Open menu' }), { settle: 1200 });
    await pause(2500);
    await click(page.getByRole('button', { name: 'Close menu' }), { settle: 600 });
    await page.setViewportSize({ width: 1280, height: 720 });
    await pause(1200);

    chapter('📖', 'The in-app platform guide', '#3b82f6');
    await click(page.getByRole('link', { name: 'Platform Guide' }).first(), { settle: 1500 });
    await page.waitForURL('**/proplity-guide**');
    await hud('📖 The Platform Guide: every feature, role by role, with screenshots', '#3b82f6');
    await pause(2500);
    await scroll(500);
    await pause(2000);
    const shot = page.locator('.screenshot-item').first();
    await shot.scrollIntoViewIfNeeded();
    await click(shot, { settle: 1500 });
    await hud(
      '🔍 Click any screenshot to open it full size and step through the gallery',
      '#3b82f6',
    );
    await pause(2500);
    await page.keyboard.press('ArrowRight');
    await pause(2200);
    await page.keyboard.press('Escape');
    await pause(1200);
    await toTop();
    await hud(
      '🎉 That was the whole journey: list, approve, publish, apply, lease, pay, repair, review',
      '#10b981',
    );
    await pause(6000);
  });

  let failed = null;
  try {
    for (const a of acts) {
      if (ONLY_ACTS && !ONLY_ACTS.includes(a.n)) continue;
      if (page.url() === 'about:blank') await page.goto('/login');
      console.log(`--- Act ${a.n}: ${a.title} ---`);
      await a.fn();
    }
    await hud('🎉 That was the whole journey, start to finish', '#10b981');
    await smoothMove(640, 360);
    await pause(6000);
  } catch (err) {
    failed = err;
    console.error('❌ The journey stopped:', err);
    await page
      .screenshot({ path: resolve(RAW_VIDEO_DIR, 'journey-failure.png') })
      .catch(() => undefined);
    console.error(`   at ${page.url()}`);
  } finally {
    const video = page.video();
    await context.close();
    await browser.close();
    if (!NO_VIDEO && video && !failed) {
      const raw = await video.path();
      const out = resolve(PUBLIC_VIDEO_DIR, 'proplity-complete-userflow.webm');
      copyFileSync(raw, out);
      const sizeMb = (statSync(out).size / (1024 * 1024)).toFixed(2);
      const total = Math.floor((Date.now() - recStart) / 1000);
      const totalStr = `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
      console.log(`✅ Saved ${out} (${sizeMb} MB, ${totalStr})`);
      for (const file of ['../docs/userflow-video.html', '../public/userflow-video.html']) {
        const path = resolve(__dirname, file);
        if (!existsSync(path)) continue;
        let html = readFileSync(path, 'utf-8');
        const items = chapters
          .map(
            (c) => `          <li class="chapter-item" data-time="${c.timeSec}">
            <div class="chapter-name"><span>${c.icon}</span> ${c.name}</div>
            <div class="chapter-time">${c.timeStr}</div>
          </li>`,
          )
          .join('\n');
        html = html.replace(
          /<ul class="chapter-list">[\s\S]*?<\/ul>/,
          `<ul class="chapter-list">\n${items}\n        </ul>`,
        );
        html = html.replace(
          /(<div class="meta-pill">Duration: <strong id="dur-display">).*?(<\/strong>)/,
          `$1${totalStr}$2`,
        );
        html = html.replace(
          /(<div class="meta-pill">Size: <strong>).*?(<\/strong>)/,
          `$1${sizeMb} MB$2`,
        );
        writeFileSync(path, html, 'utf-8');
      }
      console.table(chapters);
      console.log(
        'Run `pnpm exec prettier --write docs/userflow-video.html public/userflow-video.html` before committing.',
      );
    }
  }
  if (failed) process.exit(1);
}

main().catch((err) => {
  console.error('Fatal recording error:', err);
  process.exit(1);
});
