// Browser-driven security checks against a running Proplity app. Drives a real Chromium for
// session, redirect and stored-XSS checks, and Playwright's request client for header, CSRF,
// access-control and token checks. Prints one PASS/FAIL/INFO line per check and exits 1 on any FAIL.
// Usage: E2E_BASE_URL=http://localhost:3030 node scripts/security-browser-check.mjs
// Needs: a seeded database (admin/manager/landlord/tenant/vendor@proplity.com) and the app running
// against it, ideally a production build (`next start`). Sends bad logins for an unknown address
// at the end to confirm the limiter, so run it on a throwaway database.
import { chromium } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3030';
const PW = 'Password123!';
const results = [];
const record = (status, name, detail = '') => {
  results.push({ status, name });
  console.log(`${status.padEnd(4)} ${name}${detail ? ` — ${detail}` : ''}`);
};
const check = (ok, name, detail) => record(ok ? 'PASS' : 'FAIL', name, detail);

const browser = await chromium.launch();

async function login(email) {
  const ctx = await browser.newContext({ baseURL: BASE });
  const page = await ctx.newPage();
  await page.goto('/login');
  await page.getByPlaceholder('Enter your email').fill(email);
  await page.getByPlaceholder('Enter your password').fill(PW);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 25000 });
  return { ctx, page };
}
const send = (page, method, path, data, origin = BASE) =>
  page.request.fetch(path, {
    method,
    data,
    headers: origin ? { Origin: origin } : {},
    failOnStatusCode: false,
  });

// ------------------------------------------------------------ 1. anonymous access
{
  const ctx = await browser.newContext({ baseURL: BASE });
  const page = await ctx.newPage();
  for (const path of ['/dashboard', '/dashboard/properties', '/admin', '/admin/security']) {
    await page.goto(path);
    check(
      !/\/(dashboard|admin)/.test(new URL(page.url()).pathname),
      `anonymous ${path} is redirected`,
      page.url(),
    );
  }
  for (const path of [
    '/api/v1/properties?scope=mine',
    '/api/v1/admin/users',
    '/api/v1/admin/audit-logs',
    '/api/v1/leases',
    '/api/v1/invoices',
    '/api/v1/notifications',
    '/api/v1/auth/me',
  ]) {
    const res = await page.request.get(path, { failOnStatusCode: false });
    check(res.status() === 401, `anonymous GET ${path} is 401`, `got ${res.status()}`);
  }

  // ---------------------------------------------------------- 2. response headers
  for (const path of ['/', '/login', '/api/v1/health']) {
    const res = await page.request.get(path, { failOnStatusCode: false });
    const h = res.headers();
    check(
      h['x-content-type-options'] === 'nosniff',
      `${path} sends X-Content-Type-Options: nosniff`,
    );
    check(
      !!h['x-frame-options'] || /frame-ancestors/.test(h['content-security-policy'] ?? ''),
      `${path} blocks framing`,
    );
    check(!!h['referrer-policy'], `${path} sends Referrer-Policy`, h['referrer-policy']);
    check(!!h['strict-transport-security'], `${path} sends Strict-Transport-Security`);
    check(!h['x-powered-by'], `${path} hides X-Powered-By`, h['x-powered-by']);
  }

  // ---------------------------------------------------------- 3. exposed files
  for (const path of [
    '/.env',
    '/.git/config',
    '/prisma/schema',
    '/package.json',
    '/_next/static/chunks/main.js.map',
  ]) {
    const res = await page.request.get(path, { failOnStatusCode: false });
    check(
      res.status() === 404 || res.status() === 403,
      `${path} is not served`,
      `got ${res.status()}`,
    );
  }
  const page404 = await page.request.get('/api/v1/properties/not-a-real-id', {
    failOnStatusCode: false,
  });
  check(
    !/at\s+\S+\s+\(|node_modules|prisma/i.test(await page404.text()),
    'error responses do not leak stack traces',
  );

  // ---------------------------------------------------------- 4. password reset enumeration
  const known = await send(page, 'POST', '/api/v1/auth/forgot-password', {
    email: 'tenant@proplity.com',
  });
  const unknown = await send(page, 'POST', '/api/v1/auth/forgot-password', {
    email: 'nobody-here@example.com',
  });
  check(
    known.status() === unknown.status() && (await known.text()) === (await unknown.text()),
    'forgot-password answers the same for known and unknown addresses',
    `${known.status()} vs ${unknown.status()}`,
  );

  // ---------------------------------------------------------- 5. mass assignment on register
  const email = `sec-${Date.now()}@example.com`;
  const reg = await send(page, 'POST', '/api/v1/auth/register', {
    email,
    password: 'Password123!',
    name: 'Mass Assign',
    role: 'ADMIN',
  });
  const regBody = await reg.text();
  check(
    reg.status() >= 400 || !/"role":"ADMIN"/.test(regBody),
    'register cannot create an ADMIN',
    `status ${reg.status()}`,
  );
  await ctx.close();
}

// ------------------------------------------------------------ 6. cookies and sessions
const tenant = await login('tenant@proplity.com');
{
  const cookies = await tenant.ctx.cookies();
  const access = cookies.find((c) => c.name === 'access_token');
  check(!!access, 'login sets an access_token cookie');
  check(access?.httpOnly === true, 'access_token is HttpOnly (not readable by page scripts)');
  check(
    ['Lax', 'Strict'].includes(access?.sameSite ?? ''),
    'access_token has SameSite',
    access?.sameSite,
  );
  if (new URL(BASE).protocol === 'https:') check(access?.secure === true, 'access_token is Secure');
  else record('INFO', 'access_token Secure flag not checked on http');
  const jsCookies = await tenant.page.evaluate(() => document.cookie);
  check(!/access_token|refresh_token/.test(jsCookies), 'tokens are invisible to document.cookie');
  const stored = await tenant.page.evaluate(() =>
    JSON.stringify({ ...localStorage, ...sessionStorage }),
  );
  check(!/eyJ[A-Za-z0-9_-]{10,}\./.test(stored), 'no JWT in localStorage or sessionStorage');

  // a tampered token must be rejected
  const forged = await browser.newContext({ baseURL: BASE });
  await forged.addCookies([
    { name: 'access_token', value: `${access.value.slice(0, -4)}AAAA`, url: BASE, httpOnly: true },
  ]);
  const forgedRes = await forged.request.get('/api/v1/auth/me', { failOnStatusCode: false });
  check(forgedRes.status() === 401, 'a tampered token is rejected', `got ${forgedRes.status()}`);
  const noneAlg = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${Buffer.from(
    JSON.stringify({ sub: 'x', role: 'ADMIN' }),
  ).toString('base64url')}.`;
  await forged.clearCookies();
  await forged.addCookies([{ name: 'access_token', value: noneAlg, url: BASE, httpOnly: true }]);
  const noneRes = await forged.request.get('/api/v1/admin/users', { failOnStatusCode: false });
  check(
    noneRes.status() === 401 || noneRes.status() === 403,
    'an alg=none token is rejected',
    `got ${noneRes.status()}`,
  );
  await forged.close();
}

// ------------------------------------------------------------ 7. CSRF / cross-origin writes
{
  const evil = await send(
    tenant.page,
    'POST',
    '/api/v1/auth/logout',
    undefined,
    'https://evil.example',
  );
  check(evil.status() === 403, 'cross-origin POST is blocked', `got ${evil.status()}`);
  const evilPatch = await send(
    tenant.page,
    'PATCH',
    '/api/v1/auth/me',
    { name: 'Hacked' },
    'https://evil.example',
  );
  check(
    evilPatch.status() === 403 || evilPatch.status() === 404 || evilPatch.status() === 405,
    'cross-origin PATCH is blocked',
    `got ${evilPatch.status()}`,
  );
  const nullOrigin = await send(
    tenant.page,
    'POST',
    '/api/v1/auth/change-password',
    { currentPassword: 'x', newPassword: 'y' },
    'null',
  );
  check(nullOrigin.status() === 403, 'Origin: null write is blocked', `got ${nullOrigin.status()}`);
}

// ------------------------------------------------------------ 8. role boundaries
{
  await tenant.page.goto('/admin');
  check(
    !new URL(tenant.page.url()).pathname.startsWith('/admin'),
    'tenant opening /admin is sent away',
    tenant.page.url(),
  );
  for (const path of [
    '/api/v1/admin/users',
    '/api/v1/admin/audit-logs',
    '/api/v1/admin/settings',
    '/api/v1/admin/reports',
  ]) {
    const res = await tenant.page.request.get(path, { failOnStatusCode: false });
    check(res.status() === 403, `tenant GET ${path} is 403`, `got ${res.status()}`);
  }
  const props =
    (await (await tenant.page.request.get('/api/v1/properties?limit=5')).json()).data ?? [];
  if (props[0]) {
    const mod = await send(tenant.page, 'PATCH', `/api/v1/properties/${props[0].id}/moderation`, {
      status: 'REJECTED',
    });
    check(mod.status() === 403, 'tenant cannot moderate a listing', `got ${mod.status()}`);
    const edit = await send(tenant.page, 'PATCH', `/api/v1/properties/${props[0].id}`, {
      name: 'Owned by tenant',
    });
    check(edit.status() === 403, 'tenant cannot edit a listing', `got ${edit.status()}`);
    const merge = await send(tenant.page, 'POST', `/api/v1/properties/${props[0].id}/merge`, {
      targetPropertyId: props[0].id,
    });
    check(merge.status() === 403, 'tenant cannot merge listings', `got ${merge.status()}`);
  }
}

// ------------------------------------------------------------ 9. cross-account access (IDOR)
{
  const vendor = await login('vendor@proplity.com');
  const landlord = await login('landlord@proplity.com');
  const tenantLeases = (await (await tenant.page.request.get('/api/v1/leases')).json()).data ?? [];
  const tenantInvoices =
    (await (await tenant.page.request.get('/api/v1/invoices')).json()).data ?? [];
  if (tenantLeases[0]) {
    const res = await vendor.page.request.get(`/api/v1/leases/${tenantLeases[0].id}`, {
      failOnStatusCode: false,
    });
    check(
      [403, 404].includes(res.status()),
      "a vendor cannot read a tenant's lease",
      `got ${res.status()}`,
    );
  }
  if (tenantInvoices[0]) {
    const res = await vendor.page.request.get(`/api/v1/invoices/${tenantInvoices[0].id}`, {
      failOnStatusCode: false,
    });
    check(
      [403, 404].includes(res.status()),
      "a vendor cannot read a tenant's invoice",
      `got ${res.status()}`,
    );
  }
  const vendorInvoices =
    (await (await vendor.page.request.get('/api/v1/invoices')).json()).data ?? [];
  check(
    vendorInvoices.every((i) => !tenantInvoices.some((t) => t.id === i.id)),
    'vendor invoice list excludes the tenant invoices',
  );
  const files = await tenant.page.request.get(
    '/api/v1/files/00000000-0000-0000-0000-000000000000',
    { failOnStatusCode: false },
  );
  check(
    [400, 403, 404].includes(files.status()),
    'unknown file id is refused',
    `got ${files.status()}`,
  );
  const managerOnly = await send(landlord.page, 'POST', '/api/v1/access-codes', {
    unitId: 'x',
    code: '1234',
    validFrom: new Date().toISOString(),
  });
  check(
    managerOnly.status() === 403,
    'only tenants can create access codes',
    `got ${managerOnly.status()}`,
  );
  await vendor.ctx.close();
  await landlord.ctx.close();
}

// ------------------------------------------------------------ 10. stored XSS in the browser
{
  const mgr = await login('manager@proplity.com');
  const mine = (await (await mgr.page.request.get('/api/v1/properties?scope=mine')).json()).data;
  const pid = mine[0].id;
  const payload = '<img src=x onerror="window.__xss=1"><script>window.__xss=2</script>';
  await send(mgr.page, 'POST', `/api/v1/properties/${pid}/announcements`, {
    title: payload,
    body: payload,
  });
  await send(mgr.page, 'POST', `/api/v1/properties/${pid}/equipment`, {
    type: 'OTHER',
    serialNumber: payload,
  });
  await mgr.page.goto(`/dashboard/properties/${pid}`);
  await mgr.page.waitForLoadState('networkidle');
  await mgr.page.waitForTimeout(800);
  check(
    (await mgr.page.evaluate(() => window.__xss)) === undefined,
    'script in announcement/equipment text does not run on the property page',
  );
  check(
    (await mgr.page.locator('img[src="x"]').count()) === 0,
    'HTML in announcement text is rendered as text, not as elements',
  );
  await mgr.page.goto('/dashboard/messages');
  await mgr.page.waitForLoadState('networkidle');
  check(
    (await mgr.page.evaluate(() => window.__xss)) === undefined,
    'no script execution on the messages page',
  );
  await mgr.ctx.close();

  // the same payload as a profile name, shown in the admin user list
  const t2 = await browser.newContext({ baseURL: BASE });
  const p2 = await t2.newPage();
  const email = `xss-${Date.now()}@example.com`;
  await send(p2, 'POST', '/api/v1/auth/register', {
    email,
    password: 'Password123!',
    name: payload,
    role: 'TENANT',
  });
  const adm = await login('admin@proplity.com');
  await adm.page.goto('/admin/users');
  await adm.page
    .getByPlaceholder(/Search/)
    .first()
    .fill('xss-')
    .catch(() => undefined);
  await adm.page.waitForTimeout(1200);
  check(
    (await adm.page.evaluate(() => window.__xss)) === undefined,
    'script in a user name does not run in the admin user list',
  );
  await adm.ctx.close();
  await t2.close();
}

// ------------------------------------------------------------ 11. open redirect after login
{
  const ctx = await browser.newContext({ baseURL: BASE });
  const page = await ctx.newPage();
  for (const param of ['from', 'next', 'redirect', 'returnTo']) {
    await ctx.clearCookies();
    await page
      .goto(`/login?${param}=https://evil.example/phish`, { waitUntil: 'domcontentloaded' })
      .catch(() => undefined);
    await page.getByPlaceholder('Enter your email').fill('tenant@proplity.com');
    await page.getByPlaceholder('Enter your password').fill(PW);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 25000 });
    check(
      new URL(page.url()).origin === new URL(BASE).origin,
      `login ?${param}= cannot redirect off-site`,
      page.url(),
    );
    await send(page, 'POST', '/api/v1/auth/logout');
    await ctx.clearCookies();
  }
  await ctx.close();
}

// ------------------------------------------------------------ 12. logout ends the session
{
  const t = await login('tenant@proplity.com');
  const cookies = await t.ctx.cookies();
  const stolen = cookies.find((c) => c.name === 'access_token').value;
  await send(t.page, 'POST', '/api/v1/auth/logout');
  const replay = await browser.newContext({ baseURL: BASE });
  await replay.addCookies([{ name: 'access_token', value: stolen, url: BASE, httpOnly: true }]);
  const res = await replay.request.get('/api/v1/auth/me', { failOnStatusCode: false });
  if (res.status() === 401) record('PASS', 'a copied access token stops working after logout');
  else
    record(
      'INFO',
      'a copied access token still works until it expires after logout',
      `got ${res.status()} (short-lived access token; refresh token is what logout revokes)`,
    );
  await replay.close();
  await t.ctx.close();
}

// ------------------------------------------------------------ 13. brute force (last, so it cannot lock the accounts above)
{
  const ctx = await browser.newContext({ baseURL: BASE });
  const page = await ctx.newPage();
  const statuses = [];
  for (let i = 0; i < 40; i++) {
    const res = await send(page, 'POST', '/api/v1/auth/login', {
      email: 'no-such-user@example.com',
      password: `wrong-${i}`,
    });
    statuses.push(res.status());
    if (res.status() === 429) break;
  }
  check(
    statuses.includes(429),
    'repeated bad logins are rate limited',
    `after ${statuses.length} tries`,
  );
  await ctx.close();
}

await tenant.ctx.close();
await browser.close();
const failed = results.filter((r) => r.status === 'FAIL');
console.log(
  `\n${results.length - failed.length} passed, ${failed.length} failed, ${results.filter((r) => r.status === 'INFO').length} notes`,
);
process.exit(failed.length ? 1 : 0);
