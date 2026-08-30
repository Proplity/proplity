import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Prisma CLI work (migrate/db push/studio) must go over a DIRECT, unpooled
// connection: a transaction-mode pooler (PgBouncer, Supabase :6543, Neon's
// -pooler host) can't hold the session-level advisory lock `migrate` takes,
// nor run its DDL. The app runtime is unaffected -- lib/db.ts builds its own
// pg Pool from DATABASE_URL, which is where the pooled URL belongs.
//
// Falls back to DATABASE_URL so a single-URL setup (local dev, a plain
// non-pooled Postgres) keeps working with no extra configuration.
const migrationUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

export default defineConfig({
  schema: 'prisma/schema',
  migrations: {
    path: 'prisma/migrations',
  },
  // Spread rather than always-set: `prisma generate` needs no database at all,
  // but prisma/config's `env()` helper threw at config-load time when the var
  // was unset -- which broke the Vercel `postinstall` generate. Omitting the
  // key entirely lets generate run URL-free and still fails loudly on migrate.
  ...(migrationUrl ? { datasource: { url: migrationUrl } } : {}),
});
