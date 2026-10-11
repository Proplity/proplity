import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { cloudinaryEnabled, isPrivateRef, privateDownloadUrl } from '@/lib/cloudinary';

// Turns a stored private-file reference (User.idDocumentUrl) into a
// short-lived signed download link, after checking the caller may see it.
//
//   - the owner of the document
//   - an ADMIN
//   - a MANAGER/LANDLORD of a property the owner has applied to or leased
//
// Everyone else gets 404 (not 403) so the endpoint can't be used to probe
// which references exist. ISS-031.
export const GET = withAuth(async (req, { session }) => {
  try {
    const ref = new URL(req.url).searchParams.get('ref');
    if (!ref || !isPrivateRef(ref)) {
      return NextResponse.json({ error: 'A valid file reference is required' }, { status: 400 });
    }

    const owner = await prisma.user.findFirst({
      where: { idDocumentUrl: ref },
      select: { id: true },
    });
    if (!owner) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    let allowed = owner.id === session.sub || session.role === 'ADMIN';
    if (!allowed && (session.role === 'MANAGER' || session.role === 'LANDLORD')) {
      const propertyScope =
        session.role === 'MANAGER' ? { managerId: session.sub } : { landlordId: session.sub };
      const [application, lease] = await Promise.all([
        prisma.application.findFirst({
          where: { applicantId: owner.id, unit: { property: propertyScope } },
          select: { id: true },
        }),
        prisma.lease.findFirst({
          where: { tenantId: owner.id, unit: { property: propertyScope } },
          select: { id: true },
        }),
      ]);
      allowed = Boolean(application || lease);
    }
    if (!allowed) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (!cloudinaryEnabled()) {
      return NextResponse.json(
        { error: 'File storage is not configured on this deployment' },
        { status: 503 },
      );
    }
    const url = privateDownloadUrl(ref);
    if (!url) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const res = NextResponse.redirect(url, 302);
    res.headers.set('Cache-Control', 'private, no-store');
    return res;
  } catch (err) {
    return handleApiError(err);
  }
});
