'use client';

import Link from 'next/link';
import { Coins, Layers, Users } from 'lucide-react';
import { useMySubscription } from '@/hooks/useSubscription';

function Meter({
  label,
  used,
  included,
  enforced,
  icon: Icon,
}: {
  label: string;
  used: number;
  included: number;
  enforced: boolean;
  icon: typeof Layers;
}) {
  const pct = included > 0 ? Math.min(100, Math.round((used / included) * 100)) : 100;
  // Until an admin switches limits on, going past the included number is not a problem to flag.
  const over = enforced && used > included;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-gray-600">
        <span className="flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          {label}
        </span>
        <span className={over ? 'font-semibold text-amber-700' : 'font-medium text-gray-800'}>
          {used} of {included}
        </span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-gray-100"
        role="progressbar"
        aria-label={label}
        aria-valuenow={used}
        aria-valuemin={0}
        aria-valuemax={included}
      >
        <div
          className={`h-full rounded-full ${over ? 'bg-amber-500' : pct >= 90 ? 'bg-amber-400' : 'bg-blue-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/** What the account uses against its plan: units, users, extra units and credits. */
export function PlanUsageCard() {
  const { data } = useMySubscription();
  if (!data) return null;
  const { plan, usage, credits } = data;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5" data-testid="plan-usage">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-gray-500 uppercase">Your plan</p>
          <p className="text-lg font-semibold text-gray-900">{plan.name}</p>
          {data.lapsed && (
            <p className="mt-0.5 text-xs text-amber-700">
              Your paid period ended, so you are back on {plan.name}.
            </p>
          )}
        </div>
        {data.subscriptionsEnabled && (
          <Link
            href="/pricing"
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            Change plan
          </Link>
        )}
      </div>

      <div className="space-y-3">
        <Meter
          label="Units"
          used={usage.units}
          included={usage.unitsIncluded}
          enforced={data.limitsEnforced}
          icon={Layers}
        />
        <Meter
          label="Users"
          used={usage.users}
          included={usage.usersIncluded}
          enforced={data.limitsEnforced}
          icon={Users}
        />
      </div>

      {data.limitsEnforced && usage.extraUnits > 0 && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {usage.extraUnits} unit{usage.extraUnits === 1 ? '' : 's'} over your plan
          {usage.overageMonthly > 0
            ? `: ₦${usage.overageMonthly.toLocaleString()} a month, added to your next plan payment.`
            : '. Move to a bigger plan to add more.'}
        </p>
      )}
      {data.graceEndsAt && new Date(data.graceEndsAt) > new Date() && (
        <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800">
          You can keep adding units until{' '}
          {new Date(data.graceEndsAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}.
        </p>
      )}

      <div className="mt-4 flex items-center gap-1.5 border-t border-gray-100 pt-3 text-xs text-gray-600">
        <Coins className="h-3.5 w-3.5" aria-hidden="true" />
        <span>
          <strong className="text-gray-900">{credits.balance}</strong> credit
          {credits.balance === 1 ? '' : 's'}
          {plan.monthlyCredits > 0 ? `, ${plan.monthlyCredits} added each month` : ''}
        </span>
      </div>
    </div>
  );
}
