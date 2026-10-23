import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Home,
  DollarSign,
  Users,
  TrendingUp,
  Building2,
  PieChart,
  Calendar,
  Download,
  KeyRound,
  Copy,
  Power,
  PowerOff,
  Plus,
  CheckCircle,
  Clock,
  Shield,
  Mail,
} from 'lucide-react';
import { useOwnerSummary } from '@/hooks/useDashboardSummary';
import { useBankAccounts } from '@/hooks/useBankAccounts';
import {
  useManagerCodes,
  useCreateManagerCode,
  useSetManagerCodeStatus,
} from '@/hooks/useManagerCodes';
import { useCreateConversation } from '@/hooks/useConversations';
import { api } from '@/lib/apiClient';
import { toCsv } from '@/lib/csv';
import type { Page } from '@/app/dashboard/navigateToPage';
import { AttentionCard } from './AttentionCard';

interface LandlordDashboardProps {
  onNavigate?: (page: Page) => void;
}

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function LandlordDashboard({ onNavigate }: LandlordDashboardProps = {}) {
  // Totals are computed on the server (ISS-049): summing the first page of
  // each list in the browser was wrong past 20 rows.
  const { data: summary, loading } = useOwnerSummary();

  const { data: managerCodes, loading: codesLoading, refetch: refetchCodes } = useManagerCodes();
  const { submit: createCode, submitting: creatingCode } = useCreateManagerCode();
  const { submit: setCodeStatus } = useSetManagerCodeStatus();
  const [copied, setCopied] = useState<string | null>(null);
  const { data: bankAccounts, loading: bankLoading } = useBankAccounts();
  const [inviteEmail, setInviteEmail] = useState('');
  const [showInviteForm, setShowInviteForm] = useState(false);

  const generateCode = async () => {
    try {
      await createCode();
      refetchCodes();
      toast.success('Manager access code generated!');
    } catch {
      toast.error('Failed to generate code');
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    try {
      await createCode({ email: inviteEmail.trim() });
      refetchCodes();
      toast.success(`Invitation email sent to ${inviteEmail.trim()}!`);
      setInviteEmail('');
      setShowInviteForm(false);
    } catch {
      toast.error('Failed to send manager invitation');
    }
  };

  const toggleCode = async (id: string, currentStatus: 'ACTIVE' | 'DEACTIVATED') => {
    try {
      await setCodeStatus(id, currentStatus === 'ACTIVE' ? 'DEACTIVATED' : 'ACTIVE');
      refetchCodes();
    } catch {
      // no-op -- UI just doesn't update if this fails
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  const propertyCount = summary?.properties.count ?? 0;
  const totalUnits = summary?.units.total ?? 0;
  const occupiedUnits = summary?.units.occupied ?? 0;
  const occupancyRate = summary?.units.occupancyRate ?? 0;
  const totalListedRent = summary?.units.totalListedRent ?? 0;

  const collected = summary?.money.collected ?? 0;
  const pending = summary?.money.pending ?? 0;
  const maintenanceCosts = summary?.money.maintenanceCosts ?? 0;
  const collectionRate =
    collected + pending > 0 ? Math.round((collected / (collected + pending)) * 100) : 0;
  const netRevenue = collected - maintenanceCosts;
  const cashTotal = collected + pending + maintenanceCosts;

  const propertyRows = (summary?.properties.rows ?? []).map((row) => ({
    property: { id: row.id, name: row.name },
    unitCount: row.units,
    occupied: row.occupied,
    revenue: row.listedRent,
    occupancy: row.occupancy,
    collected: row.collected,
    pending: row.pending,
  }));

  const downloadReport = () => {
    const rows = propertyRows.map(
      ({ property, unitCount, occupied, occupancy, revenue, collected: c, pending: pd }) => ({
        Property: property.name,
        Units: unitCount,
        Occupied: occupied,
        'Occupancy %': occupancy,
        'Listed Rent (₦/cycle)': revenue,
        'Collected (₦)': c,
        'Pending (₦)': pd,
      }),
    );
    const csv = toCsv(rows, [
      'Property',
      'Units',
      'Occupied',
      'Occupancy %',
      'Listed Rent (₦/cycle)',
      'Collected (₦)',
      'Pending (₦)',
    ]);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `proplity-financial-summary-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const managers = summary?.managers ?? [];
  const [schedulingReview, setSchedulingReview] = useState(false);
  const [reviewManagerId, setReviewManagerId] = useState('');
  const [reviewMessage, setReviewMessage] = useState(
    "I'd like to schedule a review of my properties. What times work for you this week?",
  );
  const { submit: createConversation, submitting: sendingReviewRequest } = useCreateConversation();
  const [reviewError, setReviewError] = useState<string | null>(null);
  const router = useRouter();

  const openScheduleReview = () => {
    setReviewManagerId(managers[0]?.id ?? '');
    setReviewError(null);
    setSchedulingReview(true);
  };

  const handleScheduleReview = async () => {
    if (!reviewManagerId) return;
    setReviewError(null);
    try {
      const conversation = await createConversation({
        type: 'DIRECT',
        title: 'Property Review',
        participantIds: [reviewManagerId],
      });
      if (reviewMessage.trim()) {
        await api.conversations.messages.create(conversation.id, { body: reviewMessage.trim() });
      }
      setSchedulingReview(false);
      router.push(`/dashboard/messages?c=${conversation.id}`);
    } catch {
      setReviewError('Could not start the conversation. Please try again.');
    }
  };

  // Recent Activity: a real feed merged from payments, completed
  // maintenance, and newly-active rents -- replacing the mock's 4
  // hardcoded fabricated events.
  const activity = [
    ...(summary?.recentPayments ?? []).map((payment) => ({
      event: 'Rent payment received',
      tenant: payment.tenant ?? undefined,
      property: payment.property ?? undefined,
      amount: `₦${payment.amount.toLocaleString()}`,
      time: payment.paidAt,
    })),
    ...(summary?.recentCompletedMaintenance ?? [])
      .filter((r) => r.completedAt)
      .map((r) => ({
        event: 'Maintenance completed',
        tenant: undefined,
        property: r.unit?.property?.name,
        amount: r.finalCost != null ? `₦${r.finalCost.toLocaleString()}` : undefined,
        time: r.completedAt!,
      })),
    ...(summary?.recentRents ?? []).map((l) => ({
      event: 'Rent active',
      tenant: l.tenant?.name,
      property: l.unit?.property?.name,
      amount: undefined,
      time: l.startDate,
    })),
  ]
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="mb-1 text-2xl font-semibold">Landlord Portfolio</h1>
        <p className="text-gray-600">Overview of your property investments</p>
      </div>

      <AttentionCard />

      {/* Sticky Setup & Profile Completion Prompt for Landlords */}
      {!loading && !bankLoading && (propertyCount === 0 || (bankAccounts ?? []).length === 0) && (
        <div className="sticky top-4 z-20 flex flex-col items-start justify-between gap-4 rounded-xl border border-blue-200 bg-linear-to-r from-blue-50 via-white to-blue-50 p-5 shadow-sm sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Complete Your Landlord Setup</h2>
              <p className="mt-0.5 text-xs text-gray-600">
                {(bankAccounts ?? []).length === 0 && propertyCount === 0
                  ? 'To start collecting rents and managing tenancies, add your payout bank account in Settings and list your first rental property.'
                  : (bankAccounts ?? []).length === 0
                    ? 'Add your payout bank account in Settings so rent can be paid out to you.'
                    : 'List your first rental property to start managing tenancies.'}
              </p>
            </div>
          </div>
          <div className="flex w-full shrink-0 items-center gap-2.5 sm:w-auto">
            {(bankAccounts ?? []).length === 0 && (
              <Link
                href="/dashboard/settings"
                className="flex-1 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-center text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 sm:flex-none"
              >
                Add Bank Details
              </Link>
            )}
            {propertyCount === 0 && (
              <Link
                href="/dashboard/properties/new"
                className="flex-1 rounded-lg bg-blue-600 px-3.5 py-2 text-center text-xs font-semibold text-white shadow-xs transition-colors hover:bg-blue-700 sm:flex-none"
              >
                List First Property
              </Link>
            )}
          </div>
        </div>
      )}

      {loading && <p className="text-sm text-gray-500">Loading your portfolio…</p>}

      {/* Portfolio Stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4 sm:p-6">
          <div className="mb-3 flex items-center justify-between sm:mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50">
              <Building2 className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <p className="mb-1 text-2xl font-semibold">{loading ? '—' : totalUnits}</p>
          <p className="text-sm text-gray-600">Total Units</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 sm:p-6">
          <div className="mb-3 flex items-center justify-between sm:mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-50">
              <Users className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <p className="mb-1 text-2xl font-semibold">{loading ? '—' : occupiedUnits}</p>
          <p className="text-sm text-gray-600">Occupied Units</p>
          <p className="mt-1 text-xs text-green-600">
            {loading ? '—' : `${occupancyRate}% Occupancy`}
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 sm:p-6">
          <div className="mb-3 flex items-center justify-between sm:mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-50">
              <DollarSign className="h-6 w-6 text-purple-600" />
            </div>
          </div>
          <p className="mb-1 text-2xl font-semibold">
            {loading ? '—' : `₦${totalListedRent.toLocaleString()}`}
          </p>
          <p className="text-sm text-gray-600">Total Listed Rent</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 sm:p-6">
          <div className="mb-3 flex items-center justify-between sm:mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-orange-50">
              <TrendingUp className="h-6 w-6 text-orange-600" />
            </div>
          </div>
          <p className="mb-1 text-2xl font-semibold">{loading ? '—' : `${collectionRate}%`}</p>
          <p className="text-sm text-gray-600">Collection Rate</p>
        </div>
      </div>

      {/* Property Performance */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-200 p-6">
          <h2 className="font-semibold">Property Performance</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {propertyRows.map(({ property, unitCount, occupied, revenue, occupancy }) => (
            <div key={property.id} className="p-6 hover:bg-gray-50">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-lg font-semibold">{property.name}</p>
                  <p className="text-sm text-gray-600">
                    {unitCount} unit{unitCount === 1 ? '' : 's'} • {occupied} occupied
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-semibold text-green-600">
                    ₦{revenue.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500">Total Listed Rent</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs text-gray-600">Occupancy</span>
                    <span className="text-xs font-medium">{occupancy}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                    <div
                      className="h-full rounded-full bg-green-500"
                      style={{ width: `${occupancy}%` }}
                    ></div>
                  </div>
                </div>
                <button
                  onClick={() => onNavigate?.({ type: 'property-detail', propertyId: property.id })}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
                >
                  View Details
                </button>
              </div>
            </div>
          ))}
          {propertyRows.length === 0 && !loading && (
            <p className="p-6 text-sm text-gray-400">No properties yet.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Revenue Breakdown */}
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-200 p-6">
            <h2 className="font-semibold">Revenue Breakdown</h2>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {[
                {
                  label: 'Rent Collected',
                  amount: collected,
                  pct: cashTotal > 0 ? (collected / cashTotal) * 100 : 0,
                  color: 'green',
                },
                {
                  label: 'Pending Payments',
                  amount: pending,
                  pct: cashTotal > 0 ? (pending / cashTotal) * 100 : 0,
                  color: 'yellow',
                },
                {
                  label: 'Maintenance Costs',
                  amount: maintenanceCosts,
                  pct: cashTotal > 0 ? (maintenanceCosts / cashTotal) * 100 : 0,
                  color: 'red',
                },
                {
                  label: 'Net Revenue',
                  amount: netRevenue,
                  pct: collected > 0 ? Math.max(0, (netRevenue / collected) * 100) : 0,
                  color: 'blue',
                },
              ].map((item) => (
                <div key={item.label}>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm text-gray-600">{item.label}</span>
                    <span className="text-sm font-semibold">₦{item.amount.toLocaleString()}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                    <div
                      className={`h-full bg-${item.color}-500 rounded-full`}
                      style={{ width: `${Math.min(100, item.pct)}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-200 p-6">
            <h2 className="font-semibold">Recent Activity</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {activity.map((item, index) => (
              <div key={index} className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium">{item.event}</p>
                    <p className="mt-1 text-xs text-gray-600">
                      {item.tenant && `${item.tenant} • `}
                      {item.property}
                    </p>
                    {item.amount && (
                      <p className="mt-1 text-xs font-medium text-green-600">{item.amount}</p>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">{timeAgo(item.time)}</span>
                </div>
              </div>
            ))}
            {activity.length === 0 && !loading && (
              <p className="p-4 text-sm text-gray-400">No recent activity yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="rounded-lg border border-purple-200 bg-gradient-to-r from-purple-50 to-blue-50 p-6">
        <h3 className="mb-4 font-semibold">Owner Actions</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <button
            onClick={downloadReport}
            disabled={propertyCount === 0}
            className="rounded-lg border border-gray-200 bg-white p-4 text-left transition-shadow hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="mb-2 h-5 w-5 text-blue-600" />
            <p className="text-sm font-medium">Download Report</p>
            <p className="text-xs text-gray-600">Financial summary</p>
          </button>
          <button
            onClick={openScheduleReview}
            disabled={managers.length === 0}
            className="rounded-lg border border-gray-200 bg-white p-4 text-left transition-shadow hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Calendar className="mb-2 h-5 w-5 text-green-600" />
            <p className="text-sm font-medium">Schedule Review</p>
            <p className="text-xs text-gray-600">
              {managers.length === 0 ? 'No manager assigned yet' : 'With manager'}
            </p>
          </button>
          <button
            onClick={() => onNavigate?.({ type: 'breakdown', breakdownType: 'rent' })}
            className="rounded-lg border border-gray-200 bg-white p-4 text-left transition-shadow hover:shadow-md"
          >
            <PieChart className="mb-2 h-5 w-5 text-purple-600" />
            <p className="text-sm font-medium">Analytics</p>
            <p className="text-xs text-gray-600">Deep insights</p>
          </button>
          <button
            onClick={() => onNavigate?.({ type: 'list-property' })}
            className="rounded-lg border border-gray-200 bg-white p-4 text-left transition-shadow hover:shadow-md"
          >
            <Home className="mb-2 h-5 w-5 text-orange-600" />
            <p className="text-sm font-medium">Add Property</p>
            <p className="text-xs text-gray-600">Expand portfolio</p>
          </button>
        </div>

        {schedulingReview && (
          <div className="mt-4 space-y-3 rounded-lg border border-gray-200 bg-white p-4">
            <h4 className="text-sm font-semibold">Schedule a Review</h4>
            {managers.length > 1 && (
              <div>
                <label className="mb-1 block text-sm text-gray-600">Manager</label>
                <select
                  value={reviewManagerId}
                  onChange={(e) => setReviewManagerId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  {managers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm text-gray-600">Message</label>
              <textarea
                value={reviewMessage}
                onChange={(e) => setReviewMessage(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            {reviewError && <p className="text-sm text-red-600">{reviewError}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleScheduleReview}
                disabled={sendingReviewRequest}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {sendingReviewRequest ? 'Sending…' : 'Send Request'}
              </button>
              <button
                onClick={() => setSchedulingReview(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Manager Access — Code Management. No AccessCode-style model exists
          for landlord-manager linking anywhere in the schema (this is a
          different concept from the gate AccessCode model) -- stays local
          demo state, same as it was pre-hydration. */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="flex flex-col justify-between gap-4 border-b border-gray-200 p-6 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
              <KeyRound className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Manager Access Codes</h2>
              <p className="mt-0.5 text-xs text-gray-500">
                Invite or generate a code for your Property Manager to link them to your portfolio.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowInviteForm((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-blue-600 px-3.5 py-2 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50"
            >
              <Mail className="h-4 w-4" />
              {showInviteForm ? 'Close' : 'Invite via Email'}
            </button>
            <button
              onClick={generateCode}
              disabled={creatingCode}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              {creatingCode ? 'Generating…' : 'Quick Code'}
            </button>
          </div>
        </div>

        {showInviteForm && (
          <form onSubmit={handleSendInvite} className="border-b border-blue-100 bg-blue-50/60 p-4">
            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Mail className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  required
                  placeholder="Enter manager's email (e.g. manager@example.com)"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white py-2 pr-3 pl-9 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={creatingCode || !inviteEmail.trim()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium whitespace-nowrap text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                {creatingCode ? 'Sending Invite…' : 'Send Invite'}
              </button>
              <button
                type="button"
                onClick={() => setShowInviteForm(false)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
            <p className="mt-2 text-xs text-blue-700">
              The manager will receive an email with their code and a direct link to register. In
              development, open the &ldquo;Sent Emails&rdquo; widget in the bottom-right corner to
              test the link.
            </p>
          </form>
        )}

        <div className="flex items-start gap-3 border-b border-amber-100 bg-amber-50 p-4">
          <Shield className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-xs text-amber-800">
            <span className="font-semibold">How it works:</span> Generate a code and share it with
            the person you want to appoint as your Property Manager. They&apos;ll enter it during
            registration. You can deactivate a code at any time to immediately revoke access — even
            after they&apos;ve registered.
          </p>
        </div>

        <div className="divide-y divide-gray-100">
          {managerCodes.map((item) => (
            <div
              key={item.id}
              className={`flex flex-wrap items-center gap-x-4 gap-y-3 p-4 ${item.status === 'DEACTIVATED' ? 'opacity-60' : ''}`}
            >
              <div
                className={`shrink-0 rounded-lg border px-3 py-2 font-mono text-sm font-bold tracking-widest ${
                  item.status === 'ACTIVE'
                    ? 'border-blue-200 bg-blue-50 text-blue-800'
                    : 'border-gray-200 bg-gray-100 text-gray-500 line-through'
                }`}
              >
                {item.code}
              </div>

              <div className="min-w-0 flex-1 basis-48">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      item.status === 'ACTIVE'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {item.status === 'ACTIVE' ? 'Active' : 'Deactivated'}
                  </span>
                  {item.linkedManager ? (
                    <span className="flex items-center gap-1 text-xs text-gray-600">
                      <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                      Linked to <span className="font-medium">{item.linkedManager.name}</span>
                      {item.linkedAt
                        ? ` · since ${new Date(item.linkedAt).toLocaleDateString()}`
                        : ''}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <Clock className="h-3.5 w-3.5" />
                      Not yet used
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-400">
                  Created {new Date(item.createdAt).toLocaleDateString()}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {item.status === 'ACTIVE' && (
                  <button
                    onClick={() => copyCode(item.code)}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 transition-colors hover:bg-gray-50"
                  >
                    {copied === item.code ? (
                      <>
                        <CheckCircle className="h-3.5 w-3.5 text-green-500" /> Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" /> Copy
                      </>
                    )}
                  </button>
                )}
                <button
                  onClick={() => toggleCode(item.id, item.status)}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    item.status === 'ACTIVE'
                      ? 'border-red-200 text-red-600 hover:bg-red-50'
                      : 'border-green-200 text-green-700 hover:bg-green-50'
                  }`}
                >
                  {item.status === 'ACTIVE' ? (
                    <>
                      <PowerOff className="h-3.5 w-3.5" /> Deactivate
                    </>
                  ) : (
                    <>
                      <Power className="h-3.5 w-3.5" /> Reactivate
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}

          {managerCodes.length === 0 && !codesLoading && (
            <div className="p-8 text-center text-gray-400">
              <KeyRound className="mx-auto mb-2 h-10 w-10 opacity-40" />
              <p className="text-sm">
                No codes generated yet. Click &quot;Generate New Code&quot; to get started.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
