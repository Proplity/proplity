import { describe, it, expect } from 'vitest';
import { FOLDER_ACCESS, accessForFolder, fileUrl, parseFileUrl } from '@/lib/fileRef';

describe('fileRef utility', () => {
  it('correctly maps folder privacy access per ADR-0010', () => {
    expect(accessForFolder('maintenance-requests')).toBe('private');
    expect(accessForFolder('applications')).toBe('private');
    expect(accessForFolder('profile')).toBe('private');
    expect(accessForFolder('properties')).toBe('public');
    expect(accessForFolder('notices')).toBe('private');
    expect(accessForFolder('leases')).toBe('private');
    expect(accessForFolder('communications')).toBe('private');
    expect(FOLDER_ACCESS.properties).toBe('public');
  });

  it('generates consistent gateway fileUrl format', () => {
    const id = '12345678-1234-1234-1234-123456789abc';
    expect(fileUrl(id)).toBe(`/api/v1/files/${id}`);
  });

  it('parses valid StoredFile UUID from gateway URL and lowercases it', () => {
    const id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    expect(parseFileUrl(`/api/v1/files/${id}`)).toBe(id);
    expect(parseFileUrl(`/api/v1/files/${id.toUpperCase()}`)).toBe(id);
  });

  it('rejects invalid, non-string, or forged file URLs', () => {
    expect(parseFileUrl(null)).toBeNull();
    expect(parseFileUrl(undefined)).toBeNull();
    expect(parseFileUrl('')).toBeNull();
    expect(parseFileUrl(12345 as unknown as string)).toBeNull();
    expect(parseFileUrl({} as unknown as string)).toBeNull();
    expect(
      parseFileUrl(['/api/v1/files/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'] as unknown as string),
    ).toBeNull();
    expect(
      parseFileUrl('https://malicious.com/api/v1/files/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'),
    ).toBeNull();
    expect(parseFileUrl('/api/v1/files/not-a-uuid')).toBeNull();
    expect(parseFileUrl('/api/v1/files/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/extra')).toBeNull();
  });
});
