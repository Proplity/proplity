import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AccessLogAction } from '@prisma/client';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { validateBody } from '@/lib/api/validate';
import { getClientIp } from '@/lib/auth/rateLimit';

const verifySchema = z.object({
  unitId: z.string(),
  code: z.string(),
});

// Gate-side verification -- treated as a staff action (ADMIN/MANAGER), since
// there's no dedicated device/kiosk auth mechanism in this codebase yet.
export const POST = withAuth(
  async (req, { session: _session }) => {
    try {
      const validated = await validateBody(req, verifySchema);
      if (!validated.success) return validated.response;
      const { unitId, code } = validated.data;

      // Most-recently-created match: codes have no DB-level @unique, so in
      // principle more than one row could exist for the same unit+code
      // across history -- the newest one is the one that should govern.
      const accessCode = await prisma.accessCode.findFirst({
        where: { unitId, code },
        orderBy: { createdAt: 'desc' },
      });

      // AccessLog.accessCodeId is a required FK -- an attempt against a code
      // that doesn't exist at all has nothing to attach an audit row to, so
      // it can't be logged. Nothing in the plan's DENIED/EXPIRED_ATTEMPT/
      // REVOKED/GRANTED set fits "no such code" either; that's reserved for
      // a code that DOES exist but doesn't currently qualify (see below).
      if (!accessCode) {
        return NextResponse.json({ data: { granted: false, reason: 'NOT_FOUND' } });
      }

      const now = new Date();
      let action: AccessLogAction;
      let granted = false;

      if (accessCode.status === 'REVOKED') {
        action = 'REVOKED';
      } else if (accessCode.status === 'EXPIRED' || (accessCode.validUntil !== null && accessCode.validUntil < now)) {
        action = 'EXPIRED_ATTEMPT';
      } else if (
        accessCode.status === 'ACTIVE' &&
        accessCode.validFrom <= now &&
        (accessCode.validUntil === null || accessCode.validUntil >= now)
      ) {
        action = 'GRANTED';
        granted = true;
      } else {
        // A known code that's neither revoked, expired, nor currently valid
        // -- e.g. status USED (a single-use code presented again) or
        // validFrom still in the future.
        action = 'DENIED';
      }

      // A single-use code (the default -- most codes today are one-off
      // guest codes) is consumed on its first GRANTED verification. A
      // reusable code (singleUse: false, e.g. a permanent gate code) stays
      // ACTIVE across repeated verifications.
      const consumesCode = granted && accessCode.singleUse;

      const [log] = await prisma.$transaction([
        prisma.accessLog.create({
          data: {
            accessCodeId: accessCode.id,
            action,
            ipAddress: getClientIp(req),
            deviceInfo: req.headers.get('user-agent') ?? undefined,
          },
        }),
        ...(consumesCode
          ? [prisma.accessCode.update({ where: { id: accessCode.id }, data: { status: 'USED' } })]
          : []),
      ]);

      return NextResponse.json({ data: { granted, action, guestName: accessCode.guestName, logId: log.id } });
    } catch (err) {
      return handleApiError(err);
    }
  },
  { roles: ['ADMIN', 'MANAGER'] },
);
