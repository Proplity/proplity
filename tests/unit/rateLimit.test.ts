import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getClientIp, registerMaxAttempts } from '@/lib/auth/rateLimit';

describe('rateLimit helpers', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('correctly reads registerMaxAttempts default and env override', () => {
    delete process.env.REGISTER_MAX_ATTEMPTS;
    expect(registerMaxAttempts()).toBe(5);

    process.env.REGISTER_MAX_ATTEMPTS = '25';
    expect(registerMaxAttempts()).toBe(25);

    process.env.REGISTER_MAX_ATTEMPTS = 'invalid';
    expect(registerMaxAttempts()).toBe(5);

    process.env.REGISTER_MAX_ATTEMPTS = '-3';
    expect(registerMaxAttempts()).toBe(5);
  });

  it('extracts trusted client IP from the last hop of X-Forwarded-For per ADR-0005', () => {
    const singleHop = {
      headers: {
        get: (h: string) => (h.toLowerCase() === 'x-forwarded-for' ? '192.168.1.100' : null),
      },
    };
    expect(getClientIp(singleHop)).toBe('192.168.1.100');

    // Spoofed client IP in first position, trusted proxy hop at the end
    const multiHop = {
      headers: {
        get: (h: string) =>
          h.toLowerCase() === 'x-forwarded-for' ? '10.0.0.1, 172.16.0.2, 203.0.113.50' : null,
      },
    };
    expect(getClientIp(multiHop)).toBe('203.0.113.50');
  });

  it('falls back to 127.0.0.1 when header is absent', () => {
    const noHeader = {
      headers: {
        get: () => null,
      },
    };
    expect(getClientIp(noHeader)).toBe('127.0.0.1');
  });
});
