import { api } from './apiClient';

// Client-side mirror of lib/cloudinary.ts's cloudinaryEnabled() -- the
// server is still the real gate (POST /api/v1/uploads/sign 503s if unset),
// this just lets the UI show "not available" instead of a button that
// always fails.
export function uploadsEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME);
}

export type UploadFolder = 'maintenance-requests' | 'applications';

export interface UploadedFile {
  name: string;
  url: string;
}

// Signs with our own API, then uploads directly to Cloudinary from the
// browser -- the file itself never passes through our server/serverless
// function (avoids the body-size limits and cost of proxying it).
export async function uploadFile(file: File, folder: UploadFolder): Promise<UploadedFile> {
  const signRes = await api.uploads.sign(folder);
  const { cloudName, apiKey, timestamp, signature } = signRes.data.data;

  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', apiKey);
  formData.append('timestamp', String(timestamp));
  formData.append('signature', signature);
  formData.append('folder', folder);

  const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!uploadRes.ok) {
    throw new Error('Upload failed');
  }

  const data = await uploadRes.json();
  return { name: file.name, url: data.secure_url };
}
