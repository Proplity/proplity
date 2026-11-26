import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// With ADMIN_HOST set, each sign-in endpoint exists on one side only. The proxy already keeps the
// two sides apart; this checks the routes refuse by themselves, before touching the database.

const { reserve } = vi.hoisted(() => ({ reserve: vi.fn() }));

vi.mock('@/lib/db', () => ({ prisma: {} }));
vi.mock('@/lib/auth/rateLimit', () => ({
  reserveAttempt: (...a: unknown[]) => reserve(...a),
  releaseAttempt: vi.fn(),
  getClientIp: () => '203.0.113.7',
}));

import { POST as generalLogin } from '@/app/api/v1/auth/login/route';
import { POST as adminLogin } from '@/app/api/v1/auth/admin/login/route';

const post = (host: string) =>
  new NextRequest(`https://${host}/api/v1/auth/login`, {
    method: 'POST',
    headers: { origin: `https://${host}`, host, 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'a@example.com', password: 'x' }),
  });

beforeEach(() => {
  reserve.mockReset();
  reserve.mockResolvedValue({ allowed: false, attemptId: null });
  process.env.ADMIN_HOST = 'admin.example.com';
});
afterEach(() => {
  delete process.env.ADMIN_HOST;
});

describe('sign-in endpoints and ADMIN_HOST', () => {
  it('the general sign-in is not found on the admin host', async () => {
    const res = await generalLogin(post('admin.example.com'));
    expect(res.status).toBe(404);
    expect(reserve).not.toHaveBeenCalled();
  });

  it('the admin sign-in is not found on the public host', async () => {
    const res = await adminLogin(post('example.com'));
    expect(res.status).toBe(404);
    expect(reserve).not.toHaveBeenCalled();
  });

  it('each answers on its own side (here: stopped later by the rate limiter)', async () => {
    expect((await generalLogin(post('example.com'))).status).toBe(429);
    expect((await adminLogin(post('admin.example.com'))).status).toBe(429);
    expect(reserve).toHaveBeenCalledTimes(2);
  });

  it('both answer on a single shared host when no admin host is set', async () => {
    delete process.env.ADMIN_HOST;
    expect((await generalLogin(post('example.com'))).status).toBe(429);
    expect((await adminLogin(post('example.com'))).status).toBe(429);
  });
});
