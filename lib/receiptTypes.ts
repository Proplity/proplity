// Safe for the browser as well as the server (no imports): the shape of a payment receipt.

export type Receipt = {
  receiptNumber: string;
  paidAt: string;
  amount: number;
  currency: 'NGN';
  method: string;
  reference: string | null;
  notes: string | null;
  payer: { name: string };
  payee: { name: string };
  invoice: {
    number: string;
    type: string;
    description: string | null;
    amount: number;
    paidToDate: number;
    balance: number;
    status: string;
  };
  property: { name: string; address: string; unit: string | null } | null;
  /** For a bank transfer: how it was paid and who recorded and confirmed it. */
  transfer: {
    bankName: string;
    senderAccountName: string;
    recordedBy: string;
    confirmedBy: string | null;
    confirmedAt: string | null;
  } | null;
  /** The receipt or proof file the payer attached (a file-gateway link the viewer may open). */
  proofFileUrl: string | null;
};
