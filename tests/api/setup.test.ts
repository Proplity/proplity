import { beforeAll, describe, expect, it } from 'vitest';
import { Role } from '@prisma/client';
import { resetDb, testPrisma } from '../helpers/db';
import { apiFetch } from '../helpers/client';

describe('setup: first-run setup wizard API (/api/v1/setup)', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('GET returns setupComplete: false when database is fresh', async () => {
    const res = await apiFetch('/api/v1/setup');
    expect(res.status).toBe(200);
    expect(res.body.setupComplete).toBe(false);
    expect(typeof res.body.requiresToken).toBe('boolean');
  });

  it('rejects POST from mismatched Origin (CSRF guard)', async () => {
    const res = await apiFetch('/api/v1/setup', {
      method: 'POST',
      body: {
        name: 'Evil Attacker',
        email: 'attacker@evil.local',
        password: 'Password123!',
      },
      headers: { Origin: 'http://evil.example.com' },
    });
    expect(res.status).toBe(403);
  });

  it('rejects malformed payloads with 400', async () => {
    const res = await apiFetch('/api/v1/setup', {
      method: 'POST',
      body: {
        name: '',
        email: 'not-an-email',
        password: 'short',
      },
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid payload');
  });

  it('successfully provisions the initial admin and marks setupComplete', async () => {
    const res = await apiFetch('/api/v1/setup', {
      method: 'POST',
      body: {
        name: 'First Administrator',
        email: 'superadmin@proplity.local',
        password: 'SecureAdminPassword123!',
      },
    });

    expect(res.status).toBe(201);
    expect(res.body.admin).toBeDefined();
    expect(res.body.admin.email).toBe('superadmin@proplity.local');
    expect(res.body.admin.name).toBe('First Administrator');

    // Verify user record in DB
    const adminUser = await testPrisma.user.findUnique({
      where: { email: 'superadmin@proplity.local' },
    });
    expect(adminUser).not.toBeNull();
    expect(adminUser?.role).toBe(Role.ADMIN);
    expect(adminUser?.status).toBe('ACTIVE');
    expect(adminUser?.kycStatus).toBe('VERIFIED');

    // Verify SystemSettings is now setupComplete: true
    const settings = await testPrisma.systemSettings.findUnique({
      where: { id: 'global' },
    });
    expect(settings?.setupComplete).toBe(true);

    // Verify AuditLog entry was created
    const audit = await testPrisma.auditLog.findFirst({
      where: {
        action: 'FIRST_RUN_SETUP',
        actorId: adminUser!.id,
      },
    });
    expect(audit).not.toBeNull();
    expect(audit?.entityType).toBe('SystemSettings');
    expect(audit?.entityId).toBe('global');
  });

  it('rejects subsequent setup attempts with 409 Conflict once completed', async () => {
    const res = await apiFetch('/api/v1/setup', {
      method: 'POST',
      body: {
        name: 'Second Administrator',
        email: 'secondadmin@proplity.local',
        password: 'SecureAdminPassword123!',
      },
    });

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('already been completed');

    // GET now reports setupComplete: true
    const getRes = await apiFetch('/api/v1/setup');
    expect(getRes.status).toBe(200);
    expect(getRes.body.setupComplete).toBe(true);
  });
});
