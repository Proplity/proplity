import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// The first-run wizard showed "Unexpected end of JSON input" on a production database whose
// migrations had not been applied: the rate-limit write ran outside the route's try block, threw,
// and Next answered 500 with an empty body. The wizard's own GET hides the same fault, so the form
// loaded as if all were well. The route now always answers in JSON and says the database is not ready.

const { reserve, findSettings } = vi.hoisted(() => ({
  reserve: vi.fn(),
  findSettings: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ prisma: { systemSettings: { findUnique: findSettings } } }));
vi.mock('@/lib/auth/rateLimit', () => ({
  reserveAttempt: (...a: unknown[]) => reserve(...a),
  releaseAttempt: vi.fn(),
  getClientIp: () => '203.0.113.7',
}));

import { GET, POST } from '@/app/api/v1/setup/route';

const post = () =>
  new NextRequest('http://localhost/api/v1/setup', {
    method: 'POST',
    headers: { origin: 'http://localhost', host: 'localhost', 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Ada', email: 'ada@example.com', password: 'a-good-pass1' }),
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('POST /api/v1/setup when the database cannot be used', () => {
  it('answers 503 with a JSON explanation, not an empty 500', async () => {
    reserve.mockRejectedValue(new Error('relation "LoginAttempt" does not exist'));
    const res = await POST(post());
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.code).toBe('DATABASE_UNAVAILABLE');
    expect(body.error).toMatch(/database/i);
    expect(JSON.stringify(body)).not.toContain('LoginAttempt');
  });
});

describe('GET /api/v1/setup when the database cannot be used', () => {
  it('still loads the wizard but says the database is not ready', async () => {
    findSettings.mockRejectedValue(new Error('relation "SystemSettings" does not exist'));
    const res = await GET();
    const body = await res.json();
    expect(body).toMatchObject({ setupComplete: false, databaseReady: false });
  });

  it('says it is ready when the settings can be read', async () => {
    findSettings.mockResolvedValue({ setupComplete: false });
    const body = await (await GET()).json();
    expect(body).toMatchObject({ setupComplete: false, databaseReady: true });
  });
});
