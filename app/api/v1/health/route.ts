import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Never cached or prerendered: a health check that answers from a build-time
// snapshot reports the build's health, not the running instance's.
export const dynamic = 'force-dynamic';
// A health check must fail fast. If the database is wedged, the right answer
// is a quick 503, not a request that hangs until the platform's own timeout.
export const maxDuration = 10;

const DB_TIMEOUT_MS = 3_000;

/**
 * Liveness + readiness for uptime monitors and platform health checks.
 *
 * Deliberately unauthenticated -- a monitor has no session -- so the body is
 * kept free of anything that would help an attacker: no version, no
 * connection string, no error detail. A failure returns the shape of the
 * problem ("database": "down") and nothing about its cause; the cause goes to
 * the server log instead.
 *
 * 200 = ready to serve traffic. 503 = do not route traffic here.
 */
export async function GET() {
  const startedAt = Date.now();

  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('database health probe timed out')), DB_TIMEOUT_MS),
      ),
    ]);

    return NextResponse.json(
      { status: 'ok', database: 'up', latencyMs: Date.now() - startedAt },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    console.error('[health] database probe failed:', err);
    return NextResponse.json(
      { status: 'degraded', database: 'down', latencyMs: Date.now() - startedAt },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
