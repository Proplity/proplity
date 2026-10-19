'use client';

import Link from 'next/link';
import { Printer } from 'lucide-react';
import { useReceipt } from '@/hooks/useBankTransfers';

const naira = (n: number) => `₦${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const day = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-6 border-b border-gray-100 py-2 text-sm">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-right font-medium text-gray-900">{children}</dd>
    </div>
  );
}

/**
 * One payment's receipt, laid out to print or save as a PDF from the browser. Only the people the
 * payment concerns can open it; everyone else sees "not found".
 */
export function ReceiptView({ paymentId }: { paymentId: string }) {
  const { data: r, loading, notFound } = useReceipt(paymentId);

  if (loading) return <p className="p-8 text-sm text-gray-500">Loading receipt…</p>;
  if (notFound || !r) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <h1 className="text-xl font-semibold">Receipt not found</h1>
        <p className="mt-2 text-sm text-gray-600">
          Either this receipt does not exist or it belongs to someone else.
        </p>
        <Link href="/dashboard" className="mt-4 inline-block text-sm text-blue-600 underline">
          Back to my dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-8 print:max-w-none print:p-0">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link href="/dashboard" className="text-sm text-gray-600 hover:text-gray-900">
          ← Back
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Printer className="h-4 w-4" />
          Print or save as PDF
        </button>
      </div>

      <article
        aria-label={`Receipt ${r.receiptNumber}`}
        className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:p-10 print:rounded-none print:border-0 print:p-0 print:shadow-none"
      >
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-200 pb-6">
          <div>
            <p className="text-2xl font-bold text-blue-700">Proplity</p>
            <p className="text-sm text-gray-500">Payment receipt</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-lg font-semibold">{r.receiptNumber}</p>
            <p className="text-sm text-gray-500">{day(r.paidAt)}</p>
          </div>
        </header>

        <div className="py-6 text-center">
          <p className="text-sm text-gray-500">Amount received</p>
          <p className="text-4xl font-bold">{naira(r.amount)}</p>
        </div>

        <dl>
          <Line label="Received from">{r.payer.name}</Line>
          <Line label="Paid to">{r.payee.name}</Line>
          <Line label="For invoice">
            <span className="font-mono">{r.invoice.number}</span> (
            {r.invoice.type.replace(/_/g, ' ').toLowerCase()})
          </Line>
          {r.property && (
            <Line label="Property">
              {r.property.name}
              {r.property.unit ? `, unit ${r.property.unit}` : ''}
              <span className="block text-xs font-normal text-gray-500">{r.property.address}</span>
            </Line>
          )}
          <Line label="Method">{r.method}</Line>
          {r.reference && (
            <Line label="Reference">
              <span className="font-mono">{r.reference}</span>
            </Line>
          )}
          {r.transfer && (
            <>
              <Line label="Paid from">
                {r.transfer.bankName} ({r.transfer.senderAccountName})
              </Line>
              <Line label="Recorded by">{r.transfer.recordedBy}</Line>
              {r.transfer.confirmedBy && (
                <Line label="Confirmed by">
                  {r.transfer.confirmedBy}
                  {r.transfer.confirmedAt ? `, ${day(r.transfer.confirmedAt)}` : ''}
                </Line>
              )}
            </>
          )}
          <Line label="Invoice total">{naira(r.invoice.amount)}</Line>
          <Line label="Paid to date">{naira(r.invoice.paidToDate)}</Line>
          <Line label="Balance">
            {r.invoice.balance > 0 ? naira(r.invoice.balance) : 'Nothing owing: paid in full'}
          </Line>
        </dl>

        {r.notes && <p className="mt-4 text-sm text-gray-600">Note: {r.notes}</p>}

        {r.proofFileUrl && (
          <p className="mt-4 text-sm print:hidden">
            <a
              href={r.proofFileUrl}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-blue-600 hover:underline"
            >
              View the receipt or proof that was attached
            </a>
          </p>
        )}

        <footer className="mt-8 border-t border-gray-200 pt-4 text-xs text-gray-500">
          Issued by Proplity for receipt {r.receiptNumber}. Keep it for your records.
        </footer>
      </article>
    </div>
  );
}
