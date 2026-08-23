import path from 'path';
import { spawn, execSync, ChildProcess } from 'child_process';
import { Client } from 'pg';
import dotenv from 'dotenv';
import { TEST_PORT, TEST_BASE_URL } from './constants';

const envPath = path.resolve(process.cwd(), '.env.test');
const parsedEnv = dotenv.config({ path: envPath }).parsed;

if (!parsedEnv?.DATABASE_URL) {
  throw new Error(
    `Missing or incomplete ${envPath} -- copy .env.test.example to .env.test and fill in a ` +
      `DATABASE_URL pointing at a DIFFERENT database than the one in .env (this file is dropped ` +
      `and recreated on every test run).`,
  );
}
const testDbUrl: string = parsedEnv.DATABASE_URL;

function dbNameFromUrl(url: string) {
  return new URL(url).pathname.replace(/^\//, '');
}

async function recreateTestDatabase(testDbUrl: string) {
  const dbName = dbNameFromUrl(testDbUrl);
  const maintenanceUrl = testDbUrl.replace(`/${dbName}`, '/postgres');
  const client = new Client({ connectionString: maintenanceUrl });
  await client.connect();
  try {
    await client.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid();`,
      [dbName],
    );
    await client.query(`DROP DATABASE IF EXISTS "${dbName}";`);
    await client.query(`CREATE DATABASE "${dbName}";`);
  } finally {
    await client.end();
  }
}

function runMigrations(testDbUrl: string) {
  execSync('pnpm exec prisma migrate deploy', {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: testDbUrl },
    stdio: process.env.TEST_SETUP_LOGS ? 'inherit' : 'pipe',
  });
}

async function waitForServer(timeoutMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${TEST_BASE_URL}/api/v1/auth/me`);
      if (res.status === 401) return;
    } catch {
      // server not accepting connections yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Test server did not become ready within ${timeoutMs}ms`);
}

export default async function globalSetup() {
  await recreateTestDatabase(testDbUrl);
  runMigrations(testDbUrl);

  const serverEnv = {
    ...process.env,
    ...parsedEnv,
    PORT: String(TEST_PORT),
    NEXT_TEST_DIST_DIR: '.next-test',
  };
  const server: ChildProcess = spawn('pnpm', ['exec', 'next', 'dev'], {
    cwd: process.cwd(),
    env: serverEnv,
    stdio: process.env.TEST_SERVER_LOGS ? 'inherit' : 'ignore',
  });

  await waitForServer();

  return async () => {
    server.kill('SIGTERM');
  };
}
