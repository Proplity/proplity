import { describe, it, expect } from 'vitest';
import { parseFileUrl } from '@/lib/fileRef';
import { appUrl } from '@/lib/appUrl';
import { getClientIp } from '@/lib/auth/rateLimit';

// Fuzz test suite for URL, Path, and Network Header Parsers
describe('Fuzz Testing: URL and Path Parsers', () => {
  const ADVERSARIAL_INPUTS = [
    // Null bytes and control chars
    'null\0byte',
    '\x00\x01\x02\x03\x04\x05\x06\x07\x08\x09\x0a\x0b\x0c\x0d\x0e\x0f',
    '\r\nSet-Cookie: session=hijacked\r\n',
    '\u0000',
    '\uFFFF',
    // Path traversal
    '../../../etc/passwd',
    '..\\..\\..\\windows\\system32\\cmd.exe',
    '/api/v1/files/../../secret',
    '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
    // Protocol smuggling & XSS
    'javascript:alert(1)',
    'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    '//attacker.com/evil',
    'https://attacker.com/evil',
    '/\attacker.com',
    '\\\\attacker.com\\share',
    // SQL / Command injection
    "' OR 1=1; DROP TABLE properties; --",
    '1; ls -la; cat /etc/shadow',
    '$(whoami)',
    '`id`',
    // Unicode, homoglyphs and emojis
    '🚀🔥💥🏠🏢',
    'а0ееbс99-9с0b-4еf8-bb6d-6bb9bd380а11', // Cyrillic lookalikes
    'ＡＢＣＤＥＦ-1234-5678', // Full-width unicode
    'test\u202Ereversed', // Right-to-left override
    // Boundary lengths
    '',
    'a',
    'a'.repeat(256),
    'a'.repeat(4096),
    'a'.repeat(65536),
    // Numeric and type anomalies
    'NaN',
    'undefined',
    'null',
    'true',
    'false',
    '0',
    '-1',
  ];

  it('fuzz tests parseFileUrl against adversarial strings without crashing or leaking', () => {
    for (const input of ADVERSARIAL_INPUTS) {
      // Must not throw, must return null for any non-conforming UUID
      let result: string | null = null;
      expect(() => {
        result = parseFileUrl(input);
      }).not.toThrow();
      expect(result).toBeNull();
    }
  });

  it('fuzz tests parseFileUrl with 1,000 randomized mutated UUID payloads', () => {
    const validUuid = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    for (let i = 0; i < 1000; i++) {
      // Randomly mutate validUuid
      const chars = validUuid.split('');
      const mutationIndex = Math.floor(Math.random() * chars.length);
      const randomChar = String.fromCharCode(Math.floor(Math.random() * 128));
      chars[mutationIndex] = randomChar;
      const mutated = `/api/v1/files/${chars.join('')}`;

      let parsed: string | null = null;
      expect(() => {
        parsed = parseFileUrl(mutated);
      }).not.toThrow();

      if (parsed !== null) {
        // If it accepted the string, it MUST strictly match standard UUID hex format
        expect(parsed).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      }
    }
  });

  it('fuzz tests appUrl against open redirect and protocol smuggling payloads', () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    process.env.NEXT_PUBLIC_APP_URL = 'https://proplity.com';

    for (const input of ADVERSARIAL_INPUTS) {
      let resolved: string = '';
      expect(() => {
        resolved = appUrl(input);
      }).not.toThrow();

      // Must always stay rooted on proplity.com base URL
      expect(resolved.startsWith('https://proplity.com/')).toBe(true);
    }
  });

  it('fuzz tests getClientIp against high-volume and malicious X-Forwarded-For headers', () => {
    // Fuzz with deeply nested chained proxies
    const proxyChains = [
      '10.0.0.1, 10.0.0.2, 10.0.0.3, 192.168.1.1',
      Array(200).fill('10.0.0.1').join(', ') + ', 203.0.113.195',
      '   192.168.1.50   ,   10.0.0.5   ',
      'malicious-host\r\ninjected: true, 198.51.100.1',
      '::1, 2001:db8::1, fe80::1',
      '',
      ',,,,,',
      '   ',
    ];

    for (const chain of proxyChains) {
      const req = {
        headers: {
          get: (name: string) => (name.toLowerCase() === 'x-forwarded-for' ? chain : null),
        },
      };

      let clientIp = '';
      expect(() => {
        clientIp = getClientIp(req);
      }).not.toThrow();

      expect(typeof clientIp).toBe('string');
      // Must be trimmed
      expect(clientIp).toBe(clientIp.trim());
    }
  });
});
