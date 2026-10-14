// Visits the main pages of every role at phone width and reports pages that
// scroll sideways or have content poking out of the viewport.
// Usage: E2E_BASE_URL=http://localhost:3022 node scripts/audit-mobile-layout.mjs [outDir]
// Needs a seeded database (prisma/seed.ts + seed2.ts) and the app running on it.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3022';
const OUT = process.argv[2] || '/tmp/mobile-audit';
mkdirSync(OUT, { recursive: true });
const PW = 'Password123!';
const IDS = JSON.parse(process.env.AUDIT_IDS || '{}'); // { propertyId, leaseId, requestId }

const ROLES = {
  tenant: {
    email: 'tenant@proplity.com',
    home: '/dashboard',
    routes: [
      '/dashboard',
      '/dashboard/payment-history',
      '/dashboard/tenant-maintenance',
      '/dashboard/maintenance-request/new',
      '/dashboard/messages',
      '/dashboard/notifications',
      '/dashboard/rentals',
      '/dashboard/discover',
      '/dashboard/settings',
    ],
  },
  manager: {
    email: 'manager@proplity.com',
    home: '/dashboard',
    routes: [
      '/dashboard',
      '/dashboard/properties',
      '/dashboard/properties/new',
      '/dashboard/tenants',
      '/dashboard/tenants/add',
      '/dashboard/maintenance',
      '/dashboard/messages',
      '/dashboard/notifications',
      '/dashboard/settings',
      '/dashboard/breakdown/properties',
      '/dashboard/breakdown/tenants',
      '/dashboard/breakdown/rent',
      '/dashboard/breakdown/maintenance',
      '/dashboard/breakdown/renewals',
      ...(IDS.propertyId ? [`/dashboard/properties/${IDS.propertyId}`] : []),
      ...(IDS.leaseId ? [`/dashboard/tenants/${IDS.leaseId}`] : []),
      ...(IDS.requestId ? [`/dashboard/maintenance/${IDS.requestId}`] : []),
    ],
  },
  landlord: {
    email: 'landlord@proplity.com',
    home: '/dashboard',
    routes: ['/dashboard', '/dashboard/properties', '/dashboard/tenants'],
  },
  vendor: {
    email: 'vendor@proplity.com',
    home: '/dashboard',
    routes: ['/dashboard', '/dashboard/vendor/invoices', '/dashboard/messages'],
  },
  admin: {
    email: 'admin@proplity.com',
    home: '/admin',
    routes: [
      '/admin',
      '/admin/users',
      '/admin/properties',
      '/admin/reports',
      '/admin/security',
      '/admin/settings',
      '/admin/notifications',
      '/admin/breakdown/users',
      '/admin/breakdown/properties',
      '/admin/breakdown/transactions',
      '/admin/breakdown/maintenance',
    ],
  },
};

const browser = await chromium.launch();
const findings = [];

for (const [role, cfg] of Object.entries(ROLES)) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, baseURL: BASE });
  const page = await ctx.newPage();
  await page.goto('/login');
  await page.getByPlaceholder('Enter your email').fill(cfg.email);
  await page.getByPlaceholder('Enter your password').fill(PW);
  await page.getByRole('button', { name: 'Sign In', exact: false }).click();
  await page.waitForURL(`**${cfg.home}**`, { timeout: 20000 });

  for (const route of cfg.routes) {
    try {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(500);
      const res = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const sw = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
        const offenders = [];
        // Content cut off by an overflow:hidden box can never be reached.
        for (const el of document.querySelectorAll('body *')) {
          const cs = getComputedStyle(el);
          if (cs.textOverflow === 'ellipsis') continue; // intentional truncation
          if (
            cs.overflowX === 'hidden' &&
            el.scrollWidth > el.clientWidth + 2 &&
            el.clientWidth > 0
          ) {
            const tag = `${el.tagName.toLowerCase()}${typeof el.className === 'string' && el.className ? '.' + el.className.split(' ').slice(0, 3).join('.') : ''}`;
            offenders.push(`CLIPPED ${tag} (content ${el.scrollWidth} > box ${el.clientWidth})`);
          }
        }
        for (const el of document.querySelectorAll('body *')) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          if (el.closest('aside')) continue; // off-canvas drawer
          if (r.right > vw + 1 || r.left < -1) {
            // ignore anything inside a container that scrolls sideways on purpose
            let p = el.parentElement;
            let scrolls = false;
            while (p && p !== document.body) {
              const ox = getComputedStyle(p).overflowX;
              if (ox === 'auto' || ox === 'scroll') {
                scrolls = true;
                break;
              }
              p = p.parentElement;
            }
            if (!scrolls) {
              const cs = getComputedStyle(el);
              if (cs.position === 'fixed') continue;
              offenders.push(
                `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').slice(0, 3).join('.') : ''} (right=${Math.round(r.right)})`,
              );
            }
          }
        }
        return { vw, sw, offenders: [...new Set(offenders)].slice(0, 8), title: document.title };
      });
      const bad = res.sw > res.vw + 1 || res.offenders.length > 0;
      if (bad) {
        const file = `${OUT}/${role}${route.replace(/\//g, '_')}.png`;
        await page.screenshot({ path: file, fullPage: false });
        findings.push({
          role,
          route,
          scrollWidth: res.sw,
          viewport: res.vw,
          offenders: res.offenders,
          file,
        });
      }
      console.log(
        `${bad ? 'BAD' : 'ok '} ${role} ${route}${bad ? ` (scrollWidth ${res.sw} > ${res.vw})` : ''}`,
      );
    } catch (e) {
      console.log(`ERR ${role} ${route}: ${String(e).split('\n')[0]}`);
    }
  }
  await ctx.close();
}
await browser.close();
console.log('\n=== findings ===');
for (const f of findings) console.log(JSON.stringify(f));
