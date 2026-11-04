import { Role, type Prisma } from '@prisma/client';
import { activateRentAfterSigning } from '@/lib/rentLifecycle';
import { notifyAndEmail, notifyPropertyTeam } from '@/lib/notifications';
import type { getSystemSettings } from '@/lib/systemSettings';

type Tx = Prisma.TransactionClient;
type Settings = Awaited<ReturnType<typeof getSystemSettings>>;

export type SigningOutcome =
  'EXECUTED' | 'ALREADY_EXECUTED' | 'WAITING_FOR_SIGNATURES' | 'WAITING_FOR_WITNESSES';

/**
 * Moves a rent to "fully signed" if everything it needs is in: a tenant-side and a landlord-side
 * signature and, when the admin requires it (`witnessesMustSign`) and the agreement needs
 * witnesses, a witness who has signed on each side. Then the generated agreement becomes EXECUTED
 * and the rent starts if the admin's rule says it starts on signing. Called by whoever just added a
 * signature, inside their transaction, holding the rent's row lock; safe to call again.
 */
export async function completeSigningIfReady(
  tx: Tx,
  rentId: string,
  settings: Pick<Settings, 'rentActivationRule' | 'witnessEsignEnabled' | 'witnessesMustSign'>,
): Promise<SigningOutcome> {
  const rent = await tx.rent.findUnique({
    where: { id: rentId },
    select: { agreementSignedAt: true },
  });
  if (!rent) return 'WAITING_FOR_SIGNATURES';
  if (rent.agreementSignedAt) return 'ALREADY_EXECUTED';

  const signatures = await tx.rentSignature.findMany({ where: { rentId } });
  const tenantSigned = signatures.some((s) => s.signerRole === Role.TENANT);
  const teamSigned = signatures.some(
    (s) =>
      s.signerRole === Role.MANAGER ||
      s.signerRole === Role.LANDLORD ||
      s.signerRole === Role.ADMIN,
  );
  if (!tenantSigned || !teamSigned) return 'WAITING_FOR_SIGNATURES';

  const agreement = await tx.rentAgreement.findFirst({
    where: { rentId, status: { not: 'VOID' } },
    orderBy: { createdAt: 'desc' },
    include: { witnessSignatures: { select: { side: true, status: true } } },
  });
  if (
    agreement?.source === 'GENERATED' &&
    agreement.witnessRequired &&
    settings.witnessEsignEnabled &&
    settings.witnessesMustSign
  ) {
    const signedSides = new Set(
      agreement.witnessSignatures.filter((w) => w.status === 'SIGNED').map((w) => w.side),
    );
    if (!signedSides.has('LANDLORD') || !signedSides.has('TENANT')) return 'WAITING_FOR_WITNESSES';
  }

  const now = new Date();
  await tx.rent.update({ where: { id: rentId }, data: { agreementSignedAt: now } });
  await tx.rentAgreement.updateMany({
    where: { rentId, source: 'GENERATED', status: 'ISSUED' },
    data: { status: 'EXECUTED', executedAt: now },
  });
  if (settings.rentActivationRule === 'AFTER_BOTH_SIGN') {
    await activateRentAfterSigning(tx, rentId);
  }
  return 'EXECUTED';
}

/** Tells both sides the rent is fully signed (in the app; the emails of the signing already went). */
export async function announceFullySigned(rent: {
  id: string;
  tenantId: string;
  unit: {
    unitNumber: string;
    property: Parameters<typeof notifyPropertyTeam>[0] & { name: string };
  };
}) {
  const unitLabel = `unit ${rent.unit.unitNumber} at ${rent.unit.property.name}`;
  const fully = {
    title: 'Rent fully signed',
    body: `Both sides have signed the rent for ${unitLabel}.`,
  };
  await notifyAndEmail(rent.tenantId, { ...fully, link: '/dashboard' }, { email: false });
  await notifyPropertyTeam(
    rent.unit.property,
    { ...fully, link: `/dashboard/tenants/${rent.id}` },
    { email: false },
  );
}
