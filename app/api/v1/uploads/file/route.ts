import { NextResponse } from 'next/server';
import { Role } from '@prisma/client';
import { withAuth } from '@/lib/api/withAuth';
import { handleApiError } from '@/lib/api/errors';
import { validateCSRF } from '@/lib/auth/csrf';
import { getStorage } from '@/lib/storage';
import { storeUpload } from '@/lib/storage/files';
import {
  ALLOWED_PROXY_TYPES,
  FOLDER_ROLES,
  MAX_PROXY_UPLOAD_BYTES,
  UPLOAD_FOLDERS,
} from '@/lib/uploadPolicy';
import type { UploadFolder } from '@/lib/privateRef';

// Upload endpoint for storage providers where the file passes through our
// server (everything except Cloudinary's direct upload). Enforces role, size
// and content-type, then stores under <folder>/<userId>/….
export const POST = withAuth(async (req, { session }) => {
  try {
    if (!validateCSRF(req)) {
      return NextResponse.json({ error: 'Cross-origin request blocked' }, { status: 403 });
    }
    const storage = getStorage();
    if (!storage.isConfigured()) {
      return NextResponse.json(
        { error: 'File uploads are not configured on this deployment' },
        { status: 503 },
      );
    }
    if (storage.mode !== 'proxy') {
      return NextResponse.json(
        { error: 'This deployment uploads directly to its storage provider' },
        { status: 400 },
      );
    }

    const form = await req.formData();
    const folder = String(form.get('folder') ?? '') as UploadFolder;
    const file = form.get('file');
    if (!(UPLOAD_FOLDERS as string[]).includes(folder) || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'A file and a valid folder are required' },
        { status: 400 },
      );
    }
    if (!FOLDER_ROLES[folder].includes(session.role as Role)) {
      return NextResponse.json({ error: 'Not allowed to upload to this folder' }, { status: 403 });
    }
    if (file.size === 0 || file.size > MAX_PROXY_UPLOAD_BYTES) {
      return NextResponse.json(
        {
          error: `File must be between 1 byte and ${Math.floor(MAX_PROXY_UPLOAD_BYTES / 1_000_000)} MB`,
        },
        { status: 413 },
      );
    }
    if (!(ALLOWED_PROXY_TYPES as readonly string[]).includes(file.type)) {
      return NextResponse.json(
        { error: 'Only JPEG, PNG, WebP, GIF images and PDF files can be uploaded' },
        { status: 415 },
      );
    }

    const stored = await storeUpload({
      folder,
      userId: session.sub,
      fileName: file.name,
      contentType: file.type,
      data: new Uint8Array(await file.arrayBuffer()),
    });
    return NextResponse.json({ data: stored }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
});
