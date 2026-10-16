import { beforeAll, describe, expect, it } from 'vitest';
import { Role } from '@prisma/client';
import { resetDb, testPrisma } from '../helpers/db';
import { createUser } from '../helpers/fixtures';
import { authCookie } from '../helpers/auth';
import { apiFetch } from '../helpers/client';

describe('a manager can link to several landlords (ISS-040)', () => {
  beforeAll(async () => {
    await resetDb();
  });

  async function code(landlordId: string, value: string) {
    return testPrisma.managerInviteCode.create({ data: { code: value, landlordId } });
  }

  it('redeems codes from two landlords and lists both', async () => {
    const manager = await createUser(Role.MANAGER);
    const l1 = await createUser(Role.LANDLORD, { name: 'Landlord One' });
    const l2 = await createUser(Role.LANDLORD, { name: 'Landlord Two' });
    await code(l1.id, 'LLD-ML01-AA');
    await code(l2.id, 'LLD-ML02-BB');
    const cookie = await authCookie(manager.id, manager.role);

    const a = await apiFetch('/api/v1/manager-codes/redeem', {
      method: 'POST',
      cookie,
      body: { code: 'LLD-ML01-AA' },
    });
    expect(a.status).toBe(200);
    const b = await apiFetch('/api/v1/manager-codes/redeem', {
      method: 'POST',
      cookie,
      body: { code: 'lld-ml02-bb' },
    });
    expect(b.status).toBe(200);

    const linked = await apiFetch('/api/v1/manager-codes/linked', { cookie });
    expect(linked.status).toBe(200);
    expect(
      linked.body.data.map((l: { landlord: { name: string } }) => l.landlord.name).sort(),
    ).toEqual(['Landlord One', 'Landlord Two']);
  });

  it('refuses a second code from a landlord the manager is already linked to', async () => {
    const manager = await createUser(Role.MANAGER);
    const landlord = await createUser(Role.LANDLORD, { name: 'Repeat Landlord' });
    await code(landlord.id, 'LLD-ML03-CC');
    await code(landlord.id, 'LLD-ML04-DD');
    const cookie = await authCookie(manager.id, manager.role);

    await apiFetch('/api/v1/manager-codes/redeem', {
      method: 'POST',
      cookie,
      body: { code: 'LLD-ML03-CC' },
    });
    const again = await apiFetch('/api/v1/manager-codes/redeem', {
      method: 'POST',
      cookie,
      body: { code: 'LLD-ML04-DD' },
    });
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('ALREADY_LINKED');
  });

  it('keeps a code single-use across managers', async () => {
    const m1 = await createUser(Role.MANAGER);
    const m2 = await createUser(Role.MANAGER);
    const landlord = await createUser(Role.LANDLORD);
    await code(landlord.id, 'LLD-ML05-EE');

    const first = await apiFetch('/api/v1/manager-codes/redeem', {
      method: 'POST',
      cookie: await authCookie(m1.id, m1.role),
      body: { code: 'LLD-ML05-EE' },
    });
    expect(first.status).toBe(200);
    const second = await apiFetch('/api/v1/manager-codes/redeem', {
      method: 'POST',
      cookie: await authCookie(m2.id, m2.role),
      body: { code: 'LLD-ML05-EE' },
    });
    expect(second.status).toBe(409);
    expect(second.body.code).toBe('CODE_USED');
  });

  it('shows no links for a manager who registered without a code', async () => {
    const manager = await createUser(Role.MANAGER);
    const res = await apiFetch('/api/v1/manager-codes/linked', {
      cookie: await authCookie(manager.id, manager.role),
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('rate limits brute-force code enumeration attempts on check endpoint', async () => {
    // 10 failed attempts from the same IP exhausts the limit
    for (let i = 0; i < 10; i++) {
      const res = await apiFetch(`/api/v1/manager-codes/check?code=INVALID-${i}`, {
        headers: { 'x-forwarded-for': '198.51.100.42' },
      });
      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(false);
    }

    // 11th attempt must be 429 rate limited
    const blocked = await apiFetch('/api/v1/manager-codes/check?code=INVALID-11', {
      headers: { 'x-forwarded-for': '198.51.100.42' },
    });
    expect(blocked.status).toBe(429);
    expect(blocked.body.valid).toBe(false);
    expect(blocked.body.error).toContain('Too many verification attempts');
  });
});
