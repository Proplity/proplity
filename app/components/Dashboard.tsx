import { useState } from 'react';
import { DollarSign, Home, Users, AlertCircle, CheckCircle, KeyRound } from 'lucide-react';
import { useOwnerSummary } from '@/hooks/useDashboardSummary';
import { useLinkedLandlords, useRedeemManagerCode } from '@/hooks/useManagerCodes';
import type { Page } from '@/app/dashboard/navigateToPage';

interface DashboardProps {
  onNavigate: (page: Page) => void;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function Dashboard({ onNavigate }: DashboardProps) {
  const [now] = useState(() => Date.now());
  // Totals come from the server (ISS-049): summing the first page of each list
  // in the browser was wrong past 20 rows.
  const { data: summary, loading } = useOwnerSummary();

  const [codeInput, setCodeInput] = useState('');
  const { data: linkedLandlords, refetch: refetchLinks } = useLinkedLandlords();
  const [justLinked, setJustLinked] = useState<string | null>(null);
  const { submit: redeemCode, submitting: redeeming, error: redeemError } = useRedeemManagerCode();

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codeInput.trim()) return;
    try {
      const result = await redeemCode(codeInput.trim());
      setJustLinked(result.landlord?.name ?? 'your landlord');
      setCodeInput('');
      refetchLinks();
    } catch {
      // error state is already surfaced via the hook's `error`
    }
  };

  const stats = [
    {
      label: 'Total Properties',
      value: loading || !summary ? '—' : String(summary.properties.count),
      icon: Home,
      breakdown: 'properties' as const,
    },
    {
      label: 'Active Leases',
      value: loading || !summary ? '—' : String(summary.leases.active),
      icon: Users,
      breakdown: 'tenants' as const,
    },
    {
      label: 'Rent Collected (This Month)',
      value: loading || !summary ? '—' : `₦${summary.money.collectedThisMonth.toLocaleString()}`,
      icon: DollarSign,
      breakdown: 'rent' as const,
    },
    {
      label: 'Pending Maintenance',
      value: loading || !summary ? '—' : String(summary.maintenance.pending),
      icon: AlertCircle,
      breakdown: 'maintenance' as const,
    },
  ];

  const recentPayments = summary?.recentPayments ?? [];
  const upcomingRenewals = summary?.upcomingRenewals ?? [];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="mb-1 text-2xl font-semibold">Dashboard</h1>
        <p className="text-gray-600">
          Welcome back! Here&apos;s what&apos;s happening with your properties.
        </p>
      </div>

      {loading && <p className="text-sm text-gray-500">Loading your portfolio…</p>}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <button
              key={stat.label}
              onClick={() => onNavigate({ type: 'breakdown', breakdownType: stat.breakdown })}
              className="group cursor-pointer rounded-lg border border-gray-200 bg-white p-4 text-left transition-all hover:border-blue-400 hover:shadow-md sm:p-6"
            >
              <div className="mb-3 flex items-center justify-between sm:mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 transition-colors group-hover:bg-blue-100">
                  <Icon className="h-6 w-6 text-blue-600" />
                </div>
              </div>
              <div>
                <p className="mb-1 text-2xl font-semibold">{stat.value}</p>
                <p className="text-sm text-gray-600">{stat.label}</p>
              </div>
              <p className="mt-3 text-xs text-blue-500 opacity-0 transition-opacity group-hover:opacity-100">
                Click to view breakdown →
              </p>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Payments */}
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-200 p-6">
            <h2 className="font-semibold">Recent Payments</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {recentPayments.map((payment) => (
              <div
                key={payment.id}
                onClick={() =>
                  payment.leaseId && onNavigate({ type: 'tenant-detail', leaseId: payment.leaseId })
                }
                className="cursor-pointer p-4 transition-colors hover:bg-gray-50"
              >
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-medium">{payment.tenant ?? 'Unknown tenant'}</p>
                  <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                    <CheckCircle className="mr-1 inline h-3 w-3" />
                    paid
                  </span>
                </div>
                <p className="mb-1 text-sm text-gray-600">{payment.property ?? '—'}</p>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-blue-600">
                    ₦{payment.amount.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(payment.paidAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
            {recentPayments.length === 0 && !loading && (
              <p className="p-4 text-sm text-gray-400">No payments recorded yet.</p>
            )}
          </div>
        </div>

        {/* Upcoming Renewals */}
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-200 p-6">
            <h2 className="font-semibold">Upcoming Renewals</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {upcomingRenewals.map((lease) => {
              const daysLeft = Math.ceil((new Date(lease.endDate).getTime() - now) / MS_PER_DAY);
              return (
                <div
                  key={lease.id}
                  onClick={() => onNavigate({ type: 'tenant-detail', leaseId: lease.id })}
                  className="cursor-pointer p-4 transition-colors hover:bg-gray-50"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <p className="font-medium">{lease.tenant?.name ?? 'Unknown tenant'}</p>
                    <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
                      {daysLeft}d left
                    </span>
                  </div>
                  <p className="mb-1 text-sm text-gray-600">{lease.unit?.property?.name ?? '—'}</p>
                  <p className="text-sm font-medium text-orange-600">
                    Due: {new Date(lease.endDate).toLocaleDateString()}
                  </p>
                </div>
              );
            })}
            {upcomingRenewals.length === 0 && !loading && (
              <p className="p-4 text-sm text-gray-400">No renewals due in the next 60 days.</p>
            )}
          </div>
          <div className="border-t border-gray-200 p-4">
            <button
              onClick={() => onNavigate({ type: 'breakdown', breakdownType: 'renewals' })}
              className="w-full text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              View All Renewals →
            </button>
          </div>
        </div>
      </div>

      {/* Link to a Landlord -- redeems a code generated on LandlordDashboard's
          Manager Access Codes panel; recorded as an account link only, does
          not itself assign this manager to any property. */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
            <KeyRound className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">Your Landlords</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Link to each landlord you work with using the code they share.
            </p>
          </div>
        </div>
        {linkedLandlords.length > 0 ? (
          <ul className="mb-3 space-y-1">
            {linkedLandlords.map((l) => (
              <li
                key={l.codeId}
                className={`flex items-center gap-2 text-sm font-medium ${
                  l.active ? 'text-green-700' : 'text-gray-400 line-through'
                }`}
              >
                <CheckCircle className="h-4 w-4" />
                {l.landlord.name}
                {!l.active && <span className="text-xs font-normal no-underline">(revoked)</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            You are not linked to a landlord yet. Enter a code to get started.
          </p>
        )}
        {justLinked && (
          <p className="mb-2 text-sm font-medium text-green-700">Linked to {justLinked}.</p>
        )}
        <form onSubmit={handleRedeem} className="flex gap-2">
          <input
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            placeholder="e.g. LLD-2847-XK"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm uppercase focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={redeeming || !codeInput.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {redeeming ? 'Linking…' : 'Link'}
          </button>
        </form>
        {redeemError && <p className="mt-2 text-sm text-red-600">{redeemError}</p>}
      </div>
    </div>
  );
}
