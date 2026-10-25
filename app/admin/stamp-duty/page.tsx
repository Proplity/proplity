'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Stamp } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/apiClient';
import { uploadFile, uploadsEnabled } from '@/lib/uploadClient';
import { naira } from '@/lib/planDisplay';
import type { AdminStampDutyOrder } from '@/lib/api/types';

const inputClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none';
const messageOf = (err: unknown, fallback: string) =>
  (err as { response?: { data?: { error?: string } } }).response?.data?.error ?? fallback;
const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { dateStyle: 'medium' });

function OrderCard({ order, onDone }: { order: AdminStampDutyOrder; onDone: () => void }) {
  const { rent } = order.agreement;
  const file = useRef<HTMLInputElement>(null);
  const [reference, setReference] = useState('');
  const [amount, setAmount] = useState(String(order.dutyAmount));
  const [receiptUrl, setReceiptUrl] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const upload = async (f: File) => {
    setBusy(true);
    try {
      setReceiptUrl((await uploadFile(f, 'rents')).url);
      toast.success('Receipt attached.');
    } catch (err) {
      toast.error(messageOf(err, 'Could not upload the receipt.'));
    } finally {
      setBusy(false);
    }
  };

  const complete = async () => {
    setBusy(true);
    try {
      const res = await api.admin.stampDuty.complete(order.id, {
        reference: reference.trim(),
        actualAmount: Number(amount),
        receiptUrl,
      });
      toast.success(
        res.data.data.refundDue > 0
          ? `Done. Refund ${naira(res.data.data.refundDue)} to the buyer (logged).`
          : 'Done. The agreement is stamped.',
      );
      onDone();
    } catch (err) {
      toast.error(messageOf(err, 'Could not complete the order.'));
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    setBusy(true);
    try {
      await api.admin.stampDuty.cancel(order.id, reason.trim());
      toast.success('Cancelled. The refund is logged.');
      onDone();
    } catch (err) {
      toast.error(messageOf(err, 'Could not cancel the order.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="rounded-lg border border-gray-200 bg-white p-4" data-testid="stamp-order">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-gray-900">
            Unit {rent.unit.unitNumber}, {rent.unit.property.name}
          </p>
          <p className="text-sm text-gray-600">
            {rent.unit.property.address}, {rent.unit.property.city}
          </p>
          <p className="mt-1 text-sm text-gray-600">
            Landlord {order.agreement.landlordName ?? '—'} · Tenant {rent.tenant.name} · Tenancy{' '}
            {day(rent.startDate)} to {day(rent.endDate)} ({order.termYears} years)
          </p>
        </div>
        <div className="text-right text-sm">
          <p className="font-semibold">{naira(order.total)} paid</p>
          <p className="text-gray-600">
            Duty {naira(order.dutyAmount)} at {order.ratePercent}% ({order.jurisdictionName}) + fee{' '}
            {naira(order.serviceFee)}
          </p>
          <p className="text-xs text-gray-500">
            Invoice {order.invoice.invoiceNumber}
            {order.paidAt ? `, paid ${day(order.paidAt)}` : ''}
          </p>
        </div>
      </div>

      {order.status === 'PAID' && (
        <div className="mt-4 grid gap-3 border-t border-gray-100 pt-4 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-700">
              Reference from the tax authority
            </span>
            <input
              className={inputClass}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-700">
              Duty you paid the authority (₦)
            </span>
            <input
              type="number"
              min={0}
              className={inputClass}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <div className="flex items-end gap-2">
            {uploadsEnabled() ? (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => file.current?.click()}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                >
                  {receiptUrl ? 'Replace receipt' : 'Add the receipt'}
                </button>
                <input
                  ref={file}
                  type="file"
                  accept="application/pdf,image/*"
                  className="sr-only"
                  aria-label="Stamp duty receipt file"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void upload(f);
                    e.target.value = '';
                  }}
                />
              </>
            ) : (
              <span className="text-xs text-gray-500">File uploads are not set up here.</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
            <button
              type="button"
              disabled={busy || !reference.trim() || !receiptUrl || amount.trim() === ''}
              onClick={complete}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Mark as stamped
            </button>
            <input
              className={`${inputClass} max-w-xs`}
              placeholder="Why it cannot be done"
              aria-label="Reason it cannot be done"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <button
              type="button"
              disabled={busy || !reason.trim()}
              onClick={cancel}
              className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              Cannot do it: refund
            </button>
          </div>
        </div>
      )}
      {order.status === 'COMPLETED' && (
        <p className="mt-3 border-t border-gray-100 pt-3 text-sm text-green-700">
          Stamped{order.completedAt ? ` ${day(order.completedAt)}` : ''}, reference{' '}
          {order.reference}, {naira(order.actualAmount ?? 0)} paid to the authority.
        </p>
      )}
      {order.status === 'CANCELLED' && (
        <p className="mt-3 border-t border-gray-100 pt-3 text-sm text-gray-600">
          Cancelled: {order.cancelReason}
        </p>
      )}
    </li>
  );
}

// The stamping queue: what people paid Proplity to stamp. Staff pay the authority, then record the
// reference and the receipt here, which marks the agreement stamped for the tenant and the team.
export default function AdminStampDutyPage() {
  const [view, setView] = useState<'PAID' | 'COMPLETED' | 'CANCELLED'>('PAID');
  const [orders, setOrders] = useState<AdminStampDutyOrder[] | null>(null);

  const load = useCallback(() => {
    api.admin.stampDuty
      .list(view)
      .then((res) => setOrders(res.data.data))
      .catch(() => toast.error('Failed to load the stamp duty orders.'));
  }, [view]);
  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900">
          <Stamp className="h-6 w-6" aria-hidden="true" />
          Stamp duty
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-600">
          Agreements people have paid Proplity to stamp. Pay the tax authority, then add the
          reference and the receipt. If you cannot stamp one, cancel it with a reason and refund the
          buyer.
        </p>
      </div>
      <div className="flex gap-2" role="tablist">
        {(['PAID', 'COMPLETED', 'CANCELLED'] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            onClick={() => {
              setOrders(null);
              setView(v);
            }}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              view === v
                ? 'bg-blue-600 text-white'
                : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {v === 'PAID' ? 'To do' : v === 'COMPLETED' ? 'Done' : 'Cancelled'}
          </button>
        ))}
      </div>
      {!orders ? (
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      ) : orders.length === 0 ? (
        <p className="text-sm text-gray-600">Nothing here.</p>
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => (
            <OrderCard key={`${o.id}-${o.status}`} order={o} onDone={load} />
          ))}
        </ul>
      )}
    </div>
  );
}
