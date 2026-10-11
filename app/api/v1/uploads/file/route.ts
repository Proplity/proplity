import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import { handleFileError } from '@/lib/api/fileErrors';
import { validateCSRF } from '@/lib/auth/csrf';
import { completeProxyUpload, FileError } from '@/lib/storage/service';

// Step 2 for providers where the bytes pass through our server (local disk,
// ImageKit, Vercel Blob). Role, type and size were checked when the upload was
// signed; they are enforced again here against the real file.
export const POST = withAuth(async (req, { session }) => {
  try {
    if (!validateCSRF(req)) {
      return NextResponse.json({ error: 'Cross-origin request blocked' }, { status: 403 });
    }
    const form = await req.formData();
    const fileId = String(form.get('fileId') ?? '');
    const file = form.get('file');
    if (!fileId || !(file instanceof File)) {
      throw new FileError('A file and its upload id are required', 400);
    }
    const stored = await completeProxyUpload(session, fileId, file);
    return NextResponse.json({ data: stored }, { status: 201 });
  } catch (err) {
    return handleFileError(err);
  }
});
