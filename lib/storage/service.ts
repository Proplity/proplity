import 'server-only';
import crypto from 'node:crypto';
import type { Prisma, Role, StoredFile } from '@prisma/client';
import { prisma } from '@/lib/db';
import { fileUrl, parseFileUrl, accessForFolder, type UploadFolder } from '@/lib/fileRef';
import { allowedTypes, FOLDER_ROLES, maxBytes } from '@/lib/uploadPolicy';
import { getStorage, getStorageByName } from './index';
import type { DirectUploadPlan, FileLocator, StorageDriver } from './types';

/** An error the route can turn straight into an HTTP response. */
export class FileError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

type Actor = { sub: string; role: Role };

const locator = (f: StoredFile): FileLocator => ({
  key: f.key,
  access: f.access as 'private' | 'public',
  meta: (f.meta as Record<string, unknown> | null) ?? null,
});

// ── Audit ───────────────────────────────────────────────────────────────────

export type FileAuditAction =
  'FILE_UPLOADED' | 'FILE_READ' | 'FILE_DELETED' | 'FILE_PROVIDER_MISMATCH';

/** Who touched which file, on which provider. Never contains file contents. Never throws. */
export async function auditFile(
  action: FileAuditAction,
  actorId: string | null,
  file: Pick<StoredFile, 'id' | 'provider' | 'folder' | 'access' | 'ownerId'>,
  extra: Record<string, unknown> = {},
) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId,
        action,
        entityType: 'StoredFile',
        entityId: file.id,
        metadata: {
          provider: file.provider,
          folder: file.folder,
          access: file.access,
          ownerId: file.ownerId,
          ...extra,
        } as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    console.error('Could not write audit log', err);
  }
}

// ── Upload ──────────────────────────────────────────────────────────────────

export interface UploadPlan {
  file: { id: string; url: string };
  plan:
    ({ mode: 'direct' } & DirectUploadPlan) | { mode: 'proxy'; uploadUrl: string; fileId: string };
}

function checkRequest(
  actor: Actor,
  folder: UploadFolder,
  contentType: string,
  size: number,
  driver: StorageDriver,
) {
  if (!FOLDER_ROLES[folder].includes(actor.role)) {
    throw new FileError('Not allowed to upload to this folder', 403);
  }
  if (!allowedTypes(folder).includes(contentType)) {
    throw new FileError('That file type is not allowed here', 415);
  }
  if (!Number.isFinite(size) || size <= 0 || size > maxBytes(contentType, driver.upload)) {
    throw new FileError(
      `File must be between 1 byte and ${Math.floor(maxBytes(contentType, driver.upload) / 1_000_000)} MB`,
      413,
    );
  }
}

/** Step 1: register the file (PENDING) and tell the browser how to upload it. */
export async function createPendingUpload(args: {
  actor: Actor;
  folder: UploadFolder;
  fileName: string;
  contentType: string;
  size: number;
}): Promise<UploadPlan> {
  const driver = getStorage();
  if (!driver.isConfigured())
    throw new FileError('File uploads are not configured on this deployment', 503);
  checkRequest(args.actor, args.folder, args.contentType, args.size, driver);

  const id = crypto.randomUUID();
  const access = accessForFolder(args.folder);
  const key = driver.makeKey({
    folder: args.folder,
    ownerId: args.actor.sub,
    fileId: id,
    fileName: args.fileName,
    access,
  });
  await prisma.storedFile.create({
    data: {
      id,
      ownerId: args.actor.sub,
      folder: args.folder,
      access,
      provider: driver.name,
      key,
      originalName: args.fileName.slice(0, 200),
      contentType: args.contentType,
      size: args.size,
    },
  });

  const file = { id, url: fileUrl(id) };
  if (driver.upload === 'proxy') {
    return { file, plan: { mode: 'proxy', uploadUrl: '/api/v1/uploads/file', fileId: id } };
  }
  const plan = await driver.prepareDirectUpload!({
    key,
    access,
    folder: args.folder,
    contentType: args.contentType,
  });
  return { file, plan: { mode: 'direct', ...plan } };
}

async function pendingOwnedBy(fileId: string, userId: string) {
  const row = await prisma.storedFile.findUnique({ where: { id: fileId } });
  if (!row || row.ownerId !== userId || row.status !== 'PENDING') {
    throw new FileError('Upload not found', 404);
  }
  return row;
}

async function markReady(
  row: StoredFile,
  actor: Actor,
  facts: { size?: number; contentType?: string; meta?: Record<string, unknown> },
) {
  const updated = await prisma.storedFile.update({
    where: { id: row.id },
    data: {
      status: 'READY',
      readyAt: new Date(),
      size: facts.size ?? row.size,
      contentType: facts.contentType ?? row.contentType,
      meta: (facts.meta as Prisma.InputJsonValue) ?? undefined,
    },
  });
  await auditFile('FILE_UPLOADED', actor.sub, updated, { size: updated.size });
  return { id: updated.id, url: fileUrl(updated.id), name: updated.originalName };
}

async function reject(row: StoredFile, driver: StorageDriver, message: string, status: number) {
  try {
    await driver.remove(locator(row));
  } catch {
    // nothing stored, or already gone
  }
  await prisma.storedFile.update({
    where: { id: row.id },
    data: { status: 'DELETED', deletedAt: new Date() },
  });
  throw new FileError(message, status);
}

/** Step 2 (direct providers): the browser says it finished; verify and mark READY. */
export async function completeDirectUpload(
  actor: Actor,
  fileId: string,
  claimed: Record<string, unknown>,
) {
  const row = await pendingOwnedBy(fileId, actor.sub);
  const driver = getStorageByName(row.provider);
  if (!driver.verifyUpload) throw new FileError('This provider does not use direct uploads', 400);

  const verified = await driver.verifyUpload(locator(row), claimed);
  if (!verified) await reject(row, driver, 'The upload could not be found', 422);
  const v = verified!;

  const type = v.contentType?.split(';')[0].trim() ?? row.contentType ?? '';
  if (!allowedTypes(row.folder as UploadFolder).includes(type)) {
    await reject(row, driver, 'That file type is not allowed here', 415);
  }
  if (v.size !== undefined && v.size > maxBytes(type, 'direct')) {
    await reject(row, driver, 'File is too large', 413);
  }
  return markReady(row, actor, { size: v.size, contentType: type, meta: v.meta });
}

/** Step 2 (proxy providers): the bytes arrive here. */
export async function completeProxyUpload(actor: Actor, fileId: string, file: File) {
  const row = await pendingOwnedBy(fileId, actor.sub);
  const driver = getStorageByName(row.provider);
  if (!driver.put) throw new FileError('This provider uses direct uploads', 400);
  if (file.type !== row.contentType)
    throw new FileError('File type does not match the request', 415);
  if (file.size > maxBytes(file.type, 'proxy') || file.size === 0) {
    await reject(row, driver, 'File is too large', 413);
  }
  await driver.put(locator(row), new Uint8Array(await file.arrayBuffer()), file.type);
  return markReady(row, actor, { size: file.size, contentType: file.type });
}

// ── Reading ─────────────────────────────────────────────────────────────────

/** May this user read this private file? (Public files never reach here.) */
export async function canReadFile(actor: Actor, file: StoredFile): Promise<boolean> {
  if (file.ownerId === actor.sub || actor.role === 'ADMIN') return true;

  const scope =
    actor.role === 'MANAGER'
      ? { managerId: actor.sub }
      : actor.role === 'LANDLORD'
        ? { landlordId: actor.sub }
        : null;

  if (file.folder === 'profile' || file.folder === 'applications') {
    if (!scope) return false;
    const [application, lease] = await Promise.all([
      prisma.application.findFirst({
        where: { applicantId: file.ownerId, unit: { property: scope } },
        select: { id: true },
      }),
      prisma.lease.findFirst({
        where: { tenantId: file.ownerId, unit: { property: scope } },
        select: { id: true },
      }),
    ]);
    return Boolean(application || lease);
  }

  if (file.folder === 'maintenance-requests') {
    // Readable by whoever may see a request that actually carries this file.
    const url = fileUrl(file.id);
    const involved =
      actor.role === 'TENANT'
        ? { tenantId: actor.sub }
        : actor.role === 'VENDOR'
          ? { vendorId: actor.sub }
          : scope
            ? { unit: { property: scope } }
            : null;
    if (!involved) return false;
    const request = await prisma.maintenanceRequest.findFirst({
      where: {
        AND: [
          involved,
          {
            OR: [
              { mediaUrls: { has: url } },
              { completionProofUrl: url },
              { beforePhotoUrls: { has: url } },
              { afterPhotoUrls: { has: url } },
              { disputePhotoUrls: { has: url } },
            ],
          },
        ],
      },
      select: { id: true },
    });
    return Boolean(request);
  }

  if (file.folder === 'notices') {
    const url = fileUrl(file.id);
    const notice = await prisma.notice.findFirst({
      where: { documentUrl: url },
      include: { lease: { include: { unit: { include: { property: true } } } } },
    });
    if (!notice) return false;
    if (notice.lease.tenantId === actor.sub) return true;
    if (!scope) return false;
    return (
      notice.lease.unit.property.managerId === actor.sub ||
      notice.lease.unit.property.landlordId === actor.sub
    );
  }

  if (file.folder === 'leases') {
    const url = fileUrl(file.id);
    const lease = await prisma.lease.findFirst({
      where: { signedAgreementUrl: url },
      include: { unit: { include: { property: true } } },
    });
    if (!lease) return false;
    if (lease.tenantId === actor.sub) return true;
    if (!scope) return false;
    return (
      lease.unit.property.managerId === actor.sub || lease.unit.property.landlordId === actor.sub
    );
  }

  if (file.folder === 'communications') {
    const url = fileUrl(file.id);
    const message = await prisma.message.findFirst({
      where: { attachmentUrls: { has: url } },
      select: { conversationId: true, createdAt: true },
    });
    if (!message) return false;
    const participant = await prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: { conversationId: message.conversationId, userId: actor.sub },
      },
      select: { leftAt: true },
    });
    // Someone whose tenancy ended keeps what was shared before they left, not what came after.
    return (
      Boolean(participant) && (!participant!.leftAt || message.createdAt <= participant!.leftAt)
    );
  }

  if (file.folder === 'reconciliation') {
    const url = fileUrl(file.id);
    const submission = await prisma.bankTransferSubmission.findFirst({
      where: { proofFileUrl: url },
      include: {
        invoice: {
          include: {
            lease: { include: { unit: { include: { property: true } } } },
            maintenanceRequest: { include: { unit: { include: { property: true } } } },
          },
        },
      },
    });
    if (!submission) return false;
    if (submission.submittedById === actor.sub) return true;
    // Once confirmed, the payer on the lease and the vendor who was paid may read the proof too:
    // it is attached to their receipt.
    if (submission.status === 'APPROVED') {
      if (submission.invoice.lease?.tenantId === actor.sub) return true;
      if (submission.invoice.maintenanceRequest?.vendorId === actor.sub) return true;
    }
    if (!scope) return false;
    const property =
      submission.invoice.lease?.unit.property ??
      submission.invoice.maintenanceRequest?.unit.property;
    if (!property) return false;
    return property.managerId === actor.sub || property.landlordId === actor.sub;
  }

  return false;
}

export type GatewayResult =
  | { kind: 'redirect'; url: string; file: StoredFile }
  | { kind: 'stream'; stream: ReadableStream<Uint8Array>; contentType: string; file: StoredFile }
  | { kind: 'error'; status: number; message: string };

/** Resolve a READY file to a redirect or stream via the provider that holds it. */
export async function resolveForRead(
  file: StoredFile,
  actorId: string | null,
): Promise<GatewayResult> {
  let driver: StorageDriver | null = null;
  try {
    driver = getStorageByName(file.provider);
  } catch {
    // unknown provider name on the row
  }
  if (!driver || !driver.isConfigured()) {
    await auditFile('FILE_PROVIDER_MISMATCH', actorId, file, {
      activeProvider: getStorage().name,
    });
    return {
      kind: 'error',
      status: 503,
      message: 'This file is stored with a provider that is not configured',
    };
  }

  const loc = locator(file);
  const contentType = file.contentType ?? 'application/octet-stream';
  const signed = driver.signedUrl
    ? await driver.signedUrl(loc, { ttlSeconds: 300, fileName: file.originalName, contentType })
    : null;
  if (signed) return { kind: 'redirect', url: signed, file };

  const got = driver.read ? await driver.read(loc) : null;
  if (!got) return { kind: 'error', status: 404, message: 'Not found' };
  return {
    kind: 'stream',
    stream: got.stream,
    contentType: file.contentType ?? got.contentType,
    file,
  };
}

// ── Delete & ownership ──────────────────────────────────────────────────────

/** Remove the object and mark the row DELETED. Best effort; never throws. */
export async function deleteFileByUrl(url: string | null | undefined, actorId: string | null) {
  const id = parseFileUrl(url);
  if (!id) return;
  try {
    const row = await prisma.storedFile.findUnique({ where: { id } });
    if (!row || row.status === 'DELETED') return;
    try {
      await getStorageByName(row.provider).remove(locator(row));
    } catch (err) {
      console.error('Could not remove stored object', err);
    }
    const updated = await prisma.storedFile.update({
      where: { id },
      data: { status: 'DELETED', deletedAt: new Date() },
    });
    await auditFile('FILE_DELETED', actorId, updated);
  } catch (err) {
    console.error('Could not delete stored file', err);
  }
}

/**
 * Gateway URLs attached to a record must be READY files the caller uploaded
 * (and, when given, in the expected folder) -- otherwise attaching someone
 * else's file URL would grant read access to it. Non-gateway strings pass.
 */
export async function assertOwnsFileUrls(
  urls: Array<string | null | undefined>,
  userId: string,
  folder?: UploadFolder,
) {
  const ids = urls.map((u) => parseFileUrl(u)).filter((x): x is string => Boolean(x));
  if (ids.length === 0) return;
  const rows = await prisma.storedFile.findMany({ where: { id: { in: ids } } });
  const byId = new Map(rows.map((r) => [r.id, r]));
  for (const id of ids) {
    const r = byId.get(id);
    if (!r || r.ownerId !== userId || r.status !== 'READY' || (folder && r.folder !== folder)) {
      throw new FileError('A file you attached was not uploaded by your account', 400);
    }
  }
}

/** Remove PENDING uploads that were never completed. Returns how many. */
export async function cleanupStalePending(olderThanMs = 24 * 60 * 60 * 1000): Promise<number> {
  const stale = await prisma.storedFile.findMany({
    where: { status: 'PENDING', createdAt: { lt: new Date(Date.now() - olderThanMs) } },
    take: 200,
  });
  for (const row of stale) {
    try {
      await getStorageByName(row.provider).remove(locator(row));
    } catch {
      // never uploaded
    }
    await prisma.storedFile.update({
      where: { id: row.id },
      data: { status: 'DELETED', deletedAt: new Date() },
    });
  }
  return stale.length;
}
