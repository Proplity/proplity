import { api } from './apiClient';
import { makePrivateRef, type UploadFolder } from './privateRef';

// Client-side mirror of the server's storage check -- the server is still the
// real gate (POST /api/v1/uploads/sign 503s if storage is unconfigured), this
// just lets the UI show "not available" instead of a button that always
// fails. NEXT_PUBLIC_STORAGE_ENABLED covers the non-Cloudinary providers.
export function uploadsEnabled(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ||
    process.env.NEXT_PUBLIC_STORAGE_ENABLED === 'true',
  );
}

export type { UploadFolder };

export interface UploadedFile {
  name: string;
  url: string;
}

// Asks the server how to upload for the active storage provider, then either
// uploads straight to the provider (Cloudinary: the file never passes through
// our server) or posts it to our own upload endpoint (every other provider).
export async function uploadFile(file: File, folder: UploadFolder): Promise<UploadedFile> {
  const signRes = await api.uploads.sign(folder);
  const plan = signRes.data.data;

  if (plan.mode === 'proxy') {
    const body = new FormData();
    body.append('file', file);
    body.append('folder', folder);
    const res = await fetch(plan.uploadUrl, { method: 'POST', body, credentials: 'same-origin' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? 'Upload failed');
    }
    const { data } = await res.json();
    return { name: data.name ?? file.name, url: data.url };
  }

  const { cloudName, apiKey, timestamp, signature, type, folder: signedFolder } = plan;
  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', apiKey);
  formData.append('timestamp', String(timestamp));
  formData.append('signature', signature);
  // The server decides the final folder (private ones are namespaced by owner).
  formData.append('folder', signedFolder);
  if (type) formData.append('type', type);

  const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!uploadRes.ok) throw new Error('Upload failed');

  const data = await uploadRes.json();
  // Authenticated (private) assets have no usable public URL: keep an opaque
  // reference that /api/v1/uploads/private turns into a short-lived link.
  if (type === 'authenticated') {
    return {
      name: file.name,
      url: makePrivateRef(data.resource_type, data.public_id, data.format),
    };
  }
  return { name: file.name, url: data.secure_url };
}
