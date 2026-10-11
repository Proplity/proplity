import 'server-only';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  type S3ClientConfig,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { FileLocator, StorageDriver, StorageGetResult } from '../types';
import { cleanFileName } from '../keys';

export interface S3CompatibleConfig {
  name: string;
  bucket: string;
  region?: string;
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle?: boolean;
  /** Public base URL (CDN / public bucket domain) for public objects. */
  publicUrlBase?: string;
}

type Sender = { send(command: unknown): Promise<unknown> };

/** Presigner seam so tests need neither a network nor real credentials. */
type Presign = (client: unknown, command: unknown, opts: { expiresIn: number }) => Promise<string>;

/**
 * One implementation for AWS S3, Cloudflare R2, MinIO and Supabase Storage
 * (all speak the S3 API). Browsers upload straight to the bucket with a
 * presigned PUT and are redirected to a presigned GET to read, so file bytes
 * never pass through our server. The bucket needs a CORS rule allowing PUT
 * from the app origin.
 */
export class S3CompatibleStorageDriver implements StorageDriver {
  readonly name: string;
  readonly upload = 'direct' as const;
  protected readonly config: S3CompatibleConfig;
  private client: Sender | null;
  private readonly presign: Presign;

  constructor(config: S3CompatibleConfig, client?: Sender, presign?: Presign) {
    this.name = config.name;
    this.config = config;
    this.client = client ?? null;
    this.presign = presign ?? (getSignedUrl as unknown as Presign);
  }

  isConfigured(): boolean {
    return Boolean(this.config.bucket && this.config.accessKeyId && this.config.secretAccessKey);
  }

  private getClient(): Sender {
    if (!this.client) {
      if (!this.isConfigured()) {
        throw new Error(`STORAGE_NOT_CONFIGURED: ${this.name} is missing credentials or bucket`);
      }
      const cfg: S3ClientConfig = {
        region: this.config.region || 'us-east-1',
        credentials: {
          accessKeyId: this.config.accessKeyId,
          secretAccessKey: this.config.secretAccessKey,
        },
        forcePathStyle: this.config.forcePathStyle ?? false,
        ...(this.config.endpoint ? { endpoint: this.config.endpoint } : {}),
        // R2 and some S3-compatibles reject the SDK's default checksum headers on presigned PUTs.
        requestChecksumCalculation: 'WHEN_REQUIRED',
      };
      this.client = new S3Client(cfg) as unknown as Sender;
    }
    return this.client;
  }

  makeKey = ({
    access,
    folder,
    ownerId,
    fileId,
    fileName,
  }: Parameters<StorageDriver['makeKey']>[0]) =>
    `${access}/${folder}/${ownerId}/${fileId}-${cleanFileName(fileName)}`;

  async prepareDirectUpload({ key, contentType }: { key: string; contentType: string }) {
    const url = await this.presign(
      this.getClient(),
      new PutObjectCommand({ Bucket: this.config.bucket, Key: key, ContentType: contentType }),
      { expiresIn: 300 },
    );
    // The content type is part of the signature, so the browser must send exactly this.
    return { kind: 'put' as const, url, headers: { 'Content-Type': contentType } };
  }

  /**
   * A presigned PUT cannot cap the size, so the real object is inspected after
   * the upload and the caller deletes it if it breaks the limits.
   */
  async verifyUpload(loc: FileLocator) {
    try {
      const head = (await this.getClient().send(
        new HeadObjectCommand({ Bucket: this.config.bucket, Key: loc.key }),
      )) as { ContentLength?: number; ContentType?: string };
      return { size: head.ContentLength, contentType: head.ContentType };
    } catch (err) {
      const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (
        e?.name === 'NotFound' ||
        e?.name === 'NoSuchKey' ||
        e?.$metadata?.httpStatusCode === 404
      ) {
        return null;
      }
      throw err;
    }
  }

  async signedUrl(
    loc: FileLocator,
    {
      ttlSeconds,
      fileName,
      contentType,
    }: { ttlSeconds: number; fileName: string; contentType: string },
  ) {
    if (loc.access === 'public' && this.config.publicUrlBase) {
      return `${this.config.publicUrlBase.replace(/\/+$/, '')}/${loc.key}`;
    }
    return this.presign(
      this.getClient(),
      new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: loc.key,
        ResponseContentType: contentType,
        ResponseContentDisposition: `inline; filename="${cleanFileName(fileName)}"`,
      }),
      { expiresIn: ttlSeconds },
    );
  }

  async read(loc: FileLocator): Promise<StorageGetResult | null> {
    try {
      const res = (await this.getClient().send(
        new GetObjectCommand({ Bucket: this.config.bucket, Key: loc.key }),
      )) as {
        Body?: { transformToWebStream?: () => ReadableStream<Uint8Array> };
        ContentType?: string;
        ContentLength?: number;
      };
      if (!res.Body?.transformToWebStream) return null;
      return {
        stream: res.Body.transformToWebStream(),
        contentType: res.ContentType || 'application/octet-stream',
        size: res.ContentLength ?? 0,
      };
    } catch (err) {
      const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (
        e?.name === 'NoSuchKey' ||
        e?.name === 'NotFound' ||
        e?.$metadata?.httpStatusCode === 404
      ) {
        return null;
      }
      throw err;
    }
  }

  async remove(loc: FileLocator): Promise<void> {
    await this.getClient().send(
      new DeleteObjectCommand({ Bucket: this.config.bucket, Key: loc.key }),
    );
  }
}

const env = (name: string) => process.env[name] || '';

export const createS3Driver = (c?: Partial<S3CompatibleConfig>) =>
  new S3CompatibleStorageDriver({
    name: 's3',
    bucket: env('AWS_S3_BUCKET'),
    region: env('AWS_REGION') || 'us-east-1',
    accessKeyId: env('AWS_ACCESS_KEY_ID'),
    secretAccessKey: env('AWS_SECRET_ACCESS_KEY'),
    publicUrlBase: env('AWS_S3_PUBLIC_URL_BASE') || undefined,
    ...c,
  });

export const createR2Driver = (c?: Partial<S3CompatibleConfig>) => {
  const account = env('R2_ACCOUNT_ID');
  return new S3CompatibleStorageDriver({
    name: 'r2',
    bucket: env('R2_BUCKET'),
    region: 'auto',
    endpoint:
      env('R2_ENDPOINT') || (account ? `https://${account}.r2.cloudflarestorage.com` : undefined),
    accessKeyId: env('R2_ACCESS_KEY_ID'),
    secretAccessKey: env('R2_SECRET_ACCESS_KEY'),
    publicUrlBase: env('R2_PUBLIC_URL_BASE') || undefined,
    ...c,
  });
};

export const createMinioDriver = (c?: Partial<S3CompatibleConfig>) =>
  new S3CompatibleStorageDriver({
    name: 'minio',
    bucket: env('MINIO_BUCKET'),
    region: env('MINIO_REGION') || 'us-east-1',
    endpoint: env('MINIO_ENDPOINT'),
    accessKeyId: env('MINIO_ACCESS_KEY'),
    secretAccessKey: env('MINIO_SECRET_KEY'),
    forcePathStyle: true,
    publicUrlBase: env('MINIO_PUBLIC_URL_BASE') || undefined,
    ...c,
  });

export const createSupabaseDriver = (c?: Partial<S3CompatibleConfig>) =>
  new S3CompatibleStorageDriver({
    name: 'supabase',
    bucket: env('SUPABASE_STORAGE_BUCKET'),
    region: env('SUPABASE_STORAGE_REGION') || 'auto',
    endpoint:
      env('SUPABASE_STORAGE_ENDPOINT') ||
      (env('SUPABASE_URL')
        ? `${env('SUPABASE_URL').replace(/\/+$/, '')}/storage/v1/s3`
        : undefined),
    accessKeyId: env('SUPABASE_STORAGE_ACCESS_KEY_ID'),
    secretAccessKey: env('SUPABASE_STORAGE_SECRET_ACCESS_KEY'),
    forcePathStyle: true,
    publicUrlBase: env('SUPABASE_STORAGE_PUBLIC_URL_BASE') || undefined,
    ...c,
  });
