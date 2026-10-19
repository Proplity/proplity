'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useBankTransfers } from '@/hooks/useBankTransfers';
import type { Payment } from '@/lib/api/types';
import { PaidAnotherWayForm } from './PaidAnotherWayForm';

type PaymentLine = Pick<Payment, 'id' | 'amount' | 'paidAt' | 'paymentMethod' | 'receiptNumber'>;

const METHOD: Record<string, string> = {
  CREDIT_CARD: 'card',
  DEBIT_CARD: 'card',
  BANK_TRANSFER: 'bank transfer',
  CASH: 'cash',
  CHECK: 'cheque',
};

/**
 * What has been paid on one invoice (each with its receipt), the transfers recorded but not yet
 * confirmed, and, for the property team, the way to record a payment made outside the app.
 */
export function InvoicePayments({
  invoice,
  payments,
  owing,
  canRecord,
  onChanged,
}: {
  invoice: { id: string; invoiceNumber: string };
  payments: PaymentLine[];
  owing: number;
  /** The property team and admins may record and confirm payments. */
  canRecord: boolean;
  onChanged: () => void;
}) {
  const { user } = useAuth();
  const [recording, setRecording] = useState(false);
  const waiting = useBankTransfers(
    { invoiceId: invoice.id, status: 'PENDING' },
    { enabled: canRecord },
  );
  const reconcileHref = user?.role === 'admin' ? '/admin/payments' : '/dashboard/reconciliation';

  return (
    <div className="mt-2 space-y-2 text-xs">
      {payments.length > 0 && (
        <ul className="space-y-1 text-gray-600">
          {payments.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2">
              <span>
                ₦{p.amount.toLocaleString()} paid {new Date(p.paidAt).toLocaleDateString()} by{' '}
                {METHOD[p.paymentMethod] ?? 'other means'}
              </span>
              <Link
                href={`/receipts/${p.id}`}
                className="shrink-0 font-medium text-blue-600 hover:underline"
              >
                Receipt
              </Link>
            </li>
          ))}
        </ul>
      )}

      {canRecord &&
        waiting.data.map((t) => (
          <p key={t.id} className="rounded-lg bg-amber-50 p-2 text-amber-900">
            ₦{t.amount.toLocaleString()} recorded by{' '}
            {t.submittedById === user?.id ? 'you' : (t.submittedBy?.name ?? 'someone')} (reference{' '}
            {t.referenceNumber}) is waiting to be confirmed.{' '}
            <Link href={reconcileHref} className="font-medium underline">
              {t.submittedById === user?.id ? 'See it' : 'Review it'}
            </Link>
          </p>
        ))}

      {canRecord && owing > 0 && (
        <button
          type="button"
          onClick={() => setRecording(true)}
          className="font-medium text-blue-600 hover:underline"
        >
          Paid another way
        </button>
      )}

      {recording && (
        <PaidAnotherWayForm
          invoices={[{ id: invoice.id, invoiceNumber: invoice.invoiceNumber, owing }]}
          onClose={() => setRecording(false)}
          onDone={() => {
            setRecording(false);
            waiting.refetch();
            onChanged();
          }}
        />
      )}
    </div>
  );
}
