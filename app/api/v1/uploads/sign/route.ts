import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { withAuth } from '@/lib/api/withAuth';
import { validateBody } from '@/lib/api/validate';
import { handleApiError } from '@/lib/api/errors';
import { getStorage } from '@/lib/storage';
import { accessForFolder } from '@/lib/privateRef';
import { FOLDER_ROLES, UPLOAD_FOLDERS } from '@/lib/uploadPolicy';

// Tells the browser how to upload for the active storage provider.
//   direct  (Cloudinary): returns a signature; the browser uploads straight
//           to the provider and the file never passes through our server.
//   proxy   (S3, R2, MinIO, Supabase, ImageKit, Vercel Blob, local): returns
//           the URL of our own upload endpoint, which checks role, size and
//           type before storing.
// Ownership of what the resulting URL gets attached to (a maintenance
// request, an application) is enforced by the route that receives it.
const signSchema = z.object({ folder: z.enum(UPLOAD_FOLDERS) });

export const POST = withAuth(async (req, { session }) => {
  try {
    const storage = getStorage();
    if (!storage.isConfigured()) {
      return NextResponse.json(
        { error: 'File uploads are not configured on this deployment' },
        { status: 503 },
      );
    }

    const validated = await validateBody(req, signSchema);
    if (!validated.success) return validated.response;
    const { folder } = validated.data;

    if (!FOLDER_ROLES[folder].includes(session.role as Role)) {
      return NextResponse.json({ error: 'Not allowed to upload to this folder' }, { status: 403 });
    }

    const access = accessForFolder(folder);
    if (storage.mode === 'direct') {
      return NextResponse.json({ data: storage.signUpload(folder, session.sub, access) });
    }
    return NextResponse.json({
      data: {
        mode: 'proxy',
        provider: storage.name,
        uploadUrl: '/api/v1/uploads/file',
        folder,
        access,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
});
