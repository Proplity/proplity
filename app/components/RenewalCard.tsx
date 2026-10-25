'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { api } from '@/lib/apiClient';
import type { Rent } from '@/lib/api/types';

const inputClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none';
const messageOf = (err: unknown, fallback: string) =>
  (err as { response?: { data?: { error?: string } } }).response?.data?.error ?? fallback;
const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { dateStyle: 'medium' });

/**
 * Where this rent sits in a renewal: the rent it renews, the rent that renews it, and (while the
 * admin has automatic renewal on) the choice to renew it automatically. Shows nothing when none apply.
 */
export function RenewalCard({ rent, onChanged }: { rent: Rent; onChanged: () => void }) {
  const [percent, setPercent] = useState(String(rent.autoRenewIncreasePercent ?? 0));
  const [months, setMonths] = useState(
    rent.autoRenewTermMonths ? String(rent.autoRenewTermMonths) : '',
  );
  const [busy, setBusy] = useState(false);

  const canAuto = !!rent.renewal?.autoEnabled && rent.status === 'ACTIVE' && !rent.renewedInto;
  if (!rent.renewedFromId && !rent.renewedInto && !canAuto) return null;

  const save = async (autoRenew: boolean) => {
    setBusy(true);
    try {
      await api.rents.updateTerms(rent.id, {
        autoRenew,
        autoRenewIncreasePercent: parseFloat(percent) || 0,
        ...(months ? { autoRenewTermMonths: parseInt(months, 10) } : {}),
      });
      toast.success(autoRenew ? 'This rent will renew automatically' : 'Automatic renewal is off');
      onChanged();
    } catch (err) {
      toast.error(messageOf(err, 'Could not save the renewal choice'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="mb-3 font-semibold">Renewal</h2>
      {rent.renewedFromId && (
        <p className="mb-2 text-sm text-gray-600">
          This rent renews{' '}
          <Link
            href={`/dashboard/tenants/${rent.renewedFromId}`}
            className="text-blue-600 underline"
          >
            the one before it
          </Link>
          {rent.status === 'PENDING' &&
            ' and starts once the new agreement is signed and its start date arrives.'}
        </p>
      )}
      {rent.renewedInto && (
        <p className="mb-2 text-sm text-gray-600">
          Renewed.{' '}
          <Link
            href={`/dashboard/tenants/${rent.renewedInto.id}`}
            className="text-blue-600 underline"
          >
            The next rent
          </Link>{' '}
          starts {day(rent.renewedInto.startDate)}.
        </p>
      )}
      {canAuto && (
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={!!rent.autoRenew}
              disabled={busy}
              onChange={(e) => void save(e.target.checked)}
              aria-label="Renew automatically"
            />
            Renew automatically
          </label>
          <p className="text-xs text-gray-500">
            About {rent.renewal?.autoDaysBefore} days before this rent ends, the next one is
            prepared for you to review and send. Nothing reaches the tenant until you send it.
          </p>
          {rent.autoRenew && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm text-gray-600">Rent increase (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.5"
                  value={percent}
                  onChange={(e) => setPercent(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-600">Term (months)</label>
                <input
                  type="number"
                  min={1}
                  max={120}
                  placeholder="Same as now"
                  value={months}
                  onChange={(e) => setMonths(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="col-span-2">
                <button
                  onClick={() => void save(true)}
                  disabled={busy}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {busy ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
