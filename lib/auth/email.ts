import { z } from 'zod';
import { prisma } from '@/lib/db';

/**
 * Emails are case-insensitive in practice (phone keyboards capitalise the
 * first letter), but the column is a case-sensitive unique. Normalise every
 * inbound address, and look users up case-insensitively so accounts that
 * were stored with mixed case before this existed stay reachable.
 */
export const emailSchema = z.string().trim().toLowerCase().email();

export function findUserByEmail(email: string) {
  return prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } });
}
