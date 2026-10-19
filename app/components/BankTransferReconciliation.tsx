'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle, Clock, ExternalLink, FileText, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { useBankTransfers, useReconcileBankTransfer } from '@/hooks/useBankTransfers';
import type { BankTransferStatus, BankTransferSubmission } from '@/lib/api/types';

const TABS: { status: BankTransferStatus; label: string; empty: string }[] = [
  {
    status: 'PENDING',
    label: 'Waiting for confirmation',
    empty: 'Nothing is waiting. Recorded transfers show up here until someone confirms them.',
  },
  { status: 'APPROVED', label: 'Confirmed', empty: 'No confirmed transfers yet.' },
  { status: 'REJECTED', label: 'Rejected', empty: 'No rejected transfers.' },
];

const naira = (n: number) => `₦${n.toLocaleString()}`;

function Row({
  item,
  meId,
  onChanged,
}: {
  item: BankTransferSubmission;
  meId: string | undefined;
  onChanged: () => void;
}) {
  const { submit, submitting, error } = useReconcileBankTransfer();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const mine = item.submittedById === meId;

  const decide = async (action: 'APPROVE' | 'REJECT', rejectionReason?: string) => {
    try {
      await submit(item.id, { action, ...(rejectionReason ? { rejectionReason } : {}) });
      toast.success(
        action === 'APPROVE'
          ? 'Confirmed. The invoice is updated and a receipt is ready.'
          : mine
            ? 'Withdrawn.'
            : 'Rejected. The person who recorded it is told why.',
      );
      setRejecting(false);
      setReason('');
      onChanged();
    } catch {
      // surfaced through `error`
    }
  };

  return (
    <li className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900">
            {naira(item.amount)}{' '}
            <span className="font-mono text-xs font-medium text-gray-500">
              {item.invoice?.invoiceNumber}
            </span>
          </p>
          <p className="mt-0.5 text-sm text-gray-600">
            {item.invoice?.type.replace(/_/g, ' ').toLowerCase()} invoice, paid on{' '}
            {new Date(item.paymentDate).toLocaleDateString()} from {item.bankName} (
            {item.senderAccountName}
            {item.senderAccountNumber ? `, ${item.senderAccountNumber}` : ''})
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            Reference <span className="font-mono">{item.referenceNumber}</span> · recorded by{' '}
            {mine ? 'you' : (item.submittedBy?.name ?? 'someone')} on{' '}
            {new Date(item.createdAt).toLocaleDateString()}
          </p>
          {item.notes && <p className="mt-1 text-sm text-gray-700">Note: {item.notes}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
            {item.proofFileUrl ? (
              <a
                href={item.proofFileUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-medium text-blue-600 hover:underline"
              >
                <FileText className="h-4 w-4" />
                View receipt or proof
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <span className="text-xs text-gray-400">No receipt or proof attached</span>
            )}
            {item.status === 'APPROVED' && item.payment && (
              <Link
                href={`/receipts/${item.payment.id}`}
                className="inline-flex items-center gap-1 font-medium text-green-700 hover:underline"
              >
                Receipt {item.payment.receiptNumber}
              </Link>
            )}
          </div>
          {item.status === 'REJECTED' && item.rejectionReason && (
            <p className="mt-2 text-sm text-red-700">Rejected: {item.rejectionReason}</p>
          )}
          {item.status !== 'PENDING' && item.reconciledBy && (
            <p className="mt-1 text-xs text-gray-500">
              {item.status === 'APPROVED' ? 'Confirmed' : 'Rejected'} by {item.reconciledBy.name}
              {item.reconciledAt ? ` on ${new Date(item.reconciledAt).toLocaleDateString()}` : ''}
            </p>
          )}
        </div>

        {item.status === 'PENDING' && (
          <div className="flex shrink-0 flex-col items-stretch gap-2 sm:w-44">
            {mine ? (
              <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
                You recorded this, so someone else has to confirm it.
              </p>
            ) : (
              <button
                type="button"
                disabled={submitting}
                onClick={() => decide('APPROVE')}
                className="rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {submitting ? 'Saving…' : 'Confirm payment'}
              </button>
            )}
            <button
              type="button"
              disabled={submitting}
              onClick={() => setRejecting((v) => !v)}
              className="rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              {mine ? 'Withdraw' : 'Reject'}
            </button>
          </div>
        )}
      </div>

      {rejecting && item.status === 'PENDING' && (
        <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">
              {mine ? 'Why are you withdrawing it?' : 'Why is it being rejected?'}
            </span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </label>
          <button
            type="button"
            disabled={submitting || reason.trim().length < 3}
            onClick={() => decide('REJECT', reason.trim())}
            className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {mine ? 'Withdraw this entry' : 'Reject this entry'}
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </li>
  );
}

/**
 * Transfers and other offline payments that were recorded and now wait for someone to confirm them.
 * Nobody confirms an entry they recorded themselves; they can only withdraw it.
 */
export function BankTransferReconciliation() {
  const { user } = useAuth();
  const [status, setStatus] = useState<BankTransferStatus>('PENDING');
  const { data, loading, error, refetch } = useBankTransfers({ status });
  const tab = TABS.find((t) => t.status === status) ?? TABS[0];

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Bank transfers</h1>
        <p className="mt-1 text-sm text-gray-500">
          Payments made another way (a bank transfer, cash) wait here until someone other than the
          person who recorded them confirms the money arrived. Confirming updates the invoice and
          creates the receipt.
        </p>
      </div>

      <div role="tablist" className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.status}
            role="tab"
            aria-selected={status === t.status}
            onClick={() => setStatus(t.status)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium ${
              status === t.status
                ? 'bg-blue-600 text-white'
                : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            {t.status === 'PENDING' ? (
              <Clock className="h-4 w-4" />
            ) : t.status === 'APPROVED' ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : data.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
          {tab.empty}
        </p>
      ) : (
        <ul className="space-y-3">
          {data.map((item) => (
            <Row key={item.id} item={item} meId={user?.id} onChanged={refetch} />
          ))}
        </ul>
      )}
    </div>
  );
}
