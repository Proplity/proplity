import { describe, expect, it } from 'vitest';
import { TEST_BASE_URL } from '../setup/constants';

describe('security headers', () => {
  it('sets framing, sniffing and referrer protections on every response', async () => {
    const res = await fetch(`${TEST_BASE_URL}/api/v1/health`);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('SAMEORIGIN');
    expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
    expect(res.headers.get('content-security-policy')).toContain("frame-ancestors 'self'");
  });
});
