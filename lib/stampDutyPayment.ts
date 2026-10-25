import { prisma } from '@/lib/db';
import { notifyAdmins, notifyAndEmail, notifyPropertyTeam } from '@/lib/notifications';

/**
 * Called by the payment webhook when a stamp duty invoice is paid in full. The order moves from
 * awaiting payment to paid exactly once (the update only matches the first time), the agreement is
 * marked "in progress" with the quoted duty, and Proplity's admins are told there is stamping to do.
 */
export async function receiveStampDutyPayment(invoiceId: string): Promise<boolean> {
  const moved = await prisma.$transaction(async (tx) => {
    const order = await tx.stampDutyOrder.findUnique({
      where: { invoiceId },
      include: { agreement: { select: { id: true, rentId: true } } },
    });
    if (!order) return null;
    const claimed = await tx.stampDutyOrder.updateMany({
      where: { id: order.id, status: 'AWAITING_PAYMENT' },
      data: { status: 'PAID', paidAt: new Date() },
    });
    if (claimed.count === 0) return null;
    await tx.rentAgreement.update({
      where: { id: order.agreementId },
      data: {
        stampDutyStatus: 'IN_PROGRESS',
        stampDutyAmount: order.dutyAmount,
        stampedAt: null,
      },
    });
    return order;
  });
  if (!moved) return false;

  const rent = await prisma.rent.findUnique({
    where: { id: moved.agreement.rentId },
    include: { unit: { include: { property: true } } },
  });
  if (rent) {
    const where = `unit ${rent.unit.unitNumber} at ${rent.unit.property.name}`;
    await notifyAdmins({
      title: 'Stamp duty to process',
      body: `₦${moved.total.toLocaleString()} was paid to stamp the rent agreement for ${where}. Pay the duty and upload the receipt.`,
      link: '/admin/stamp-duty',
    });
    const note = {
      title: 'Stamp duty paid',
      body: `The stamp duty for the rent agreement for ${where} is paid. Proplity is stamping it and will add the receipt here.`,
    };
    await notifyAndEmail(
      moved.requestedById,
      { ...note, link: `/dashboard/tenants/${rent.id}` },
      { email: false },
    );
    await notifyPropertyTeam(
      rent.unit.property,
      { ...note, link: `/dashboard/tenants/${rent.id}` },
      {
        email: false,
        exceptId: moved.requestedById,
      },
    );
  }
  return true;
}
