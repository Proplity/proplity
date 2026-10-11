import { api } from './apiClient';
import type { UploadFolder } from './fileRef';

// Client-side mirror of the server's storage check -- the server is still the
// real gate (POST /api/v1/uploads/sign 503s if storage is unconfigured), this
// just lets the UI show "not available" instead of a button that always
// fails. NEXT_PUBLIC_STORAGE_ENABLED covers providers other than Cloudinary.
export function uploadsEnabled(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ||
    process.env.NEXT_PUBLIC_STORAGE_ENABLED === 'true',
  );
}

export type { UploadFolder };

export interface UploadedFile {
  name: string;
  /** Gateway URL (`/api/v1/files/<id>`) -- store this on the record. */
  url: string;
}

async function failure(res: Response, fallback: string): Promise<never> {
  const body = await res.json().catch(() => ({}));
  throw new Error(body?.error ?? fallback);
}

// 1. Ask the server to register the file and say how to upload it.
// 2. Upload: straight to the provider (Cloudinary form POST / S3 presigned
//    PUT), or through our own endpoint for the other providers.
// 3. Direct uploads: tell the server it finished so it can verify the file.
export async function uploadFile(file: File, folder: UploadFolder): Promise<UploadedFile> {
  const signRes = await api.uploads.sign({
    folder,
    fileName: file.name,
    contentType: file.type,
    size: file.size,
  });
  const { file: registered, plan } = signRes.data.data;

  if (plan.mode === 'proxy') {
    const body = new FormData();
    body.append('fileId', plan.fileId);
    body.append('file', file);
    const res = await fetch(plan.uploadUrl, { method: 'POST', body, credentials: 'same-origin' });
    if (!res.ok) await failure(res, 'Upload failed');
    return { name: file.name, url: registered.url };
  }

  let claimed: Record<string, unknown> = {};
  if (plan.kind === 'form-post') {
    const form = new FormData();
    for (const [k, v] of Object.entries(plan.fields)) form.append(k, v);
    form.append('file', file);
    const res = await fetch(plan.url, { method: 'POST', body: form });
    if (!res.ok) throw new Error('Upload failed');
    claimed = await res.json();
  } else {
    const res = await fetch(plan.url, { method: 'PUT', headers: plan.headers, body: file });
    if (!res.ok) throw new Error('Upload failed');
  }

  await api.uploads.complete({ fileId: registered.id, claimed });
  return { name: file.name, url: registered.url };
}
