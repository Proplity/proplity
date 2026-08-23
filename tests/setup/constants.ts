// Shared between globalSetup.ts (separate process, spawns the server) and
// the test-file workers (import this to build request URLs) -- avoids
// relying on env vars crossing the globalSetup/worker process boundary.
export const TEST_PORT = 3101;
export const TEST_BASE_URL = `http://localhost:${TEST_PORT}`;
