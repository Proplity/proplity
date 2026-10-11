import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';
import { readPublicFile } from '@/lib/storage/files';
import { ALLOWED_PROXY_TYPES } from '@/lib/uploadPolicy';
import { accessForFolder, isSafeKey, type UploadFolder } from '@/lib/privateRef';

// Serves files uploaded to PUBLIC folders (property photos, maintenance
// photos) for proxy storage providers. Deliberately unauthenticated -- these
// are the listing images shown to anonymous visitors -- but it can only read
// keys under the public/ namespace, in folders marked public.
export async function GET(req: NextRequest) {
  const key = new URL(req.url).searchParams.get('key') ?? '';
  const folder = key.split('/')[0] as UploadFolder;
  if (!isSafeKey(key) || accessForFolder(folder) !== 'public') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const driver = getStorage();
  if (driver.mode !== 'proxy' || !driver.isConfigured()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const file = await readPublicFile(key);
  if (!file) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const safe = (ALLOWED_PROXY_TYPES as readonly string[]).includes(file.contentType);
  return new NextResponse(file.stream, {
    headers: {
      'Content-Type': safe ? file.contentType : 'application/octet-stream',
      'Content-Disposition': safe ? 'inline' : 'attachment',
      'X-Content-Type-Options': 'nosniff',
      // Keys carry a timestamp + random id, so a URL never changes content.
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
