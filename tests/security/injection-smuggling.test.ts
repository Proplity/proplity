import { describe, it, expect } from 'vitest';
import { isSafeUrl, safeUrl, safeUrlOrName } from '@/lib/api/urlField';
import { safeRedirect } from '@/lib/safeRedirect';

describe('Security Testing: Injection, Protocol Smuggling & Open Redirects', () => {
  it('blocks dangerous protocol smuggling attacks in URL fields', () => {
    const dangerousUrls = [
      'javascript:alert(document.cookie)',
      'JAVASCRIPT:alert(1)',
      'java\0script:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
      'vbscript:msgbox(1)',
      'file:///etc/passwd',
      'blob:https://proplity.com/uuid',
      'http://insecure-cdn.com/avatar.jpg', // HTTP rejected, only HTTPS allowed
      'ftp://files.example.com/id.pdf',
    ];

    for (const url of dangerousUrls) {
      expect(isSafeUrl(url)).toBe(false);
      expect(safeUrl.safeParse(url).success).toBe(false);
    }
  });

  it('blocks protocol-relative, backslash smuggling and control char injection', () => {
    const smugglingUrls = [
      '//attacker.com/evil.js',
      '/\\attacker.com/evil',
      '\\attacker.com',
      '/images/test\0.png',
      '/images/test\r\nSet-Cookie: stolen=1',
      '/images/test\x1b[31m',
    ];

    for (const url of smugglingUrls) {
      expect(isSafeUrl(url)).toBe(false);
      expect(safeUrl.safeParse(url).success).toBe(false);
    }
  });

  it('rejects URLs exceeding 2048 characters to prevent ReDoS / memory bloat', () => {
    const longUrl = 'https://example.com/' + 'a'.repeat(2048);
    expect(isSafeUrl(longUrl)).toBe(false);
  });

  it('allows genuine gateway files, site relative paths, and HTTPS URLs', () => {
    const validUrls = [
      '/api/v1/files/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      '/images/logo.png',
      '/assets/hero-banner.jpg',
      'https://res.cloudinary.com/proplity/image/upload/sample.jpg',
      'https://s3.eu-west-1.amazonaws.com/proplity-storage/file.pdf',
    ];

    for (const url of validUrls) {
      expect(isSafeUrl(url)).toBe(true);
      expect(safeUrl.safeParse(url).success).toBe(true);
    }
  });

  it('validates safeUrlOrName allows plain alphanumeric document names while blocking schemes', () => {
    expect(safeUrlOrName.safeParse('passport_scan_2026.pdf').success).toBe(true);
    expect(safeUrlOrName.safeParse('national_id.jpg').success).toBe(true);

    // Must block anything containing colons, slashes, or control characters
    expect(safeUrlOrName.safeParse('javascript:test').success).toBe(false);
    expect(safeUrlOrName.safeParse('../secret.pdf').success).toBe(false);
    expect(safeUrlOrName.safeParse('folder/file.pdf').success).toBe(false);
    expect(safeUrlOrName.safeParse('c:\\passwords.txt').success).toBe(false);
  });

  it('tests open redirect protection in safeRedirect', () => {
    const maliciousRedirects = [
      'https://evil.com/phishing',
      'http://evil.com/phishing',
      '//evil.com',
      '///evil.com',
      '/\\evil.com',
      'javascript:alert(1)',
      'data:text/html,evil',
      '',
      null,
    ];

    for (const target of maliciousRedirects) {
      expect(safeRedirect(target)).toBeNull();
    }

    const safeRedirects = [
      '/dashboard',
      '/properties/12345',
      '/admin/reports',
      '/proplity-guide',
    ];

    for (const target of safeRedirects) {
      expect(safeRedirect(target)).toBe(target);
    }
  });
});
