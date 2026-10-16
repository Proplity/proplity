import { describe, it, expect } from 'vitest';
import { signAccessToken, verifyToken, verifyTokenAllowExpired } from '@/lib/auth/jwt';
import { SignJWT, decodeProtectedHeader, decodeJwt } from 'jose';

describe('auth jwt utilities', () => {
  it('signs tokens with HS256 algorithm and 15-minute expiration', async () => {
    const payload = { sub: 'user-12345', role: 'LANDLORD' };
    const token = await signAccessToken(payload);
    expect(typeof token).toBe('string');

    const header = decodeProtectedHeader(token);
    expect(header.alg).toBe('HS256');

    const decoded = decodeJwt(token);
    expect(decoded.sub).toBe(payload.sub);
    expect(decoded.role).toBe(payload.role);
    expect(decoded.exp).toBeDefined();
    expect(decoded.iat).toBeDefined();
    // 15 minutes = 900 seconds
    expect(decoded.exp! - decoded.iat!).toBe(900);

    const verified = await verifyToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.sub).toBe(payload.sub);
    expect(verified?.role).toBe(payload.role);
  });

  it('rejects tampered or malformed tokens', async () => {
    expect(await verifyToken('not-a-token')).toBeNull();
    expect(await verifyToken('')).toBeNull();

    const payload = { sub: 'user-12345', role: 'LANDLORD' };
    const valid = await signAccessToken(payload);
    const tampered = valid.substring(0, valid.length - 5) + 'abcde';
    expect(await verifyToken(tampered)).toBeNull();
  });

  it('allows expired tokens through verifyTokenAllowExpired for session cleanup', async () => {
    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET ||
        'dev_proplity_jwt_secret_key_2026_only_for_local_testing_environment',
    );
    const expiredToken = await new SignJWT({ sub: 'user-expired', role: 'TENANT' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 1000)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 500)
      .sign(secret);

    // Standard verifyToken must reject expired token
    const normalVerify = await verifyToken(expiredToken);
    expect(normalVerify).toBeNull();

    // verifyTokenAllowExpired must decode claims for identification
    const allowExpired = await verifyTokenAllowExpired(expiredToken);
    expect(allowExpired).not.toBeNull();
    expect(allowExpired?.sub).toBe('user-expired');
    expect(allowExpired?.role).toBe('TENANT');
  });

  it('verifies non-expired token in verifyTokenAllowExpired passes through normally', async () => {
    const payload = { sub: 'user-active', role: 'MANAGER' };
    const token = await signAccessToken(payload);
    const verified = await verifyTokenAllowExpired(token);
    expect(verified).not.toBeNull();
    expect(verified?.sub).toBe('user-active');
  });

  it('rejects tampered tokens in verifyTokenAllowExpired', async () => {
    expect(await verifyTokenAllowExpired('invalid.garbage.token')).toBeNull();
    expect(await verifyTokenAllowExpired('')).toBeNull();
  });

  it('rejects token signed with wrong secret key in verifyTokenAllowExpired', async () => {
    const wrongSecret = new TextEncoder().encode(
      'completely_different_secret_key_for_testing_123456',
    );
    const wrongToken = await new SignJWT({ sub: 'user-attacker', role: 'ADMIN' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 1000)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 500)
      .sign(wrongSecret);

    expect(await verifyTokenAllowExpired(wrongToken)).toBeNull();
  });
});
