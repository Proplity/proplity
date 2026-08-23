// Vitest setupFile, runs inside every test-worker process (a different
// process than globalSetup.ts). Needed so helpers that import app code
// directly -- e.g. tests/helpers/auth.ts importing lib/auth/jwt.ts to mint
// tokens -- see the same JWT_SECRET the spawned test server is using.
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.test') });
