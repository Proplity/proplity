import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getAppUrl, appUrl } from '@/lib/appUrl';

function setNodeEnv(env: string) {
  (process.env as Record<string, string | undefined>).NODE_ENV = env;
}

describe('appUrl utility', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    delete process.env.VERCEL_URL;
    delete process.env.VERCEL_ENV;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('uses request origin in non-production environment', () => {
    setNodeEnv('development');
    const req = { nextUrl: { origin: 'http://localhost:3005' } };
    expect(getAppUrl(req)).toBe('http://localhost:3005');
    expect(appUrl('/login', req)).toBe('http://localhost:3005/login');
  });

  it('handles empty or missing request nextUrl in development', () => {
    setNodeEnv('development');
    expect(getAppUrl(null)).toBe('http://localhost:3000');
    expect(getAppUrl(undefined)).toBe('http://localhost:3000');
    expect(getAppUrl({})).toBe('http://localhost:3000');
    expect(getAppUrl({ nextUrl: {} })).toBe('http://localhost:3000');
    expect(getAppUrl({ nextUrl: { origin: '' } })).toBe('http://localhost:3000');
  });

  it('never uses non-local request origin in production', () => {
    setNodeEnv('production');
    process.env.NEXT_PUBLIC_APP_URL = 'https://proplity.com';
    const attackerReq = { nextUrl: { origin: 'https://attacker.com' } };
    expect(getAppUrl(attackerReq)).toBe('https://proplity.com');
    expect(appUrl('/reset-password?token=safe', attackerReq)).toBe(
      'https://proplity.com/reset-password?token=safe',
    );
  });

  it('prefers explicit NEXT_PUBLIC_APP_URL in production when not local', () => {
    setNodeEnv('production');
    process.env.NEXT_PUBLIC_APP_URL = 'https://proplity.com/';
    expect(getAppUrl()).toBe('https://proplity.com');
    expect(appUrl('/properties/123')).toBe('https://proplity.com/properties/123');
  });

  it('does not treat local explicit NEXT_PUBLIC_APP_URL as public domain', () => {
    setNodeEnv('production');
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:5000';
    process.env.VERCEL_ENV = 'production';
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'prod.proplity.com';
    // Because NEXT_PUBLIC_APP_URL is localhost, it shouldn't override Vercel production domain
    expect(getAppUrl()).toBe('https://prod.proplity.com');
  });

  it('trims multiple trailing slashes from base URL', () => {
    setNodeEnv('production');
    process.env.NEXT_PUBLIC_APP_URL = 'https://proplity.com///';
    expect(getAppUrl()).toBe('https://proplity.com');
    expect(appUrl('/about')).toBe('https://proplity.com/about');
  });

  it('uses VERCEL_PROJECT_PRODUCTION_URL in production Vercel environment', () => {
    setNodeEnv('production');
    process.env.VERCEL_ENV = 'production';
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'app.proplity.com';
    expect(getAppUrl()).toBe('https://app.proplity.com');
  });

  it('does not use VERCEL_PROJECT_PRODUCTION_URL when VERCEL_ENV is not production', () => {
    setNodeEnv('production');
    process.env.VERCEL_ENV = 'preview';
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'app.proplity.com';
    process.env.VERCEL_URL = 'preview.proplity.com';
    expect(getAppUrl()).toBe('https://preview.proplity.com');
  });

  it('falls back to VERCEL_PROJECT_PRODUCTION_URL if VERCEL_URL is missing', () => {
    setNodeEnv('production');
    delete process.env.VERCEL_ENV;
    delete process.env.VERCEL_URL;
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'fallback.proplity.com';
    expect(getAppUrl()).toBe('https://fallback.proplity.com');
  });

  it('uses VERCEL_URL on preview deployments', () => {
    setNodeEnv('production');
    process.env.VERCEL_ENV = 'preview';
    process.env.VERCEL_URL = 'proplity-preview-123.vercel.app';
    expect(getAppUrl()).toBe('https://proplity-preview-123.vercel.app');
  });

  it('echoes loopback request origin in production when nothing public configured', () => {
    setNodeEnv('production');
    const req = { nextUrl: { origin: 'http://127.0.0.1:4000' } };
    expect(getAppUrl(req)).toBe('http://127.0.0.1:4000');

    const reqLocalhost = { nextUrl: { origin: 'http://localhost:8080' } };
    expect(getAppUrl(reqLocalhost)).toBe('http://localhost:8080');
  });

  it('defaults to localhost:3000 if nothing else is available', () => {
    setNodeEnv('production');
    expect(getAppUrl()).toBe('http://localhost:3000');
  });

  it('rewrites auth api verification and reset paths to user-facing pages', () => {
    setNodeEnv('production');
    process.env.NEXT_PUBLIC_APP_URL = 'https://proplity.com';

    expect(appUrl('/api/v1/auth/verify-email?token=xyz')).toBe(
      'https://proplity.com/verify-email?token=xyz',
    );
    expect(appUrl('/api/v1/verify-email?token=xyz')).toBe(
      'https://proplity.com/verify-email?token=xyz',
    );
    expect(appUrl('/api/v1/auth/reset-password?token=abc')).toBe(
      'https://proplity.com/reset-password?token=abc',
    );
    expect(appUrl('/api/v1/reset-password?token=abc')).toBe(
      'https://proplity.com/reset-password?token=abc',
    );
  });

  it('leaves other API routes unchanged', () => {
    setNodeEnv('production');
    process.env.NEXT_PUBLIC_APP_URL = 'https://proplity.com';
    expect(appUrl('/api/v1/properties')).toBe('https://proplity.com/api/v1/properties');
    expect(appUrl('/api/v1/auth/login')).toBe('https://proplity.com/api/v1/auth/login');
  });

  it('ensures single leading slash formatting', () => {
    setNodeEnv('production');
    process.env.NEXT_PUBLIC_APP_URL = 'https://proplity.com';
    expect(appUrl('dashboard')).toBe('https://proplity.com/dashboard');
    expect(appUrl('/dashboard')).toBe('https://proplity.com/dashboard');
  });
});
