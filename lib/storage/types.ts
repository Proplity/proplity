import type { StorageAccess, UploadFolder } from '@/lib/fileRef';

export type { StorageAccess };

export type StorageProviderName =
  'cloudinary' | 's3' | 'r2' | 'minio' | 'supabase' | 'imagekit' | 'vercel-blob' | 'local';

/** Where one stored object lives, taken from its StoredFile row. */
export interface FileLocator {
  key: string;
  access: StorageAccess;
  meta?: Record<string, unknown> | null;
}

export interface StorageGetResult {
  stream: ReadableStream<Uint8Array>;
  contentType: string;
  size: number;
}

/** What the browser does to upload straight to the provider. */
export type DirectUploadPlan =
  /** multipart form POST of `fields` + `file` (Cloudinary). */
  | { kind: 'form-post'; url: string; fields: Record<string, string> }
  /** HTTP PUT of the raw file with these headers (S3-compatible presigned URL). */
  | { kind: 'put'; url: string; headers: Record<string, string> };

export interface MakeKeyArgs {
  folder: UploadFolder;
  ownerId: string;
  fileId: string;
  fileName: string;
  access: StorageAccess;
}

export interface UploadRequest {
  key: string;
  access: StorageAccess;
  folder: UploadFolder;
  contentType: string;
}

export interface VerifiedUpload {
  size?: number;
  contentType?: string;
  meta?: Record<string, unknown>;
}

/**
 * Every provider implements this. Providers differ in HOW bytes arrive
 * (`upload: 'direct'` = the browser sends them to the provider with a plan we
 * prepare; `'proxy'` = through POST /api/v1/uploads/file) and in how they are
 * read back (`signedUrl` = redirect to a short-lived link; `read` = stream).
 * Who may read a file is NOT a driver concern -- the gateway decides.
 */
export interface StorageDriver {
  readonly name: string;
  readonly upload: 'direct' | 'proxy';
  isConfigured(): boolean;
  makeKey(args: MakeKeyArgs): string;

  /** direct providers: how the browser should upload this file. */
  prepareDirectUpload?(req: UploadRequest): Promise<DirectUploadPlan> | DirectUploadPlan;
  /** direct providers: confirm the object exists; null if it does not. */
  verifyUpload?(
    loc: FileLocator,
    claimed: Record<string, unknown>,
  ): Promise<VerifiedUpload | null> | VerifiedUpload | null;

  /** proxy providers: store the bytes. */
  put?(loc: FileLocator, data: Uint8Array, contentType: string): Promise<void>;

  /** Short-lived URL the gateway can redirect to; null if unsupported. */
  signedUrl?(
    loc: FileLocator,
    opts: { ttlSeconds: number; fileName: string; contentType: string },
  ): Promise<string | null> | string | null;
  /** Stream the object through the server (when no signed URL exists). */
  read?(loc: FileLocator): Promise<StorageGetResult | null>;

  remove(loc: FileLocator): Promise<void>;
}
