import type { Prisma } from '@prisma/client';

/**
 * The payment fields a screen may show. A payment row also holds `rawProviderPayload` (the signed
 * provider webhook body: payer email, card details, authorisation data) and a virtual account
 * number, and those must never reach a client. Query payments with this select, not `true`.
 */
export const PUBLIC_PAYMENT_SELECT = {
  id: true,
  invoiceId: true,
  amount: true,
  paymentMethod: true,
  provider: true,
  transactionRef: true,
  paidAt: true,
  notes: true,
  receiptNumber: true,
  createdAt: true,
} satisfies Prisma.PaymentSelect;
