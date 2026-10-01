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

export type Reservation = { allowed: boolean; attemptId: string | null };

// Atomically checks-and-reserves a rate-limit slot -- closes the race
// checkRateLimit()+recordAttempt() had: two concurrent requests for the
// same identifier could both pass the count check before either had
// recorded an attempt, since the slow work in between (bcrypt compare, DB
// writes, sendEmail) gave the race a window of hundreds of milliseconds.
//
// A Postgres advisory lock scoped to the identifier serializes concurrent
// callers sharing it: the second caller blocks until the first's
// transaction commits (releasing the lock), then re-reads the count
// including the first's now-committed row. This is genuinely atomic, not
// just "check and insert close together" -- a single combined SQL
// statement (e.g. an INSERT...SELECT...WHERE count < limit) would still
// let two truly concurrent transactions each read the same pre-insert
// count in their own snapshot and both insert, since Postgres's default
// READ COMMITTED isolation doesn't lock rows a plain SELECT count(*) reads.
//
// Call this BEFORE any slow work, not after. If `allowed`, the caller must
// eventually call either nothing further (permanent record, e.g.
// forgot-password) or releaseAttempt(attemptId) once it's known the
// request didn't need to count (e.g. login succeeded) -- see each route
// for which applies.
export async function reserveAttempt(
  identifier: string,
  userId?: string,
  maxAttempts: number = MAX_ATTEMPTS,
): Promise<Reservation> {
  return prisma.$transaction(async (tx) => {
    // hashtext() maps the identifier string to the int4 pg_advisory_xact_lock
    // expects; the lock is released automatically when this transaction ends
    // (commit or rollback), never needs an explicit unlock.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${identifier}))`;

    const since = new Date(Date.now() - WINDOW_MS);
    const count = await tx.loginAttempt.count({
      where: { identifier, createdAt: { gt: since } },
    });
    if (count >= maxAttempts) {
      return { allowed: false, attemptId: null };
    }

    const attempt = await tx.loginAttempt.create({ data: { identifier, userId } });
    return { allowed: true, attemptId: attempt.id };
  });
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
