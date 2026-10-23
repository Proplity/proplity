import { chromium } from '@playwright/test';
import { copyFileSync, mkdirSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3025';
const PW = 'Password123!';
const PARTS_DOCS = resolve(__dirname, '../docs/videos/parts');
const PARTS_PUBLIC = resolve(__dirname, '../public/videos/parts');

mkdirSync(PARTS_DOCS, { recursive: true });
mkdirSync(PARTS_PUBLIC, { recursive: true });

const connectionString =
  process.env.DATABASE_URL || 'postgresql://roji:roji@127.0.0.1:5432/proplity_test';
const pool = new pg.Pool({ connectionString });

async function setSetupComplete(status) {
  try {
    await pool.query(
      `UPDATE "public"."SystemSettings" SET "setupComplete" = $1, "updatedAt" = NOW() WHERE "id" = 'global'`,
      [status],
    );
  } catch (err) {
    console.error('[DB] Failed to update setupComplete:', err.message);
  }
}

const CURSOR_SCRIPT = `
(function() {
  function init() {
    if (document.getElementById('playwright-cursor')) return;

    const cursor = document.createElement('div');
    cursor.id = 'playwright-cursor';
    cursor.style.cssText = 'position:fixed;top:0;left:0;width:26px;height:26px;z-index:9999999;pointer-events:none;transform:translate(720px, 450px);will-change:transform;transition:transform 0.04s cubic-bezier(0.16, 1, 0.3, 1);';
    cursor.innerHTML = \`
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style="filter: drop-shadow(0 3px 8px rgba(0,0,0,0.75));">
        <path d="M5.5 3.5L18.5 11.5L12 13L9.5 19.5L5.5 3.5Z" fill="#3b82f6" stroke="#ffffff" stroke-width="1.8" stroke-linejoin="round"/>
      </svg>
      <div id="playwright-ripple" style="position:absolute;top:2px;left:2px;width:24px;height:24px;border-radius:50%;background:rgba(59,130,246,0.65);transform:scale(0);opacity:0;pointer-events:none;transition:none;"></div>
    \`;
    document.body.appendChild(cursor);

    const hud = document.createElement('div');
    hud.id = 'playwright-hud';
    hud.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:9999998;background:rgba(15,23,42,0.94);backdrop-filter:blur(16px);border:1px solid rgba(59,130,246,0.45);border-radius:9999px;padding:9px 24px;color:#ffffff;font-family:system-ui,-apple-system,sans-serif;font-size:14px;font-weight:700;box-shadow:0 12px 32px -4px rgba(0,0,0,0.8);display:flex;align-items:center;gap:12px;pointer-events:none;transition:all 0.3s ease;';
    hud.innerHTML = \`
      <span style="width:10px;height:10px;border-radius:50%;background:#3b82f6;display:inline-block;box-shadow:0 0 12px #3b82f6;"></span>
      <span id="playwright-hud-text">Proplity Userflow</span>
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
          ripple.style.transform = 'scale(2.6)';
          ripple.style.opacity = '0';
        }, 15);
      }
    }, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
`;

async function recordPart(name, title, color, routine) {
  console.log(`\n▶️  Recording ${name}: ${title}...`);
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    baseURL: BASE,
    recordVideo: { dir: PARTS_DOCS, size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();
  await page.addInitScript(CURSOR_SCRIPT);

  let currentMouseX = 720;
  let currentMouseY = 450;

  async function smoothMove(targetX, targetY, steps = 14, delayMs = 12) {
    const startX = currentMouseX;
    const startY = currentMouseY;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      const x = Math.round(startX + (targetX - startX) * ease);
      const y = Math.round(startY + (targetY - startY) * ease);
      await page.mouse.move(x, y);
      await page.waitForTimeout(delayMs);
    }
    currentMouseX = targetX;
    currentMouseY = targetY;
  }

  async function smoothClick(locator) {
    try {
      const box = await locator.boundingBox();
      if (box) {
        await smoothMove(Math.round(box.x + box.width / 2), Math.round(box.y + box.height / 2));
        await page.waitForTimeout(80);
        await page.mouse.down();
        await page.waitForTimeout(60);
        await page.mouse.up();
        await page.waitForTimeout(160);
      }
    } catch {}
  }

  async function humanType(locator, text) {
    await smoothClick(locator);
    await locator.fill('');
    for (const char of text) {
      await locator.pressSequentially(char, { delay: 30 });
    }
    await page.waitForTimeout(160);
  }

  async function setHud(text, accent = color) {
    await page.evaluate(
      ({ t, c }) => {
        const textElem = document.getElementById('playwright-hud-text');
        const dot = document.querySelector('#playwright-hud span');
        if (textElem) textElem.textContent = t;
        if (dot) {
          dot.style.background = c;
          dot.style.boxShadow = '0 0 12px ' + c;
        }
      },
      { t: text, c: accent },
    );
  }

  async function smoothScroll(deltaY, steps = 12, delayMs = 15) {
    const stepY = deltaY / steps;
    for (let i = 0; i < steps; i++) {
      await page.evaluate((y) => window.scrollBy({ top: y, behavior: 'instant' }), stepY);
      await page.waitForTimeout(delayMs);
    }
    await page.waitForTimeout(200);
  }

  try {
    await routine({ page, context, smoothMove, smoothClick, humanType, setHud, smoothScroll });
  } catch (err) {
    console.error(`Error in ${name}:`, err.message);
  } finally {
    const video = page.video();
    await context.close();
    await browser.close();

    if (video) {
      const rawPath = await video.path();
      const finalDocs = resolve(PARTS_DOCS, `${name}.webm`);
      const finalPublic = resolve(PARTS_PUBLIC, `${name}.webm`);
      copyFileSync(rawPath, finalDocs);
      copyFileSync(rawPath, finalPublic);
      const mb = (statSync(finalDocs).size / (1024 * 1024)).toFixed(2);
      console.log(`✅ Finished ${name}: ${mb} MB`);
    }
  }
}

async function main() {
  // Part 0: Setup Wizard
  await recordPart(
    'part0_setup_wizard',
    '🏁 Section 0: First-Time Super Admin Bootstrap (/setup)',
    '#8b5cf6',
    async ({ page, humanType, setHud, smoothMove }) => {
      await setSetupComplete(false);
      await page.goto('/setup');
      await page.waitForTimeout(600);
      await setHud('🏁 First-Time Super Admin Setup Wizard (/setup)');
      await humanType(page.getByPlaceholder('e.g. Adebayo Ogunlesi'), 'Platform Administrator');
      await humanType(page.getByPlaceholder('admin@yourcompany.com'), 'admin@proplity.com');
      await humanType(page.locator('input[type="password"]').first(), PW);
      await humanType(page.locator('input[type="password"]').nth(1), PW);
      await smoothMove(720, 720);
      await page.waitForTimeout(1400);
      await setSetupComplete(true);
    },
  );

  // Part 1: Visitor Experience
  await recordPart(
    'part1_visitor_discovery',
    '🌍 Part 1: Visitor Experience & Property Discovery',
    '#10b981',
    async ({ page, smoothMove, smoothScroll, setHud }) => {
      await page.goto('/');
      await page.waitForTimeout(600);
      await setHud('🌍 Visitor Experience: Real Metrics & Metro Listings');
      await smoothMove(450, 360);
      await smoothScroll(600);
      await smoothMove(500, 420);
      await smoothScroll(650);
      await page.waitForTimeout(600);

      await page.goto('/properties/f384abab-e7fb-4d05-be1f-e616bf395aa9');
      await page.waitForTimeout(800);
      await setHud('🌍 Public Property Detail: Photos & Neighborhood Scores');
      await smoothScroll(450);
      await page.waitForTimeout(800);

      await page.goto('/pricing');
      await page.waitForTimeout(800);
      await setHud('💳 Pricing Tiers: Free, Starter, Pro & Enterprise');
      await smoothScroll(400);
      await page.waitForTimeout(1000);
    },
  );

  // Part 2: Tenant Experience
  await recordPart(
    'part2_tenant_portal',
    '🏠 Part 2: Tenant Portal & Tenancy Experience',
    '#3b82f6',
    async ({ page, humanType, smoothClick, setHud, smoothMove, smoothScroll }) => {
      await page.goto('/login');
      await humanType(page.getByPlaceholder('Enter your email'), 'tenant@proplity.com');
      await humanType(page.getByPlaceholder('Enter your password'), PW);
      await smoothClick(page.getByRole('button', { name: 'Sign In' }));
      await page.waitForURL('**/dashboard**', { timeout: 15000 });
      await setHud('🏠 Tenant Dashboard: Active Rent & Rent Due Banner');
      await smoothMove(400, 300);
      await page.waitForTimeout(800);

      await page.goto('/dashboard/rentals');
      await page.waitForTimeout(800);
      await setHud('📄 Tenant Digital Tenancy Agreement & E-Sign Clauses');
      await smoothScroll(350);

      await page.goto('/dashboard/payment-history');
      await page.waitForTimeout(800);
      await setHud('🧾 Payment Ledger: References & Downloadable Receipts');
      await smoothScroll(300);

      await page.goto('/dashboard/tenant-maintenance');
      await page.waitForTimeout(800);
      await setHud('🛠 Maintenance Requests: Live Status & Inspection Updates');
      await page.waitForTimeout(1000);
    },
  );

  // Part 3: Landlord Portfolio
  await recordPart(
    'part3_landlord_portfolio',
    '🏗 Part 3: Landlord Portfolio & Asset Management',
    '#f59e0b',
    async ({ page, humanType, smoothClick, setHud, smoothMove, smoothScroll }) => {
      await page.goto('/login');
      await humanType(page.getByPlaceholder('Enter your email'), 'landlord@proplity.com');
      await humanType(page.getByPlaceholder('Enter your password'), PW);
      await smoothClick(page.getByRole('button', { name: 'Sign In' }));
      await page.waitForURL('**/dashboard**', { timeout: 15000 });
      await setHud('🏗 Landlord KPIs: Occupancy, Rent Roll & Revenue');
      await smoothMove(300, 240);
      await smoothMove(600, 240);
      await smoothMove(900, 240);
      await page.waitForTimeout(800);

      await page.goto('/dashboard/properties');
      await page.waitForTimeout(800);
      await setHud('🏢 Multi-Property Catalog: Unit Counts & Status Badges');
      await smoothScroll(400);

      await page.goto('/dashboard/tenants');
      await page.waitForTimeout(800);
      await setHud('👥 Portfolio Tenant Roster & Active Rent Records');
      await smoothScroll(300);

      await page.goto('/dashboard/breakdown/revenue');
      await page.waitForTimeout(800);
      await setHud('📊 Server-Side Revenue Statement & Financial Ledger');
      await smoothScroll(350);
      await page.waitForTimeout(1000);
    },
  );

  // Part 4: Property Manager Operations
  await recordPart(
    'part4_manager_operations',
    '👔 Part 4: Property Manager Operations & Dispatch',
    '#3b82f6',
    async ({ page, humanType, smoothClick, setHud, smoothMove, smoothScroll }) => {
      await page.goto('/login');
      await humanType(page.getByPlaceholder('Enter your email'), 'manager@proplity.com');
      await humanType(page.getByPlaceholder('Enter your password'), PW);
      await smoothClick(page.getByRole('button', { name: 'Sign In' }));
      await page.waitForURL('**/dashboard**', { timeout: 15000 });
      await setHud('👔 Manager Operations Hub: Pending Tasks & Viewings');
      await smoothScroll(300);

      await page.goto('/dashboard/maintenance');
      await page.waitForTimeout(800);
      await setHud('📋 Visual Kanban Board: Submitted → Assigned → Done');
      await smoothMove(350, 420);
      await smoothMove(700, 420);
      await smoothMove(1050, 420);

      await page.goto('/dashboard/tenants/add');
      await page.waitForTimeout(800);
      await setHud('✉️ Direct Tenant Onboarding & Rent Invite Builder');
      await smoothScroll(350);
      await page.waitForTimeout(1000);
    },
  );

  // Part 5: Service Provider & Field Operations
  await recordPart(
    'part5_vendor_operations',
    '🔧 Part 5: Service Provider & Field Operations',
    '#ef4444',
    async ({ page, humanType, smoothClick, setHud, smoothScroll }) => {
      await page.goto('/login');
      await humanType(page.getByPlaceholder('Enter your email'), 'vendor@proplity.com');
      await humanType(page.getByPlaceholder('Enter your password'), PW);
      await smoothClick(page.getByRole('button', { name: 'Sign In' }));
      await page.waitForURL('**/dashboard**', { timeout: 15000 });
      await setHud('🔧 Service Provider Console: Assigned Maintenance Jobs');
      await smoothScroll(300);

      await page.goto('/dashboard/vendor/invoices');
      await page.waitForTimeout(800);
      await setHud('💰 Itemized Invoices & NUBAN Payout Disbursement Ledger');
      await smoothScroll(300);
      await page.waitForTimeout(1000);
    },
  );

  // Part 6: Super Admin Command Center
  await recordPart(
    'part6_admin_governance',
    '🛡 Part 6: Super Admin Command Center & Governance',
    '#a78bfa',
    async ({ page, humanType, smoothClick, setHud, smoothMove, smoothScroll }) => {
      await page.goto('/login');
      await humanType(page.getByPlaceholder('Enter your email'), 'admin@proplity.com');
      await humanType(page.getByPlaceholder('Enter your password'), PW);
      await smoothClick(page.getByRole('button', { name: 'Sign In' }));
      await page.waitForURL('**/admin**', { timeout: 15000 });
      await setHud('🛡 Super Admin Overview: Platform-Wide System Aggregates');
      await smoothMove(300, 220);
      await smoothMove(600, 220);
      await smoothMove(900, 220);

      await page.goto('/admin/users');
      await page.waitForTimeout(800);
      await setHud('👥 User Directory: Live Search, Roles & Suspension Dialog');
      await smoothScroll(350);

      await page.goto('/admin/properties');
      await page.waitForTimeout(800);
      await setHud('🏘 Property Moderation Queue & Duplicate Address Detection');
      await smoothScroll(350);

      await page.goto('/admin/security');
      await page.waitForTimeout(800);
      await setHud('🔐 Security Audit Log Explorer & Filterable Event History');
      await smoothScroll(350);

      await page.goto('/proplity-guide');
      await page.waitForTimeout(800);
      await setHud('📋 In-App Master Feature Directory & Interactive Role Guide');
      await smoothScroll(500);
      await page.waitForTimeout(1500);
    },
  );

  await setSetupComplete(true);
  await pool.end();
  console.log('\n🎉 All 7 modular userflow video chapters recorded successfully!');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
