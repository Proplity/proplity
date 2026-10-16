import { describe, it, expect } from 'vitest';
import {
  FOLDER_ROLES,
  allowedTypes,
  maxBytes,
  isInlineSafe,
  MAX_PROXY_UPLOAD_BYTES,
  MAX_DIRECT_IMAGE_BYTES,
  MAX_DIRECT_VIDEO_BYTES,
  IMAGE_AND_PDF_TYPES,
  VIDEO_TYPES,
} from '@/lib/uploadPolicy';
import { Role } from '@prisma/client';

describe('uploadPolicy', () => {
  it('enforces RBAC folder access matrix per ADR-0010', () => {
    expect(FOLDER_ROLES['maintenance-requests']).toEqual([
      Role.TENANT,
      Role.MANAGER,
      Role.LANDLORD,
      Role.VENDOR,
    ]);
    expect(FOLDER_ROLES.applications).toEqual([Role.TENANT]);
    expect(FOLDER_ROLES.profile).toEqual([Role.TENANT, Role.LANDLORD, Role.MANAGER, Role.VENDOR]);
    expect(FOLDER_ROLES.properties).toContain(Role.LANDLORD);
    expect(FOLDER_ROLES.properties).toContain(Role.MANAGER);
    expect(FOLDER_ROLES.properties).toContain(Role.ADMIN);
    expect(FOLDER_ROLES.properties).not.toContain(Role.TENANT);
    expect(FOLDER_ROLES.notices).toEqual([Role.LANDLORD, Role.MANAGER, Role.ADMIN]);
    expect(FOLDER_ROLES.leases).toEqual([Role.TENANT, Role.LANDLORD, Role.MANAGER, Role.ADMIN]);
    expect(FOLDER_ROLES.communications).toEqual([
      Role.TENANT,
      Role.LANDLORD,
      Role.MANAGER,
      Role.VENDOR,
      Role.ADMIN,
    ]);
  });

  it('allows videos and documents according to folder policy', () => {
    const propTypes = allowedTypes('properties');
    expect(propTypes).toEqual(expect.arrayContaining([...IMAGE_AND_PDF_TYPES, ...VIDEO_TYPES]));

    const profileTypes = allowedTypes('profile');
    expect(profileTypes).toEqual(IMAGE_AND_PDF_TYPES);
    expect(profileTypes).not.toEqual(expect.arrayContaining([...VIDEO_TYPES]));

    const commTypes = allowedTypes('communications');
    expect(commTypes).toEqual(expect.arrayContaining(['audio/mpeg', 'text/plain']));
  });

  it('calculates size limits correctly for proxy and direct modes', () => {
    expect(MAX_PROXY_UPLOAD_BYTES).toBe(4_000_000);
    expect(maxBytes('image/jpeg', 'proxy')).toBe(4_000_000);
    expect(maxBytes('video/mp4', 'proxy')).toBe(4_000_000);

    expect(maxBytes('image/png', 'direct')).toBe(MAX_DIRECT_IMAGE_BYTES);
    expect(maxBytes('video/mp4', 'direct')).toBe(MAX_DIRECT_VIDEO_BYTES);
    expect(maxBytes('video/quicktime', 'direct')).toBe(200_000_000);
  });

  it('identifies inline safe media types', () => {
    expect(isInlineSafe('image/jpeg')).toBe(true);
    expect(isInlineSafe('image/png')).toBe(true);
    expect(isInlineSafe('application/pdf')).toBe(true);
    expect(isInlineSafe('video/mp4')).toBe(true);
    expect(isInlineSafe('audio/mpeg')).toBe(true);
    expect(isInlineSafe('text/plain')).toBe(true);
    expect(isInlineSafe('application/octet-stream')).toBe(false);
    expect(isInlineSafe('text/html')).toBe(false);
  });
});
