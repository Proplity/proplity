import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';
import { signAccessToken } from '@/lib/auth/jwt';

function request(url: string, opts: { token?: string } = {}) {
  const u = new URL(url);
  return new NextRequest(u, {
    headers: {
      host: u.host,
      ...(opts.token ? { cookie: `access_token=${opts.token}` } : {}),
    },
  });
}

const location = (res: Response) => res.headers.get('location');
const isNext = (res: Response) => res.headers.get('x-middleware-next') === '1';

describe('proxy: one shared host (no ADMIN_HOST)', () => {
  beforeEach(() => {
    delete process.env.ADMIN_HOST;
  });

  it('sends a signed-out visitor to /admin to the admin sign-in page, remembering the page', async () => {
    const res = await proxy(request('https://app.test/admin/users'));
    expect(location(res)).toBe('https://app.test/admin/login?from=%2Fadmin%2Fusers');
  });

  it('leaves the admin sign-in page open', async () => {
    const res = await proxy(request('https://app.test/admin/login'));
    expect(isNext(res)).toBe(true);
  });

  it('still sends a signed-out visitor to the dashboard to the home page', async () => {
    const res = await proxy(request('https://app.test/dashboard'));
    expect(location(res)).toBe('https://app.test/?from=%2Fdashboard');
  });

  it('keeps non-admins out of /admin and admins out of /dashboard', async () => {
    const tenant = await signAccessToken({ sub: 'u1', role: 'TENANT' });
    const admin = await signAccessToken({ sub: 'u2', role: 'ADMIN' });
    expect(location(await proxy(request('https://app.test/admin', { token: tenant })))).toBe(
      'https://app.test/dashboard',
    );
    expect(location(await proxy(request('https://app.test/dashboard', { token: admin })))).toBe(
      'https://app.test/admin',
    );
    expect(isNext(await proxy(request('https://app.test/admin/users', { token: admin })))).toBe(
      true,
    );
  });

  it('does not touch public pages or the admin API', async () => {
    expect(isNext(await proxy(request('https://app.test/')))).toBe(true);
    expect(isNext(await proxy(request('https://app.test/api/v1/admin/users')))).toBe(true);
  });
});

describe('proxy: admin on its own host', () => {
  const ADMIN = 'https://admin.example.com';
  const PUBLIC = 'https://example.com';

  beforeEach(() => {
    process.env.ADMIN_HOST = 'admin.example.com';
  });
  afterEach(() => {
    delete process.env.ADMIN_HOST;
  });

  describe('on the admin host', () => {
    it('serves the admin sign-in page and the admin area', async () => {
      expect(isNext(await proxy(request(`${ADMIN}/admin/login`)))).toBe(true);
      const admin = await signAccessToken({ sub: 'u2', role: 'ADMIN' });
      expect(isNext(await proxy(request(`${ADMIN}/admin/users`, { token: admin })))).toBe(true);
    });

    it('sends the bare host and every public page to /admin', async () => {
      for (const path of ['/', '/login', '/register', '/dashboard', '/properties/1', '/setup']) {
        expect(location(await proxy(request(`${ADMIN}${path}`)))).toBe(`${ADMIN}/admin`);
      }
    });

    it('sends a signed-out visitor from /admin to the admin sign-in page', async () => {
      expect(location(await proxy(request(`${ADMIN}/admin`)))).toBe(
        `${ADMIN}/admin/login?from=%2Fadmin`,
      );
    });

    it('does not offer the general sign-in', async () => {
      const res = await proxy(request(`${ADMIN}/api/v1/auth/login`));
      expect(res.status).toBe(404);
    });

    it('lets the other APIs and Next assets through', async () => {
      expect(isNext(await proxy(request(`${ADMIN}/api/v1/auth/admin/login`)))).toBe(true);
      expect(isNext(await proxy(request(`${ADMIN}/api/v1/auth/me`)))).toBe(true);
      expect(isNext(await proxy(request(`${ADMIN}/_next/static/chunks/a.js`)))).toBe(true);
      expect(isNext(await proxy(request(`${ADMIN}/favicon.ico`)))).toBe(true);
    });
  });

  describe('on the public host', () => {
    it('forwards an admin page link to the admin host, keeping the path and query', async () => {
      expect(location(await proxy(request(`${PUBLIC}/admin/users?tab=2`)))).toBe(
        `${ADMIN}/admin/users?tab=2`,
      );
      expect(location(await proxy(request(`${PUBLIC}/admin/login`)))).toBe(`${ADMIN}/admin/login`);
    });

    it('does not serve the admin APIs or the admin sign-in endpoint', async () => {
      expect((await proxy(request(`${PUBLIC}/api/v1/admin/users`))).status).toBe(404);
      expect((await proxy(request(`${PUBLIC}/api/v1/auth/admin/login`))).status).toBe(404);
    });

    it('still serves the public site and the general sign-in', async () => {
      expect(isNext(await proxy(request(`${PUBLIC}/`)))).toBe(true);
      expect(isNext(await proxy(request(`${PUBLIC}/login`)))).toBe(true);
      expect(isNext(await proxy(request(`${PUBLIC}/api/v1/auth/login`)))).toBe(true);
    });

    it('treats the free vercel.app domain as a public host', async () => {
      expect(location(await proxy(request('https://proplity-ecru.vercel.app/admin')))).toBe(
        `${ADMIN}/admin`,
      );
    });
  });
});
