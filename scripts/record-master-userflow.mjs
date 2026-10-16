import { chromium } from '@playwright/test';
import { copyFileSync, mkdirSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3025';
const PW = 'Password123!';
const VIDEO_DIR = resolve(__dirname, '../docs/videos');
const PUBLIC_VIDEO_DIR = resolve(__dirname, '../public/videos');

mkdirSync(VIDEO_DIR, { recursive: true });
mkdirSync(PUBLIC_VIDEO_DIR, { recursive: true });

// Database helper using direct pg pool
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
      <span id="playwright-hud-text">Proplity Complete Userflow Walkthrough</span>
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

async function main() {
  console.log('🎬 Starting Proplity Master Userflow Video Recording...');
  console.log(`Base URL: ${BASE}`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    baseURL: BASE,
    recordVideo: {
      dir: VIDEO_DIR,
      size: { width: 1440, height: 900 },
    },
  });

  const page = await context.newPage();
  await page.addInitScript(CURSOR_SCRIPT);

  let currentMouseX = 720;
  let currentMouseY = 450;

  // Smooth mouse move helper with easeInOut curve
  async function smoothMove(targetX, targetY, steps = 16, delayMs = 14) {
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

  // Smooth move to center of element
  async function moveToElement(locator, steps = 16, delayMs = 14) {
    try {
      const box = await locator.boundingBox();
      if (box) {
        const targetX = Math.round(box.x + box.width / 2);
        const targetY = Math.round(box.y + box.height / 2);
        await smoothMove(targetX, targetY, steps, delayMs);
        return true;
      }
    } catch {}
    return false;
  }

  // Smooth click with visual ripple
  async function smoothClick(locator) {
    await moveToElement(locator);
    await page.waitForTimeout(100);
    await page.mouse.down();
    await page.waitForTimeout(80);
    await page.mouse.up();
    await page.waitForTimeout(200);
  }

  // Smooth human-like typing
  async function humanType(locator, text, delayBetweenChars = 35) {
    await smoothClick(locator);
    await locator.fill('');
    for (const char of text) {
      await locator.pressSequentially(char, { delay: delayBetweenChars });
    }
    await page.waitForTimeout(180);
  }

  // Update HUD text & color
  async function setHud(text, accentColor = '#3b82f6') {
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
      { t: text, c: accentColor },
    );
  }

  // Smooth window scroll
  async function smoothScroll(deltaY, steps = 14, delayMs = 18) {
    const stepY = deltaY / steps;
    for (let i = 0; i < steps; i++) {
      await page.evaluate((y) => window.scrollBy({ top: y, behavior: 'instant' }), stepY);
      await page.waitForTimeout(delayMs);
    }
    await page.waitForTimeout(250);
  }

  // Clean logout helper
  async function logout() {
    await page.evaluate(async () => {
      try {
        await fetch('/api/v1/auth/logout', { method: 'POST' });
      } catch {}
    });
    await context.clearCookies();
    await page.goto('/login');
    await page.waitForTimeout(600);
  }

  try {
    // =========================================================================
    // SCENE 0: FIRST-TIME SUPER ADMIN SETUP WIZARD (/setup)
    // =========================================================================
    console.log('--- Act 0: First-Time Setup Wizard (/setup) ---');
    await setSetupComplete(false);

    await page.goto('/setup');
    await page.waitForTimeout(800);
    await setHud('🏁 Section 0: First-Time Super Admin Bootstrap Wizard (/setup)', '#8b5cf6');
    await page.waitForTimeout(1000);

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

    // Hover over completion CTA
    await smoothMove(720, 720);
    await page.waitForTimeout(2000);

    // Restore setupComplete in DB so platform functions smoothly
    await setSetupComplete(true);

    // =========================================================================
    // SCENE 1: VISITOR & PUBLIC PROPERTY DISCOVERY
    // =========================================================================
    console.log('--- Act 1: Visitor Experience & Property Discovery ---');
    await page.goto('/');
    await page.waitForTimeout(800);
    await setHud('🌍 Part 1: Visitor Experience & Property Discovery', '#10b981');
    await page.waitForTimeout(1000);

    // Explore hero and stats
    await smoothMove(420, 360);
    await page.waitForTimeout(600);
    await smoothMove(600, 480);
    await page.waitForTimeout(500);

    // Scroll through features
    await smoothScroll(650);
    await page.waitForTimeout(800);
    await smoothMove(360, 450);
    await page.waitForTimeout(400);
    await smoothMove(740, 450);
    await page.waitForTimeout(400);

    // Scroll to Featured Properties
    await smoothScroll(700);
    await page.waitForTimeout(1000);

    // Hover over a property card
    const card = page.locator('a[href*="/properties/"]').first();
    if (await card.isVisible()) {
      await moveToElement(card);
      await page.waitForTimeout(700);
    }

    // Navigate to public property detail
    console.log('Navigating to Property Detail...');
    await page.goto('/properties/f384abab-e7fb-4d05-be1f-e616bf395aa9'); // Highland Park Residences
    await page.waitForTimeout(900);
    await setHud('🌍 Public Property Detail: Photo Gallery & Neighborhood Scores', '#10b981');

    await smoothScroll(450);
    await page.waitForTimeout(800);
    await smoothMove(940, 420); // Schedule viewing CTA
    await page.waitForTimeout(600);
    await smoothScroll(450);
    await page.waitForTimeout(900);

    // Visit pricing matrix
    console.log('Navigating to Pricing...');
    await page.goto('/pricing');
    await page.waitForTimeout(800);
    await setHud('💳 Transparent Management Tiers: Free, Starter, Pro & Enterprise', '#10b981');
    await smoothScroll(450);
    await page.waitForTimeout(1100);

    // =========================================================================
    // SCENE 2: TENANT EXPERIENCE
    // =========================================================================
    console.log('--- Act 2: Tenant Experience ---');
    await page.goto('/login');
    await page.waitForTimeout(800);
    await setHud('🏠 Part 2: Tenant Portal (tenant@proplity.com)', '#3b82f6');

    await humanType(page.getByPlaceholder('Enter your email'), 'tenant@proplity.com');
    await humanType(page.getByPlaceholder('Enter your password'), PW);
    await smoothClick(page.getByRole('button', { name: 'Sign In' }));
    await page.waitForURL('**/dashboard**', { timeout: 15000 });
    await page.waitForTimeout(1000);

    await setHud('🏠 Tenant Command Center: Active Rental, Bills & Due Dates', '#3b82f6');
    await smoothMove(380, 290);
    await page.waitForTimeout(600);
    await smoothMove(740, 460);
    await page.waitForTimeout(600);

    // Digital Tenancy Agreement
    await page.goto('/dashboard/rentals');
    await page.waitForTimeout(900);
    await setHud('📄 Tenant Digital Tenancy Agreement & Digital E-Signature Terms', '#3b82f6');
    await smoothScroll(350);
    await page.waitForTimeout(1000);

    // Payment Ledger
    await page.goto('/dashboard/payment-history');
    await page.waitForTimeout(900);
    await setHud('🧾 Tenant Ledger: Transaction References & Instant Receipts', '#3b82f6');
    await smoothScroll(300);
    await page.waitForTimeout(1000);

    // Maintenance Requests
    await page.goto('/dashboard/tenant-maintenance');
    await page.waitForTimeout(900);
    await setHud('🛠 Tenant Maintenance Requests & Real-Time Progress Timeline', '#3b82f6');
    await smoothMove(580, 320);
    await page.waitForTimeout(1000);

    // Logout
    await logout();

    // =========================================================================
    // SCENE 3: LANDLORD PORTFOLIO MANAGEMENT
    // =========================================================================
    console.log('--- Act 3: Landlord Portfolio Management ---');
    await setHud('🏗 Part 3: Landlord Asset Management (landlord@proplity.com)', '#f59e0b');

    await humanType(page.getByPlaceholder('Enter your email'), 'landlord@proplity.com');
    await humanType(page.getByPlaceholder('Enter your password'), PW);
    await smoothClick(page.getByRole('button', { name: 'Sign In' }));
    await page.waitForURL('**/dashboard**', { timeout: 15000 });
    await page.waitForTimeout(1000);

    await setHud('🏗 Landlord KPIs: Total Properties, Occupancy & Rent Roll', '#f59e0b');
    await smoothMove(280, 240); // Total properties
    await page.waitForTimeout(500);
    await smoothMove(560, 240); // Occupancy
    await page.waitForTimeout(500);
    await smoothMove(840, 240); // Rent roll
    await page.waitForTimeout(700);

    // Portfolio Properties
    await page.goto('/dashboard/properties');
    await page.waitForTimeout(900);
    await setHud('🏢 Landlord Multi-Property Catalog & Units Directory', '#f59e0b');
    await smoothScroll(400);
    await page.waitForTimeout(1100);

    // Portfolio Tenants Roster
    await page.goto('/dashboard/tenants');
    await page.waitForTimeout(900);
    await setHud('👥 Landlord Portfolio Tenant Roster & Active Leases', '#f59e0b');
    await smoothScroll(300);
    await page.waitForTimeout(1000);

    // Revenue Breakdown
    await page.goto('/dashboard/breakdown/revenue');
    await page.waitForTimeout(900);
    await setHud('📊 Server-Side Revenue Statement & Financial Ledger', '#f59e0b');
    await smoothScroll(350);
    await page.waitForTimeout(1100);

    // Logout
    await logout();

    // =========================================================================
    // SCENE 4: PROPERTY MANAGER OPERATIONS
    // =========================================================================
    console.log('--- Act 4: Property Manager Operations ---');
    await setHud('👔 Part 4: Property Manager Operations (manager@proplity.com)', '#3b82f6');

    await humanType(page.getByPlaceholder('Enter your email'), 'manager@proplity.com');
    await humanType(page.getByPlaceholder('Enter your password'), PW);
    await smoothClick(page.getByRole('button', { name: 'Sign In' }));
    await page.waitForURL('**/dashboard**', { timeout: 15000 });
    await page.waitForTimeout(1000);

    await setHud('👔 Manager Operations Hub: Pending Viewings & Work Orders', '#3b82f6');
    await smoothScroll(300);
    await page.waitForTimeout(900);

    // Kanban Maintenance Board
    await page.goto('/dashboard/maintenance');
    await page.waitForTimeout(900);
    await setHud('📋 Visual Kanban Board: Submitted → Assigned → In Progress → Done', '#3b82f6');
    await smoothMove(340, 420);
    await page.waitForTimeout(500);
    await smoothMove(680, 420);
    await page.waitForTimeout(500);
    await smoothMove(1020, 420);
    await page.waitForTimeout(900);

    // Direct Tenant Onboarding
    await page.goto('/dashboard/tenants/add');
    await page.waitForTimeout(900);
    await setHud('✉️ Direct Tenant Onboarding & Lease Invitation Builder', '#3b82f6');
    await smoothScroll(350);
    await page.waitForTimeout(1000);

    // Logout
    await logout();

    // =========================================================================
    // SCENE 5: SERVICE PROVIDER & FIELD OPERATIONS
    // =========================================================================
    console.log('--- Act 5: Service Provider & Field Operations ---');
    await setHud('🔧 Part 5: Service Provider & Field Operations (vendor@proplity.com)', '#ef4444');

    await humanType(page.getByPlaceholder('Enter your email'), 'vendor@proplity.com');
    await humanType(page.getByPlaceholder('Enter your password'), PW);
    await smoothClick(page.getByRole('button', { name: 'Sign In' }));
    await page.waitForURL('**/dashboard**', { timeout: 15000 });
    await page.waitForTimeout(1000);

    await setHud('🔧 Service Provider Console: Assigned Jobs & CAC Status', '#ef4444');
    await smoothScroll(300);
    await page.waitForTimeout(900);

    // Vendor Invoices
    await page.goto('/dashboard/vendor/invoices');
    await page.waitForTimeout(900);
    await setHud('💰 Vendor Invoices & Direct NUBAN Transfer Settlement Ledger', '#ef4444');
    await smoothScroll(300);
    await page.waitForTimeout(1000);

    // Logout
    await logout();

    // =========================================================================
    // SCENE 6: SUPER ADMIN GOVERNANCE & OVERSIGHT
    // =========================================================================
    console.log('--- Act 6: Super Admin Command Center ---');
    await setHud('🛡 Part 6: Super Admin Command Center (admin@proplity.com)', '#a78bfa');

    await humanType(page.getByPlaceholder('Enter your email'), 'admin@proplity.com');
    await humanType(page.getByPlaceholder('Enter your password'), PW);
    await smoothClick(page.getByRole('button', { name: 'Sign In' }));
    await page.waitForURL('**/admin**', { timeout: 15000 });
    await page.waitForTimeout(1000);

    await setHud('🛡 Super Admin Executive Overview: Global Platform Metrics', '#a78bfa');
    await smoothMove(280, 220);
    await page.waitForTimeout(400);
    await smoothMove(550, 220);
    await page.waitForTimeout(400);
    await smoothMove(820, 220);
    await page.waitForTimeout(700);

    // User Directory
    await page.goto('/admin/users');
    await page.waitForTimeout(900);
    await setHud('👥 Admin User Directory: Live Search, Role Filters & Suspension', '#a78bfa');
    await smoothScroll(350);
    await page.waitForTimeout(1000);

    // Property Moderation Queue
    await page.goto('/admin/properties');
    await page.waitForTimeout(900);
    await setHud('🏘 Property Moderation Queue & Duplicate Fingerprint Detection', '#a78bfa');
    await smoothScroll(350);
    await page.waitForTimeout(1000);

    // Security Audit Log
    await page.goto('/admin/security');
    await page.waitForTimeout(900);
    await setHud('🔐 Security Audit Log Explorer: Action History & JSON Metadata', '#a78bfa');
    await smoothScroll(350);
    await page.waitForTimeout(1000);

    // In-App Master Feature Directory & Role Guide
    console.log('Navigating to Proplity Guide...');
    await page.goto('/proplity-guide');
    await page.waitForTimeout(1000);
    await setHud('📋 In-App Master Feature Directory & Role Documentation', '#3b82f6');
    await smoothScroll(500);
    await page.waitForTimeout(900);
    await smoothScroll(600);
    await page.waitForTimeout(1200);

    // Grand Finale HUD
    await setHud('🎉 Complete Proplity Platform Userflow Walkthrough Finished!', '#10b981');
    await smoothMove(720, 450);
    await page.waitForTimeout(2500);

    console.log('✨ Walkthrough recording completed successfully!');
  } catch (error) {
    console.error('❌ Error during walkthrough recording:', error);
  } finally {
    // Ensure setupComplete is always restored
    await setSetupComplete(true);
    await pool.end();

    const video = page.video();
    await context.close();
    await browser.close();

    if (video) {
      const rawVideoPath = await video.path();
      console.log(`Video captured at raw path: ${rawVideoPath}`);

      const finalDocsVideo = resolve(VIDEO_DIR, 'proplity-complete-userflow.webm');
      const finalPublicVideo = resolve(PUBLIC_VIDEO_DIR, 'proplity-complete-userflow.webm');

      copyFileSync(rawVideoPath, finalDocsVideo);
      copyFileSync(rawVideoPath, finalPublicVideo);

      const stats = statSync(finalDocsVideo);
      const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);

      console.log(`✅ Saved master video: ${finalDocsVideo} (${sizeMb} MB)`);
      console.log(`✅ Saved public video: ${finalPublicVideo} (${sizeMb} MB)`);
    }
  }
}

main().catch((err) => {
  console.error('Fatal recording error:', err);
  process.exit(1);
});
