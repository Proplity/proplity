import type { StorageAccess, UploadFolder } from '@/lib/privateRef';

export type { StorageAccess };

export type StorageProviderName =
  'cloudinary' | 's3' | 'r2' | 'minio' | 'supabase' | 'imagekit' | 'vercel-blob' | 'local';

export interface StoragePutOptions {
  access: StorageAccess;
  contentType: string;
}

export interface StoragePutResult {
  pathname: string;
  contentType: string;
  size: number;
  /** Direct public URL, when the provider has one for public objects. */
  url?: string;
}

export interface StorageGetResult {
  stream: ReadableStream<Uint8Array>;
  contentType: string;
  size: number;
}

/** What the browser needs to upload one file straight to the provider. */
export interface SignedUpload {
  mode: 'direct';
  provider: string;
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  /** The folder the file will land in (includes the owner id for private folders). */
  folder: string;
  type?: 'authenticated';
}

/** Tells the browser to POST the file to our own endpoint instead. */
export interface ProxyUpload {
  mode: 'proxy';
  provider: string;
  uploadUrl: string;
  folder: UploadFolder;
  access: StorageAccess;
}

/**
 * Providers where the file passes through our server. Keys given to these
 * methods are already namespaced by access (`private/…` / `public/…`) by
 * lib/storage/files.ts, so a driver never has to decide what is private.
 */
export interface ProxyStorageDriver {
  readonly name: string;
  readonly mode: 'proxy';
  isConfigured(): boolean;
  put(
    key: string,
    data: Buffer | Uint8Array | ReadableStream<Uint8Array>,
    options: StoragePutOptions,
  ): Promise<StoragePutResult>;
  get(key: string, options: { access: StorageAccess }): Promise<StorageGetResult | null>;
  delete(key: string, options?: { access: StorageAccess }): Promise<void>;
}

/** Providers the browser uploads to directly (Cloudinary). */
export interface DirectStorageDriver {
  readonly name: string;
  readonly mode: 'direct';
  isConfigured(): boolean;
  signUpload(folder: UploadFolder, userId: string, access: StorageAccess): SignedUpload;
  privateDownloadUrl(ref: string, ttlSeconds?: number): string | null;
  deleteRef(ref: string): Promise<void>;
}

export type StorageDriver = ProxyStorageDriver | DirectStorageDriver;
