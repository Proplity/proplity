import { describe, it, expect, vi, beforeEach } from 'vitest';

const storage = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/lib/db', () => ({ prisma: {} }));
vi.mock('@/lib/systemSettings', () => ({ getSystemSettings: vi.fn() }));
vi.mock('@/lib/notifications', () => ({ notifyAndEmail: vi.fn(), notifyUser: vi.fn() }));
vi.mock('@/lib/storage', () => ({ getStorage: () => storage.get() }));

import { evidenceRequired, lacksEvidence } from '@/lib/maintenanceFlow';

const noPhotos = { afterPhotoUrls: [], completionProofUrl: null };
const withPhoto = { afterPhotoUrls: ['/api/v1/files/a'], completionProofUrl: null };
const withProof = { afterPhotoUrls: [], completionProofUrl: '/api/v1/files/b' };

describe('finished-work photo rule', () => {
  beforeEach(() => {
    storage.get.mockReset();
  });

  it('asks for a photo when files can be uploaded', () => {
    storage.get.mockReturnValue({ isConfigured: () => true });
    expect(evidenceRequired()).toBe(true);
    expect(lacksEvidence(noPhotos)).toBe(true);
    expect(lacksEvidence(withPhoto)).toBe(false);
    expect(lacksEvidence(withProof)).toBe(false);
  });

  it('does not ask when no storage provider is configured (the vendor could never attach one)', () => {
    storage.get.mockReturnValue({ isConfigured: () => false });
    expect(evidenceRequired()).toBe(false);
    expect(lacksEvidence(noPhotos)).toBe(false);
  });

  it('does not ask when the provider cannot even be created', () => {
    storage.get.mockImplementation(() => {
      throw new Error('Unknown STORAGE_PROVIDER');
    });
    expect(evidenceRequired()).toBe(false);
    expect(lacksEvidence(noPhotos)).toBe(false);
  });
});
