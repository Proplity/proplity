import { beforeAll, describe, expect, it } from 'vitest';
import { Role, UserStatus } from '@prisma/client';
import { resetDb } from '../helpers/db';
import { createUser, FIXTURE_PASSWORD } from '../helpers/fixtures';
import { apiFetch, cookieHeaderFrom } from '../helpers/client';

describe('auth: login / me / logout / CSRF', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('rejects a login POST from a mismatched Origin (CSRF)', async () => {
    const res = await apiFetch('/api/v1/auth/login', {
      method: 'POST',
      body: { email: 'nobody@test.local', password: 'x' },
      headers: { Origin: 'http://evil.example.com' },
    });
    expect(res.status).toBe(403);
  });

  it('rejects invalid credentials', async () => {
    await createUser(Role.TENANT, { email: 'wrongpass@test.local' });
    const res = await apiFetch('/api/v1/auth/login', {
      method: 'POST',
      body: { email: 'wrongpass@test.local', password: 'not-the-password' },
    });
    expect(res.status).toBe(401);
  });

  it('rejects login for a PENDING_VERIFICATION account', async () => {
    await createUser(Role.TENANT, {
      email: 'unverified@test.local',
      status: UserStatus.PENDING_VERIFICATION,
    });
    const res = await apiFetch('/api/v1/auth/login', {
      method: 'POST',
      body: { email: 'unverified@test.local', password: FIXTURE_PASSWORD },
    });
    expect(res.status).toBe(403);
  });

  it('logs in with valid credentials, sets cookies, and returns a lowercase role', async () => {
    await createUser(Role.MANAGER, { email: 'manager@test.local' });

    const login = await apiFetch('/api/v1/auth/login', {
      method: 'POST',
      body: { email: 'manager@test.local', password: FIXTURE_PASSWORD },
    });

    expect(login.status).toBe(200);
    expect(login.body.user.role).toBe('manager');
    expect(login.setCookies.some((c) => c.startsWith('access_token='))).toBe(true);
    expect(login.setCookies.some((c) => c.startsWith('refresh_token='))).toBe(true);

    const cookie = cookieHeaderFrom(login.setCookies);

    const me = await apiFetch('/api/v1/auth/me', { cookie });
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe('manager@test.local');
    expect(me.body.user.role).toBe('manager');

    const logout = await apiFetch('/api/v1/auth/logout', { method: 'POST', cookie });
    expect(logout.status).toBe(200);
  });

  it('rejects /me with no session cookie', async () => {
    const res = await apiFetch('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });
});
