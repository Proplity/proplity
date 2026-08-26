import { beforeAll, describe, expect, it } from 'vitest';
import { Role } from '@prisma/client';
import { resetDb, testPrisma } from '../helpers/db';
import { createUser, createProperty, createUnit, createLease } from '../helpers/fixtures';
import { authCookie } from '../helpers/auth';
import { apiFetch } from '../helpers/client';

describe('properties: export (GET /properties/export)', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('rejects a TENANT outright', async () => {
    const tenant = await createUser(Role.TENANT);
    const cookie = await authCookie(tenant.id, tenant.role);
    const res = await apiFetch('/api/v1/properties/export', { cookie });
    expect(res.status).toBe(403);
  });

  it('CSV export is scoped to the caller\'s own properties, one row per unit', async () => {
    const manager = await createUser(Role.MANAGER);
    const otherManager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id, name: 'Sunrise Court' });
    const otherProperty = await createProperty({ managerId: otherManager.id, name: 'Other Place' });
    await createUnit(property.id, { unitNumber: '1A', rentAmount: 500_000 });
    await createUnit(property.id, { unitNumber: '1B', rentAmount: 600_000 });
    await createUnit(otherProperty.id, { unitNumber: '2A' });
    const cookie = await authCookie(manager.id, manager.role);

    const res = await apiFetch('/api/v1/properties/export?format=csv', { cookie });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');
    const text = typeof res.body === 'string' ? res.body : String(res.body);
    expect(text).toContain('Sunrise Court');
    expect(text).toContain('1A');
    expect(text).toContain('1B');
    expect(text).not.toContain('Other Place');
  });

  it('an ADMIN sees every property\'s units, including tenant info from the active lease', async () => {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id, name: 'Admin View Court' });
    const unit = await createUnit(property.id, { unitNumber: '3A' });
    const tenant = await createUser(Role.TENANT, { name: 'Test Tenant', email: 'exporttest@test.local' });
    await createLease(unit.id, tenant.id, { status: 'ACTIVE' });
    const admin = await createUser(Role.ADMIN);
    const cookie = await authCookie(admin.id, admin.role);

    const res = await apiFetch('/api/v1/properties/export?format=csv', { cookie });
    expect(res.status).toBe(200);
    const text = typeof res.body === 'string' ? res.body : String(res.body);
    expect(text).toContain('Admin View Court');
    expect(text).toContain('Test Tenant');
    expect(text).toContain('exporttest@test.local');
  });

  it('xlsx format returns a real spreadsheet with the right content-type', async () => {
    const manager = await createUser(Role.MANAGER);
    await createProperty({ managerId: manager.id });
    const cookie = await authCookie(manager.id, manager.role);

    const res = await apiFetch('/api/v1/properties/export?format=xlsx', { cookie });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('spreadsheetml');
  });
});

describe('properties: units import (POST /properties/[id]/units/import)', () => {
  beforeAll(async () => {
    await resetDb();
  });

  function csvFile(csv: string, name = 'units.csv') {
    return new File([csv], name, { type: 'text/csv' });
  }

  it('rejects a manager who does not own the property', async () => {
    const owner = await createUser(Role.MANAGER);
    const intruder = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: owner.id });
    const cookie = await authCookie(intruder.id, intruder.role);

    const form = new FormData();
    form.append('file', csvFile('unitNumber,rentAmount\n1A,500000'));

    const res = await apiFetch(`/api/v1/properties/${property.id}/units/import`, {
      method: 'POST',
      cookie,
      body: form,
    });
    expect(res.status).toBe(403);
  });

  it('creates valid rows and reports errors for invalid ones without aborting the whole import', async () => {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });
    const cookie = await authCookie(manager.id, manager.role);

    const csv = [
      'unitNumber,rentAmount,bedrooms,bathrooms',
      '1A,500000,2,1',
      '1B,600000,3,2',
      ',700000,2,1', // missing unitNumber
      '1C,not-a-number,1,1', // invalid rentAmount
    ].join('\n');

    const form = new FormData();
    form.append('file', csvFile(csv));

    const res = await apiFetch(`/api/v1/properties/${property.id}/units/import`, {
      method: 'POST',
      cookie,
      body: form,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.created).toBe(2);
    expect(res.body.data.errors.length).toBe(2);

    const units = await testPrisma.unit.findMany({ where: { propertyId: property.id } });
    expect(units.map((u) => u.unitNumber).sort()).toEqual(['1A', '1B']);
  });

  it('a duplicate unitNumber within the same property is reported as an error, not a crash', async () => {
    const manager = await createUser(Role.MANAGER);
    const property = await createProperty({ managerId: manager.id });
    await createUnit(property.id, { unitNumber: 'DUP' });
    const cookie = await authCookie(manager.id, manager.role);

    const form = new FormData();
    form.append('file', csvFile('unitNumber,rentAmount\nDUP,500000'));

    const res = await apiFetch(`/api/v1/properties/${property.id}/units/import`, {
      method: 'POST',
      cookie,
      body: form,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.created).toBe(0);
    expect(res.body.data.errors.length).toBe(1);
  });
});
