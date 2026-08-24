import { beforeAll, describe, expect, it } from 'vitest';
import { Role, UserStatus } from '@prisma/client';
import { resetDb, testPrisma } from '../helpers/db';
import {
  createUser,
  createVerificationToken,
  fillRateLimit,
  FIXTURE_PASSWORD,
} from '../helpers/fixtures';
import { authCookie } from '../helpers/auth';
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

  it('400s cleanly on a malformed body instead of an unhandled 500', async () => {
    const res = await apiFetch('/api/v1/auth/login', {
      method: 'POST',
      body: { email: 'not-an-email', password: '' },
    });
    expect(res.status).toBe(400);
  });

  it('returns 401 (not a crash) for a nonexistent email, same as a wrong password', async () => {
    const res = await apiFetch('/api/v1/auth/login', {
      method: 'POST',
      body: { email: 'no-such-user@test.local', password: 'whatever123' },
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

describe('auth: register', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('rejects a register POST from a mismatched Origin (CSRF)', async () => {
    const res = await apiFetch('/api/v1/auth/register', {
      method: 'POST',
      body: { email: 'csrf@test.local', password: 'somepassword', name: 'CSRF Test' },
      headers: { Origin: 'http://evil.example.com' },
    });
    expect(res.status).toBe(403);
  });

  it('rejects an invalid payload', async () => {
    const res = await apiFetch('/api/v1/auth/register', {
      method: 'POST',
      body: { email: 'not-an-email', password: 'short', name: '' },
    });
    expect(res.status).toBe(400);
  });

  it('maps a valid role string case-insensitively, falls back to TENANT otherwise', async () => {
    const manager = await apiFetch('/api/v1/auth/register', {
      method: 'POST',
      body: { email: 'newmanager@test.local', password: 'somepassword', name: 'New Manager', role: 'manager' },
    });
    expect(manager.status).toBe(200);
    expect(manager.body.user.role).toBe('manager');

    const bogus = await apiFetch('/api/v1/auth/register', {
      method: 'POST',
      body: { email: 'newbogus@test.local', password: 'somepassword', name: 'New Bogus', role: 'superadmin' },
    });
    expect(bogus.status).toBe(200);
    expect(bogus.body.user.role).toBe('tenant');
  });

  it('never grants ADMIN via self-registration, even though it is a valid Role value', async () => {
    const res = await apiFetch('/api/v1/auth/register', {
      method: 'POST',
      body: { email: 'wannabe-admin@test.local', password: 'somepassword', name: 'Wannabe Admin', role: 'admin' },
    });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('tenant');
  });

  it('registers a new user active by default, sets session cookies, then blocks and rate-limits duplicates', async () => {
    const email = 'dup@test.local';
    const first = await apiFetch('/api/v1/auth/register', {
      method: 'POST',
      body: { email, password: 'somepassword', name: 'Dup Test' },
    });
    expect(first.status).toBe(200);
    expect(first.body.user.status).toBe('ACTIVE');
    expect(first.setCookies.some((c) => c.startsWith('access_token='))).toBe(true);

    // 5 duplicate attempts consume register's IP-scoped rate limit budget...
    for (let i = 0; i < 5; i++) {
      const dup = await apiFetch('/api/v1/auth/register', {
        method: 'POST',
        body: { email, password: 'somepassword', name: 'Dup Test' },
      });
      expect(dup.status).toBe(409);
    }
    // ...and the 6th is rejected before it even re-checks the duplicate email.
    const limited = await apiFetch('/api/v1/auth/register', {
      method: 'POST',
      body: { email, password: 'somepassword', name: 'Dup Test' },
    });
    expect(limited.status).toBe(429);
  });
});

describe('auth: refresh rotation + reuse detection', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('rotates the refresh token on use, and detects reuse of the old one by revoking the whole family', async () => {
    await createUser(Role.TENANT, { email: 'refresh1@test.local' });
    const login = await apiFetch('/api/v1/auth/login', {
      method: 'POST',
      body: { email: 'refresh1@test.local', password: FIXTURE_PASSWORD },
    });
    const cookieA = cookieHeaderFrom(login.setCookies);

    const refresh1 = await apiFetch('/api/v1/auth/refresh', { method: 'POST', cookie: cookieA });
    expect(refresh1.status).toBe(200);
    const cookieB = cookieHeaderFrom(refresh1.setCookies);
    expect(cookieB).not.toBe(cookieA);

    // Replaying the now-rotated-away token A is reuse -- must be detected and
    // must revoke the ENTIRE family, not just token A. This atomicity is the
    // security-critical property CLAUDE.md calls out explicitly.
    const replay = await apiFetch('/api/v1/auth/refresh', { method: 'POST', cookie: cookieA });
    expect(replay.status).toBe(401);

    // Token B was legitimately rotated in, but must now be dead too --
    // proving the whole family was killed, not just the reused token.
    const afterFamilyRevoke = await apiFetch('/api/v1/auth/refresh', {
      method: 'POST',
      cookie: cookieB,
    });
    expect(afterFamilyRevoke.status).toBe(401);
  });

  it('preserves the original rememberMe-based expiry across rotation, not a flat +7 days', async () => {
    const user = await createUser(Role.TENANT, { email: 'refresh-remember@test.local' });
    const login = await apiFetch('/api/v1/auth/login', {
      method: 'POST',
      body: { email: 'refresh-remember@test.local', password: FIXTURE_PASSWORD, rememberMe: false },
    });
    const cookie = cookieHeaderFrom(login.setCookies);

    const original = await testPrisma.refreshToken.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });
    expect(original).toBeTruthy();

    const refresh = await apiFetch('/api/v1/auth/refresh', { method: 'POST', cookie });
    expect(refresh.status).toBe(200);

    const rotated = await testPrisma.refreshToken.findFirst({
      where: { userId: user.id, id: { not: original!.id } },
      orderBy: { createdAt: 'desc' },
    });
    expect(rotated).toBeTruthy();

    // rememberMe: false means a real 1-day session -- the rotated token must
    // inherit that same expiry (down to the second), not reset to +7 days.
    expect(rotated!.expiresAt.getTime()).toBe(original!.expiresAt.getTime());
  });

  it('rejects a refresh request with no refresh_token cookie', async () => {
    const res = await apiFetch('/api/v1/auth/refresh', { method: 'POST' });
    expect(res.status).toBe(401);
  });

  it('rejects a refresh request from a mismatched Origin (CSRF)', async () => {
    const res = await apiFetch('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { Origin: 'http://evil.example.com' },
    });
    expect(res.status).toBe(403);
  });

  it('rate-limits refresh once the identifier is already exhausted', async () => {
    // Discover the IP string the server itself sees (getClientIp() falls back to
    // a literal '127.0.0.1' only when x-forwarded-for is absent -- Next's own
    // dev server may set it to the real loopback address, e.g. '::1') by
    // triggering one real recorded login attempt and reading its identifier back.
    await apiFetch('/api/v1/auth/login', {
      method: 'POST',
      body: { email: 'rate-limit-probe@test.local', password: 'wrong' },
    });
    const suffix = ':rate-limit-probe@test.local';
    const probe = await testPrisma.loginAttempt.findFirst({
      where: { identifier: { endsWith: suffix } },
      orderBy: { createdAt: 'desc' },
    });
    // IP may itself contain colons (IPv6, e.g. '::1') -- strip the known
    // suffix rather than splitting on ':' from the start.
    const ip = probe!.identifier.slice(0, probe!.identifier.length - suffix.length);

    await fillRateLimit(`refresh:${ip}`, 5);
    const res = await apiFetch('/api/v1/auth/refresh', { method: 'POST' });
    expect(res.status).toBe(429);
  });
});

describe('auth: change-password', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('requires authentication', async () => {
    const res = await apiFetch('/api/v1/auth/change-password', {
      method: 'POST',
      body: { currentPassword: 'x', newPassword: 'y' },
    });
    expect(res.status).toBe(401);
  });

  it('rejects a mismatched Origin (CSRF)', async () => {
    const user = await createUser(Role.TENANT, { email: 'cp-csrf@test.local' });
    const cookie = await authCookie(user.id, user.role);
    const res = await apiFetch('/api/v1/auth/change-password', {
      method: 'POST',
      cookie,
      headers: { Origin: 'http://evil.example.com' },
      body: { currentPassword: FIXTURE_PASSWORD, newPassword: 'newpassword123' },
    });
    expect(res.status).toBe(403);
  });

  it('rejects the wrong current password', async () => {
    const user = await createUser(Role.TENANT, { email: 'cp-wrong@test.local' });
    const cookie = await authCookie(user.id, user.role);
    const res = await apiFetch('/api/v1/auth/change-password', {
      method: 'POST',
      cookie,
      body: { currentPassword: 'not-it', newPassword: 'newpassword123' },
    });
    expect(res.status).toBe(400);
  });

  it('rejects a new password shorter than the 6-character minimum register enforces', async () => {
    const user = await createUser(Role.TENANT, { email: 'cp-short@test.local' });
    const cookie = await authCookie(user.id, user.role);
    const res = await apiFetch('/api/v1/auth/change-password', {
      method: 'POST',
      cookie,
      body: { currentPassword: FIXTURE_PASSWORD, newPassword: 'ab' },
    });
    expect(res.status).toBe(400);
  });

  it('changes the password and revokes existing refresh tokens', async () => {
    const email = 'cp-ok@test.local';
    await createUser(Role.TENANT, { email });
    const login = await apiFetch('/api/v1/auth/login', {
      method: 'POST',
      body: { email, password: FIXTURE_PASSWORD },
    });
    const cookie = cookieHeaderFrom(login.setCookies);

    const change = await apiFetch('/api/v1/auth/change-password', {
      method: 'POST',
      cookie,
      body: { currentPassword: FIXTURE_PASSWORD, newPassword: 'brandNewPassword1' },
    });
    expect(change.status).toBe(200);

    // The refresh token minted at login must now be revoked.
    const refresh = await apiFetch('/api/v1/auth/refresh', { method: 'POST', cookie });
    expect(refresh.status).toBe(401);

    const oldLogin = await apiFetch('/api/v1/auth/login', {
      method: 'POST',
      body: { email, password: FIXTURE_PASSWORD },
    });
    expect(oldLogin.status).toBe(401);

    const newLogin = await apiFetch('/api/v1/auth/login', {
      method: 'POST',
      body: { email, password: 'brandNewPassword1' },
    });
    expect(newLogin.status).toBe(200);
  });
});

describe('auth: verify-email', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('requires a token', async () => {
    const res = await apiFetch('/api/v1/auth/verify-email', { method: 'POST', body: {} });
    expect(res.status).toBe(400);
  });

  it('rejects an unknown token', async () => {
    const res = await apiFetch('/api/v1/auth/verify-email', {
      method: 'POST',
      body: { token: 'not-a-real-token' },
    });
    expect(res.status).toBe(400);
  });

  it('rejects an expired token', async () => {
    const user = await createUser(Role.TENANT, {
      email: 'expired@test.local',
      status: UserStatus.PENDING_VERIFICATION,
    });
    const { rawToken } = await createVerificationToken(user.id, {
      expiresAt: new Date(Date.now() - 1000),
    });
    const res = await apiFetch('/api/v1/auth/verify-email', {
      method: 'POST',
      body: { token: rawToken },
    });
    expect(res.status).toBe(400);
  });

  it('activates the account without changing its password when none is supplied', async () => {
    const user = await createUser(Role.TENANT, {
      email: 'invited@test.local',
      status: UserStatus.PENDING_VERIFICATION,
    });
    const { rawToken } = await createVerificationToken(user.id);
    const res = await apiFetch('/api/v1/auth/verify-email', {
      method: 'POST',
      body: { token: rawToken },
    });
    expect(res.status).toBe(200);

    const login = await apiFetch('/api/v1/auth/login', {
      method: 'POST',
      body: { email: 'invited@test.local', password: FIXTURE_PASSWORD },
    });
    expect(login.status).toBe(200);
  });

  it('activates and sets a new password when one is supplied', async () => {
    const user = await createUser(Role.TENANT, {
      email: 'selfset@test.local',
      status: UserStatus.PENDING_VERIFICATION,
    });
    const { rawToken } = await createVerificationToken(user.id);
    const res = await apiFetch('/api/v1/auth/verify-email', {
      method: 'POST',
      body: { token: rawToken, password: 'chosenPassword1' },
    });
    expect(res.status).toBe(200);

    const login = await apiFetch('/api/v1/auth/login', {
      method: 'POST',
      body: { email: 'selfset@test.local', password: 'chosenPassword1' },
    });
    expect(login.status).toBe(200);
  });

  it('is deliberately CSRF-exempt -- succeeds even from a mismatched Origin (rule 3)', async () => {
    const user = await createUser(Role.TENANT, {
      email: 'csrf-exempt@test.local',
      status: UserStatus.PENDING_VERIFICATION,
    });
    const { rawToken } = await createVerificationToken(user.id);
    const res = await apiFetch('/api/v1/auth/verify-email', {
      method: 'POST',
      headers: { Origin: 'http://evil.example.com' },
      body: { token: rawToken },
    });
    expect(res.status).toBe(200);
  });
});
