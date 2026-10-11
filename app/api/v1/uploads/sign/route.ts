import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/api/withAuth';
import { validateBody } from '@/lib/api/validate';
import { handleApiError } from '@/lib/api/errors';
import { cloudinaryEnabled, signUploadParams, isPrivateFolder } from '@/lib/cloudinary';
import { Role } from '@prisma/client';

// Signs a direct-to-Cloudinary upload for the calling user -- the file
// itself never passes through our server. Any authenticated role may
// request a signature; ownership of what the resulting URL gets attached
// to (a maintenance request, an application) is enforced by the route that
// receives that URL afterward, same as every other upload-adjacent field
// in this API.
const signSchema = z.object({
  // Cloudinary folder the upload lands in -- callers pass a stable, human-
  // auditable path (e.g. "maintenance-requests", "applications") rather
  // than a free-form string, so uploads can be found by kind in Cloudinary's
  // own console.
  folder: z.enum(['maintenance-requests', 'applications', 'profile', 'properties']),
});

// Who may upload into each folder (ISS-032). A tenant cannot write into the
// property-listing folder, a vendor cannot write into identity documents, etc.
const FOLDER_ROLES: Record<z.infer<typeof signSchema>['folder'], Role[]> = {
  'maintenance-requests': [Role.TENANT, Role.MANAGER, Role.LANDLORD, Role.VENDOR],
  applications: [Role.TENANT],
  profile: [Role.TENANT, Role.LANDLORD, Role.MANAGER, Role.VENDOR],
  properties: [Role.LANDLORD, Role.MANAGER, Role.ADMIN],
};

export const POST = withAuth(async (req, { session }) => {
  if (!cloudinaryEnabled()) {
    return NextResponse.json(
      { error: 'File uploads are not configured on this deployment' },
      { status: 503 },
    );
  }

  try {
    const validated = await validateBody(req, signSchema);
    if (!validated.success) return validated.response;
    const { folder } = validated.data;

    if (!FOLDER_ROLES[folder].includes(session.role as Role)) {
      return NextResponse.json({ error: 'Not allowed to upload to this folder' }, { status: 403 });
    }

    const timestamp = Math.round(Date.now() / 1000);
    // Identity/application files are stored as authenticated assets: the plain
    // delivery URL does not work, see lib/cloudinary.ts (ISS-031).
    const type = isPrivateFolder(folder) ? 'authenticated' : undefined;
    const signature = signUploadParams({ folder, timestamp, ...(type ? { type } : {}) });

    return NextResponse.json({
      data: {
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        apiKey: process.env.CLOUDINARY_API_KEY,
        timestamp,
        signature,
        folder,
        ...(type ? { type } : {}),
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
});
