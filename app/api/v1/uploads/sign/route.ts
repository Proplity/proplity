import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/api/withAuth';
import { validateBody } from '@/lib/api/validate';
import { handleApiError } from '@/lib/api/errors';
import { cloudinaryEnabled, signUploadParams } from '@/lib/cloudinary';

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
  folder: z.enum(['maintenance-requests', 'applications']),
});

export const POST = withAuth(async (req) => {
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

    const timestamp = Math.round(Date.now() / 1000);
    const signature = signUploadParams({ folder, timestamp });

    return NextResponse.json({
      data: {
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        apiKey: process.env.CLOUDINARY_API_KEY,
        timestamp,
        signature,
        folder,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
});
