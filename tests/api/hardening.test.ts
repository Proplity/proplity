import { beforeAll, describe, expect, it } from 'vitest';
import { Role } from '@prisma/client';
import { resetDb } from '../helpers/db';
import { createUser } from '../helpers/fixtures';
import { authCookie } from '../helpers/auth';
import { apiFetch } from '../helpers/client';
import { neutraliseFormula } from '../../lib/csv';

describe('hardening', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('neutralises spreadsheet formulas in exported text but not numbers', () => {
    expect(neutraliseFormula('=HYPERLINK("http://evil","x")')).toBe(
      `'=HYPERLINK("http://evil","x")`,
    );
    expect(neutraliseFormula('+1')).toBe("'+1");
    expect(neutraliseFormula('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(neutraliseFormula('Palm Court')).toBe('Palm Court');
    expect(neutraliseFormula(-5)).toBe('-5');
  });

  it('refuses an oversized JSON body', async () => {
    const m = await createUser(Role.MANAGER);
    const cookie = await authCookie(m.id, m.role);
    const huge = JSON.stringify({
      name: 'x',
      address: 'y',
      city: 'z',
      description: 'a'.repeat(1_200_000),
    });
    const res = await apiFetch('/api/v1/properties', { method: 'POST', cookie, rawBody: huge });
    expect(res.status).toBe(413);
  });

  it('limits failed logins per account even when every attempt comes from a new address', async () => {
    const victim = await createUser(Role.TENANT, { email: 'victim-limit@test.local' });
    let blocked = 0;
    for (let i = 0; i < 34; i++) {
      const res = await apiFetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'x-forwarded-for': `203.0.113.${i + 1}` },
        body: { email: victim.email, password: 'wrong-password' },
      });
      if (res.status === 429) blocked++;
    }
    expect(blocked).toBeGreaterThan(0);
  }, 120_000);
});
