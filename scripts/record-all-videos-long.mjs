import { chromium } from '@playwright/test';
import { copyFileSync, mkdirSync, statSync, unlinkSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3025';
const PW = 'Password123!';
const DOCS_VIDEOS = resolve(__dirname, '../docs/videos');
const PUBLIC_VIDEOS = resolve(__dirname, '../public/videos');
const PARTS_DOCS = resolve(DOCS_VIDEOS, 'parts');
const PARTS_PUBLIC = resolve(PUBLIC_VIDEOS, 'parts');

mkdirSync(DOCS_VIDEOS, { recursive: true });
mkdirSync(PUBLIC_VIDEOS, { recursive: true });
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
    console.log(`[DB] SystemSettings.setupComplete set to: ${status}`);
  } catch (err) {
    console.error('[DB] Failed to update setupComplete:', err.message);
  }
}

// Injected virtual cursor and animated HUD banner
const CURSOR_SCRIPT = `
(function() {
  function init() {
    if (document.getElementById('playwright-cursor')) return;

    // 1. Sleek Virtual Cursor
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

    // 2. HUD Banner
    const hud = document.createElement('div');
    hud.id = 'playwright-hud';
    hud.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:9999998;background:rgba(15,23,42,0.94);backdrop-filter:blur(16px);border:1px solid rgba(59,130,246,0.45);border-radius:9999px;padding:9px 24px;color:#ffffff;font-family:system-ui,-apple-system,sans-serif;font-size:14px;font-weight:700;box-shadow:0 12px 32px -4px rgba(0,0,0,0.8);display:flex;align-items:center;gap:12px;pointer-events:none;transition:all 0.3s ease;';
    hud.innerHTML = \`
      <span style="width:10px;height:10px;border-radius:50%;background:#3b82f6;display:inline-block;box-shadow:0 0 12px #3b82f6;"></span>
      <span id="playwright-hud-text">Proplity Userflow Walkthrough</span>
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

// Helper to record a single standalone video chapter (guaranteed >= minDurationSec)
async function recordChapter(name, title, color, minDurationSec, routine) {
  console.log(`\n========================================================================`);
  console.log(`▶️  Recording ${name} (Target: >= ${minDurationSec}s): ${title}`);
  console.log(`========================================================================`);

  const startTime = Date.now();
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    baseURL: BASE,
    recordVideo: { dir: PARTS_DOCS, size: { width: 1440, height: 900 } },
  });

  const page = await context.newPage();
  await page.addInitScript(CURSOR_SCRIPT);

  let currentMouseX = 720;
  let currentMouseY = 450;

  async function smoothMove(targetX, targetY, steps = 18, delayMs = 15) {
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

  async function moveToElement(locator, steps = 18, delayMs = 15) {
    try {
      const box = await locator.boundingBox();
      if (box) {
        await smoothMove(
          Math.round(box.x + box.width / 2),
          Math.round(box.y + box.height / 2),
          steps,
          delayMs,
        );
        return true;
      }
    } catch {}
    return false;
  }

  async function smoothClick(locator) {
    await moveToElement(locator);
    await page.waitForTimeout(100);
    await page.mouse.down();
    await page.waitForTimeout(80);
    await page.mouse.up();
    await page.waitForTimeout(200);
  }

  async function humanType(locator, text, delayBetweenChars = 40) {
    await smoothClick(locator);
    await locator.fill('');
    for (const char of text) {
      await locator.pressSequentially(char, { delay: delayBetweenChars });
    }
    await page.waitForTimeout(200);
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

  async function smoothScroll(deltaY, steps = 16, delayMs = 20) {
    const stepY = deltaY / steps;
    for (let i = 0; i < steps; i++) {
      await page.evaluate((y) => window.scrollBy({ top: y, behavior: 'instant' }), stepY);
      await page.waitForTimeout(delayMs);
    }
    await page.waitForTimeout(300);
  }

  try {
    await routine({
      page,
      context,
      smoothMove,
      moveToElement,
      smoothClick,
      humanType,
      setHud,
      smoothScroll,
    });

    // Enforce minimum duration so no video is under 30 seconds
    const elapsedSec = (Date.now() - startTime) / 1000;
    if (elapsedSec < minDurationSec) {
      const remainingMs = Math.round((minDurationSec - elapsedSec) * 1000);
      console.log(
        `Padding video by ${(remainingMs / 1000).toFixed(1)}s to reach minimum duration...`,
      );
      // Gentle cursor exploration during padding
      const loops = Math.max(1, Math.floor(remainingMs / 3000));
      for (let l = 0; l < loops; l++) {
        await smoothMove(400 + Math.random() * 400, 300 + Math.random() * 300, 20, 20);
        await page.waitForTimeout(1500);
      }
    }
  } catch (err) {
    console.error(`❌ Error in ${name}:`, err.message);
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

      // Clean up raw temp file
      try {
        unlinkSync(rawPath);
      } catch {}

      const totalSec = ((Date.now() - startTime) / 1000).toFixed(1);
      const mb = (statSync(finalDocs).size / (1024 * 1024)).toFixed(2);
      console.log(`✅ Saved ${name}.webm: ${totalSec}s (${mb} MB)`);
    }
  }
}

async function main() {
  console.log('🎥 Recording All Proplity Userflow Videos (Guaranteed >= 35s each)...');

  // ---------------------------------------------------------------------------
  // 1. Part 0: First-Time Setup Wizard (>= 35s)
  // ---------------------------------------------------------------------------
  await recordChapter(
    'part0_setup_wizard',
    '🏁 Section 0: First-Time Super Admin Bootstrap (/setup)',
    '#8b5cf6',
    35,
    async ({ page, humanType, setHud, smoothMove, smoothScroll }) => {
      await setSetupComplete(false);
      await page.goto('/setup');
      await page.waitForTimeout(1000);
      await setHud('🏁 Section 0: First-Time Super Admin Bootstrap (/setup)');
      await page.waitForTimeout(1500);

      const nameInput = page.locator('input[type="text"]').first();
      await humanType(nameInput, 'Platform Administrator');
      await page.waitForTimeout(1000);

      const emailInput = page.locator('input[type="email"]').first();
      await humanType(emailInput, 'admin@proplity.com');
      await page.waitForTimeout(1000);

      const pwInput = page.locator('input[type="password"]').first();
      await humanType(pwInput, PW);
      await page.waitForTimeout(1200);

      const confirmPwInput = page.locator('input[type="password"]').nth(1);
      await humanType(confirmPwInput, PW);
      await page.waitForTimeout(1500);

      // Smooth scroll down to review instructions & security warning
      await smoothScroll(250);
      await page.waitForTimeout(1500);

      // Hover over complete setup button
      await smoothMove(720, 720);
      await page.waitForTimeout(2000);

      await setSetupComplete(true);
    },
  );

  // ---------------------------------------------------------------------------
  // 2. Part 1: Visitor Experience & Property Discovery (>= 40s)
  // ---------------------------------------------------------------------------
  await recordChapter(
    'part1_visitor_discovery',
    '🌍 Part 1: Visitor Experience & Property Discovery',
    '#10b981',
    40,
    async ({ page, smoothMove, moveToElement, smoothScroll, setHud }) => {
      await page.goto('/');
      await page.waitForTimeout(1000);
      await setHud('🌍 Part 1: Visitor Experience & Platform Discovery');
      await page.waitForTimeout(1500);

      // Hover over hero badges & CTA
      await smoothMove(420, 360);
      await page.waitForTimeout(1000);
      await smoothMove(580, 480);
      await page.waitForTimeout(1000);

      // Scroll through features section
      await smoothScroll(650);
      await page.waitForTimeout(1500);
      await smoothMove(360, 420);
      await page.waitForTimeout(800);
      await smoothMove(720, 420);
      await page.waitForTimeout(800);

      // Scroll down to Featured Properties
      await smoothScroll(700);
      await page.waitForTimeout(1500);

      // Hover on a featured property card
      const card = page.locator('a[href*="/properties/"]').first();
      if (await card.isVisible()) {
        await moveToElement(card);
        await page.waitForTimeout(1200);
      }

      // Navigate to public property detail
      await page.goto('/properties/f384abab-e7fb-4d05-be1f-e616bf395aa9');
      await page.waitForTimeout(1200);
      await setHud('🌍 Public Property Detail: Photo Gallery & Neighborhood Scores');

      await smoothScroll(450);
      await page.waitForTimeout(1500);
      await smoothMove(920, 420); // Schedule viewing CTA
      await page.waitForTimeout(1000);
      await smoothScroll(500);
      await page.waitForTimeout(1500);

      // Visit Pricing Matrix
      await page.goto('/pricing');
      await page.waitForTimeout(1200);
      await setHud('💳 Transparent Pricing Tiers: Free, Starter, Pro & Enterprise');
      await smoothScroll(450);
      await page.waitForTimeout(2000);
    },
  );

  // ---------------------------------------------------------------------------
  // 3. Part 2: Tenant Experience (>= 40s)
  // ---------------------------------------------------------------------------
  await recordChapter(
    'part2_tenant_portal',
    '🏠 Part 2: Tenant Portal & Tenancy Experience',
    '#3b82f6',
    40,
    async ({ page, humanType, smoothClick, setHud, smoothMove, smoothScroll }) => {
      await page.goto('/login');
      await page.waitForTimeout(800);
      await setHud('🏠 Part 2: Tenant Portal (tenant@proplity.com)');

      await humanType(page.getByPlaceholder('Enter your email'), 'tenant@proplity.com');
      await humanType(page.getByPlaceholder('Enter your password'), PW);
      await smoothClick(page.getByRole('button', { name: 'Sign In' }));
      await page.waitForURL('**/dashboard**', { timeout: 15000 });
      await page.waitForTimeout(1200);

      await setHud('🏠 Tenant Command Center: Active Rental, Bills & Due Dates');
      await smoothMove(380, 280);
      await page.waitForTimeout(1200);
      await smoothMove(740, 460);
      await page.waitForTimeout(1200);

      // Digital Tenancy Agreement
      await page.goto('/dashboard/rentals');
      await page.waitForTimeout(1200);
      await setHud('📄 Tenant Digital Tenancy Agreement & Digital E-Signature Terms');
      await smoothScroll(350);
      await page.waitForTimeout(2000);

      // Payment Ledger
      await page.goto('/dashboard/payment-history');
      await page.waitForTimeout(1200);
      await setHud('🧾 Tenant Ledger: Transaction References & Instant Receipts');
      await smoothScroll(300);
      await page.waitForTimeout(2000);

      // Maintenance Requests
      await page.goto('/dashboard/tenant-maintenance');
      await page.waitForTimeout(1200);
      await setHud('🛠 Tenant Maintenance Requests & Real-Time Progress Timeline');
      await smoothMove(580, 320);
      await page.waitForTimeout(2000);
    },
  );

  // ---------------------------------------------------------------------------
  // 4. Part 3: Landlord Portfolio (>= 40s)
  // ---------------------------------------------------------------------------
  await recordChapter(
    'part3_landlord_portfolio',
    '🏗 Part 3: Landlord Portfolio & Asset Management',
    '#f59e0b',
    40,
    async ({ page, humanType, smoothClick, setHud, smoothMove, smoothScroll }) => {
      await page.goto('/login');
      await page.waitForTimeout(800);
      await setHud('🏗 Part 3: Landlord Asset Management (landlord@proplity.com)');

      await humanType(page.getByPlaceholder('Enter your email'), 'landlord@proplity.com');
      await humanType(page.getByPlaceholder('Enter your password'), PW);
      await smoothClick(page.getByRole('button', { name: 'Sign In' }));
      await page.waitForURL('**/dashboard**', { timeout: 15000 });
      await page.waitForTimeout(1200);

      await setHud('🏗 Landlord KPIs: Total Properties, Occupancy & Rent Roll');
      await smoothMove(280, 240);
      await page.waitForTimeout(800);
      await smoothMove(560, 240);
      await page.waitForTimeout(800);
      await smoothMove(840, 240);
      await page.waitForTimeout(1200);

      // Portfolio Properties
      await page.goto('/dashboard/properties');
      await page.waitForTimeout(1200);
      await setHud('🏢 Landlord Multi-Property Catalog & Units Directory');
      await smoothScroll(400);
      await page.waitForTimeout(2000);

      // Portfolio Tenants Roster
      await page.goto('/dashboard/tenants');
      await page.waitForTimeout(1200);
      await setHud('👥 Landlord Portfolio Tenant Roster & Active Leases');
      await smoothScroll(300);
      await page.waitForTimeout(2000);

      // Revenue Breakdown
      await page.goto('/dashboard/breakdown/revenue');
      await page.waitForTimeout(1200);
      await setHud('📊 Server-Side Revenue Statement & Financial Ledger');
      await smoothScroll(350);
      await page.waitForTimeout(2000);
    },
  );

  // ---------------------------------------------------------------------------
  // 5. Part 4: Property Manager Operations (>= 40s)
  // ---------------------------------------------------------------------------
  await recordChapter(
    'part4_manager_operations',
    '👔 Part 4: Property Manager Operations & Dispatch',
    '#3b82f6',
    40,
    async ({ page, humanType, smoothClick, setHud, smoothMove, smoothScroll }) => {
      await page.goto('/login');
      await page.waitForTimeout(800);
      await setHud('👔 Part 4: Property Manager Operations (manager@proplity.com)');

      await humanType(page.getByPlaceholder('Enter your email'), 'manager@proplity.com');
      await humanType(page.getByPlaceholder('Enter your password'), PW);
      await smoothClick(page.getByRole('button', { name: 'Sign In' }));
      await page.waitForURL('**/dashboard**', { timeout: 15000 });
      await page.waitForTimeout(1200);

      await setHud('👔 Manager Operations Hub: Pending Tasks & Viewings');
      await smoothScroll(300);
      await page.waitForTimeout(1500);

      // Kanban Maintenance Board
      await page.goto('/dashboard/maintenance');
      await page.waitForTimeout(1200);
      await setHud('📋 Visual Kanban Board: Submitted → Assigned → In Progress → Done');
      await smoothMove(340, 420);
      await page.waitForTimeout(1000);
      await smoothMove(680, 420);
      await page.waitForTimeout(1000);
      await smoothMove(1020, 420);
      await page.waitForTimeout(1500);

      // Direct Tenant Onboarding
      await page.goto('/dashboard/tenants/add');
      await page.waitForTimeout(1200);
      await setHud('✉️ Direct Tenant Onboarding & Lease Invitation Builder');
      await smoothScroll(350);
      await page.waitForTimeout(2000);
    },
  );

  // ---------------------------------------------------------------------------
  // 6. Part 5: Service Provider & Field Operations (>= 35s)
  // ---------------------------------------------------------------------------
  await recordChapter(
    'part5_vendor_operations',
    '🔧 Part 5: Service Provider & Field Operations',
    '#ef4444',
    35,
    async ({ page, humanType, smoothClick, setHud, smoothScroll, smoothMove }) => {
      await page.goto('/login');
      await page.waitForTimeout(800);
      await setHud('🔧 Part 5: Service Provider & Field Operations (vendor@proplity.com)');

      await humanType(page.getByPlaceholder('Enter your email'), 'vendor@proplity.com');
      await humanType(page.getByPlaceholder('Enter your password'), PW);
      await smoothClick(page.getByRole('button', { name: 'Sign In' }));
      await page.waitForURL('**/dashboard**', { timeout: 15000 });
      await page.waitForTimeout(1200);

      await setHud('🔧 Service Provider Console: Assigned Jobs & CAC Status');
      await smoothMove(500, 300);
      await page.waitForTimeout(1000);
      await smoothScroll(300);
      await page.waitForTimeout(1500);

      // Vendor Invoices & Payouts
      await page.goto('/dashboard/vendor/invoices');
      await page.waitForTimeout(1200);
      await setHud('💰 Vendor Invoices & Direct NUBAN Transfer Settlement Ledger');
      await smoothScroll(300);
      await page.waitForTimeout(2000);
    },
  );

  // ---------------------------------------------------------------------------
  // 7. Part 6: Super Admin Command Center (>= 45s)
  // ---------------------------------------------------------------------------
  await recordChapter(
    'part6_admin_governance',
    '🛡 Part 6: Super Admin Command Center & Governance',
    '#a78bfa',
    45,
    async ({ page, humanType, smoothClick, setHud, smoothMove, smoothScroll }) => {
      await page.goto('/login');
      await page.waitForTimeout(800);
      await setHud('🛡 Part 6: Super Admin Command Center (admin@proplity.com)');

      await humanType(page.getByPlaceholder('Enter your email'), 'admin@proplity.com');
      await humanType(page.getByPlaceholder('Enter your password'), PW);
      await smoothClick(page.getByRole('button', { name: 'Sign In' }));
      await page.waitForURL('**/admin**', { timeout: 15000 });
      await page.waitForTimeout(1200);

      await setHud('🛡 Super Admin Executive Overview: Global Platform Metrics');
      await smoothMove(280, 220);
      await page.waitForTimeout(800);
      await smoothMove(550, 220);
      await page.waitForTimeout(800);
      await smoothMove(820, 220);
      await page.waitForTimeout(1200);

      // User Directory
      await page.goto('/admin/users');
      await page.waitForTimeout(1200);
      await setHud('👥 Admin User Directory: Live Search, Role Filters & Suspension');
      await smoothScroll(350);
      await page.waitForTimeout(2000);

      // Property Moderation
      await page.goto('/admin/properties');
      await page.waitForTimeout(1200);
      await setHud('🏘 Property Moderation Queue & Duplicate Fingerprint Detection');
      await smoothScroll(350);
      await page.waitForTimeout(2000);

      // Security Audit Log
      await page.goto('/admin/security');
      await page.waitForTimeout(1200);
      await setHud('🔐 Security Audit Log Explorer: Action History & JSON Metadata');
      await smoothScroll(350);
      await page.waitForTimeout(2000);

      // Proplity Guide
      await page.goto('/proplity-guide');
      await page.waitForTimeout(1200);
      await setHud('📋 In-App Master Feature Directory & Interactive Role Guide');
      await smoothScroll(500);
      await page.waitForTimeout(1500);
      await smoothScroll(600);
      await page.waitForTimeout(2000);
    },
  );

  await setSetupComplete(true);
  await pool.end();
  console.log('\n🎉 ALL 7 CHAPTER VIDEOS RECORDED (EVERY VIDEO >= 35 SECONDS)!');
}

main().catch((err) => {
  console.error('Fatal recording error:', err);
  process.exit(1);
});
