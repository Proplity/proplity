'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { ShieldCheck, Lock, ChevronDown } from 'lucide-react';

// Mimics Paystack's own hosted checkout page closely enough to be a
// realistic stand-in for manual testing -- dark navy header, green pay
// button, card-first channel tabs, "Secured by Paystack" footer -- while
// staying unmistakably fake via the TEST MODE banner. Only ever reached via
// the authorizationUrl POST /api/v1/payments/initialize hands back when
// there's no real Paystack key and NEXT_PUBLIC_PAYMENTS_MOCK_ENABLED is on
// (see lib/payments/mockGateway.ts) -- never a substitute for the real
// checkout, and never reachable when a real key is configured.
function MockCheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reference = searchParams.get('reference') ?? '';
  const invoiceId = searchParams.get('invoiceId') ?? '';
  const email = searchParams.get('email') ?? '';
  const amountNaira = Number(searchParams.get('amount') ?? 0);
  const [submitting, setSubmitting] = useState<'success' | 'failed' | null>(null);

  const complete = async (outcome: 'success' | 'failed') => {
    setSubmitting(outcome);
    try {
      const res = await fetch('/api/v1/dev/mock-checkout/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reference,
          invoiceId,
          email,
          outcome,
          amountKobo: Math.round(amountNaira * 100),
        }),
      });
      if (!res.ok) throw new Error('Mock webhook delivery failed');

      if (outcome === 'success') {
        toast.success('Payment successful (test mode) — webhook delivered.');
      } else {
        toast.error('Payment declined (test mode).');
      }
      router.push('/dashboard/payment-history');
    } catch {
      toast.error('Could not simulate this payment. Check the server logs.');
      setSubmitting(null);
    }
  };

  if (process.env.NEXT_PUBLIC_PAYMENTS_MOCK_ENABLED !== 'true') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6 text-center text-gray-500">
        This test checkout page isn&apos;t enabled.
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-[#f4f7fa] pb-10">
      <div className="w-full bg-[#011B33] px-4 py-2 text-center text-xs font-semibold text-yellow-300">
        TEST MODE — this is a fake checkout page. No real money moves.
      </div>

      <div className="mt-10 w-full max-w-sm overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between bg-[#011B33] px-6 py-4 text-white">
          <span className="text-lg font-bold tracking-tight">Paystack</span>
          <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
            Test
          </span>
        </div>

        <div className="border-b border-gray-100 px-6 py-5 text-center">
          <p className="text-xs text-gray-500">Amount</p>
          <p className="text-3xl font-bold text-gray-900">₦{amountNaira.toLocaleString()}</p>
          <p className="mt-1 text-xs text-gray-400">{email}</p>
        </div>

        <div className="flex border-b border-gray-100 text-xs font-medium text-gray-400">
          <div className="flex-1 border-b-2 border-[#011B33] py-3 text-center text-[#011B33]">
            Card
          </div>
          <div className="flex-1 py-3 text-center">Bank</div>
          <div className="flex-1 py-3 text-center">USSD</div>
          <div className="flex-1 py-3 text-center">Transfer</div>
        </div>

        <div className="space-y-3 px-6 py-5">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Card Number</label>
            <input
              disabled
              value="4084 0840 8408 4081"
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700"
            />
            <p className="mt-1 text-[11px] text-gray-400">
              Paystack&apos;s own published test card — decorative here, nothing is charged.
            </p>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-gray-500">Expiry</label>
              <input
                disabled
                value="12/30"
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700"
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-gray-500">CVV</label>
              <input
                disabled
                value="408"
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700"
              />
            </div>
          </div>

          <button
            onClick={() => complete('success')}
            disabled={submitting !== null}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-[#00C16E] py-3 text-sm font-semibold text-white transition-colors hover:bg-[#00a95f] disabled:opacity-50"
          >
            <Lock className="h-4 w-4" />
            {submitting === 'success' ? 'Processing…' : `Pay ₦${amountNaira.toLocaleString()}`}
          </button>
          <button
            onClick={() => complete('failed')}
            disabled={submitting !== null}
            className="w-full py-2 text-xs font-medium text-red-500 hover:text-red-600 disabled:opacity-50"
          >
            {submitting === 'failed' ? 'Processing…' : 'Simulate a declined payment'}
          </button>
        </div>

        <div className="flex items-center justify-center gap-1.5 border-t border-gray-100 bg-gray-50 py-3 text-[11px] text-gray-400">
          <ShieldCheck className="h-3.5 w-3.5" />
          Secured by Paystack
          <ChevronDown className="h-3 w-3" />
        </div>
      </div>

      <p className="mt-4 max-w-sm text-center text-[11px] text-gray-400">Ref: {reference || '—'}</p>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <MockCheckoutContent />
    </Suspense>
  );
}
