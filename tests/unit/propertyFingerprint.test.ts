import { describe, it, expect, vi } from 'vitest';
import { listingHash, findPossibleDuplicates } from '@/lib/propertyFingerprint';
import { prisma } from '@/lib/db';

vi.mock('@/lib/db', () => ({
  prisma: {
    property: {
      findMany: vi.fn(),
    },
  },
}));

describe('propertyFingerprint - listingHash', () => {
  it('hashes normalized address and city consistently', () => {
    const hash1 = listingHash('123 Victoria Island Way', 'Lagos');
    const hash2 = listingHash('123 Victoria Island Way', 'Lagos');
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[0-9a-f]{64}$/);
  });

  it('normalizes casing and completely strips punctuation and spaces', () => {
    // Specifically verify that non-alphanumeric chars are replaced with empty string, not a replacement token
    const hashOriginal = listingHash('123victoriast4apta', 'lagos');
    const hashPunctuation = listingHash('123 Victoria St. #4, Apt-A', 'Lagos!');
    expect(hashPunctuation).toBe(hashOriginal);
  });

  it('differentiates distinct addresses in the same city', () => {
    const hash1 = listingHash('123 Victoria Island Way', 'Lagos');
    const hash2 = listingHash('124 Victoria Island Way', 'Lagos');
    expect(hash1).not.toBe(hash2);
  });

  it('differentiates same address in different cities', () => {
    const hash1 = listingHash('123 Commercial Ave', 'Lagos');
    const hash2 = listingHash('123 Commercial Ave', 'Abuja');
    expect(hash1).not.toBe(hash2);
  });

  it('handles empty strings gracefully', () => {
    const hashEmpty = listingHash('', '');
    expect(hashEmpty).toMatch(/^[0-9a-f]{64}$/);
    expect(hashEmpty.length).toBe(64);
  });
});

describe('propertyFingerprint - findPossibleDuplicates', () => {
  it('queries prisma for active duplicates with matching hash', async () => {
    const mockFindMany = vi.mocked(prisma.property.findMany);
    mockFindMany.mockResolvedValueOnce(
      [{ id: 'prop-1', name: 'Duplicated Building' }] as unknown as Parameters<typeof mockFindMany.mockResolvedValueOnce>[0],
    );

    const results = await findPossibleDuplicates('hash-12345');
    expect(results).toEqual([{ id: 'prop-1', name: 'Duplicated Building' }]);
    expect(mockFindMany).toHaveBeenCalledWith({
      where: {
        listingHash: 'hash-12345',
        mergedIntoId: null,
      },
      select: { id: true, name: true },
    });
  });

  it('excludes current property ID when excludeId is provided', async () => {
    const mockFindMany = vi.mocked(prisma.property.findMany);
    mockFindMany.mockResolvedValueOnce([]);

    await findPossibleDuplicates('hash-12345', 'prop-current');
    expect(mockFindMany).toHaveBeenCalledWith({
      where: {
        listingHash: 'hash-12345',
        id: { not: 'prop-current' },
        mergedIntoId: null,
      },
      select: { id: true, name: true },
    });
  });
});
