import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/api/withAuth';
import { validateBody } from '@/lib/api/validate';
import { handleFileError } from '@/lib/api/fileErrors';
import { createPendingUpload } from '@/lib/storage/service';
import { UPLOAD_FOLDERS } from '@/lib/uploadPolicy';

// Step 1 of an upload (ADR-0010): validates role, type and size, registers a
// PENDING StoredFile and says how to upload for the active storage provider --
// straight to the provider (Cloudinary, S3-compatible) or through
// POST /api/v1/uploads/file. The returned `file.url` is what gets stored on
// the record the file belongs to; the gateway checks access when it is read.
const signSchema = z.object({
  folder: z.enum(UPLOAD_FOLDERS),
  fileName: z.string().min(1).max(200),
  contentType: z.string().min(1).max(100),
  size: z.number().int().positive(),
});

export const POST = withAuth(async (req, { session }) => {
  try {
    const validated = await validateBody(req, signSchema);
    if (!validated.success) return validated.response;
    const result = await createPendingUpload({ actor: session, ...validated.data });
    return NextResponse.json({ data: result });
  } catch (err) {
    return handleFileError(err);
  }
});
