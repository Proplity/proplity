import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  normalizeHost,
  adminHost,
  hostMode,
  roleAllowedOnHost,
  isAdminPage,
  isAdminApi,
  isGeneralLoginApi,
  isStaticPath,
  adminUrl,
} from '@/lib/adminHost';

const req = (host: string, extra: Record<string, string> = {}) => ({
  headers: new Headers({ host, ...extra }),
});

describe('adminHost', () => {
  const original = process.env.ADMIN_HOST;
  beforeEach(() => {
    delete process.env.ADMIN_HOST;
  });
  afterEach(() => {
    if (original === undefined) delete process.env.ADMIN_HOST;
    else process.env.ADMIN_HOST = original;
  });

  describe('normalizeHost', () => {
    it.each([
      ['admin.proplity.com', 'admin.proplity.com'],
      ['Admin.Proplity.COM', 'admin.proplity.com'],
      ['https://admin.proplity.com/', 'admin.proplity.com'],
      ['admin.proplity.com:3000', 'admin.proplity.com'],
      ['admin.proplity.com.', 'admin.proplity.com'],
      ['  admin.localhost:3000  ', 'admin.localhost'],
      ['', null],
      [undefined, null],
    ])('%s -> %s', (input, expected) => {
      expect(normalizeHost(input)).toBe(expected);
    });
  });

  describe('hostMode', () => {
    it('is "shared" when no admin host is configured, whatever the request host', () => {
      expect(adminHost()).toBeNull();
      expect(hostMode(req('proplity.com'))).toBe('shared');
      expect(hostMode(req('admin.proplity.com'))).toBe('shared');
    });

    it('separates the admin host from everything else once configured', () => {
      process.env.ADMIN_HOST = 'admin.proplity.com';
      expect(hostMode(req('admin.proplity.com'))).toBe('admin');
      expect(hostMode(req('Admin.Proplity.com:443'))).toBe('admin');
      expect(hostMode(req('proplity.com'))).toBe('public');
      expect(hostMode(req('proplity-ecru.vercel.app'))).toBe('public');
      // a host that merely contains the admin host is not the admin host
      expect(hostMode(req('admin.proplity.com.evil.example'))).toBe('public');
      expect(hostMode(req('notadmin.proplity.com'))).toBe('public');
    });

    it('uses x-forwarded-host ahead of host, like the CSRF check', () => {
      process.env.ADMIN_HOST = 'admin.proplity.com';
      expect(hostMode(req('internal:3000', { 'x-forwarded-host': 'admin.proplity.com' }))).toBe(
        'admin',
      );
    });

    it('handles staging the same way', () => {
      process.env.ADMIN_HOST = 'admin.staging.proplity.com';
      expect(hostMode(req('admin.staging.proplity.com'))).toBe('admin');
      expect(hostMode(req('staging.proplity.com'))).toBe('public');
      expect(hostMode(req('admin.proplity.com'))).toBe('public');
    });
  });

  describe('roleAllowedOnHost', () => {
    it('lets every role through on a shared host', () => {
      expect(roleAllowedOnHost('ADMIN', req('proplity.com'))).toBe(true);
      expect(roleAllowedOnHost('TENANT', req('proplity.com'))).toBe(true);
    });

    it('admin only on the admin host, everyone else only off it', () => {
      process.env.ADMIN_HOST = 'admin.proplity.com';
      expect(roleAllowedOnHost('ADMIN', req('admin.proplity.com'))).toBe(true);
      expect(roleAllowedOnHost('TENANT', req('admin.proplity.com'))).toBe(false);
      expect(roleAllowedOnHost('MANAGER', req('admin.proplity.com'))).toBe(false);
      expect(roleAllowedOnHost('ADMIN', req('proplity.com'))).toBe(false);
      expect(roleAllowedOnHost('TENANT', req('proplity.com'))).toBe(true);
      expect(roleAllowedOnHost('VENDOR', req('proplity.com'))).toBe(true);
    });
  });

  describe('path classifiers', () => {
    it('knows the admin pages', () => {
      expect(isAdminPage('/admin')).toBe(true);
      expect(isAdminPage('/admin/login')).toBe(true);
      expect(isAdminPage('/admin/users/1')).toBe(true);
      expect(isAdminPage('/administrators')).toBe(false);
      expect(isAdminPage('/dashboard')).toBe(false);
    });

    it('knows the admin APIs and the general login', () => {
      expect(isAdminApi('/api/v1/admin/users')).toBe(true);
      expect(isAdminApi('/api/v1/auth/admin/login')).toBe(true);
      expect(isAdminApi('/api/v1/auth/login')).toBe(false);
      expect(isAdminApi('/api/v1/administrators')).toBe(false);
      expect(isGeneralLoginApi('/api/v1/auth/login')).toBe(true);
      expect(isGeneralLoginApi('/api/v1/auth/admin/login')).toBe(false);
    });

    it('knows static paths', () => {
      expect(isStaticPath('/_next/static/x.js')).toBe(true);
      expect(isStaticPath('/favicon.ico')).toBe(true);
      expect(isStaticPath('/icons/a.png')).toBe(true);
      expect(isStaticPath('/dashboard')).toBe(false);
    });
  });

  describe('adminUrl', () => {
    it('is a relative path with no admin host, an absolute URL with one', () => {
      expect(adminUrl('/admin/login')).toBe('/admin/login');
      process.env.ADMIN_HOST = 'admin.proplity.com';
      expect(adminUrl('/admin/login')).toBe('https://admin.proplity.com/admin/login');
      expect(adminUrl('admin')).toBe('https://admin.proplity.com/admin');
      expect(adminUrl('/admin', 'http:')).toBe('http://admin.proplity.com/admin');
    });
  });
});
