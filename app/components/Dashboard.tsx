import { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Home,
  Users,
  AlertCircle,
  CheckCircle,
  Clock,
  KeyRound,
} from 'lucide-react';
import { useMyProperties } from '@/hooks/useProperties';
import { useLeases } from '@/hooks/useLeases';
import { useInvoices } from '@/hooks/useInvoices';
import { useMaintenanceRequests } from '@/hooks/useMaintenanceRequests';
import { useRedeemManagerCode } from '@/hooks/useManagerCodes';

interface DashboardProps {
  onNavigate: (page: any) => void;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function isThisMonth(date: string) {
  const d = new Date(date);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const { data: properties, loading: propertiesLoading } = useMyProperties();
  const { data: activeLeases, loading: leasesLoading } = useLeases({ status: 'ACTIVE' });
  const { data: invoices, loading: invoicesLoading } = useInvoices();
  const { data: maintenanceRequests, loading: maintenanceLoading } = useMaintenanceRequests();

  const loading = propertiesLoading || leasesLoading || invoicesLoading || maintenanceLoading;

  const [codeInput, setCodeInput] = useState('');
  const [linkedTo, setLinkedTo] = useState<string | null>(null);
  const { submit: redeemCode, submitting: redeeming, error: redeemError } = useRedeemManagerCode();

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codeInput.trim()) return;
    try {
      const result = await redeemCode(codeInput.trim());
      setLinkedTo(result.landlord?.name ?? 'landlord');
      setCodeInput('');
    } catch {
      // error state is already surfaced via the hook's `error`
    }
  };

  const rentCollectedThisMonth = invoices
    .flatMap((i) => i.payments)
    .filter((p) => isThisMonth(p.paidAt))
    .reduce((sum, p) => sum + p.amount, 0);

  const pendingMaintenanceCount = maintenanceRequests.filter(
    (r) => r.status !== 'COMPLETED' && r.status !== 'CANCELLED',
  ).length;

  const stats = [
    {
      label: 'Total Properties',
      value: loading ? '—' : String(properties.length),
      icon: Home,
      breakdown: 'properties' as const,
    },
    {
      label: 'Active Leases',
      value: loading ? '—' : String(activeLeases.length),
      icon: Users,
      breakdown: 'tenants' as const,
    },
    {
      label: 'Rent Collected (This Month)',
      value: loading ? '—' : `₦${rentCollectedThisMonth.toLocaleString()}`,
      icon: DollarSign,
      breakdown: 'rent' as const,
    },
    {
      label: 'Pending Maintenance',
      value: loading ? '—' : String(pendingMaintenanceCount),
      icon: AlertCircle,
      breakdown: 'maintenance' as const,
    },
  ];

  // Recent Payments: every real payment across the manager's invoices,
  // newest first. No stored "recent payments" feed exists -- derived the
  // same way TenantPaymentHistory derives its own record list (Phase 9.2).
  const recentPayments = invoices
    .flatMap((invoice) => invoice.payments.map((payment) => ({ invoice, payment })))
    .sort((a, b) => new Date(b.payment.paidAt).getTime() - new Date(a.payment.paidAt).getTime())
    .slice(0, 5);

  // Upcoming Renewals: ACTIVE leases ending within 60 days. There's no
  // stored "contacted" status here (that would need per-lease Notice
  // fetches this list can't afford) -- shown as days-until-expiry instead
  // of a fabricated contact-status pill.
  const upcomingRenewals = activeLeases
    .filter((l) => {
      const daysLeft = (new Date(l.endDate).getTime() - Date.now()) / MS_PER_DAY;
      return daysLeft >= 0 && daysLeft <= 60;
    })
    .sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="mb-1 text-2xl font-semibold">Dashboard</h1>
        <p className="text-gray-600">Welcome back! Here's what's happening with your properties.</p>
      </div>

      {loading && <p className="text-sm text-gray-500">Loading your portfolio…</p>}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <button
              key={stat.label}
              onClick={() => onNavigate({ type: 'breakdown', breakdownType: stat.breakdown })}
              className="group cursor-pointer rounded-lg border border-gray-200 bg-white p-6 text-left transition-all hover:border-blue-400 hover:shadow-md"
            >
              <div className="mb-4 flex items-center justify-between">
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
            {recentPayments.map(({ invoice, payment }) => (
              <div
                key={payment.id}
                onClick={() =>
                  invoice.lease && onNavigate({ type: 'tenant-detail', leaseId: invoice.lease.id })
                }
                className="cursor-pointer p-4 transition-colors hover:bg-gray-50"
              >
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-medium">{invoice.lease?.tenant.name ?? 'Unknown tenant'}</p>
                  <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                    <CheckCircle className="mr-1 inline h-3 w-3" />
                    paid
                  </span>
                </div>
                <p className="mb-1 text-sm text-gray-600">
                  {invoice.lease?.unit.property.name ?? '—'}
                </p>
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
              const daysLeft = Math.ceil(
                (new Date(lease.endDate).getTime() - Date.now()) / MS_PER_DAY,
              );
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
            <h2 className="font-semibold text-gray-900">Link to a Landlord</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Enter the code your landlord shared with you.
            </p>
          </div>
        </div>
        {linkedTo ? (
          <p className="flex items-center gap-2 text-sm font-medium text-green-700">
            <CheckCircle className="h-4 w-4" />
            Linked to {linkedTo}.
          </p>
        ) : (
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
        )}
        {redeemError && <p className="mt-2 text-sm text-red-600">{redeemError}</p>}
      </div>
    </div>
  );
}
