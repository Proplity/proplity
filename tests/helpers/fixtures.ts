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
