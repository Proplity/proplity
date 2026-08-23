import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { Role, UserStatus } from '@prisma/client';
import { testPrisma } from './db';

let counter = 0;
function unique(prefix: string) {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

/** Default password for every fixture user, matching the seeded dev accounts. */
export const FIXTURE_PASSWORD = 'Password123!';
let cachedPasswordHash: string | null = null;
async function passwordHash() {
  if (!cachedPasswordHash) cachedPasswordHash = await bcrypt.hash(FIXTURE_PASSWORD, 12);
  return cachedPasswordHash;
}

export async function createUser(
  role: Role = Role.TENANT,
  overrides: Partial<{
    email: string;
    name: string;
    status: UserStatus;
    phoneNumber: string | null;
  }> = {},
) {
  return testPrisma.user.create({
    data: {
      email: overrides.email ?? `${unique(role.toLowerCase())}@test.local`,
      name: overrides.name ?? `Test ${role}`,
      passwordHash: await passwordHash(),
      role,
      status: overrides.status ?? UserStatus.ACTIVE,
      phoneNumber: overrides.phoneNumber ?? null,
    },
  });
}

/** Mirrors verify-email's own token hashing so the route can find what we create here. */
export async function createVerificationToken(
  userId: string,
  overrides: Partial<{ expiresAt: Date }> = {},
) {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const record = await testPrisma.verificationToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt: overrides.expiresAt ?? new Date(Date.now() + 60 * 60 * 1000),
    },
  });
  return { rawToken, record };
}

/** Seeds LoginAttempt rows directly to simulate an identifier whose rate limit is already exhausted. */
export async function fillRateLimit(identifier: string, count = 5) {
  await testPrisma.loginAttempt.createMany({
    data: Array.from({ length: count }, () => ({ identifier })),
  });
}
