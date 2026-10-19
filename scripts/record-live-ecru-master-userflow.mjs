import { chromium } from '/home/rojitech/Desktop/CODEC/NextJS/proplity/node_modules/@playwright/test/index.mjs';
import {
  copyFileSync,
  mkdirSync,
  statSync,
  readFileSync,
  writeFileSync,
  readdirSync,
} from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BASE = 'https://proplity-ecru.vercel.app';
const PW = 'Password123!';
const VIDEO_DIR = resolve(__dirname, '../out/video');
const OUT_VIDEO_DIR = resolve(__dirname, '../out/video');

mkdirSync(VIDEO_DIR, { recursive: true });
mkdirSync(OUT_VIDEO_DIR, { recursive: true });

// Injected virtual cursor and premium animated HUD pill banner
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
      <span id="playwright-hud-text">Proplity Live Master Userflow Walkthrough</span>
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
  console.log('🎬 Starting Proplity Live Master Userflow Video Recording...');
  console.log(`Target Base URL: ${BASE}`);

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

  async function smoothClick(locator) {
    try {
      const box = await locator.boundingBox();
      if (box) {
        await smoothMove(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.waitForTimeout(80);
        await page.mouse.up();
      } else {
        await locator.click();
      }
    } catch {
      await locator.click().catch(() => {});
    }
    await page.waitForTimeout(400);
  }

  async function humanType(locator, text, minDelay = 25, maxDelay = 65) {
    await locator.click();
    await page.waitForTimeout(100);
    for (const char of text) {
      await page.keyboard.type(char);
      const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
      await page.waitForTimeout(delay);
    }
    await page.waitForTimeout(250);
  }

  async function setHud(text, accent = '#3b82f6') {
    await page.evaluate(
      ({ t, a }) => {
        const el = document.getElementById('playwright-hud-text');
        const dot = document.querySelector('#playwright-hud span:first-child');
        const hud = document.getElementById('playwright-hud');
        if (el) el.textContent = t;
        if (dot) {
          dot.style.background = a;
          dot.style.boxShadow = `0 0 12px ${a}`;
        }
        if (hud) {
          hud.style.borderColor = a + '88';
        }
      },
      { t: text, a: accent },
    );
  }

  async function smoothScroll(distance, stepSize = 35, delayMs = 18) {
    const steps = Math.abs(Math.round(distance / stepSize));
    const sign = distance > 0 ? 1 : -1;
    for (let i = 0; i < steps; i++) {
      await page.mouse.wheel(0, sign * stepSize);
      await page.waitForTimeout(delayMs);
    }
    await page.waitForTimeout(400);
  }

  async function logout() {
    try {
      const sidebarAvatar = page.locator('aside button[aria-label="Account options"]');
      if (await sidebarAvatar.isVisible()) {
        await smoothClick(sidebarAvatar);
        await page.waitForTimeout(400);
        const menuLogout = page.locator('aside div[role="menu"] button:has-text("Log Out")');
        if (await menuLogout.isVisible()) {
          await smoothClick(menuLogout);
          await page.waitForTimeout(400);
          const confirmBtn = page
            .locator('button:has-text("Sign Out"), button[aria-label="Confirm sign out"]')
            .first();
          if (await confirmBtn.isVisible()) {
            await smoothClick(confirmBtn);
            await page.waitForTimeout(1000);
          }
        }
      }
    } catch {}

    try {
      await page.evaluate(async () => {
        try {
          await fetch('/api/v1/auth/logout', { method: 'POST' });
        } catch {}
      });
    } catch {}

    try {
      await context.clearCookies();
    } catch {}

    await ensureLoginPage();
  }

  async function ensureLoginPage() {
    try {
      if (!page.url().includes('/login')) {
        await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
      }
      await page
        .waitForSelector('input[placeholder*="email"], input[type="email"]', { timeout: 12000 })
        .catch(() => {});
      await page.waitForTimeout(600);
    } catch {}
  }

  async function fetchVerificationToken(email) {
    try {
      const res = await fetch(`${BASE}/api/v1/dev/emails`);
      const json = await res.json();
      const list = json.data || [];
      const match = list.reverse().find((e) => e.to === email && e.body?.includes('token='));
      if (match) {
        const m = match.body.match(/token=([a-f0-9]+)/);
        return m ? m[1] : null;
      }
    } catch (err) {
      console.warn('Failed to fetch dev email token:', err.message);
    }
    return null;
  }

  async function activateAccountWithToken(token) {
    if (!token) return;
    await page.goto(`${BASE}/verify-email?token=${token}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);
    const activateBtn = page.locator('button:has-text("Activate Account"), button[type="submit"]');
    if (await activateBtn.isVisible()) {
      await smoothClick(activateBtn);
      await page.waitForTimeout(1800);
    }
  }

  const ts = Date.now();
  const landlordEmail1 = `victoria.landlord.${ts}@example.com`;
  const landlordEmail2 = `sterling.landlord.${ts}@example.com`;
  const managerEmail = `marcus.pm.${ts}@example.com`;
  const tenantEmail = `sophia.tenant.${ts}@example.com`;

  try {
    // =========================================================================
    // ACT 1: PUBLIC PORTAL & ROLE SHOWCASE
    // =========================================================================
    console.log('--- Act 1: Public Portal & Role Showcase ---');
    recordChapter('🌍', 'Act 1: Public Portal, Roles & Platform Discovery', '#3b82f6');
    await page.goto(`${BASE}/`);
    await page.waitForLoadState('networkidle');
    await setHud('🌍 Act 1: Modern AI Property Management — Landing Page', '#3b82f6');
    await page.waitForTimeout(2000);

    // Smooth scroll down to view value props
    await smoothScroll(600);
    await page.waitForTimeout(1500);
    await smoothScroll(800);
    await page.waitForTimeout(1500);
    await smoothScroll(-1400);
    await page.waitForTimeout(1000);

    // Visit For Landlords
    await setHud('🏢 Role Showcase: For Landlords & Property Owners (/for-landlords)', '#10b981');
    await page.goto(`${BASE}/for-landlords`);
    await page.waitForLoadState('networkidle');
    await smoothScroll(500);
    await page.waitForTimeout(1500);

    // Visit Pricing
    await setHud('💎 Transparent Subscription Plans & Pricing (/pricing)', '#8b5cf6');
    await page.goto(`${BASE}/pricing`);
    await page.waitForLoadState('networkidle');
    await smoothScroll(400);
    await page.waitForTimeout(1500);

    // =========================================================================
    // ACT 2: MULTIPLE LANDLORD SELF-REGISTRATIONS & VERIFICATION
    // =========================================================================
    console.log('--- Act 2: Multiple Landlord Self-Registrations ---');
    recordChapter(
      '🏰',
      'Act 2: Multiple Landlord Self-Registrations & Email Verification',
      '#10b981',
    );

    // Landlord 1: Victoria Sterling
    await page.goto(`${BASE}/register?role=landlord`);
    await page.waitForLoadState('networkidle');
    await setHud('🏰 Landlord 1: Registering Victoria Sterling (/register)', '#10b981');
    await page.waitForTimeout(1200);

    const l1First = page.locator('input[placeholder="First name"]');
    if (await l1First.isVisible()) await humanType(l1First, 'Victoria');
    const l1Last = page.locator('input[placeholder="Last name"]');
    if (await l1Last.isVisible()) await humanType(l1Last, 'Sterling');
    const l1Email = page.locator('input[placeholder="you@example.com"]');
    if (await l1Email.isVisible()) await humanType(l1Email, landlordEmail1);
    const l1Phone = page.locator('input[placeholder="+234 803 000 0000"]');
    if (await l1Phone.isVisible()) await humanType(l1Phone, '+234 802 111 2233');

    // Select State
    const stateSel = page.locator('select');
    if (await stateSel.isVisible()) await stateSel.selectOption('Lagos');

    await smoothScroll(250);
    const l1Pw = page.locator('input[type="password"]').first();
    if (await l1Pw.isVisible()) await humanType(l1Pw, PW);
    const l1PwConfirm = page.locator('input[type="password"]').nth(1);
    if (await l1PwConfirm.isVisible()) await humanType(l1PwConfirm, PW);

    const l1Terms = page.locator('input[type="checkbox"]').first();
    if (await l1Terms.isVisible()) await smoothClick(l1Terms);
    await page.waitForTimeout(400);

    const l1Submit = page.locator('button:has-text("Create Account")');
    if (await l1Submit.isVisible()) await smoothClick(l1Submit);
    await page.waitForTimeout(2500);

    // Verify email token via Dev Emails
    await setHud('📬 Activating Landlord 1 via Cryptographic Token', '#10b981');
    const token1 = await fetchVerificationToken(landlordEmail1);
    await activateAccountWithToken(token1);

    // Landlord 2: Alexander Sterling (Second Landlord demonstrating multi-landlord capability)
    await page.goto(`${BASE}/register?role=landlord`);
    await page.waitForLoadState('networkidle');
    await setHud('🏰 Landlord 2: Registering Second Landlord (Alexander Sterling)', '#10b981');
    await page.waitForTimeout(1000);

    const l2First = page.locator('input[placeholder="First name"]');
    if (await l2First.isVisible()) await humanType(l2First, 'Alexander');
    const l2Last = page.locator('input[placeholder="Last name"]');
    if (await l2Last.isVisible()) await humanType(l2Last, 'Sterling');
    const l2Email = page.locator('input[placeholder="you@example.com"]');
    if (await l2Email.isVisible()) await humanType(l2Email, landlordEmail2);
    const l2Phone = page.locator('input[placeholder="+234 803 000 0000"]');
    if (await l2Phone.isVisible()) await humanType(l2Phone, '+234 802 444 5566');

    const stateSel2 = page.locator('select');
    if (await stateSel2.isVisible()) await stateSel2.selectOption('Lagos');

    await smoothScroll(250);
    const l2Pw = page.locator('input[type="password"]').first();
    if (await l2Pw.isVisible()) await humanType(l2Pw, PW);
    const l2PwConfirm = page.locator('input[type="password"]').nth(1);
    if (await l2PwConfirm.isVisible()) await humanType(l2PwConfirm, PW);

    const l2Terms = page.locator('input[type="checkbox"]').first();
    if (await l2Terms.isVisible()) await smoothClick(l2Terms);
    const l2Submit = page.locator('button:has-text("Create Account")');
    if (await l2Submit.isVisible()) await smoothClick(l2Submit);
    await page.waitForTimeout(2500);

    const token2 = await fetchVerificationToken(landlordEmail2);
    await activateAccountWithToken(token2);

    // =========================================================================
    // ACT 3: LANDLORD LOGIN, SETTINGS & PROPERTY CREATION WIZARD
    // =========================================================================
    console.log('--- Act 3: Landlord Login, Settings & Property Creation ---');
    recordChapter(
      '🏰',
      'Act 3: Landlord Dashboard & Listing "The Grand Azure Residences"',
      '#10b981',
    );
    await ensureLoginPage();
    await setHud('🔑 Signing in as Landlord Victoria Sterling', '#10b981');
    await page.getByPlaceholder('Enter your email').fill(landlordEmail1);
    await page.getByPlaceholder('Enter your password').fill(PW);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForTimeout(2000);

    // Tour Landlord Settings & Tabs
    await setHud('⚙️ Landlord Settings: Profile, Bank Details & Setup Progress', '#10b981');
    await page.goto(`${BASE}/dashboard/settings`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    const setupTab = page.locator('button:has-text("Setup Progress")');
    if (await setupTab.isVisible()) {
      await smoothClick(setupTab);
      await page.waitForTimeout(1200);
    }
    const profileTab = page.locator('button:has-text("Profile")');
    if (await profileTab.isVisible()) {
      await smoothClick(profileTab);
      await page.waitForTimeout(1000);
    }

    // Landlord Creates Property "The Grand Azure Residences"
    await setHud('🏗 Step 1/4: Landlord Listing New Property (/properties/new)', '#10b981');
    await page.goto(`${BASE}/dashboard/properties/new`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1200);

    // Select Property Type
    const aptBtn = page.locator('button:has-text("Apartment")').first();
    if (await aptBtn.isVisible()) await smoothClick(aptBtn);

    const propAddr = page
      .locator('input[placeholder*="Block 15"], input[placeholder*="Address"]')
      .first();
    if (await propAddr.isVisible()) {
      await humanType(propAddr, 'Plot 14B Admiralty Way, Lekki Phase 1');
    }

    const propCity = page
      .locator('input[placeholder*="Lagos"], input[placeholder*="City"]')
      .first();
    if (await propCity.isVisible()) {
      await humanType(propCity, 'Lagos');
    }

    const propState = page.locator('select').first();
    if (await propState.isVisible()) {
      await propState.selectOption('Lagos');
    }

    await smoothScroll(300);
    const nextStep1 = page.locator('button:has-text("Next Step")');
    if (await nextStep1.isVisible()) {
      await smoothClick(nextStep1);
      await page.waitForTimeout(1200);
    }

    // Step 2: Multi-Unit setup & Amenities
    await setHud('🏢 Step 2/4: Unit Breakdown, Rent Pricing & Amenities', '#10b981');
    const unitInput = page.locator('input[placeholder*="3B"]').first();
    if (await unitInput.isVisible()) await humanType(unitInput, 'Suite 4A');

    const rentInput = page.locator('input[placeholder*="850000"]').first();
    if (await rentInput.isVisible()) await humanType(rentInput, '4500000');

    await smoothScroll(350);
    const pwrBtn = page.locator('button:has-text("24/7 Power Supply")');
    if (await pwrBtn.isVisible()) await smoothClick(pwrBtn);
    const secBtn = page.locator('button:has-text("Security/CCTV")');
    if (await secBtn.isVisible()) await smoothClick(secBtn);
    const gymBtn = page.locator('button:has-text("Gym")');
    if (await gymBtn.isVisible()) await smoothClick(gymBtn);

    await smoothScroll(400);
    const nextStep2 = page.locator('button:has-text("Next Step")');
    if (await nextStep2.isVisible()) {
      await smoothClick(nextStep2);
      await page.waitForTimeout(1200);
    }

    // Step 3: Media Upload Guidelines
    await setHud('📸 Step 3/4: Media Guidelines & Photo Quality Verification', '#10b981');
    await smoothScroll(400);
    await page.waitForTimeout(1000);
    const nextStep3 = page.locator('button:has-text("Next Step")');
    if (await nextStep3.isVisible()) {
      await smoothClick(nextStep3);
      await page.waitForTimeout(1200);
    }

    // Step 4: Review & Submit
    await setHud('🚀 Step 4/4: Listing Audit & Submitting for Verification', '#10b981');
    await smoothScroll(400);
    await page.waitForTimeout(1000);
    const submitBtn = page
      .locator('button:has-text("Submit for Verification"), button:has-text("Submit Property")')
      .first();
    if (await submitBtn.isVisible()) {
      await smoothClick(submitBtn);
      await page.waitForTimeout(2500);
    }

    // Landlord inspects portfolio list (Cards / Table view)
    await setHud('📂 Landlord Portfolio: Modern Cards & Sticky Filter View', '#10b981');
    await page.goto(`${BASE}/dashboard/properties`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    await logout();

    // =========================================================================
    // ACT 4: MANAGER SELF-REGISTRATION & ONBOARDING
    // =========================================================================
    console.log('--- Act 4: Manager Self-Registration ---');
    recordChapter('👔', 'Act 4: Property Manager Self-Registration & Onboarding', '#3b82f6');
    await page.goto(`${BASE}/register?role=manager`);
    await page.waitForLoadState('networkidle');
    await setHud('👔 Manager Self-Registration: Marcus Vance (/register)', '#3b82f6');
    await page.waitForTimeout(1200);

    const mFirst = page.locator('input[placeholder="First name"]');
    if (await mFirst.isVisible()) await humanType(mFirst, 'Marcus');
    const mLast = page.locator('input[placeholder="Last name"]');
    if (await mLast.isVisible()) await humanType(mLast, 'Vance');
    const mEmail = page.locator('input[placeholder="you@example.com"]');
    if (await mEmail.isVisible()) await humanType(mEmail, managerEmail);
    const mPhone = page.locator('input[placeholder="+234 803 000 0000"]');
    if (await mPhone.isVisible()) await humanType(mPhone, '+234 803 777 8899');

    const mState = page.locator('select');
    if (await mState.isVisible()) await mState.selectOption('Lagos');

    await smoothScroll(250);
    const mPw = page.locator('input[type="password"]').first();
    if (await mPw.isVisible()) await humanType(mPw, PW);
    const mPwConfirm = page.locator('input[type="password"]').nth(1);
    if (await mPwConfirm.isVisible()) await humanType(mPwConfirm, PW);

    const mTerms = page.locator('input[type="checkbox"]').first();
    if (await mTerms.isVisible()) await smoothClick(mTerms);
    const mSubmit = page.locator('button:has-text("Create Account")');
    if (await mSubmit.isVisible()) await smoothClick(mSubmit);
    await page.waitForTimeout(2500);

    const mToken = await fetchVerificationToken(managerEmail);
    await activateAccountWithToken(mToken);

    // =========================================================================
    // ACT 5: MANAGER LOGIN & PORTFOLIO EXPLORATION
    // =========================================================================
    console.log('--- Act 5: Manager Login & Portfolio Exploration ---');
    recordChapter('👔', 'Act 5: Property Manager Portal & Operational Overview', '#3b82f6');
    await ensureLoginPage();
    await setHud('🔑 Signing in as Property Manager Marcus Vance', '#3b82f6');
    await page.getByPlaceholder('Enter your email').fill(managerEmail);
    await page.getByPlaceholder('Enter your password').fill(PW);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForTimeout(2000);

    await setHud('📊 Property Manager Dashboard & Portfolio Controls', '#3b82f6');
    await page.goto(`${BASE}/dashboard`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await smoothScroll(300);
    await page.waitForTimeout(1000);

    await logout();

    // =========================================================================
    // ACT 6: SUPER ADMIN PROPERTY MODERATION & APPROVAL
    // =========================================================================
    console.log('--- Act 6: Admin Review & Moderation ---');
    recordChapter('🛡', 'Act 6: Super Admin Review, Compliance Audit & Approval', '#a78bfa');
    await ensureLoginPage();
    await setHud('🛡 Super Admin Reviewing Moderation Queue (/admin)', '#a78bfa');
    await page.getByPlaceholder('Enter your email').fill('admin@proplity.com');
    await page.getByPlaceholder('Enter your password').fill(PW);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForTimeout(2000);

    await page.goto(`${BASE}/admin/properties`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // Showcase Cards view and Table view toggle
    await setHud('🔲 Switching View Modes: Cards vs. Table Directory', '#a78bfa');
    const tableBtn = page.locator('button[title="Switch to Table view"]');
    if (await tableBtn.isVisible()) {
      await smoothClick(tableBtn);
      await page.waitForTimeout(1200);
    }
    const cardsBtn = page.locator('button[title="Switch to Card view"]');
    if (await cardsBtn.isVisible()) {
      await smoothClick(cardsBtn);
      await page.waitForTimeout(1200);
    }

    // Sticky toolbar demonstration on scroll
    await setHud('📌 Sticky Compact Filter Toolbar Remains Pinned on Scroll', '#a78bfa');
    await smoothScroll(300);
    await page.waitForTimeout(1000);
    await smoothScroll(-300);
    await page.waitForTimeout(800);

    // Open Slide-Over Review Drawer
    await setHud('📋 Opening Slide-Over Review Drawer for "The Grand Azure Residences"', '#a78bfa');
    const reviewBtn = page.locator('button:has-text("Review"), button:has-text("View")').first();
    if (await reviewBtn.isVisible()) {
      await smoothClick(reviewBtn);
      await page.waitForTimeout(1800);

      // Inspect Landlord info & Units inside Drawer
      await setHud('🔍 Review Drawer: Landlord & Manager Contacts, Units & Audit Trail', '#a78bfa');
      const drawerScroll = page.locator(
        'aside[aria-label="Property Review Drawer"] div.overflow-y-auto',
      );
      if (await drawerScroll.isVisible()) {
        await drawerScroll.evaluate((el) => el.scrollBy({ top: 250, behavior: 'smooth' }));
        await page.waitForTimeout(1200);
      }

      // Approve listing in Drawer
      const approveBtn = page
        .locator('aside button:has-text("Approve Listing"), button:has-text("Approve Listing")')
        .first();
      if (await approveBtn.isVisible()) {
        await setHud('✅ Super Admin Approves Property in Review Drawer', '#10b981');
        await smoothClick(approveBtn);
        await page.waitForTimeout(2000);
      }

      // Re-open or toggle publish if drawer closed on approval
      const publishBtn = page
        .locator(
          'aside button:has-text("Publish Listing"), button:has-text("Publish Listing"), button:has-text("Publish")',
        )
        .first();
      if (await publishBtn.isVisible()) {
        await setHud('🌐 Publishing Listing for Public Discovery', '#10b981');
        await smoothClick(publishBtn);
        await page.waitForTimeout(1800);
      }

      const closeDrawerBtn = page
        .locator('button[aria-label="Close review popup"], aside button:has-text("Close")')
        .first();
      if (await closeDrawerBtn.isVisible()) {
        await smoothClick(closeDrawerBtn);
        await page.waitForTimeout(1000);
      }
    }

    await logout();

    // =========================================================================
    // ACT 7: TENANT SELF-REGISTRATION & MARKETPLACE DISCOVERY
    // =========================================================================
    console.log('--- Act 7: Tenant Registration & Marketplace ---');
    recordChapter('🏠', 'Act 7: Tenant Self-Registration & Marketplace Discovery', '#3b82f6');
    await page.goto(`${BASE}/register?role=tenant`);
    await page.waitForLoadState('networkidle');
    await setHud('🏠 Tenant Self-Registration: Sophia Chen (/register)', '#3b82f6');
    await page.waitForTimeout(1200);

    const tFirst = page.locator('input[placeholder="First name"]');
    if (await tFirst.isVisible()) await humanType(tFirst, 'Sophia');
    const tLast = page.locator('input[placeholder="Last name"]');
    if (await tLast.isVisible()) await humanType(tLast, 'Chen');
    const tEmail = page.locator('input[placeholder="you@example.com"]');
    if (await tEmail.isVisible()) await humanType(tEmail, tenantEmail);
    const tPhone = page.locator('input[placeholder="+234 803 000 0000"]');
    if (await tPhone.isVisible()) await humanType(tPhone, '+234 805 123 9988');

    const tState = page.locator('select');
    if (await tState.isVisible()) await tState.selectOption('Lagos');

    await smoothScroll(250);
    const tPw = page.locator('input[type="password"]').first();
    if (await tPw.isVisible()) await humanType(tPw, PW);
    const tPwConfirm = page.locator('input[type="password"]').nth(1);
    if (await tPwConfirm.isVisible()) await humanType(tPwConfirm, PW);

    const tTerms = page.locator('input[type="checkbox"]').first();
    if (await tTerms.isVisible()) await smoothClick(tTerms);
    const tSubmit = page.locator('button:has-text("Create Account")');
    if (await tSubmit.isVisible()) await smoothClick(tSubmit);
    await page.waitForTimeout(2500);

    const tToken = await fetchVerificationToken(tenantEmail);
    await activateAccountWithToken(tToken);

    // Tenant Login & Discover
    await ensureLoginPage();
    await setHud('🔑 Sophia Chen Signs In to Explore Public Marketplace', '#3b82f6');
    await page.getByPlaceholder('Enter your email').fill(tenantEmail);
    await page.getByPlaceholder('Enter your password').fill(PW);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForTimeout(2000);

    await setHud('🔍 Browsing Public Marketplace Listings (/dashboard/discover)', '#3b82f6');
    await page.goto(`${BASE}/dashboard/discover`);
    await page.waitForLoadState('networkidle');
    await smoothScroll(400);
    await page.waitForTimeout(1800);

    await logout();

    // =========================================================================
    // ACT 8: 2-WAY REAL-TIME MESSAGING
    // =========================================================================
    console.log('--- Act 8: 2-Way Messaging ---');
    recordChapter('💬', 'Act 8: Real-Time 2-Way Chat between Tenant & Manager', '#8b5cf6');

    // Tenant sends message
    await ensureLoginPage();
    await setHud('💬 Tenant Initiates Direct Message (/dashboard/messages)', '#8b5cf6');
    await page.getByPlaceholder('Enter your email').fill('tenant@proplity.com');
    await page.getByPlaceholder('Enter your password').fill(PW);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForTimeout(2000);

    await page.goto(`${BASE}/dashboard/messages`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    const msgInput = page
      .locator('input[placeholder*="Type a message"], textarea[placeholder*="Type a message"]')
      .first();
    if (await msgInput.isVisible()) {
      await humanType(msgInput, 'Hello Marcus! Confirming move-in arrangements and key pickup.');
      const sendBtn = page
        .locator('button:has-text("Send"), button[aria-label="Send message"]')
        .first();
      if (await sendBtn.isVisible()) await smoothClick(sendBtn);
      await page.waitForTimeout(1500);
    }

    await logout();

    // Manager replies
    await ensureLoginPage();
    await setHud('👔 Manager Marcus Vance Replies to Message Thread', '#3b82f6');
    await page.getByPlaceholder('Enter your email').fill('manager@proplity.com');
    await page.getByPlaceholder('Enter your password').fill(PW);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForTimeout(2000);

    await page.goto(`${BASE}/dashboard/messages`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    const managerMsgInput = page
      .locator('input[placeholder*="Type a message"], textarea[placeholder*="Type a message"]')
      .first();
    if (await managerMsgInput.isVisible()) {
      await humanType(
        managerMsgInput,
        'Hi Sophia! All set. The concierge has your welcome package ready.',
      );
      const sendBtn = page
        .locator('button:has-text("Send"), button[aria-label="Send message"]')
        .first();
      if (await sendBtn.isVisible()) await smoothClick(sendBtn);
      await page.waitForTimeout(1500);
    }

    await logout();

    // =========================================================================
    // ACT 9: MAINTENANCE TICKET, VENDOR DISPATCH & STAR RATING
    // =========================================================================
    console.log('--- Act 9: Maintenance Lifecycle ---');
    recordChapter('🔧', 'Act 9: Maintenance Ticket, Vendor Dispatch & 5-Star Rating', '#ef4444');

    // Tenant creates ticket
    await ensureLoginPage();
    await setHud(
      '🔧 Tenant Submits Maintenance Request (/dashboard/maintenance-request/new)',
      '#ef4444',
    );
    await page.getByPlaceholder('Enter your email').fill('tenant@proplity.com');
    await page.getByPlaceholder('Enter your password').fill(PW);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForTimeout(2000);

    await page.goto(`${BASE}/dashboard/maintenance-request/new`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1200);

    const maintTitle = page
      .locator('input[placeholder*="title"], input[placeholder*="brief"]')
      .first();
    if (await maintTitle.isVisible()) {
      await humanType(maintTitle, 'Kitchen Sink Pipe Pressure Drop');
    }

    const maintDesc = page.locator('textarea').first();
    if (await maintDesc.isVisible()) {
      await humanType(
        maintDesc,
        'Water pressure has decreased in kitchen faucet and requires plumber inspection.',
      );
    }

    const maintSubmit = page.locator('button:has-text("Submit"), button[type="submit"]').first();
    if (await maintSubmit.isVisible()) {
      await smoothClick(maintSubmit);
      await page.waitForTimeout(1500);
    }

    await logout();

    // Vendor Console
    await ensureLoginPage();
    await setHud('⚡ Certified Vendor Console (AquaFix Plumbing)', '#ef4444');
    await page.getByPlaceholder('Enter your email').fill('vendor@proplity.com');
    await page.getByPlaceholder('Enter your password').fill(PW);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForTimeout(2000);

    await smoothScroll(400);
    await page.waitForTimeout(1500);
    await logout();

    // =========================================================================
    // ACT 10: RENT INVOICE, PAYMENT & AUTOPAY
    // =========================================================================
    console.log('--- Act 10: Financials & Rent Checkout ---');
    recordChapter('💳', 'Act 10: Rent Invoicing, Payment History & Autopay', '#10b981');
    await ensureLoginPage();
    await setHud('💳 Tenant Portal: Rent Invoices, Payment History & Autopay', '#10b981');
    await page.getByPlaceholder('Enter your email').fill('tenant@proplity.com');
    await page.getByPlaceholder('Enter your password').fill(PW);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForTimeout(2000);

    await page.goto(`${BASE}/dashboard/payment-history`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await smoothScroll(300);
    await page.waitForTimeout(1200);

    await logout();

    // =========================================================================
    // ACT 11: SUPER ADMIN GOVERNANCE, AUDIT LOGS & SETTINGS
    // =========================================================================
    console.log('--- Act 11: Super Admin Governance ---');
    recordChapter(
      '🏛',
      'Act 11: Super Admin Governance, Audit Trail & Fixed Sidebar Avatar',
      '#8b5cf6',
    );
    await ensureLoginPage();
    await setHud('🏛 Super Admin System Overview: Metrics, Analytics & Revenue', '#8b5cf6');
    await page.getByPlaceholder('Enter your email').fill('admin@proplity.com');
    await page.getByPlaceholder('Enter your password').fill(PW);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForTimeout(2000);

    // Tour Admin Users
    await setHud('👥 Admin User Management: Directory & Role Filters (/admin/users)', '#8b5cf6');
    await page.goto(`${BASE}/admin/users`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // Switch between Cards and Table view on Admin Users
    await setHud('🔲 User Management: Modern Cards View with Active Properties Count', '#8b5cf6');
    const userTableBtn = page.locator('button[title="Switch to Table view"]');
    if (await userTableBtn.isVisible()) {
      await smoothClick(userTableBtn);
      await page.waitForTimeout(1200);
    }
    const userCardsBtn = page.locator('button[title="Switch to Card view"]');
    if (await userCardsBtn.isVisible()) {
      await smoothClick(userCardsBtn);
      await page.waitForTimeout(1200);
    }

    // Scroll to demonstrate sticky compact toolbar
    await setHud('📌 Sticky Compact Filter Toolbar Remains Visible on Vertical Scroll', '#8b5cf6');
    await smoothScroll(350);
    await page.waitForTimeout(1200);
    await smoothScroll(-350);
    await page.waitForTimeout(800);

    // Tour Admin Security & Audit Logs
    await setHud('🔒 Security & Audit Logs: Real-time Event Tracking (/admin/security)', '#8b5cf6');
    await page.goto(`${BASE}/admin/security`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await smoothScroll(400);
    await page.waitForTimeout(1200);

    // Test the newly created Fixed Bottom Avatar & Menu in Sidebar
    await setHud('✨ Pinned Bottom Sidebar Avatar & Interactive Options Popover', '#3b82f6');
    const sidebarAvatar = page.locator('aside button[aria-label="Account options"]');
    if (await sidebarAvatar.isVisible()) {
      await smoothClick(sidebarAvatar);
      await page.waitForTimeout(1200);
      const settingsOption = page.locator('aside div[role="menu"] a:has-text("Settings")');
      if (await settingsOption.isVisible()) {
        await smoothClick(settingsOption);
        await page.waitForTimeout(1500);
      }
    }

    // Verify top navbar role display
    await setHud('🌟 Top Navbar Display: User Name + Capitalized Role Subtitle', '#10b981');
    await smoothMove(1250, 40);
    await page.waitForTimeout(2000);

    // Final Victory Hold
    await setHud('🎉 Proplity Live Master Walkthrough Complete (100% Feature Coverage)', '#10b981');
    await page.waitForTimeout(3500);
  } catch (err) {
    console.error('Recording step error:', err);
  } finally {
    console.log('Closing browser and finalizing video...');
    await page.waitForTimeout(1500);
    await context.close();
    await browser.close();
  }

  // Find generated video in VIDEO_DIR
  console.log('Finding video in', VIDEO_DIR);
  const files = readdirSync(VIDEO_DIR).filter((f) => f.endsWith('.webm'));
  if (files.length > 0) {
    const latestVideo = files.sort((a, b) => {
      return statSync(resolve(VIDEO_DIR, b)).mtimeMs - statSync(resolve(VIDEO_DIR, a)).mtimeMs;
    })[0];
    const srcPath = resolve(VIDEO_DIR, latestVideo);
    const destPath = resolve(OUT_VIDEO_DIR, 'proplity-complete-userflow.webm');
    copyFileSync(srcPath, destPath);
    const sizeMb = Math.round(statSync(destPath).size / 1024 / 1024);
    console.log(`✅ Video saved directly to out/video: ${destPath} (${sizeMb}MB)`);

    // Update the interactive HTML video players
    const totalSec = Math.floor((Date.now() - recStartTime) / 1000);
    const totalMins = Math.floor(totalSec / 60);
    const remSecs = totalSec % 60;
    const totalDurStr = `${totalMins}:${String(remSecs).padStart(2, '0')}`;

    function updatePlayerFile(filePath) {
      try {
        let html = readFileSync(filePath, 'utf-8');
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

  console.log('Chapters recorded:', chapters);
}

main().catch(console.error);
