import { beforeAll, describe, expect, it } from 'vitest';
import { LeaseStatus, Role } from '@prisma/client';
import { resetDb, testPrisma } from '../helpers/db';
import { createUser, createProperty, createUnit, createLease } from '../helpers/fixtures';
import { apiFetch } from '../helpers/client';
import { computeTrustScore } from '../../lib/workers/propertyTrustScorer';

const CRON_SECRET = 'test_only_cron_secret_do_not_use_in_production';

describe('computeTrustScore (ISS-013 formula)', () => {
  const none = {
    landlordVerified: false,
    managerVerified: false,
    requests: { completed: 0, total: 0 },
    leases: { reliable: 0, scored: 0 },
    units: { occupied: 0, total: 0 },
  };

  it('starts at 54 with no signals (base 40 + two neutral 7s)', () => {
    expect(computeTrustScore(none)).toBe(54);
  });

  it('reaches 100 with every signal at its best', () => {
    expect(
      computeTrustScore({
        landlordVerified: true,
        managerVerified: true,
        requests: { completed: 10, total: 10 },
        leases: { reliable: 4, scored: 4 },
        units: { occupied: 5, total: 5 },
      }),
    ).toBe(100);
  });

  it('rewards verification and punishes unfinished maintenance and late rent', () => {
    const verified = computeTrustScore({ ...none, landlordVerified: true });
    expect(verified).toBe(64);
    const poor = computeTrustScore({
      ...none,
      requests: { completed: 0, total: 6 },
      leases: { reliable: 0, scored: 3 },
    });
    expect(poor).toBe(40); // 40 base + 0 maintenance + 0 rent
  });

  it('ignores maintenance until there are at least 3 requests', () => {
    expect(computeTrustScore({ ...none, requests: { completed: 0, total: 2 } })).toBe(54);
  });
});

describe('property-trust-scorer worker', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('scores properties from real data and leaves a stable score alone on a second run', async () => {
    const landlord = await createUser(Role.LANDLORD);
    await testPrisma.user.update({ where: { id: landlord.id }, data: { kycStatus: 'VERIFIED' } });
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ landlordId: landlord.id, managerId: manager.id });
    const unit = await createUnit(property.id);
    await testPrisma.unit.update({ where: { id: unit.id }, data: { status: 'OCCUPIED' } });
    const tenant = await createUser(Role.TENANT);
    const lease = await createLease(unit.id, tenant.id, { status: LeaseStatus.ACTIVE });
    await testPrisma.lease.update({
      where: { id: lease.id },
      data: { paymentReliability: 'EXCELLENT' },
    });
    await testPrisma.property.update({ where: { id: property.id }, data: { trustScore: null } });

    const run = () =>
      apiFetch('/api/v1/cron/property-trust-scorer', {
        method: 'POST',
        headers: { 'x-cron-secret': CRON_SECRET },
      });
    const first = await run();
    expect(first.status).toBe(200);
    expect(first.body.result.changed).toBe(1);

    // 40 base + 10 verified landlord + 7 neutral maintenance + 15 rent + 10 occupancy
    const row = await testPrisma.property.findUnique({ where: { id: property.id } });
    expect(row?.trustScore).toBe(82);

    const second = await run();
    expect(second.body.result.changed).toBe(0);
  });

  it('is refused without the cron secret', async () => {
    const res = await apiFetch('/api/v1/cron/property-trust-scorer', { method: 'POST' });
    expect([401, 403]).toContain(res.status);
  });
});
