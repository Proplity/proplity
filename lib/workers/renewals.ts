import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getSystemSettings } from '@/lib/systemSettings';
import { notifyAndEmail, notifyPropertyTeam } from '@/lib/notifications';
import { occupyUnitForRent } from '@/lib/rentLifecycle';
import { renewRent } from '@/lib/rentRenewal';

const DAY = 24 * 60 * 60 * 1000;
// A person is reminded to sign at most this many times, one reminder per period.
const MAX_UNSIGNED_REMINDERS = 4;

/**
 * Records that a reminder was sent, returning false if it already had been. The unique
 * (rent, kind, key) row is the claim, taken before telling anyone, so the job running twice at
 * once, or again tomorrow, tells each person once.
 */
export async function claimReminder(rentId: string, kind: string, key: string): Promise<boolean> {
  try {
    await prisma.rentReminderLog.create({ data: { rentId, kind, key } });
    return true;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return false;
    throw err;
  }
}

/** Starts renewals whose day has come and which both sides have signed, handing the unit over. */
async function handOverRenewals(now: Date): Promise<number> {
  const due = await prisma.rent.findMany({
    where: {
      status: 'PENDING',
      renewedFromId: { not: null },
      startDate: { lte: now },
      agreementSignedAt: { not: null },
    },
    include: { unit: { include: { property: true } } },
  });
  let handedOver = 0;
  for (const rent of due) {
    try {
      const started = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Unit" WHERE "id" = ${rent.unitId} FOR UPDATE`;
        const fresh = await tx.rent.findUnique({ where: { id: rent.id } });
        if (!fresh || fresh.status !== 'PENDING') return false;
        await tx.rent.update({ where: { id: rent.id }, data: { status: 'ACTIVE' } });
        await occupyUnitForRent(tx, { ...fresh, unit: { propertyId: rent.unit.propertyId } });
        return true;
      });
      if (!started) continue;
      handedOver += 1;
      const where = `unit ${rent.unit.unitNumber} at ${rent.unit.property.name}`;
      await notifyAndEmail(
        rent.tenantId,
        {
          title: 'Your renewed rent has started',
          body: `Your renewed rent for ${where} is now running.`,
          link: '/dashboard',
        },
        { email: false },
      );
      await notifyPropertyTeam(
        rent.unit.property,
        {
          title: 'Renewed rent started',
          body: `The renewal for ${where} has started.`,
          link: `/dashboard/tenants/${rent.id}`,
        },
        { email: false },
      );
    } catch (err) {
      // One rent that cannot start (its unit is taken by something else) must not stop the rest.
      console.error('[renewals] could not start a renewal', rent.id, err);
    }
  }
  return handedOver;
}

/** Prepares the renewal of every rent marked "renew automatically" that is within the admin's window. */
async function prepareAutoRenewals(now: Date, daysBefore: number) {
  const settings = await getSystemSettings();
  const rents = await prisma.rent.findMany({
    where: {
      status: 'ACTIVE',
      autoRenew: true,
      renewedInto: { is: null },
      endDate: {
        gt: new Date(now.getTime() - DAY),
        lte: new Date(now.getTime() + daysBefore * DAY),
      },
    },
    include: { unit: { include: { property: true } } },
  });
  let prepared = 0;
  let failed = 0;
  for (const rent of rents) {
    const property = rent.unit.property;
    const actorId = property.managerId ?? property.landlordId;
    const where = `unit ${rent.unit.unitNumber} at ${property.name}`;
    const actor = actorId
      ? await prisma.user.findUnique({ where: { id: actorId }, select: { id: true, role: true } })
      : null;
    if (!actor) continue;
    const result = await renewRent({
      rentId: rent.id,
      actor: { sub: actor.id, role: actor.role, scope: [actor.id] },
      terms: {},
      copyAgreement: true,
      settings,
    });
    if (result.ok) {
      prepared += 1;
      const note = result.agreement.drafted
        ? 'A draft agreement is ready. Review it and send it to the tenant.'
        : `No draft agreement was made: ${result.agreement.reason}. Make it from the new rent's page.`;
      await notifyPropertyTeam(
        property,
        {
          title: 'Renewal prepared',
          body: `The rent for ${where} ends on ${rent.endDate.toDateString()}, so its renewal was prepared automatically. ${note}`,
          link: `/dashboard/tenants/${result.rent.id}`,
        },
        { email: false },
      );
    } else if (
      result.code !== 'ALREADY_RENEWED' &&
      (await claimReminder(rent.id, 'AUTO_RENEWAL_FAILED', 'once'))
    ) {
      failed += 1;
      await notifyPropertyTeam(
        property,
        {
          title: 'Automatic renewal did not work',
          body: `The renewal of the rent for ${where} could not be prepared: ${result.error}. Renew it yourself from the rent's page.`,
          link: `/dashboard/tenants/${rent.id}`,
        },
        { email: false },
      );
    }
  }
  return { prepared, failed };
}

/** Tells the team once that a rent is still running past its end date. */
async function remindEndedStillActive(now: Date): Promise<number> {
  const rents = await prisma.rent.findMany({
    where: {
      status: 'ACTIVE',
      endDate: { lt: new Date(now.getTime() - DAY) },
      renewedInto: { is: null },
    },
    include: { unit: { include: { property: true } } },
  });
  let told = 0;
  for (const rent of rents) {
    if (!(await claimReminder(rent.id, 'ENDED_ACTIVE', 'once'))) continue;
    await notifyPropertyTeam(
      rent.unit.property,
      {
        title: `Rent ended ${rent.endDate.toDateString()}: unit ${rent.unit.unitNumber}`,
        body: `The rent for unit ${rent.unit.unitNumber} at ${rent.unit.property.name} ended on ${rent.endDate.toDateString()} but is still running. Renew it, or end it.`,
        link: `/dashboard/tenants/${rent.id}`,
      },
      { email: false },
    );
    told += 1;
  }
  return told;
}

/** Reminds whoever has not signed an agreement that was sent, every few days, a few times. */
async function remindUnsigned(now: Date, everyDays: number): Promise<number> {
  const agreements = await prisma.rentAgreement.findMany({
    where: {
      status: 'ISSUED',
      issuedAt: { lte: new Date(now.getTime() - everyDays * DAY) },
      rent: { status: { in: ['PENDING', 'ACTIVE'] } },
    },
    include: {
      rent: {
        include: {
          signatures: { select: { signerRole: true } },
          unit: { include: { property: true } },
        },
      },
    },
  });
  let told = 0;
  for (const a of agreements) {
    const round = Math.floor((now.getTime() - a.issuedAt!.getTime()) / (everyDays * DAY));
    if (round < 1 || round > MAX_UNSIGNED_REMINDERS) continue;
    const { rent } = a;
    const where = `unit ${rent.unit.unitNumber} at ${rent.unit.property.name}`;
    const tenantSigned =
      a.source === 'UPLOADED' ? false : rent.signatures.some((s) => s.signerRole === 'TENANT');
    const teamSigned = rent.signatures.some((s) =>
      ['MANAGER', 'LANDLORD', 'ADMIN'].includes(s.signerRole),
    );
    if (!tenantSigned && (await claimReminder(rent.id, 'UNSIGNED_TENANT', String(round)))) {
      await notifyAndEmail(rent.tenantId, {
        title: 'Your rent agreement is waiting for you',
        body: `The rent agreement for ${where} is waiting for ${a.source === 'UPLOADED' ? 'you to confirm it' : 'your signature'}.`,
        link: `/dashboard/tenants/${rent.id}`,
      });
      told += 1;
    }
    if (
      a.source === 'GENERATED' &&
      !teamSigned &&
      (await claimReminder(rent.id, 'UNSIGNED_TEAM', String(round)))
    ) {
      await notifyPropertyTeam(
        rent.unit.property,
        {
          title: 'A rent agreement is waiting for your signature',
          body: `The rent agreement for ${where} has not been signed by the property team yet.`,
          link: `/dashboard/tenants/${rent.id}`,
        },
        { email: false },
      );
      told += 1;
    }
  }
  return told;
}

export type RenewalsResult = {
  handedOver: number;
  prepared: number;
  failed: number;
  endedStillActive: number;
  unsignedReminders: number;
};

/**
 * The daily renewals job. Starting renewals whose time has come always runs. The rest follow the
 * admin's switches: automatic preparation of renewals (`autoRenewalEnabled`), and the reminders
 * about a rent that ran past its end and about agreements nobody has signed
 * (`agreementRemindersEnabled`).
 */
export async function runRenewals(): Promise<RenewalsResult> {
  const now = new Date();
  const settings = await getSystemSettings();
  const result: RenewalsResult = {
    handedOver: 0,
    prepared: 0,
    failed: 0,
    endedStillActive: 0,
    unsignedReminders: 0,
  };
  result.handedOver = await handOverRenewals(now);
  if (settings.autoRenewalEnabled) {
    const auto = await prepareAutoRenewals(now, settings.autoRenewalDaysBefore);
    result.prepared = auto.prepared;
    result.failed = auto.failed;
  }
  if (settings.agreementRemindersEnabled) {
    result.endedStillActive = await remindEndedStillActive(now);
    if (settings.agreementUnsignedReminderDays > 0) {
      result.unsignedReminders = await remindUnsigned(now, settings.agreementUnsignedReminderDays);
    }
  }
  return result;
}
