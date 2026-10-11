import type { UploadFolder } from '@/lib/privateRef';

/** What the browser needs to upload one file directly to the provider. */
export interface SignedUpload {
  /** Provider-specific, JSON-serialisable fields the client forwards verbatim. */
  provider: string;
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  /** The folder the file will land in (includes the owner id for private folders). */
  folder: string;
  type?: 'authenticated';
}

/**
 * Server-side contract every storage provider implements. Browsers upload
 * directly to the provider; the app only signs the request and later hands
 * out short-lived download links for private files. Adding S3 / R2 / MinIO /
 * Supabase / ImageKit means adding a driver here, not touching the routes.
 */
export interface StorageDriver {
  readonly name: string;
  /** Credentials present on this deployment. */
  isConfigured(): boolean;
  /** Sign a direct upload into `folder` on behalf of `userId`. */
  signUpload(folder: UploadFolder, userId: string): SignedUpload;
  /** Short-lived download URL for a private reference, or null if unusable. */
  privateDownloadUrl(ref: string, ttlSeconds?: number): string | null;
}
