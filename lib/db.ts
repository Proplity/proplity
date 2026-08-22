import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const envConnectionString = process.env.DATABASE_URL;
if (!envConnectionString && process.env.NODE_ENV === 'production') {
  throw new Error('CRITICAL: DATABASE_URL environment variable is not defined in production!');
}

const connectionString =
  envConnectionString || 'postgresql://postgres:postgres@localhost:5432/proplity_db?schema=public';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const pool = new pg.Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
