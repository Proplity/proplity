import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from '@/lib/auth/session';
import { validateCSRF } from '@/lib/auth/csrf';
import { validateBody } from '@/lib/api/validate';
import { prisma } from '@/lib/db';

const PROFILE_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  status: true,
  phoneNumber: true,
  bio: true,
  yearOfBirth: true,
  emergencyContactName: true,
  emergencyContactRelationship: true,
  emergencyContactPhone: true,
  previousLandlordPhone: true,
  previousLandlordEmail: true,
  idDocumentUrl: true,
  lastLoginAt: true,
  createdAt: true,
} as const;

function serialize(user: {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  phoneNumber: string | null;
  bio: string | null;
  yearOfBirth: number | null;
  emergencyContactName: string | null;
  emergencyContactRelationship: string | null;
  emergencyContactPhone: string | null;
  previousLandlordPhone: string | null;
  previousLandlordEmail: string | null;
  idDocumentUrl: string | null;
  lastLoginAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role.toLowerCase(),
    status: user.status,
    phoneNumber: user.phoneNumber,
    bio: user.bio,
    yearOfBirth: user.yearOfBirth,
    emergencyContactName: user.emergencyContactName,
    emergencyContactRelationship: user.emergencyContactRelationship,
    emergencyContactPhone: user.emergencyContactPhone,
    previousLandlordPhone: user.previousLandlordPhone,
    previousLandlordEmail: user.previousLandlordEmail,
    idDocumentUrl: user.idDocumentUrl,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  };
}

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: PROFILE_SELECT,
  });

  if (!user || user.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Account inactive or missing' }, { status: 401 });
  }

  return NextResponse.json({ user: serialize(user) });
}

// Deliberately narrow: no email (a real "change email" flow needs its own
// re-verification step, not a side effect of this route), no role/status
// (privilege fields -- ADMIN-only elsewhere, never self-service), no
// avatarUrl (no file-storage endpoint exists anywhere in this codebase to
// upload one to). The tenant-profile fields below reuse the same
// direct-to-Cloudinary upload flow PropertyApplicationForm already uses
// (POST /api/v1/uploads/sign, folder: 'profile') for idDocumentUrl.
const updateProfileSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  phoneNumber: z.string().max(32).nullable().optional(),
  bio: z.string().max(500).nullable().optional(),
  yearOfBirth: z.number().int().min(1900).max(new Date().getFullYear()).nullable().optional(),
  emergencyContactName: z.string().max(120).nullable().optional(),
  emergencyContactRelationship: z.string().max(60).nullable().optional(),
  emergencyContactPhone: z.string().max(32).nullable().optional(),
  previousLandlordPhone: z.string().max(32).nullable().optional(),
  previousLandlordEmail: z.string().max(255).nullable().optional(),
  // Not strictly a URL: when no upload provider is configured
  // (uploadsEnabled() false, see CompleteProfileForm), this falls back to
  // just the selected file's name, same "record the name, not lost
  // silently" precedent as PropertyApplicationForm's own document fields.
  idDocumentUrl: z.string().min(1).nullable().optional(),
});

export async function PATCH(req: NextRequest) {
  if (!validateCSRF(req)) {
    return NextResponse.json({ error: 'Cross-origin request blocked' }, { status: 403 });
  }

  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }

  const validated = await validateBody(req, updateProfileSchema);
  if (!validated.success) return validated.response;

  if (Object.keys(validated.data).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: session.sub },
    data: validated.data,
    select: PROFILE_SELECT,
  });

  return NextResponse.json({ user: serialize(user) });
}
