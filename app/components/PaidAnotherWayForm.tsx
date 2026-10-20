'use client';

import { useRef, useState } from 'react';
import { FileText, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { useSubmitBankTransfer } from '@/hooks/useBankTransfers';
import { uploadFile, uploadsEnabled } from '@/lib/uploadClient';

export type PayableInvoice = {
  id: string;
  invoiceNumber: string;
  /** What is still owed on it. */
  owing: number;
  /** A line to tell several invoices apart ("Rent, Jan 2027"). */
  label?: string;
};

const today = () => new Date().toISOString().slice(0, 10);

const field =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none';

/**
 * "I paid this another way": a bank transfer (or cash handed over) recorded with its reference and,
 * ideally, a receipt. It does not mark anything paid by itself: someone other than the person who
 * records it confirms it on the transfers list, and only then does the invoice change and a receipt
 * exist. The one exception is the property team recording a payment when an admin has switched the
 * two-person rule off for that kind of money (`needsSecondPerson={false}`): then it counts at once.
 */
export function PaidAnotherWayForm({
  invoices,
  payerName,
  needsSecondPerson = true,
  onClose,
  onDone,
}: {
  invoices: PayableInvoice[];
  /** Who paid, when it is not the person filling this in (the team recording a tenant's payment). */
  payerName?: string;
  /** False only for the team's own entry when the admin switched the two-person rule off. */
  needsSecondPerson?: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const { user } = useAuth();
  const { submit, submitting, error } = useSubmitBankTransfer();
  const fileInput = useRef<HTMLInputElement>(null);

  const [invoiceId, setInvoiceId] = useState(invoices[0]?.id ?? '');
  const invoice = invoices.find((i) => i.id === invoiceId) ?? invoices[0];
  const [amount, setAmount] = useState(String(invoices[0]?.owing ?? ''));
  const [bankName, setBankName] = useState('');
  const [senderName, setSenderName] = useState(payerName ?? user?.name ?? '');
  const [senderNumber, setSenderNumber] = useState('');
  const [reference, setReference] = useState('');
  const [paidOn, setPaidOn] = useState(today());
  const [notes, setNotes] = useState('');
  const [proof, setProof] = useState<{ name: string; url: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const value = Number(amount);
  const valid =
    !!invoice &&
    Number.isFinite(value) &&
    value > 0 &&
    value <= invoice.owing + 0.005 &&
    bankName.trim().length >= 2 &&
    senderName.trim().length >= 2 &&
    reference.trim().length >= 2 &&
    !!paidOn;

  const chooseInvoice = (id: string) => {
    setInvoiceId(id);
    const next = invoices.find((i) => i.id === id);
    if (next) setAmount(String(next.owing));
  };

  const attach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const uploaded = await uploadFile(file, 'reconciliation');
      setProof({ name: file.name, url: uploaded.url });
    } catch (err) {
      setUploadError(
        err instanceof Error && err.message ? err.message : 'The file could not be uploaded.',
      );
    } finally {
      setUploading(false);
    }
  };

  const send = async () => {
    if (!valid || !invoice) return;
    try {
      const result = await submit({
        invoiceId: invoice.id,
        amount: value,
        bankName: bankName.trim(),
        senderAccountName: senderName.trim(),
        ...(senderNumber.trim() ? { senderAccountNumber: senderNumber.trim() } : {}),
        referenceNumber: reference.trim(),
        paymentDate: paidOn,
        ...(proof ? { proofFileUrl: proof.url } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      toast.success(
        result.status === 'APPROVED'
          ? 'Recorded and counted. The invoice is updated and a receipt exists.'
          : 'Recorded. Someone else has to confirm it before the invoice changes.',
      );
      onDone();
    } catch {
      // surfaced through `error`
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Paid another way"
        className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-gray-200 p-5">
          <div>
            <h2 className="text-lg font-semibold">Paid another way</h2>
            <p className="mt-0.5 text-sm text-gray-500">
              {needsSecondPerson
                ? 'Record a bank transfer or cash payment. It counts once someone else confirms it.'
                : 'Record a bank transfer or cash payment. It counts straight away, and the entry is logged.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="space-y-3 overflow-y-auto p-5">
          {invoices.length > 1 && (
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-700">Invoice</span>
              <select
                value={invoiceId}
                onChange={(e) => chooseInvoice(e.target.value)}
                className={field}
              >
                {invoices.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.invoiceNumber}
                    {i.label ? `, ${i.label}` : ''} (₦{i.owing.toLocaleString()} owing)
                  </option>
                ))}
              </select>
            </label>
          )}
          {invoices.length === 1 && invoice && (
            <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
              Invoice <span className="font-mono font-medium">{invoice.invoiceNumber}</span>
              {invoice.label ? `, ${invoice.label}` : ''}: ₦{invoice.owing.toLocaleString()} owing
            </p>
          )}

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">Amount paid (₦)</span>
            <input
              type="number"
              min="0"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={field}
            />
            {invoice && value > invoice.owing + 0.005 && (
              <span className="mt-1 block text-xs text-red-600">
                That is more than the ₦{invoice.owing.toLocaleString()} still owing.
              </span>
            )}
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-700">Paid from (bank)</span>
              <input
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="e.g. GTBank"
                className={field}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-700">Date paid</span>
              <input
                type="date"
                value={paidOn}
                max={today()}
                onChange={(e) => setPaidOn(e.target.value)}
                className={field}
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-700">Name on the account</span>
              <input
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                className={field}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-700">
                Account number (optional)
              </span>
              <input
                value={senderNumber}
                onChange={(e) => setSenderNumber(e.target.value)}
                inputMode="numeric"
                className={field}
              />
            </label>
          </div>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">Bank reference</span>
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="The transfer or session reference"
              className={`${field} font-mono`}
            />
          </label>

          <div className="text-sm">
            <span className="mb-1 block font-medium text-gray-700">
              Receipt or proof of payment (photo or PDF)
            </span>
            {uploadsEnabled() ? (
              <>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  aria-label="Attach receipt or proof"
                  onChange={attach}
                />
                {proof ? (
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                    <span className="flex min-w-0 items-center gap-2 text-gray-700">
                      <FileText className="h-4 w-4 shrink-0 text-gray-400" />
                      <span className="truncate">{proof.name}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setProof(null)}
                      className="text-xs font-medium text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => fileInput.current?.click()}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
                    {uploading ? 'Uploading…' : 'Attach a file'}
                  </button>
                )}
                {uploadError && <p className="mt-1 text-xs text-red-600">{uploadError}</p>}
                <p className="mt-1 text-xs text-gray-500">
                  Optional, but whoever confirms the payment will want to see it.
                </p>
              </>
            ) : (
              <p className="text-xs text-gray-500">
                File uploads are not set up on this site yet, so a receipt cannot be attached.
              </p>
            )}
          </div>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">Notes (optional)</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className={field}
            />
          </label>

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </p>
          )}
        </div>

        <div className="flex gap-3 border-t border-gray-200 p-5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={send}
            disabled={!valid || submitting || uploading}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Saving…' : 'Record payment'}
          </button>
        </div>
      </div>
    </div>
  );
}
