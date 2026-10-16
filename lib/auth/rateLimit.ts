import { prisma } from '@/lib/db';

const WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ATTEMPTS = 5;

// refresh/route.ts's traffic isn't credential-guessing (the secret being
// protected is a 256-bit random refresh token -- volumetric brute force
// isn't a realistic threat at any sane limit) -- it's a periodic background
// call every authenticated tab makes on its own timer (useAuthRefresh.ts,
// ~every 13 minutes) plus a reactive one on any 401. Multiple staff behind
// one office/NAT IP, or several tabs each on their own timer, legitimately
// exceeds 5 calls per 5 minutes from a single observed IP; MAX_ATTEMPTS was
// tuned for login's actual brute-force surface (a guessable password), not
// this. A much looser cap still meaningfully throttles abuse without
// locking out ordinary multi-session usage from a shared IP.
export const REFRESH_MAX_ATTEMPTS = 30;

// Registrations per IP per window. Defaults to the same 5 as login. The
// Playwright run starts several registration tests at once from one IP and
// raises this on its own dev server only (playwright.config.ts); a production
// deployment should leave REGISTER_MAX_ATTEMPTS unset.
export function registerMaxAttempts(): number {
  const n = Number(process.env.REGISTER_MAX_ATTEMPTS);
  return Number.isInteger(n) && n > 0 ? n : MAX_ATTEMPTS;
}

// Callers sharing an identifier queue on the advisory lock, so a transaction can
// legitimately wait on the others ahead of it. Prisma's default 5 s timeout
// expired under a burst of sign-ups from one IP and surfaced as a 500; give the
// queue room instead (ISS-006).
const TX_OPTIONS = { timeout: 20_000, maxWait: 20_000 } as const;

export type Reservation = {
  allowed: boolean;
  attemptId: string | null;
  remaining: number;
  retryAfterSeconds?: number;
  resetAt?: Date;
};

// Atomically checks-and-reserves a rate-limit slot using a true sliding-window
// log (ISS-021) guarded by a PostgreSQL advisory transaction lock.
//
// Sliding-window guarantees:
// 1. Sliding boundary: Evaluates attempts in the exact rolling window [now - windowMs, now],
//    completely eliminating fixed-window boundary burst bypasses (~2x limit).
// 2. Active table pruning: Automatically purges expired attempts older than windowMs
//    for the identifier on each reservation pass, preventing unbounded table growth.
// 3. Precise retry timing: Computes exact remaining attempts, resetAt timestamp, and
//    retryAfterSeconds derived from the oldest entry in the active window.
// 4. Atomicity: Scoped Postgres advisory lock serializes concurrent attempts per
//    identifier across transactions.
//
// Call this BEFORE any slow work, not after. If `allowed`, the caller must
// eventually call either nothing further (permanent record, e.g. forgot-password)
// or releaseAttempt(attemptId) once it's known the request didn't need to count
// (e.g. login succeeded).
export async function reserveAttempt(
  identifier: string,
  userId?: string,
  maxAttempts: number = MAX_ATTEMPTS,
  windowMs: number = WINDOW_MS,
): Promise<Reservation> {
  return prisma.$transaction(async (tx) => {
    // hashtext() maps the identifier string to the int4 pg_advisory_xact_lock expects;
    // released automatically when this transaction ends (commit or rollback).
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${identifier}))`;

    const now = Date.now();
    const windowStart = new Date(now - windowMs);

    // 1. Purge stale records older than the sliding window
    await tx.loginAttempt.deleteMany({
      where: { identifier, createdAt: { lte: windowStart } },
    });

    // 2. Count active attempts strictly within the sliding window (windowStart, now]
    const count = await tx.loginAttempt.count({
      where: { identifier, createdAt: { gt: windowStart } },
    });

    if (count >= maxAttempts) {
      // Find oldest active attempt to calculate exact window roll-off time
      const oldest = await tx.loginAttempt.findFirst({
        where: { identifier, createdAt: { gt: windowStart } },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      });

      const resetAt = new Date((oldest ? oldest.createdAt.getTime() : windowStart.getTime()) + windowMs);
      const retryAfterSeconds = Math.max(1, Math.ceil((resetAt.getTime() - now) / 1000));

      return {
        allowed: false,
        attemptId: null,
        remaining: 0,
        retryAfterSeconds,
        resetAt,
      };
    }

    // 3. Record attempt in sliding window log
    const attempt = await tx.loginAttempt.create({ data: { identifier, userId } });
    return {
      allowed: true,
      attemptId: attempt.id,
      remaining: Math.max(0, maxAttempts - count - 1),
      resetAt: new Date(now + windowMs),
    };
  }, TX_OPTIONS);
}

// Deletes a reservation that turned out not to need counting (e.g. the
// login it guarded actually succeeded) -- restores the exact pre-existing
// semantics of "only failed attempts count toward the window" while still
// closing the check-then-record race during the attempt itself.
export async function releaseAttempt(attemptId: string | null): Promise<void> {
  if (!attemptId) return;
  await prisma.loginAttempt.delete({ where: { id: attemptId } }).catch(() => {});
}

// X-Forwarded-For is a chain of "client, proxy1, proxy2, ..." where each
// hop APPENDS the IP it observed to whatever it received -- so the FIRST
// entry is whatever the original client sent (arbitrary, attacker-supplied,
// trivially spoofed) and the LAST entry is whatever the closest trusted
// proxy actually saw on its own connection. Previously took [0] (the
// spoofable end), making every per-IP rate limit bypassable by sending a
// fake X-Forwarded-For. Deployed behind exactly one trusted hop (Vercel's
// edge network, per .env's pooled-connection comments) -- the last entry
// is the one that hop appended, and is the one to trust.
export function getClientIp(req: { headers: { get(name: string): string | null } }): string {
  const raw = req.headers.get('x-forwarded-for') ?? '127.0.0.1';
  const hops = raw.split(',').map((h) => h.trim());
  return hops[hops.length - 1];
}
