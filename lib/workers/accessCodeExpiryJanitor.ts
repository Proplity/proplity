import { prisma } from '@/lib/db';

export async function runAccessCodeExpiryJanitor(): Promise<{ expired: number }> {
  const now = new Date();
  const result = await prisma.accessCode.updateMany({
    where: { status: 'ACTIVE', validUntil: { not: null, lt: now } },
    data: { status: 'EXPIRED' },
  });

  return { expired: result.count };
}
