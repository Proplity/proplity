import { describe, expect, it } from 'vitest';
import { Role } from '@prisma/client';
import { resetDb } from '../helpers/db';
import { createUser, createProperty, createUnit, createRent } from '../helpers/fixtures';
import { authCookie } from '../helpers/auth';
import { apiFetch } from '../helpers/client';
import { isSafeUrl } from '../../lib/api/urlField';

// ISS-033: URL fields that the app later renders as links, images or video
// must not accept anything that can run script.
describe('safe URL rule', () => {
  it.each([
    'https://res.cloudinary.com/demo/image/upload/a.jpg',
    '/api/v1/files/0f8fad5b-d9cb-469f-a165-70867728950e',
    '/images/house.png',
  ])('accepts %s', (url) => expect(isSafeUrl(url)).toBe(true));

  it.each([
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'http://example.com/a.jpg',
    '//evil.example/a.jpg',
    '/\\evil.example',
    'ftp://example.com/a',
    'not a url',
    '',
    `https://example.com/${'a'.repeat(2100)}`,
  ])('rejects %s', (url) => expect(isSafeUrl(url)).toBe(false));
});

describe('URL fields reject unsafe links over the API', () => {
  it('refuses javascript: and http: in notices, requests, properties and messages', async () => {
    await resetDb();
    const manager = await createUser(Role.MANAGER);
    const tenant = await createUser(Role.TENANT);
    const property = await createProperty({ managerId: manager.id });
    const unit = await createUnit(property.id);
    const rent = await createRent(unit.id, tenant.id);
    const managerCookie = await authCookie(manager.id, manager.role);
    const tenantCookie = await authCookie(tenant.id, tenant.role);

    const notice = (documentUrl: string) =>
      apiFetch(`/api/v1/rents/${rent.id}/notices`, {
        method: 'POST',
        cookie: managerCookie,
        body: { type: 'PAYMENT_REMINDER', content: 'Hello', documentUrl },
      });
    expect((await notice('javascript:alert(1)')).status).toBe(400);
    expect((await notice('http://example.com/doc.pdf')).status).toBe(400);
    expect((await notice('https://example.com/doc.pdf')).status).toBeLessThan(300);

    const request = (mediaUrls: string[]) =>
      apiFetch('/api/v1/maintenance/requests', {
        method: 'POST',
        cookie: tenantCookie,
        body: { unitId: unit.id, title: 'Leak', description: 'Tap', mediaUrls },
      });
    expect((await request(['data:text/html,<script>1</script>'])).status).toBe(400);
    expect((await request(['https://example.com/leak.jpg'])).status).toBe(201);

    const patched = await apiFetch(`/api/v1/properties/${property.id}`, {
      method: 'PATCH',
      cookie: managerCookie,
      body: { imageUrl: 'javascript:alert(1)' },
    });
    expect(patched.status).toBe(400);

    const me = await apiFetch('/api/v1/auth/me', {
      method: 'PATCH',
      cookie: tenantCookie,
      body: { idDocumentUrl: 'javascript:alert(1)' },
    });
    expect(me.status).toBe(400);

    // A typed file name (no upload) is still accepted for the ID document.
    const named = await apiFetch('/api/v1/auth/me', {
      method: 'PATCH',
      cookie: tenantCookie,
      body: { idDocumentUrl: 'passport.pdf' },
    });
    expect(named.status).toBe(200);
  });
});
