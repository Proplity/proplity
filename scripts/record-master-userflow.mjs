import { chromium } from '@playwright/test';
import { copyFileSync, mkdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3025';
const PW = 'Password123!';
const VIDEO_DIR = resolve(__dirname, '../docs/videos');
const PUBLIC_VIDEO_DIR = resolve(__dirname, '../public/videos');
const OUT_VIDEO_DIR = resolve(__dirname, '../out/video');

mkdirSync(VIDEO_DIR, { recursive: true });
mkdirSync(PUBLIC_VIDEO_DIR, { recursive: true });
mkdirSync(OUT_VIDEO_DIR, { recursive: true });

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

async function ensureMessagingThread() {
  try {
    const convId = 'e9233661-1228-405a-a6b2-60dc80089448';
    const tenantRes = await pool.query(
      `SELECT id FROM "public"."User" WHERE email = 'tenant@proplity.com' LIMIT 1;`,
    );
    const managerRes = await pool.query(
      `SELECT id FROM "public"."User" WHERE email = 'manager@proplity.com' LIMIT 1;`,
    );
    if (!tenantRes.rows[0] || !managerRes.rows[0]) return;
    const tenantId = tenantRes.rows[0].id;
    const managerId = managerRes.rows[0].id;

    await pool.query(
      `INSERT INTO "public"."Conversation" ("id", "type", "title", "createdAt", "updatedAt")
       VALUES ($1, 'DIRECT', 'Move-in & Key Collection', NOW(), NOW())
       ON CONFLICT ("id") DO UPDATE SET "title" = 'Move-in & Key Collection';`,
      [convId],
    );

    await pool.query(
      `INSERT INTO "public"."ConversationParticipant" ("id", "conversationId", "userId", "joinedAt")
       VALUES (gen_random_uuid(), $1, $2, NOW())
       ON CONFLICT ("conversationId", "userId") DO NOTHING;`,
      [convId, tenantId],
    );

    await pool.query(
      `INSERT INTO "public"."ConversationParticipant" ("id", "conversationId", "userId", "joinedAt")
       VALUES (gen_random_uuid(), $1, $2, NOW())
       ON CONFLICT ("conversationId", "userId") DO NOTHING;`,
      [convId, managerId],
    );
    console.log('[DB] Verified Move-in & Key Collection conversation thread');
  } catch (err) {
    console.warn('[DB] Failed to ensure messaging thread:', err.message);
  }
}

// Injected virtual cursor and animated HUD banner
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
`;

async function main() {
  console.log('🎬 Starting Proplity Master End-to-End Userflow Video Recording...');
  console.log(`Target Base URL: ${BASE}`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    baseURL: BASE,
    recordVideo: {
      dir: OUT_VIDEO_DIR,
      size: { width: 1440, height: 900 },
    },
  });

  const page = await context.newPage();
  await page.addInitScript(CURSOR_SCRIPT);

  let currentMouseX = 720;
  let currentMouseY = 450;
  const chapters = [];
  const recStartTime = Date.now();

  function recordChapter(icon, name, accentColor) {
    const elapsedSec = Math.floor((Date.now() - recStartTime) / 1000);
    const mins = Math.floor(elapsedSec / 60);
    const secs = elapsedSec % 60;
    const timeStr = String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
    chapters.push({ timeSec: elapsedSec, timeStr, icon, name, accentColor });
    console.log(`⏱ [${timeStr}] ${icon} ${name}`);
  }

  // Smooth mouse move helper with easeInOut curve
  async function smoothMove(targetX, targetY, steps = 16, delayMs = 15) {
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
  async function moveToElement(locator, steps = 16, delayMs = 15) {
    try {
      await locator.scrollIntoViewIfNeeded({ timeout: 4000 });
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

  // Smooth click with visual ripple and guaranteed DOM dispatch
  async function smoothClick(locator) {
    try {
      await locator.scrollIntoViewIfNeeded({ timeout: 4000 });
    } catch {}
    await moveToElement(locator);
    await page.waitForTimeout(120);
    try {
      await locator.click({ timeout: 4000 });
    } catch {
      await page.mouse.down();
      await page.waitForTimeout(90);
      await page.mouse.up();
    }
    await page.waitForTimeout(250);
  }

  // Smooth human-like typing
  async function humanType(locator, text, delayBetweenChars = 40) {
    await smoothClick(locator);
    await locator.fill('');
    for (const char of text) {
      await locator.pressSequentially(char, { delay: delayBetweenChars });
    }
    await page.waitForTimeout(200);
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

  // Smooth scroll helper (handles both window and dashboard <main> container)
  async function smoothScroll(deltaY, steps = 16, delayMs = 20) {
    const stepY = deltaY / steps;
    for (let i = 0; i < steps; i++) {
      await page.evaluate((y) => {
        window.scrollBy({ top: y, behavior: 'instant' });
        const main = document.querySelector('main');
        if (main && main.scrollHeight > main.clientHeight) {
          main.scrollBy({ top: y, behavior: 'instant' });
        }
      }, stepY);
      await page.waitForTimeout(delayMs);
    }
    await page.waitForTimeout(300);
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
    await page.waitForTimeout(800);
  }

  try {
    // =========================================================================
    // ACT 0: FIRST-TIME SUPER ADMIN SETUP WIZARD (/setup)
    // =========================================================================
    console.log('--- Act 0: First-Time Setup Wizard (/setup) ---');
    recordChapter('🏁', 'Act 0: Setup Wizard & Platform Bootstrap', '#8b5cf6');
    await setSetupComplete(false);
    await ensureMessagingThread();

    await page.goto('/setup');
    await page.waitForTimeout(1000);
    await setHud('🏁 Act 0: First-Time Super Admin Bootstrap Wizard (/setup)', '#8b5cf6');
    await page.waitForTimeout(1200);

    const setupNameInput = page.locator('input[type="text"]').first();
    await humanType(setupNameInput, 'Platform Administrator');
    await page.waitForTimeout(1000);

    const setupEmailInput = page.locator('input[type="email"]').first();
    await humanType(setupEmailInput, 'admin@proplity.com');
    await page.waitForTimeout(1000);

    const setupPwInput = page.locator('input[type="password"]').first();
    await humanType(setupPwInput, PW);
    await page.waitForTimeout(1200);

    const setupConfirmPwInput = page.locator('input[type="password"]').nth(1);
    await humanType(setupConfirmPwInput, PW);
    await page.waitForTimeout(1500);

    // Review password requirements and architecture notes
    await smoothScroll(300);
    await page.waitForTimeout(1800);

    // Hover over completion CTA
    await smoothMove(720, 680);
    await page.waitForTimeout(2000);

    // Restore setupComplete in DB so platform functions seamlessly
    await setSetupComplete(true);

    // =========================================================================
    // ACT 1: COMPLETE AUTHENTICATION & PASSWORD RECOVERY SUITE
    // =========================================================================
    console.log('--- Act 1: Full Authentication Suite ---');
    recordChapter('🔐', 'Act 1: Full Authentication, Register & Password Recovery', '#3b82f6');

    // 1A: Marketing Showcase & Interactive Tour
    await page.goto('/');
    await page.waitForTimeout(2500);
    await setHud('🏠 Act 1A: Proplity Real Estate OS — Next-Gen Platform Showcase', '#3b82f6');
    await smoothScroll(500);
    await page.waitForTimeout(3500);
    await smoothScroll(600);
    await page.waitForTimeout(3500);
    await smoothScroll(600);
    await page.waitForTimeout(3500);
    await smoothScroll(-1200);
    await page.waitForTimeout(2500);

    const watchDemoBtn = page.locator('button:has-text("Watch Demo"), a:has-text("Watch Demo")').first();
    if (await watchDemoBtn.isVisible()) {
      await smoothClick(watchDemoBtn);
      await page.waitForTimeout(2500);
      await setHud('🎬 Interactive Platform Tour: 4 Operational Pillars', '#3b82f6');

      // Click through all 4 tour chapters
      const chapterChips = page.locator('button:has-text("Chapter")');
      const chipCount = await chapterChips.count();
      for (let i = 0; i < Math.min(chipCount, 4); i++) {
        await smoothClick(chapterChips.nth(i));
        await page.waitForTimeout(6500);
      }

      // Close demo modal
      const closeDemo = page.locator('button[aria-label="Close demo modal"], button:has-text("Close")').first();
      if (await closeDemo.isVisible()) {
        await smoothClick(closeDemo);
        await page.waitForTimeout(2000);
      }
    }

    await page.goto('/register');
    await page.waitForTimeout(1500);
    await setHud('🔐 Act 1B: Role Selection & Tenant Registration (/register)', '#3b82f6');
    await page.waitForTimeout(1500);

    // Hover across the role options: Manager, Landlord, Tenant, Service Provider
    await smoothMove(360, 320); // Property Manager card
    await page.waitForTimeout(1000);
    await smoothMove(580, 320); // Landlord card
    await page.waitForTimeout(1000);
    await smoothMove(820, 320); // Tenant card
    await page.waitForTimeout(1200);

    // Click on Tenant card
    const tenantCard = page.locator('text=Tenant').first();
    await smoothClick(tenantCard);
    await page.waitForTimeout(1500);

    // Fill Tenant registration form
    await setHud('📝 Tenant Registration: Personal Details & Contact', '#3b82f6');
    const fNameInput = page.locator('input[placeholder="First name"]');
    if (await fNameInput.isVisible()) {
      await humanType(fNameInput, 'Chioma');
    }
    const lNameInput = page.locator('input[placeholder="Last name"]');
    if (await lNameInput.isVisible()) {
      await humanType(lNameInput, 'Eze');
    }
    const regEmailInput = page.locator('input[placeholder="you@example.com"]');
    if (await regEmailInput.isVisible()) {
      await humanType(regEmailInput, 'chioma.eze@example.com');
    }
    const phoneInput = page.locator('input[placeholder="+234 803 000 0000"]');
    if (await phoneInput.isVisible()) {
      await humanType(phoneInput, '+234 802 345 6789');
    }

    // Smooth scroll down to reveal password fields, terms checkbox and submit
    await smoothScroll(250);
    await page.waitForTimeout(400);

    const regPwInput = page.locator('input[type="password"]').first();
    if (await regPwInput.isVisible()) {
      await humanType(regPwInput, PW);
    }
    const regConfirmPwInput = page.locator('input[type="password"]').nth(1);
    if (await regConfirmPwInput.isVisible()) {
      await humanType(regConfirmPwInput, PW);
    }

    // Terms checkbox
    const termsBox = page.locator('input[type="checkbox"]').first();
    if (await termsBox.isVisible()) {
      await smoothClick(termsBox);
      await page.waitForTimeout(600);
    }

    // Hover over Create Account
    const createAccBtn = page.locator('button:has-text("Create Account")');
    if (await createAccBtn.isVisible()) {
      await moveToElement(createAccBtn);
      await page.waitForTimeout(1000);
    }

    // Clear dev emails inbox before testing forgot-password flow
    await page.evaluate(async () => {
      try {
        await fetch('/api/v1/dev/emails', { method: 'DELETE' });
      } catch {}
    });

    // 1B: Forgot Password
    console.log('Navigating to Forgot Password...');
    await page.goto('/forgot-password');
    await page.waitForTimeout(1000);
    await setHud('🔑 Act 1B: Password Reset Request Flow (/forgot-password)', '#3b82f6');

    const forgotEmail = page.locator('input[type="email"]');
    await humanType(forgotEmail, 'landlord@proplity.com');
    await page.waitForTimeout(800);

    const sendResetBtn = page
      .locator('button:has-text("Send Reset Link"), button[type="submit"]')
      .first();
    await smoothClick(sendResetBtn);
    await page.waitForTimeout(2000); // Display "Check Your Email" confirmation screen

    // 1C: Access Email Dev Popup & Reset Token Link
    console.log('Opening Email Dev Popup...');
    await setHud('📬 Act 1C: Opening Sent Emails Dev Popup & Inspecting Reset Link', '#3b82f6');
    const emailWidgetBtn = page.locator('button[aria-label*="sent emails panel"]').first();
    await emailWidgetBtn.waitFor({ state: 'visible', timeout: 8000 });
    await smoothMove(60, 850);
    await page.waitForTimeout(400);
    await smoothClick(emailWidgetBtn);
    await page.waitForTimeout(1000);

    // Click refresh button in dev mailbox header if visible to immediately fetch newest emails
    const refreshInboxBtn = page.locator('button[aria-label="Refresh"]');
    if (await refreshInboxBtn.isVisible()) {
      await smoothClick(refreshInboxBtn);
      await page.waitForTimeout(600);
    }

    // Click the received email item to expand its body
    await setHud('📧 Act 1C: Expanding "Reset your Proplity password" Email Record', '#3b82f6');
    const emailRow = page.locator('button:has-text("Reset your Proplity password")').first();
    await emailRow.waitFor({ state: 'visible', timeout: 10000 });
    await moveToElement(emailRow);
    await page.waitForTimeout(400);
    await smoothClick(emailRow);
    await page.waitForTimeout(1500);

    // Locate the reset password link inside the email body
    const resetLink = page.locator('a[href*="/reset-password"]').first();
    await resetLink.waitFor({ state: 'visible', timeout: 5000 });
    await resetLink.evaluate((el) => el.removeAttribute('target'));

    await setHud('🔗 Act 1C: Clicking Cryptographic Reset Link from Email Body', '#10b981');
    await moveToElement(resetLink);
    await page.waitForTimeout(1000);
    await smoothClick(resetLink);
    await page.waitForURL('**/reset-password**', { timeout: 15000 });
    await page.waitForTimeout(1200);

    // 1D: Reset Password Screen with Token
    console.log('Completing Password Reset with Token...');
    await setHud(
      '🔒 Act 1D: Setting New Password with Token Verification (/reset-password)',
      '#3b82f6',
    );

    const newPw = page.locator('input[type="password"]').first();
    await humanType(newPw, PW);
    const confirmNewPw = page.locator('input[type="password"]').nth(1);
    await humanType(confirmNewPw, PW);
    await page.waitForTimeout(600);

    const resetSubmitBtn = page.locator('button:has-text("Reset Password")');
    await smoothClick(resetSubmitBtn);
    await page.waitForTimeout(2000); // Shows "Password Reset" success card with "Sign In" button

    await setHud('✅ Password Reset Complete — Proceeding to Sign In', '#10b981');
    const signInLink = page.locator('a:has-text("Sign In")').first();
    if (await signInLink.isVisible()) {
      await smoothClick(signInLink);
      await page.waitForURL('**/login**', { timeout: 10000 });
      await page.waitForTimeout(1000);
    } else {
      await page.goto('/login');
      await page.waitForTimeout(1000);
    }

    // 1E: Login with Validation & Error Feedback
    console.log('Navigating to Login...');
    await setHud('🛡 Act 1E: Sign In Security & Form Validation (/login)', '#3b82f6');

    await humanType(page.getByPlaceholder('Enter your email'), 'landlord@proplity.com');
    await humanType(page.getByPlaceholder('Enter your password'), 'IncorrectPassword!');
    await smoothClick(page.getByRole('button', { name: 'Sign In' }));
    await page.waitForTimeout(1600); // Shows inline error message

    // Re-enter valid credentials
    await setHud('🔑 Act 1E: Signing in with Verified Landlord Credentials', '#10b981');
    await humanType(page.getByPlaceholder('Enter your password'), PW);
    await smoothClick(page.getByRole('button', { name: 'Sign In' }));
    await page.waitForURL('**/dashboard**', { timeout: 15000 });
    await page.waitForTimeout(1200);

    // =========================================================================
    // ACT 2: LANDLORD PROPERTY LIFECYCLE (CREATE, UPDATE, CONFIGURE & REVIEW)
    // =========================================================================
    console.log('--- Act 2: Landlord Property Creation & Lifecycle ---');
    recordChapter('🏗', 'Act 2: Landlord Property Creation Wizard & Media', '#f59e0b');
    await setHud('🏗 Act 2: Landlord Property Creation Wizard (4-Step Pipeline)', '#f59e0b');

    await page.goto('/dashboard/properties/new');
    await page.waitForTimeout(1000);

    // Step 1: Property Information
    await setHud('📋 Step 1/4: Property Architecture & Address Location', '#f59e0b');
    const aptBtn = page.locator('button:has-text("Apartment/Flat")');
    if (await aptBtn.isVisible()) {
      await smoothClick(aptBtn);
    }
    await humanType(page.locator('input[placeholder*="Block 15"]'), 'Plot 12B Admiralty Way');
    await humanType(page.locator('input[placeholder*="Lagos"]'), 'Lekki Phase 1, Lagos');

    // Smooth scroll down to reveal state selector and next button
    await smoothScroll(300);
    await page.waitForTimeout(600);
    await page.locator('select').selectOption('Lagos');
    await page.waitForTimeout(800);

    // Continue to Step 2
    await smoothClick(page.locator('button:has-text("Next Step")'));
    await page.waitForTimeout(1000);

    // Step 2: Property Details & Multi-Unit Setup
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await setHud('🏢 Step 2/4: Unit Breakdown, Rent Pricing & Service Charge', '#f59e0b');
    await humanType(page.locator('input[placeholder*="3B"]'), 'Suite 4A');
    await humanType(page.locator('input[placeholder*="3"]').first(), '3');
    await humanType(page.locator('input[placeholder*="2"]').first(), '3');
    await humanType(page.locator('input[placeholder*="1200"]').first(), '1850');
    await humanType(page.getByPlaceholder('e.g., 850000'), '4500000');
    await humanType(page.getByPlaceholder('e.g., 50000'), '500000');
    await page.waitForTimeout(1000);

    // Smooth scroll down to Description
    await smoothScroll(350);
    await page.waitForTimeout(600);
    await setHud('📝 Step 2/4: Property Description & Architectural Notes', '#f59e0b');

    const descInput = page.locator('textarea[placeholder*="Describe the property"]');
    if (await descInput.isVisible()) {
      await humanType(
        descInput,
        'Executive waterfront luxury flat with private elevator, 24/7 power & premium security in Lekki Phase 1.',
        25,
      );
    }
    await page.waitForTimeout(800);

    // Smooth scroll down to Amenities
    await smoothScroll(400);
    await page.waitForTimeout(600);
    await setHud('✨ Step 2/4: Building Amenities & Facilities Selection', '#f59e0b');

    // Select Amenities
    const pwrBtn = page.locator('button:has-text("24/7 Power Supply")');
    if (await pwrBtn.isVisible()) await smoothClick(pwrBtn);
    const secBtn = page.locator('button:has-text("Security/CCTV")');
    if (await secBtn.isVisible()) await smoothClick(secBtn);
    const parkBtn = page.locator('button:has-text("Parking Space")');
    if (await parkBtn.isVisible()) await smoothClick(parkBtn);
    const gymBtn = page.locator('button:has-text("Gym")');
    if (await gymBtn.isVisible()) await smoothClick(gymBtn);
    const poolBtn = page.locator('button:has-text("Swimming Pool")');
    if (await poolBtn.isVisible()) await smoothClick(poolBtn);
    const elevBtn = page.locator('button:has-text("Elevator")');
    if (await elevBtn.isVisible()) await smoothClick(elevBtn);

    // Smooth scroll down to Utilities Included section & Next Step button!
    await smoothScroll(450);
    await page.waitForTimeout(800);
    await setHud('💡 Step 2/4: Included Utilities & Service Coverage', '#f59e0b');

    // Select Utilities
    const waterBtn = page.locator('button:has-text("Water Included")');
    if (await waterBtn.isVisible()) await smoothClick(waterBtn);
    const wasteBtn = page.locator('button:has-text("Waste Management Included")');
    if (await wasteBtn.isVisible()) await smoothClick(wasteBtn);
    const inetBtn = page.locator('button:has-text("Internet Included")');
    if (await inetBtn.isVisible()) await smoothClick(inetBtn);

    // Pause so the viewer clearly sees the entire bottom half:
    // the utilities checkboxes, previous button, next button!
    await page.waitForTimeout(1600);

    // Advance to Step 3
    const nextStep2Btn = page.locator('button:has-text("Next Step")');
    await smoothClick(nextStep2Btn);
    await page
      .getByRole('heading', { name: 'Media Upload' })
      .waitFor({ state: 'visible', timeout: 8000 });
    await page.waitForTimeout(1000);

    // Step 3: Media Upload & Quality Guidelines
    await page.evaluate(() => {
      window.scrollTo({ top: 0, behavior: 'instant' });
      const main = document.querySelector('main');
      if (main) main.scrollTo({ top: 0, behavior: 'instant' });
    });
    await setHud('📸 Step 3/4: Media Upload & Verification Guidelines', '#f59e0b');
    await page.waitForTimeout(1200);

    // View 360 Walkthrough card
    await smoothScroll(350);
    await page.waitForTimeout(1200);

    // View Room Photos & Exterior building view cards and Admin Review Note
    await smoothScroll(400);
    await page.waitForTimeout(1500);

    // Advance to Step 4
    const nextStep3Btn = page.locator('button:has-text("Next Step")');
    await smoothClick(nextStep3Btn);
    await page
      .getByRole('heading', { name: 'Review Your Listing' })
      .waitFor({ state: 'visible', timeout: 8000 });
    await page.waitForTimeout(1000);

    // Step 4: Review & Submit Listing
    await page.evaluate(() => {
      window.scrollTo({ top: 0, behavior: 'instant' });
      const main = document.querySelector('main');
      if (main) main.scrollTo({ top: 0, behavior: 'instant' });
    });
    await setHud('🚀 Step 4/4: Listing Summary, Multi-Unit & Media Audit', '#f59e0b');
    await page.waitForTimeout(1200);

    // Scroll to see Unit breakdown & Amenities
    await smoothScroll(350);
    await page.waitForTimeout(1200);

    // Scroll further to see Media Status & What Happens Next guidelines
    await smoothScroll(450);
    await page.waitForTimeout(1500);

    const submitListingBtn = page.locator('button:has-text("Submit for Verification")');
    if (await submitListingBtn.isVisible()) {
      await smoothClick(submitListingBtn);
      await page.waitForTimeout(3000);
    }

    // View Landlord Properties Directory
    console.log('Viewing Landlord Properties...');
    await page.goto('/dashboard/properties');
    await page.waitForTimeout(1000);
    await setHud('🏢 Landlord Portfolio: Managed Properties & Moderation Status', '#f59e0b');
    await smoothScroll(350);
    await page.waitForTimeout(1500);

    // Open Property Detail & Showcase Staged Draft Edits Lifecycle
    console.log('Viewing Property Detail & Staged Edits...');
    await page.goto('/dashboard/properties/f384abab-e7fb-4d05-be1f-e616bf395aa9');
    await page.waitForTimeout(1500);
    await setHud('🏢 Property Detail: Staged Edits, Units & Listing Lifecycle', '#f59e0b');

    // 1. Showcase Staged Property Draft Edits
    await setHud('📝 Staged Property Edits: Editing Details & Saving as Draft', '#f59e0b');
    const editPropBtn = page.locator('button:has-text("Edit Property")').first();
    if (await editPropBtn.isVisible()) {
      await smoothClick(editPropBtn);
      await page.waitForTimeout(1200);

      const descBox = page.locator('textarea').first();
      if (await descBox.isVisible()) {
        await humanType(descBox, ' Luxury waterfront suites with 24/7 power, private elevator & biometric access.', 25);
        await page.waitForTimeout(1000);
      }

      // Click "Save as Draft"
      const saveDraftBtn = page.locator('button:has-text("Save as Draft")');
      if (await saveDraftBtn.isVisible()) {
        await setHud('💾 Saving Changes to Property.metadata.pendingChanges (Draft Mode)', '#f59e0b');
        await smoothClick(saveDraftBtn);
        await page.waitForTimeout(2000);
      }

      // Review the Draft Staging Banner
      await setHud('📋 Staged Edits Stored: Live Listing Unchanged While in Draft', '#3b82f6');
      await page.waitForTimeout(2500);

      // Request Admin Review
      const reqReviewBtn = page.locator('button:has-text("Request Admin Review"), button:has-text("Request Review")').first();
      if (await reqReviewBtn.isVisible()) {
        await setHud('📤 Submitting Staged Edits for Admin Moderation Review', '#f59e0b');
        await smoothClick(reqReviewBtn);
        await page.waitForTimeout(2200);
      }

      // Show under review state
      await setHud('⏳ Changes Under Admin Review (Direct Deletion Blocked by Safety Guard)', '#a78bfa');
      await page.waitForTimeout(2500);

      // Cancel approval request -> returns to draft
      const cancelApprovalBtn = page.locator('button:has-text("Cancel Approval Request")').first();
      if (await cancelApprovalBtn.isVisible()) {
        await setHud('↩️ Canceling Approval Request: Safely Reverting Staged Edits to Draft', '#3b82f6');
        await smoothClick(cancelApprovalBtn);
        await page.waitForTimeout(2000);
      }

      // Discard draft
      const discardDraftBtn = page.locator('button:has-text("Discard Draft"), button:has-text("Discard")').first();
      if (await discardDraftBtn.isVisible()) {
        await setHud('🗑 Discarding Staged Draft Edits cleanly', '#ef4444');
        await smoothClick(discardDraftBtn);
        await page.waitForTimeout(2000);
      }

      // Now create final proposed revision and submit for review
      await setHud('✨ Final Listing Polish: Submitting Staged Revisions for Admin Approval', '#10b981');
      await smoothClick(editPropBtn);
      await page.waitForTimeout(1000);
      if (await descBox.isVisible()) {
        await humanType(descBox, ' High-spec waterfront executive residence with 24/7 power and security in Lekki.', 25);
      }
      const saveAndSubmitBtn = page.locator('button:has-text("Save & Submit for Review")');
      if (await saveAndSubmitBtn.isVisible()) {
        await smoothClick(saveAndSubmitBtn);
        await page.waitForTimeout(2500);
      }
    }

    // 2. Unit Visibility Control
    await setHud('👁️ Unit Visibility: Toggling Marketplace Public vs Internal Private Units', '#3b82f6');
    await smoothScroll(400);
    await page.waitForTimeout(2000);

    const unitVisBtn = page.locator('button:has-text("Public"), button:has-text("Private")').first();
    if (await unitVisBtn.isVisible()) {
      await smoothClick(unitVisBtn);
      await page.waitForTimeout(2000);
      await smoothClick(unitVisBtn);
      await page.waitForTimeout(2000);
    }

    // Post an announcement
    const newAnnBtn = page.locator('button:has-text("New Announcement")');
    if (await newAnnBtn.isVisible()) {
      await smoothClick(newAnnBtn);
      await page.waitForTimeout(500);
      const annTitle = page.locator('input[placeholder="Title"]');
      if (await annTitle.isVisible()) {
        await humanType(annTitle, 'Generator Maintenance Notice');
      }
      const annBody = page.locator('textarea[placeholder="Message"]');
      if (await annBody.isVisible()) {
        await humanType(
          annBody,
          'Quarterly servicing scheduled for Saturday 9:00 AM. Inverter active.',
        );
      }
      const postAnnBtn = page.locator('button:has-text("Post Announcement")');
      if (await postAnnBtn.isVisible()) {
        await smoothClick(postAnnBtn);
        await page.waitForTimeout(1500);
      }
    }

    // View Financial Rent Breakdown
    await page.goto('/dashboard/breakdown/rent');
    await page.waitForTimeout(2500);
    await setHud('📊 Landlord Financial Analytics & Rent Collection Ledger', '#f59e0b');
    await smoothScroll(450);
    await page.waitForTimeout(3500);

    // View Landlord Invoices Manager
    await page.goto('/dashboard/invoices');
    await page.waitForTimeout(2500);
    await setHud('🧾 Landlord Invoice Manager: Rent Invoices & Settlement Tracking', '#f59e0b');
    await smoothScroll(350);
    await page.waitForTimeout(3500);

    // Return to Landlord Dashboard & Download Financial CSV Report
    await page.goto('/dashboard');
    await page.waitForTimeout(2000);
    await setHud('📈 Landlord Executive Suite: Portfolio Health & Report Generation', '#f59e0b');
    await smoothScroll(450);
    await page.waitForTimeout(2000);

    const downloadCsvBtn = page.locator('button:has-text("Download Report")').first();
    if (await downloadCsvBtn.isVisible()) {
      await setHud('📥 Exporting Real-Time Financial Summary (.csv) for Landlord Audit', '#10b981');
      await smoothClick(downloadCsvBtn);
      await page.waitForTimeout(3000);
    }

    await logout();

    // =========================================================================
    // ACT 3: SUPER ADMIN PROPERTY MODERATION, APPROVAL & VISIBILITY
    // =========================================================================
    console.log('--- Act 3: Super Admin Property Moderation & Approval ---');
    recordChapter('🛡', 'Act 3: Super Admin Review, Approval & Visibility Control', '#a78bfa');
    await setHud('🛡 Act 3: Super Admin Property Moderation & Compliance', '#a78bfa');

    // Ensure target property f384abab-e7fb-4d05-be1f-e616bf395aa9 is set to PENDING_REVIEW & Unpublished
    await pool.query(
      `UPDATE "public"."Property" SET "moderationStatus" = 'PENDING_REVIEW', "isPublished" = false WHERE id = 'f384abab-e7fb-4d05-be1f-e616bf395aa9';`,
    );

    await humanType(page.getByPlaceholder('Enter your email'), 'admin@proplity.com');
    await humanType(page.getByPlaceholder('Enter your password'), PW);
    await smoothClick(page.getByRole('button', { name: 'Sign In' }));
    await page.waitForURL('**/admin**', { timeout: 15000 });
    await page.waitForTimeout(1500);

    await page.goto('/admin/properties');
    await page.waitForTimeout(2000);
    await setHud('🏘 Moderation Queue: Address Fingerprinting & Pending Review Listings', '#a78bfa');

    // Inspect Merged Tab (Duplicate Detection & Merge History)
    const mergedChip = page.locator('button:has-text("Merged")');
    if (await mergedChip.isVisible()) {
      await setHud('🔗 Duplicate Detection: Merged Listings Audit & De-duplication History', '#a78bfa');
      await smoothClick(mergedChip);
      await page.waitForTimeout(2500);
      await smoothScroll(250);
      await page.waitForTimeout(2000);
    }

    // Inspect Approved Tab
    const approvedChip = page.locator('button:has-text("Approved")');
    if (await approvedChip.isVisible()) {
      await setHud('✅ Verified Listings: Actively Monitored Properties in Circulation', '#10b981');
      await smoothClick(approvedChip);
      await page.waitForTimeout(3000);
      await smoothScroll(250);
      await page.waitForTimeout(2000);
    }

    // Click Pending Review chip
    const pendingChip = page.locator('button:has-text("Pending Review")');
    if (await pendingChip.isVisible()) {
      await setHud('⏳ Moderation Queue: Inbound Submissions Awaiting Audit', '#a78bfa');
      await smoothClick(pendingChip);
      await page.waitForTimeout(2500);
    }

    await smoothScroll(300);
    await page.waitForTimeout(2000);

    // Click Review on the listing to open PropertyReviewDrawer
    const reviewBtn = page.locator('button:has-text("Review")').first();
    await reviewBtn.waitFor({ state: 'visible', timeout: 8000 });
    await smoothClick(reviewBtn);
    await page.waitForTimeout(3000);

    await setHud('📋 Admin Review Drawer: Visual Diff of Staged Property & Unit Edits', '#a78bfa');
    await page.waitForTimeout(3500);

    // Scroll through the drawer to show live vs proposed comparison
    const drawerAside = page.locator('aside');
    if (await drawerAside.isVisible()) {
      await drawerAside.evaluate((el) => el.scrollBy({ top: 350, behavior: 'smooth' }));
      await page.waitForTimeout(4000);
      await drawerAside.evaluate((el) => el.scrollBy({ top: 350, behavior: 'smooth' }));
      await page.waitForTimeout(4000);
    }

    // Approve Listing in drawer
    await setHud('✅ Super Admin Action: Approving Staged Property Edits', '#10b981');
    const drawerApproveBtn = page.locator('aside button:has-text("Approve Listing")');
    if (await drawerApproveBtn.isVisible()) {
      await smoothClick(drawerApproveBtn);
      await page.waitForTimeout(2500);
    }

    // Highlight Visibility Distinction: Public vs Selected Tenants
    await setHud(
      '👁️ Visibility Control: When Unpublished, Property is Private for Selected Tenants via Direct Invite',
      '#f59e0b',
    );
    await page.waitForTimeout(2500);

    // Publish Listing in drawer
    const drawerPublishBtn = page.locator('aside button:has-text("Publish Listing")');
    if (await drawerPublishBtn.isVisible()) {
      await setHud(
        '🌐 Admin Action: Publishing Listing for Public Discovery on Marketplace',
        '#10b981',
      );
      await smoothClick(drawerPublishBtn);
      await page.waitForTimeout(2500);
    }

    // Close drawer
    const closeDrawerBtn = page
      .locator('aside button:has-text("Close"), aside button[aria-label="Close"]')
      .first();
    if (await closeDrawerBtn.isVisible()) {
      await smoothClick(closeDrawerBtn);
      await page.waitForTimeout(1200);
    }

    await setHud('🚀 Listing Approved & Published: Now Active on Public Marketplace!', '#10b981');
    await page.waitForTimeout(2000);

    await logout();

    // =========================================================================
    // ACT 4: PROPERTY MANAGER OPERATIONS & SELECTED TENANTS DIRECT INVITE
    // =========================================================================
    console.log('--- Act 4: Property Manager Operations & Selected Tenants ---');
    recordChapter('👔', 'Act 4: Manager Operations & Selected Tenants Invite', '#3b82f6');
    await setHud('👔 Act 4: Property Manager Portfolio & Direct Tenant Onboarding', '#3b82f6');

    await humanType(page.getByPlaceholder('Enter your email'), 'manager@proplity.com');
    await humanType(page.getByPlaceholder('Enter your password'), PW);
    await smoothClick(page.getByRole('button', { name: 'Sign In' }));
    await page.waitForURL('**/dashboard**', { timeout: 15000 });
    await page.waitForTimeout(1000);

    // View Manager Portfolio
    await page.goto('/dashboard/properties');
    await page.waitForTimeout(2000);
    await setHud('🏢 Manager Portfolio: Managing Approved Residential Properties', '#3b82f6');
    await smoothScroll(350);
    await page.waitForTimeout(2500);

    // Deep-dive into managed property units
    await page.goto('/dashboard/properties/f384abab-e7fb-4d05-be1f-e616bf395aa9');
    await page.waitForTimeout(2500);
    await setHud('📋 Property Operations: Multi-Unit Tenancy, Rent Rates & Equipment', '#3b82f6');
    await smoothScroll(400);
    await page.waitForTimeout(3000);
    await smoothScroll(400);
    await page.waitForTimeout(3000);

    // Direct Tenant Onboarding for Selected/Private Tenants
    await page.goto('/dashboard/tenants/add');
    await page.waitForTimeout(2000);
    await setHud(
      '✉️ Else Shown to Selected Tenants: Direct Onboarding for Private Units',
      '#3b82f6',
    );

    const inviteFname = page.getByPlaceholder('e.g. Adewale', { exact: true });
    if (await inviteFname.isVisible()) {
      await humanType(inviteFname, 'Babatunde');
    }
    const inviteLname = page.getByPlaceholder('e.g. Johnson', { exact: true });
    if (await inviteLname.isVisible()) {
      await humanType(inviteLname, 'Adeleke');
    }
    const inviteEmail = page.getByPlaceholder('adewale@email.com', { exact: true });
    if (await inviteEmail.isVisible()) {
      await humanType(inviteEmail, 'babatunde.adeleke@example.com');
    }

    await smoothScroll(350);
    await page.waitForTimeout(2500);

    // Tenant Management Table
    await page.goto('/dashboard/tenants');
    await page.waitForTimeout(2500);
    await setHud('📋 Active & Terminated Leases Directory: Payment Tracking & Compliance', '#3b82f6');
    await smoothScroll(300);
    await page.waitForTimeout(3000);

    const terminatedTab = page.locator('button:has-text("Terminated")').first();
    if (await terminatedTab.isVisible()) {
      await setHud('📜 Historical Lease Audit: Filter Terminated & Archived Tenants', '#3b82f6');
      await smoothClick(terminatedTab);
      await page.waitForTimeout(3500);
      const activeTab = page.locator('button:has-text("Active")').first();
      if (await activeTab.isVisible()) {
        await smoothClick(activeTab);
        await page.waitForTimeout(3500);
      }
    }

    // Manager Maintenance Dispatch Queue
    await page.goto('/dashboard/maintenance');
    await page.waitForTimeout(2500);
    await setHud('🛠 Maintenance Pipeline: Reviewing Service Requests & SLA Timers', '#3b82f6');
    await smoothScroll(350);
    await page.waitForTimeout(3500);
    await smoothScroll(-350);
    await page.waitForTimeout(2500);

    await logout();

    // =========================================================================
    // ACT 5: PUBLIC DISCOVERY & PROSPECTIVE TENANT EXPERIENCE
    // =========================================================================
    console.log('--- Act 5: Public Discovery ---');
    recordChapter('🌍', 'Act 5: If Public, Shown Publicly — Marketplace Discovery', '#10b981');
    await page.goto('/properties');
    await page.waitForTimeout(2500);
    await setHud(
      '🌍 Act 5: If Public, Shown Publicly — Prospective Tenants Browse Marketplace',
      '#10b981',
    );

    // Search properties by keyword
    const searchInput = page.locator('input[placeholder*="Search by city, area, or property name" i], input[type="text"]').first();
    if (await searchInput.isVisible()) {
      await humanType(searchInput, 'Highland');
      await page.waitForTimeout(3000);
    }
    await smoothScroll(400);
    await page.waitForTimeout(3500);

    // Click into Highland Park Residences
    const propCard = page.locator('text=Highland Park Residences').first();
    if (await propCard.isVisible()) {
      await smoothClick(propCard);
      await page.waitForTimeout(3000);
    } else {
      await page.goto('/properties/f384abab-e7fb-4d05-be1f-e616bf395aa9');
      await page.waitForTimeout(2500);
    }

    await setHud('🏡 Public Listing: High-Res Gallery, Amenities & Units', '#10b981');
    await smoothScroll(450);
    await page.waitForTimeout(3000);

    // Interactive photo gallery inspection
    const galleryThumbs = page.locator('button:has(img)');
    const thumbCount = await galleryThumbs.count();
    for (let i = 0; i < Math.min(thumbCount, 3); i++) {
      await smoothClick(galleryThumbs.nth(i));
      await page.waitForTimeout(2000);
    }

    await smoothMove(920, 380); // Schedule viewing CTA
    await page.waitForTimeout(2000);

    // Demonstrate clicking Apply for this Property
    const applyBtn = page.locator('button:has-text("Apply for this Property")').first();
    if (await applyBtn.isVisible()) {
      await setHud('📝 Resident Application Gate: Secure Sign-In Required', '#3b82f6');
      await smoothClick(applyBtn);
      await page.waitForTimeout(3000);
      const maybeLaterBtn = page.locator('button:has-text("Maybe Later")').first();
      if (await maybeLaterBtn.isVisible()) {
        await smoothClick(maybeLaterBtn);
        await page.waitForTimeout(2000);
      }
    }

    // Schedule a viewing interaction
    const scheduleBtn = page.locator('button:has-text("Schedule a Viewing")').first();
    if (await scheduleBtn.isVisible()) {
      await setHud('📅 Interactive Schedule Viewing Modal: Tour Booking System', '#10b981');
      await smoothClick(scheduleBtn);
      await page.waitForTimeout(3500);
      const closeSched = page.locator('button:has-text("Cancel"), button[aria-label="Close"]').first();
      if (await closeSched.isVisible()) {
        await smoothClick(closeSched);
        await page.waitForTimeout(2000);
      }
    }

    // Demonstrate clicking Neighbourhood Report scrolls directly to scores without subscription upselling
    const neighBtn = page.locator('button:has-text("Neighbourhood Report")').first();
    if (await neighBtn.isVisible()) {
      await setHud('📊 Neighbourhood Intelligence: Direct Insight Access (Zero Subscription Upsell)', '#10b981');
      await smoothClick(neighBtn);
      await page.waitForTimeout(4000);
    }
    await smoothScroll(450);
    await page.waitForTimeout(3500);

    // =========================================================================
    // ACT 6: TENANT LIVING — DIGITAL LEASE, RENT CHECKOUT & MAINTENANCE
    // =========================================================================
    console.log('--- Act 6: Tenant Living ---');
    recordChapter('🏠', 'Act 6: Tenant Portal, Digital Lease, Rent Checkout & Messaging', '#3b82f6');
    await page.goto('/login');
    await page.waitForTimeout(800);
    await setHud('🏠 Tenant Portal: Lease Agreement & Digital Signing', '#3b82f6');

    await humanType(page.getByPlaceholder('Enter your email'), 'tenant@proplity.com');
    await humanType(page.getByPlaceholder('Enter your password'), PW);
    await smoothClick(page.getByRole('button', { name: 'Sign In' }));
    await page.waitForURL('**/dashboard**', { timeout: 15000 });
    await page.waitForTimeout(1000);

    // Tenant Tenancy Agreement
    await page.goto('/dashboard/rentals');
    await page.waitForTimeout(2000);
    await setHud('📄 Digital Tenancy Agreement: Legal Terms & E-Signature Audit', '#3b82f6');
    await smoothScroll(400);
    await page.waitForTimeout(3000);
    await smoothScroll(400);
    await page.waitForTimeout(3000);

    // Tenant Payment Ledger & Multi-Channel Checkout
    await page.goto('/dashboard/payment-history');
    await page.waitForTimeout(2000);
    await setHud('💳 Rent Invoicing & Multi-Channel Payments (Paystack & Transfer)', '#3b82f6');
    await smoothScroll(350);
    await page.waitForTimeout(3000);
    await smoothScroll(-350);
    await page.waitForTimeout(2500);

    // Tenant Dashboard & Access Codes
    await page.goto('/dashboard');
    await page.waitForTimeout(2000);
    await setHud('🏠 Tenant Dashboard: Active Lease & Quick Actions', '#3b82f6');
    await smoothScroll(300);
    await page.waitForTimeout(2000);

    // Click Neighbourhood Report quick action
    const tenantNeighBtn = page.locator('button:has-text("Neighbourhood Report")').first();
    if (await tenantNeighBtn.isVisible()) {
      await setHud('📍 Resident Area Intelligence: In-Depth Security & Amenity Metrics', '#3b82f6');
      await smoothClick(tenantNeighBtn);
      await page.waitForTimeout(3000);
      await smoothScroll(300);
      await page.waitForTimeout(2500);

      // Demonstrate Download PDF with Incoming Feature badge & toast
      const dlBtn = page.locator('button:has-text("Download PDF")').first();
      if (await dlBtn.isVisible()) {
        await setHud('✨ Incoming Feature Notice: Honest UI/UX Gating Without Misleading Alerts', '#3b82f6');
        await smoothClick(dlBtn);
        await page.waitForTimeout(4000);
      }

      await smoothScroll(400);
      await page.waitForTimeout(3500);
      // Return to dashboard
      await page.goto('/dashboard');
      await page.waitForTimeout(2000);
    }

    await setHud('🎟 Single-Use Visitor Gate Pass Access Codes for Estate Security', '#3b82f6');
    await smoothScroll(400);
    await page.waitForTimeout(2000);

    // Tenant In-App Messaging
    await page.goto('/dashboard/messages');
    await page.waitForTimeout(1000);
    await setHud(
      '💬 Real-Time In-App Messaging: Tenant Coordinates with Property Manager',
      '#3b82f6',
    );
    const tenantConv = page
      .locator('button:has-text("Move-in & Key Collection"), button:has-text("Alex Vance")')
      .first();
    if (await tenantConv.isVisible()) {
      await smoothClick(tenantConv);
      await page.waitForTimeout(800);
    }
    const tenantMsgInput = page.getByPlaceholder('Type your message...');
    if (await tenantMsgInput.isVisible()) {
      await humanType(
        tenantMsgInput,
        'Hi Alex, agreement is signed and rent paid. When can I pick up keys for Unit 4B?',
      );
      await page.waitForTimeout(600);
      const sendBtn = page.locator('button[title="Send message"]');
      if (await sendBtn.isVisible()) {
        await smoothClick(sendBtn);
        await page.waitForTimeout(1500);
      }
    }
    await smoothScroll(200);
    await page.waitForTimeout(1000);

    // Tenant Maintenance Request
    await page.goto('/dashboard/tenant-maintenance');
    await page.waitForTimeout(1000);
    await setHud('🛠 Tenant Maintenance: Submitting Issue for Unit Repairs', '#f97316');
    await smoothScroll(300);
    await page.waitForTimeout(1000);

    // Click New Request
    const newReqBtn = page.locator('button:has-text("New Request")');
    if (await newReqBtn.isVisible()) {
      await smoothClick(newReqBtn);
      await page.waitForTimeout(1000);
      await setHud('📝 Maintenance Form: Category, Priority Level & Issue Details', '#f97316');

      // Select Plumbing
      const plumbBtn = page.locator('button:has-text("Plumbing")');
      if (await plumbBtn.isVisible()) {
        await smoothClick(plumbBtn);
      }

      // Select High Priority
      const highBtn = page.locator('button:has-text("High")');
      if (await highBtn.isVisible()) {
        await smoothClick(highBtn);
      }

      const reqTitle = page.getByPlaceholder('e.g., Kitchen faucet is leaking');
      if (await reqTitle.isVisible()) {
        await humanType(reqTitle, 'Kitchen Booster Pump Pressure Loss');
      }

      const reqDesc = page.locator('textarea[placeholder*="describe the issue" i]');
      if (await reqDesc.isVisible()) {
        await humanType(
          reqDesc,
          'Water pressure dropped significantly this morning. Suspected booster pump sensor issue.',
          25,
        );
      }

      await smoothScroll(250);
      await page.waitForTimeout(1200);

      const submitReqBtn = page.locator('button:has-text("Submit Request")');
      if (await submitReqBtn.isVisible()) {
        await moveToElement(submitReqBtn);
        await page.waitForTimeout(1000);
      }
    }

    await logout();

    // =========================================================================
    // ACT 7: MANAGER MAINTENANCE OPERATIONS & VENDOR DISPATCH
    // =========================================================================
    console.log('--- Act 7: Manager Maintenance Operations ---');
    recordChapter('📋', 'Act 7: Manager Messaging Reply, Kanban Dispatch & Vendor Assignment', '#3b82f6');
    await setHud(
      '📋 Act 7: Manager Operations — Triaging Ticket & Dispatching to Vendor',
      '#3b82f6',
    );

    await humanType(page.getByPlaceholder('Enter your email'), 'manager@proplity.com');
    await humanType(page.getByPlaceholder('Enter your password'), PW);
    await smoothClick(page.getByRole('button', { name: 'Sign In' }));
    await page.waitForURL('**/dashboard**', { timeout: 15000 });
    await page.waitForTimeout(1000);

    // Manager In-App Messaging Reply
    await page.goto('/dashboard/messages');
    await page.waitForTimeout(1000);
    await setHud(
      '💬 Real-Time Messaging: Property Manager Replies to Tenant Inquiry',
      '#3b82f6',
    );
    const mgrConv = page
      .locator('button:has-text("Move-in & Key Collection"), button:has-text("Jordan Hayes")')
      .first();
    if (await mgrConv.isVisible()) {
      await smoothClick(mgrConv);
      await page.waitForTimeout(800);
    }
    const mgrMsgInput = page.getByPlaceholder('Type your message...');
    if (await mgrMsgInput.isVisible()) {
      await humanType(
        mgrMsgInput,
        'Hi Jordan! Welcome to Highland Park. Your keys and physical welcome pack are ready at the front office with code 8492.',
      );
      await page.waitForTimeout(600);
      const mgrSendBtn = page.locator('button[title="Send message"]');
      if (await mgrSendBtn.isVisible()) {
        await smoothClick(mgrSendBtn);
        await page.waitForTimeout(1500);
      }
    }
    await smoothScroll(200);
    await page.waitForTimeout(1000);

    // Kanban Maintenance Board
    await page.goto('/dashboard/maintenance');
    await page.waitForTimeout(1000);
    await setHud('📋 Visual Kanban Board: Triaging Submitted → Assigned → In Progress', '#3b82f6');

    await smoothMove(320, 360); // Column 1: Submitted
    await page.waitForTimeout(800);
    await smoothMove(640, 360); // Column 2: Assigned
    await page.waitForTimeout(800);
    await smoothMove(960, 360); // Column 3: In Progress
    await page.waitForTimeout(1000);

    await logout();

    // =========================================================================
    // ACT 8: SERVICE PROVIDER FIELD OPERATIONS & INVOICING
    // =========================================================================
    console.log('--- Act 8: Vendor Field Operations ---');
    recordChapter('🔧', 'Act 8: Service Provider Console & Itemized Invoicing', '#ef4444');
    await setHud('🔧 Act 8: Certified Service Provider Operations & Invoicing', '#ef4444');

    await humanType(page.getByPlaceholder('Enter your email'), 'vendor@proplity.com');
    await humanType(page.getByPlaceholder('Enter your password'), PW);
    await smoothClick(page.getByRole('button', { name: 'Sign In' }));
    await page.waitForURL('**/dashboard**', { timeout: 15000 });
    await page.waitForTimeout(1000);

    // Vendor Console
    await setHud('🔧 Service Provider Console: Work Orders & CAC Status', '#ef4444');
    await smoothScroll(350);
    await page.waitForTimeout(3000);

    const viewJobBtn = page.locator('button:has-text("View Job"), a:has-text("View"), button:has-text("Create Invoice")').first();
    if (await viewJobBtn.isVisible()) {
      await setHud('🔍 Inspecting Work Order: Resident Ticket, Scope & Urgency Level', '#ef4444');
      await smoothClick(viewJobBtn);
      await page.waitForTimeout(3500);
      await smoothScroll(350);
      await page.waitForTimeout(3000);
    } else {
      await smoothScroll(-350);
      await page.waitForTimeout(2500);
    }

    // Vendor Invoices & NUBAN Settlements
    await page.goto('/dashboard/vendor/invoices');
    await page.waitForTimeout(3000);
    await setHud('💰 Itemized Invoicing & Direct NUBAN Bank Transfer Ledger', '#ef4444');
    await smoothScroll(350);
    await page.waitForTimeout(4000);

    await logout();

    // =========================================================================
    // ACT 9: SUPER ADMIN GOVERNANCE, AUDIT TRAIL & MASTER GUIDE
    // =========================================================================
    console.log('--- Act 9: Super Admin Governance & Guide ---');
    recordChapter('🏛', 'Act 9: Super Admin Governance, Audit Trail & Guide', '#a78bfa');
    await setHud('🏛 Act 9: Super Admin Governance, Security & Feature Matrix', '#a78bfa');

    await humanType(page.getByPlaceholder('Enter your email'), 'admin@proplity.com');
    await humanType(page.getByPlaceholder('Enter your password'), PW);
    await smoothClick(page.getByRole('button', { name: 'Sign In' }));
    await page.waitForURL('**/admin**', { timeout: 15000 });
    await page.waitForTimeout(1500);

    // Security Audit Log Explorer
    await page.goto('/admin/security');
    await page.waitForTimeout(2500);
    await setHud(
      '🔐 Security Audit Log Explorer: Action History & Cryptographic Payloads',
      '#a78bfa',
    );
    await smoothScroll(350);
    await page.waitForTimeout(3500);

    // User Directory & Account Suspension Modal
    await page.goto('/admin/users');
    await page.waitForTimeout(2500);
    await setHud('👥 User Directory: Live Search, Roles & Suspension Modal', '#a78bfa');

    const userSearch = page.locator('input[placeholder*="Search"]').first();
    if (await userSearch.isVisible()) {
      await humanType(userSearch, 'tenant');
      await page.waitForTimeout(2000);
    }

    const suspendBtn = page.locator('button:has-text("Suspend")').first();
    if (await suspendBtn.isVisible()) {
      await smoothClick(suspendBtn);
      await page.waitForTimeout(2000); // Reveals suspension reason modal
      const cancelModalBtn = page.locator('button:has-text("Cancel")').first();
      if (await cancelModalBtn.isVisible()) {
        await smoothClick(cancelModalBtn);
        await page.waitForTimeout(1500);
      }
    }

    // Platform Configuration & Environment Flags
    await page.goto('/admin/settings');
    await page.waitForTimeout(2500);
    await setHud(
      '⚙️ Platform Settings: Feature Toggles, Subscriptions Status & Governance',
      '#a78bfa',
    );
    await smoothScroll(350);
    await page.waitForTimeout(3500);

    // Proplity In-App Master Directory & Capabilities Guide
    console.log('Navigating to Proplity Guide...');
    await page.goto('/proplity-guide');
    await page.waitForTimeout(3000);
    await setHud(
      '📋 In-App Master Feature Directory: 154 Platform Capabilities Across All Roles',
      '#3b82f6',
    );

    await smoothScroll(450);
    await page.waitForTimeout(3500);

    // Interactive Lightbox Demonstration
    const screenshotCard = page.locator('.screenshot-item').first();
    if (await screenshotCard.isVisible()) {
      await setHud('🔍 Interactive High-Res Guide Lightbox: Platform Screenshots Gallery', '#3b82f6');
      await smoothClick(screenshotCard);
      await page.waitForTimeout(5000);

      // Next screenshot navigation
      const nextBtn = page.locator('button[aria-label="Next screenshot"], button:has-text("Next")').first();
      if (await nextBtn.isVisible()) {
        await smoothClick(nextBtn);
        await page.waitForTimeout(4500);
        await smoothClick(nextBtn);
        await page.waitForTimeout(4500);
      } else {
        await page.keyboard.press('ArrowRight');
        await page.waitForTimeout(4500);
        await page.keyboard.press('ArrowRight');
        await page.waitForTimeout(4500);
      }

      // Close Lightbox
      await page.keyboard.press('Escape');
      await page.waitForTimeout(3000);
    }

    // Highlight Role Guide chapters
    await setHud('📖 High-Resolution 88-Page Step-by-Step Interactive Workflow Manual', '#3b82f6');
    await smoothScroll(650);
    await page.waitForTimeout(4500);
    await smoothScroll(650);
    await page.waitForTimeout(4500);
    await smoothScroll(650);
    await page.waitForTimeout(4500);
    await smoothScroll(650);
    await page.waitForTimeout(4500);
    await smoothScroll(650);
    await page.waitForTimeout(4500);
    await smoothScroll(-1500);
    await page.waitForTimeout(3500);

    // Grand Finale HUD
    await setHud('🎉 Proplity Complete Platform Lifecycle Walkthrough Finished!', '#10b981');
    await smoothMove(720, 450);
    await page.waitForTimeout(18000);

    console.log('✨ All 9 Acts recorded successfully!');
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
      const outDir = resolve(__dirname, '../out/video');
      mkdirSync(outDir, { recursive: true });
      const finalOutVideo = resolve(outDir, 'proplity-complete-userflow.webm');
      const finalOutLiveVideo = resolve(outDir, 'master-userflow-live.webm');

      copyFileSync(rawVideoPath, finalDocsVideo);
      copyFileSync(rawVideoPath, finalPublicVideo);
      copyFileSync(rawVideoPath, finalOutVideo);
      copyFileSync(rawVideoPath, finalOutLiveVideo);

      const stats = statSync(finalDocsVideo);
      const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);

      console.log(`✅ Saved master video: ${finalDocsVideo} (${sizeMb} MB)`);
      console.log(`✅ Saved public video: ${finalPublicVideo} (${sizeMb} MB)`);
      console.log(`✅ Saved out video: ${finalOutVideo} (${sizeMb} MB)`);
      console.log(`✅ Saved out live video: ${finalOutLiveVideo} (${sizeMb} MB)`);

      // Update HTML Players with exact chapters and total duration
      const totalElapsedSec = Math.floor((Date.now() - recStartTime) / 1000);
      const totalMins = Math.floor(totalElapsedSec / 60);
      const totalSecs = totalElapsedSec % 60;
      const totalDurStr =
        String(totalMins).padStart(2, '0') + ':' + String(totalSecs).padStart(2, '0');

      console.log(`Total Duration: ${totalDurStr} (${totalElapsedSec}s)`);
      console.log('Chapters Generated:');
      console.table(chapters);

      function updatePlayerFile(filePath) {
        try {
          let html = readFileSync(filePath, 'utf-8');
          // Replace chapters list
          const chapterItemsHtml = chapters
            .map(
              (ch) => `          <li class="chapter-item" data-time="${ch.timeSec}">
            <div class="chapter-name"><span>${ch.icon}</span> ${ch.name}</div>
            <div class="chapter-time">${ch.timeStr}</div>
          </li>`,
            )
            .join('\n');

          const listRegex = /<ul class="chapter-list">[\s\S]*?<\/ul>/;
          html = html.replace(
            listRegex,
            `<ul class="chapter-list">\n${chapterItemsHtml}\n        </ul>`,
          );

          // Update duration and size pill
          html = html.replace(
            /<div class="meta-pill">Duration: <strong id="dur-display">.*?<\/strong><\/div>/,
            `<div class="meta-pill">Duration: <strong id="dur-display">${totalDurStr}</strong></div>`,
          );
          html = html.replace(
            /<div class="meta-pill">Size: <strong>.*?<\/strong><\/div>/,
            `<div class="meta-pill">Size: <strong>${sizeMb} MB</strong></div>`,
          );

          writeFileSync(filePath, html, 'utf-8');
          console.log(`✅ Updated player: ${filePath}`);
        } catch (err) {
          console.error(`Failed to update player ${filePath}:`, err.message);
        }
      }

      updatePlayerFile(resolve(__dirname, '../docs/userflow-video.html'));
      updatePlayerFile(resolve(__dirname, '../public/userflow-video.html'));
    }
  }
}

main().catch((err) => {
  console.error('Fatal recording error:', err);
  process.exit(1);
});
