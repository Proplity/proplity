import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { handleApiError } from '@/lib/api/errors';

// Deliberately unauthenticated -- reached from the registration form before
// any account (or session) exists for the person filling it out. Read-only:
// checking a code here never links it. Actual redemption happens either at
// account-creation time (register/route.ts, for the manager-signup flow
// this exists for) or later via POST /manager-codes/redeem.
export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get('code');
    if (!code) return NextResponse.json({ valid: false }, { status: 400 });

    const record = await prisma.managerInviteCode.findUnique({
      where: { code: code.trim().toUpperCase() },
      include: { landlord: { select: { name: true } } },
    });

    if (!record || record.status !== 'ACTIVE' || record.linkedManagerId) {
      return NextResponse.json({ valid: false });
    }

    const propertiesManaged = await prisma.property.count({ where: { landlordId: record.landlordId } });

    return NextResponse.json({
      valid: true,
      landlord: { name: record.landlord.name },
      propertiesManaged,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
