import { SignJWT, jwtVerify } from 'jose';

const secretKey = process.env.JWT_SECRET;
if (!secretKey && process.env.NODE_ENV === 'production') {
  throw new Error('CRITICAL: JWT_SECRET environment variable is not defined in production!');
}

const JWT_SECRET = new TextEncoder().encode(
  secretKey || 'dev_proplity_jwt_secret_key_2026_only_for_local_testing_environment',
);

export interface JWTPayload {
  sub: string;
  role: string;
}

export async function signAccessToken(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

// Signature-valid but possibly expired -- for the one place an expired
// access token still needs to identify *whose* session to clean up
// (logout). jose's JWTExpired error carries the decoded payload precisely
// for this use case: the signature already checked out before expiry was
// evaluated, so the claims are trustworthy for identification, just not for
// authorization. Any other failure (bad signature, wrong alg, malformed)
// still returns null -- never treat an unverifiable token as identifying
// anyone. NEVER use this for authorization decisions, only for revoking a
// session the caller is trying to end anyway.
export async function verifyTokenAllowExpired(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as JWTPayload;
  } catch (err) {
    // Checked by `code`, not `instanceof errors.JWTExpired` -- Next.js can
    // bundle 'jose' into more than one module instance across the route
    // handler and library boundary, which silently breaks `instanceof`
    // across that boundary. `code` is a plain string on the error object
    // and survives that; jose documents this as the reliable way to switch
    // on error type. Still exclusively checking JWTExpired's specific
    // payload -- any other failure (bad signature, wrong alg, malformed)
    // returns null, same as before.
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      err.code === 'ERR_JWT_EXPIRED' &&
      'payload' in err
    ) {
      return err.payload as unknown as JWTPayload;
    }
    return null;
  }
}
