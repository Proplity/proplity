import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

// Separate from the app's lib/db.ts singleton on purpose -- this client is
// for test-side fixture setup and out-of-band assertions only, never
// imported into application code. Points at DATABASE_URL from .env.test
// (loaded into process.env by tests/setup/loadEnv.ts before this runs).
// Needs the same driver-adapter construction as lib/db.ts -- this Prisma
// version's generated client has no default connection path without one.
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
export const testPrisma = new PrismaClient({ adapter });

/** Truncates every app table so each test file starts from a clean slate. */
export async function resetDb() {
  const tables = await testPrisma.$queryRawUnsafe<{ tablename: string }[]>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE '\\_prisma%';`,
  );
  if (tables.length === 0) return;
  const list = tables.map((t) => `"${t.tablename}"`).join(', ');
  await testPrisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE;`);
}
