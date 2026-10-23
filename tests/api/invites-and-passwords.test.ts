import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import bcrypt from 'bcryptjs';
import { Role, UserStatus } from '@prisma/client';
import { resetDb, testPrisma } from '../helpers/db';
import {
  createUser,
  createProperty,
  createUnit,
  createRent,
  createPasswordResetToken,
  createVerificationToken,
  FIXTURE_PASSWORD,
  setSystemSettings,
} from '../helpers/fixtures';
import { authCookie } from '../helpers/auth';
import { apiFetch } from '../helpers/client';

// Owner decisions of 2026-10-21 on the second security pass: ISS-154 (invitations) and ISS-155
// (password length).

describe('inviting a new tenant by email is gated and capped (ISS-154)', () => {
  beforeAll(async () => {
    await resetDb();
  });
  beforeEach(async () => {
    await setSystemSettings({ id: 'global', tenantInvitesPerDay: 2 });
  });

  async function setup(approved = true) {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id, isPublished: approved });
    const cookie = await authCookie(manager.id, manager.role);
    const invite = async (email: string, unitId?: string) =>
      apiFetch('/api/v1/rents', {
        method: 'POST',
        cookie,
        body: {
          unitId: unitId ?? (await createUnit(property.id)).id,
          tenantEmail: email,
          tenantName: 'New Person',
          startDate: '2027-01-01',
          endDate: '2027-12-31',
          rentAmount: 1_000_000,
          deposit: 0,
        },
      });
    return { manager, property, cookie, invite };
  }

  it('refuses on a listing an admin has not approved, and creates no account', async () => {
    const s = await setup(false);
    const res = await s.invite('stranger@test.local');
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('LISTING_NOT_APPROVED');
    expect(await testPrisma.user.count({ where: { email: 'stranger@test.local' } })).toBe(0);
  });

  it('stops at the daily limit the admin set, and says so', async () => {
    const s = await setup();
    expect((await s.invite('one@test.local')).status).toBe(201);
    expect((await s.invite('two@test.local')).status).toBe(201);
    const third = await s.invite('three@test.local');
    expect(third.status).toBe(429);
    expect(third.body.code).toBe('INVITE_LIMIT');
    expect(await testPrisma.user.count({ where: { email: 'three@test.local' } })).toBe(0);
    expect(
      await testPrisma.auditLog.count({
        where: { actorId: s.manager.id, action: 'TENANT_INVITED' },
      }),
    ).toBe(2);
  });

  it('counts a burst of simultaneous invitations against the limit', async () => {
    await setSystemSettings({ id: 'global', tenantInvitesPerDay: 3 });
    const s = await setup();
    const units = await Promise.all(Array.from({ length: 8 }, () => createUnit(s.property.id)));
    const results = await Promise.all(units.map((u, i) => s.invite(`burst${i}@test.local`, u.id)));
    expect(results.filter((r) => r.status === 201)).toHaveLength(3);
    expect(results.filter((r) => r.status === 429)).toHaveLength(5);
  });

  it('forgets invitations older than a day', async () => {
    const s = await setup();
    await s.invite('old1@test.local');
    await s.invite('old2@test.local');
    await testPrisma.auditLog.updateMany({
      where: { actorId: s.manager.id, action: 'TENANT_INVITED' },
      data: { createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) },
    });
    expect((await s.invite('fresh@test.local')).status).toBe(201);
  });

  it('does not limit a rent for someone who already has an account, or an admin', async () => {
    const s = await setup();
    const existing = await createUser(Role.TENANT, { email: 'member@test.local' });
    await s.invite('a@test.local');
    await s.invite('b@test.local');
    expect((await s.invite('member@test.local')).status).toBe(201);
    expect(await testPrisma.rent.count({ where: { tenantId: existing.id } })).toBe(1);

    const admin = await createUser(Role.ADMIN);
    const unit = await createUnit(s.property.id);
    const res = await apiFetch('/api/v1/rents', {
      method: 'POST',
      cookie: await authCookie(admin.id, admin.role),
      body: {
        unitId: unit.id,
        tenantEmail: 'by-admin@test.local',
        tenantName: 'By Admin',
        startDate: '2027-01-01',
        endDate: '2027-12-31',
        rentAmount: 1_000_000,
        deposit: 0,
      },
    });
    expect(res.status).toBe(201);
  });

  it('stops all invitations when the limit is 0', async () => {
    await setSystemSettings({ id: 'global', tenantInvitesPerDay: 0 });
    const s = await setup();
    expect((await s.invite('nobody@test.local')).status).toBe(429);
  });

  it('lets an admin read and change the limit, within bounds', async () => {
    const admin = await createUser(Role.ADMIN);
    const cookie = await authCookie(admin.id, admin.role);
    const patch = (value: number) =>
      apiFetch('/api/v1/admin/settings', {
        method: 'PATCH',
        cookie,
        body: { tenantInvitesPerDay: value },
      });
    const ok = await patch(25);
    expect(ok.status).toBe(200);
    expect(ok.body.data.tenantInvitesPerDay).toBe(25);
    expect((await patch(-1)).status).toBe(400);
    expect((await patch(201)).status).toBe(400);
    expect((await patch(2.5)).status).toBe(400);
    const manager = await createUser(Role.MANAGER);
    expect(
      (
        await apiFetch('/api/v1/admin/settings', {
          method: 'PATCH',
          cookie: await authCookie(manager.id, manager.role),
          body: { tenantInvitesPerDay: 100 },
        })
      ).status,
    ).toBe(403);
    const log = await testPrisma.auditLog.findFirst({
      where: { action: 'SETTINGS_CHANGED', actorId: admin.id },
    });
    expect(JSON.stringify(log?.metadata)).toContain('tenantInvitesPerDay');
  });
});

describe('a password needs 8 characters (ISS-155)', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('is refused at 7 and accepted at 8 when signing up', async () => {
    const short = await apiFetch('/api/v1/auth/register', {
      method: 'POST',
      body: { email: 'seven@test.local', password: 'abcdefg', name: 'Seven' },
    });
    expect(short.status).toBe(400);
    expect(await testPrisma.user.count({ where: { email: 'seven@test.local' } })).toBe(0);

    const ok = await apiFetch('/api/v1/auth/register', {
      method: 'POST',
      body: { email: 'eight@test.local', password: 'abcdefgh', name: 'Eight' },
    });
    expect(ok.status).toBe(200);
  });

  it('is refused at 7 and accepted at 8 when changing it', async () => {
    const user = await createUser(Role.TENANT);
    const cookie = await authCookie(user.id, user.role);
    const change = (newPassword: string) =>
      apiFetch('/api/v1/auth/change-password', {
        method: 'POST',
        cookie,
        body: { currentPassword: FIXTURE_PASSWORD, newPassword },
      });
    expect((await change('abcdefg')).status).toBe(400);
    expect((await change('abcdefgh')).status).toBe(200);
  });

  it('is refused at 7 and accepted at 8 when resetting it', async () => {
    // A person holds one reset link at a time, so the two tries use two people.
    const reset = async (password: string) => {
      const user = await createUser(Role.TENANT);
      const { rawToken } = await createPasswordResetToken(user.id);
      return apiFetch('/api/v1/auth/reset-password', {
        method: 'POST',
        body: { token: rawToken, password },
      });
    };
    expect((await reset('abcdefg')).status).toBe(400);
    expect((await reset('abcdefgh')).status).toBe(200);
  });

  it('is refused at 7 when an invited tenant sets it at first sign-in', async () => {
    const user = await createUser(Role.TENANT, { status: UserStatus.PENDING_VERIFICATION });
    const { rawToken } = await createVerificationToken(user.id);
    const res = await apiFetch('/api/v1/auth/verify-email', {
      method: 'POST',
      body: { token: rawToken, password: 'abcdefg' },
    });
    expect(res.status).toBe(400);
    const ok = await apiFetch('/api/v1/auth/verify-email', {
      method: 'POST',
      body: { token: rawToken, password: 'abcdefgh' },
    });
    expect(ok.status).toBe(200);
  });

  it('lets someone with an older, shorter password still sign in', async () => {
    const user = await createUser(Role.TENANT, { email: 'oldpw@test.local' });
    await testPrisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash('abc123', 10) },
    });
    const login = await apiFetch('/api/v1/auth/login', {
      method: 'POST',
      body: { email: 'oldpw@test.local', password: 'abc123' },
    });
    expect(login.status).toBe(200);
  });
});
