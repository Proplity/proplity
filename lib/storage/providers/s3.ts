import 'server-only';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  type S3ClientConfig,
} from '@aws-sdk/client-s3';
import type {
  ProxyStorageDriver,
  StorageAccess,
  StorageGetResult,
  StoragePutOptions,
  StoragePutResult,
} from '../types';

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

async function toBytes(
  data: Buffer | Uint8Array | ReadableStream<Uint8Array>,
): Promise<Uint8Array> {
  if (data instanceof Uint8Array) return data as unknown as Uint8Array;
  const chunks: Uint8Array[] = [];
  const reader = data.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  return Buffer.concat(chunks) as unknown as Uint8Array;
}

/** One implementation for AWS S3, Cloudflare R2, MinIO and Supabase Storage (S3 API). */
export class S3CompatibleStorageDriver implements ProxyStorageDriver {
  readonly name: string;
  readonly mode = 'proxy' as const;
  protected readonly config: S3CompatibleConfig;
  private client: Sender | null;

  /** `client` is injectable so the driver can be tested without a network. */
  constructor(config: S3CompatibleConfig, client?: Sender) {
    this.name = config.name;
    this.config = config;
    this.client = client ?? null;
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
      };
      this.client = new S3Client(cfg) as unknown as Sender;
    }
    return this.client;
  }

  async put(
    key: string,
    data: Buffer | Uint8Array | ReadableStream<Uint8Array>,
    options: StoragePutOptions,
  ): Promise<StoragePutResult> {
    const body = await toBytes(data);
    await this.getClient().send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: body,
        ContentType: options.contentType,
      }),
    );
    // A direct URL only when the operator says the bucket/CDN is public.
    const url =
      options.access === 'public' && this.config.publicUrlBase
        ? `${this.config.publicUrlBase.replace(/\/+$/, '')}/${key}`
        : undefined;
    return { pathname: key, contentType: options.contentType, size: body.byteLength, url };
  }

  async get(key: string, _options: { access: StorageAccess }): Promise<StorageGetResult | null> {
    try {
      const res = (await this.getClient().send(
        new GetObjectCommand({ Bucket: this.config.bucket, Key: key }),
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

  async delete(key: string): Promise<void> {
    await this.getClient().send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }));
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
