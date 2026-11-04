'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/apiClient';
import { naira } from '@/lib/planDisplay';
import type { StampDutyOffer } from '@/lib/api/types';

const messageOf = (err: unknown, fallback: string) =>
  (err as { response?: { data?: { error?: string } } }).response?.data?.error ?? fallback;
const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { dateStyle: 'medium' });

/**
 * Pay stamp duty through Proplity: the quote (duty at the place's rate plus Proplity's fee), then
 * the card page. Proplity staff pay the tax authority and the receipt appears on the agreement.
 * Renders nothing while the admin has this switched off or the agreement is not signed yet.
 */
export function StampDutyPay({ rentId }: { rentId: string }) {
  const [offer, setOffer] = useState<StampDutyOffer | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setOffer((await api.rents.agreement.stampDutyOffer(rentId)).data.data);
    } catch {
      setOffer(null);
    }
  }, [rentId]);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  if (!offer?.enabled) return null;
  const order = offer.order;

  const pay = async () => {
    setBusy(true);
    setError(null);
    try {
      const started = (await api.rents.agreement.startStampDutyPayment(rentId)).data.data;
      const { authorizationUrl } = (await api.payments.initialize(started.invoiceId)).data.data;
      window.location.assign(authorizationUrl);
    } catch (err) {
      setError(messageOf(err, 'Could not start the payment.'));
      setBusy(false);
    }
  };

  let body: React.ReactNode;
  if (order?.status === 'PAID') {
    body = (
      <p className="text-sm text-gray-700" data-testid="stamp-paid">
        Paid {naira(order.total)}
        {order.paidAt ? ` on ${day(order.paidAt)}` : ''}. Proplity is paying the duty and will add
        the receipt here.
      </p>
    );
  } else if (order?.status === 'COMPLETED') {
    return null;
  } else if (offer.quote && offer.canPay) {
    body = (
      <>
        <dl className="grid max-w-sm grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-sm">
          <dt className="text-gray-600">
            Stamp duty ({offer.quote.ratePercent}% for a {offer.quote.termYears}-year tenancy)
          </dt>
          <dd className="text-right">{naira(offer.quote.dutyAmount)}</dd>
          <dt className="text-gray-600">Proplity service fee</dt>
          <dd className="text-right">{naira(offer.quote.serviceFee)}</dd>
          <dt className="font-medium text-gray-900">Total</dt>
          <dd className="text-right font-semibold" data-testid="stamp-total">
            {naira(offer.quote.total)}
          </dd>
        </dl>
        <p className="mt-2 text-xs text-gray-500">
          An estimate from the rates Proplity uses. If the tax authority charges less, the
          difference is refunded.
        </p>
        <button
          type="button"
          onClick={pay}
          disabled={busy || offer.cardsAvailable === false}
          data-testid="stamp-pay"
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Pay {naira(offer.quote.total)}
        </button>
        {offer.cardsAvailable === false && (
          <p className="mt-2 text-xs text-amber-700">Card payments aren&apos;t available yet.</p>
        )}
      </>
    );
  } else {
    body = <p className="text-sm text-gray-600">{offer.reason ?? 'Not available yet.'}</p>;
  }

  return (
    <div className="mt-4 border-t border-gray-100 pt-4">
      <h3 className="text-sm font-medium text-gray-900">Pay stamp duty through Proplity</h3>
      <div className="mt-2">{body}</div>
      {error && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
