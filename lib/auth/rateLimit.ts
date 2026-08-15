import { prisma } from '@/lib/db';

const WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ATTEMPTS = 5;

export async function checkRateLimit(identifier: string): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MS);
  const count = await prisma.loginAttempt.count({
    where: { identifier, createdAt: { gt: since } },
  });
  return count < MAX_ATTEMPTS;
}

export async function recordAttempt(identifier: string, userId?: string) {
  await prisma.loginAttempt.create({ data: { identifier, userId } });
}

export function getClientIp(req: { headers: { get(name: string): string | null } }): string {
  const raw = req.headers.get('x-forwarded-for') ?? '127.0.0.1';
  return raw.split(',')[0].trim();
}
