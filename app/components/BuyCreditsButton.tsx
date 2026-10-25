'use client';

import { useState } from 'react';
import { Coins, Loader2 } from 'lucide-react';
import { useBuyCredits, useCreditShop } from '@/hooks/useCredits';
import { naira } from '@/lib/planDisplay';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/app/components/ui/dialog';

/**
 * Opens the credit packs an account can buy. Renders nothing while the admin has the shop switched
 * off. Paying goes to the card page (Paystack); the credits are added when the payment is
 * confirmed, which can take a moment after coming back.
 */
export function BuyCreditsButton({ className }: { className?: string }) {
  const { data } = useCreditShop();
  const { submit, submitting, error } = useBuyCredits();
  const [choosing, setChoosing] = useState<string | null>(null);
  if (!data?.enabled) return null;

  const buy = async (packKey: string) => {
    setChoosing(packKey);
    try {
      const { authorizationUrl } = await submit(packKey);
      window.location.assign(authorizationUrl);
    } catch {
      // the error is shown below
      setChoosing(null);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          data-testid="buy-credits-open"
          className={
            className ??
            'rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50'
          }
        >
          Buy credits
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" data-testid="buy-credits-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-blue-600" aria-hidden="true" />
            Buy credits
          </DialogTitle>
          <DialogDescription>
            You have {data.balance} credit{data.balance === 1 ? '' : 's'}. Credits are added as soon
            as your card payment is confirmed.
          </DialogDescription>
        </DialogHeader>
        {!data.cardsAvailable && (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800" role="status">
            Card payments aren&apos;t available yet, so credits can&apos;t be bought right now.
          </p>
        )}
        {data.packs.length === 0 ? (
          <p className="text-sm text-gray-600">No credit packs are on sale right now.</p>
        ) : (
          <ul className="space-y-2">
            {data.packs.map((pack) => (
              <li
                key={pack.key}
                className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 p-3"
              >
                <div>
                  <p className="text-sm font-semibold text-gray-900">{pack.name}</p>
                  <p className="text-xs text-gray-500">
                    {pack.credits} credit{pack.credits === 1 ? '' : 's'}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={submitting || !data.cardsAvailable}
                  onClick={() => buy(pack.key)}
                  data-testid={`buy-pack-${pack.key}`}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting && choosing === pack.key && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  )}
                  Pay {naira(pack.price)}
                </button>
              </li>
            ))}
          </ul>
        )}
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
