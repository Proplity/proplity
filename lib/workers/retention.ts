import { prisma } from '@/lib/db';
import { deleteFileByUrl } from '@/lib/storage/service';
import { fileUrl } from '@/lib/fileRef';
import { getSystemSettings, retentionOn } from '@/lib/systemSettings';

// Retention for identity documents (ADR-0012, ISS-039). Identity documents
// are personal data (NDPR), so they are removed once there is no reason to
// hold them:
//   - tenancy ended: the user has leases, none pending or active, and the
//     latest one ended more than the tenancy period ago (365 days unless an admin set another);
//   - never became a tenant: the user has applications, all rejected, and
//     the latest decision is more than the rejection period old (90 days unless set).
// Users with no lease and no application are left alone (no trigger yet).
//
// Deleting is irreversible, so it only happens when both gates are open (ADR-0015): the
// deployment allows it (RETENTION_ENABLED=true) and an admin has switched it on in Platform
// Settings, where the two periods are also set. Otherwise the job reports what it would remove
// and changes nothing.
const DAY_MS = 24 * 60 * 60 * 1000;
const DOC_FOLDERS = ['profile', 'applications'];

async function eligibleOwnerIds(
  now: number,
  tenancyEndedMs: number,
  rejectedMs: number,
): Promise<Set<string>> {
  const owners = await prisma.storedFile.findMany({
    where: { status: 'READY', folder: { in: DOC_FOLDERS } },
    select: { ownerId: true },
    distinct: ['ownerId'],
  });
  const eligible = new Set<string>();

  for (const { ownerId } of owners) {
    const leases = await prisma.lease.findMany({
      where: { tenantId: ownerId },
      select: { status: true, endDate: true },
    });
    if (leases.length > 0) {
      const stillNeeded = leases.some((l) => l.status === 'PENDING' || l.status === 'ACTIVE');
      const latestEnd = Math.max(...leases.map((l) => l.endDate.getTime()));
      if (!stillNeeded && now - latestEnd > tenancyEndedMs) eligible.add(ownerId);
      continue;
    }

    const applications = await prisma.application.findMany({
      where: { applicantId: ownerId },
      select: { status: true, reviewedAt: true },
    });
    if (applications.length === 0) continue;
    const allRejected = applications.every((a) => a.status === 'REJECTED' && a.reviewedAt);
    if (!allRejected) continue;
    const latestDecision = Math.max(...applications.map((a) => a.reviewedAt!.getTime()));
    if (now - latestDecision > rejectedMs) eligible.add(ownerId);
  }
  return eligible;
}

export async function runRetention(): Promise<{
  enabled: boolean;
  owners: number;
  files: number;
  deleted: number;
}> {
  const settings = await getSystemSettings();
  const enabled = retentionOn(settings);
  const owners = await eligibleOwnerIds(
    Date.now(),
    settings.retentionAfterTenancyDays * DAY_MS,
    settings.retentionAfterRejectionDays * DAY_MS,
  );
  if (owners.size === 0) return { enabled, owners: 0, files: 0, deleted: 0 };

  const files = await prisma.storedFile.findMany({
    where: { status: 'READY', folder: { in: DOC_FOLDERS }, ownerId: { in: [...owners] } },
  });
  if (!enabled) return { enabled, owners: owners.size, files: files.length, deleted: 0 };

  let deleted = 0;
  for (const file of files) {
    const url = fileUrl(file.id);
    await deleteFileByUrl(url, null);
    // Do not leave a dead reference on the profile.
    await prisma.user.updateMany({
      where: { id: file.ownerId, idDocumentUrl: url },
      data: { idDocumentUrl: null },
    });
    await prisma.auditLog.create({
      data: {
        actorId: null,
        action: 'FILE_RETENTION_DELETED',
        entityType: 'StoredFile',
        entityId: file.id,
        metadata: { ownerId: file.ownerId, folder: file.folder },
      },
    });
    deleted += 1;
  }
  return { enabled, owners: owners.size, files: files.length, deleted };
}
