import { useState } from 'react';
import {
  Search,
  Phone,
  Mail,
  MapPin,
  Calendar,
  DollarSign,
  AlertCircle,
  CheckCircle,
  FileText,
  Send,
  Loader2,
} from 'lucide-react';
import { useRents } from '@/hooks/useRents';
import { useInvoices } from '@/hooks/useInvoices';
import { toast } from 'sonner';
import { api } from '@/lib/apiClient';
import type { Invoice, InvitationState } from '@/lib/api/types';
import type { Page } from '@/app/dashboard/navigateToPage';
import { perFrequency } from '@/lib/paymentFrequency';

interface TenantManagementProps {
  onNavigate: (page: Page) => void;
}

const AVATAR_COLORS = [
  'bg-blue-500',
  'bg-green-500',
  'bg-purple-500',
  'bg-orange-500',
  'bg-pink-500',
  'bg-teal-500',
];

// No stored "rent status" field exists on Rent -- derived from its RENT
// invoices the same way TenantPaymentHistory derives payment status
// (Phase 9.2): the earliest still-unpaid invoice decides due/overdue/paid.
function paymentInfo(rentId: string, invoices: Invoice[]) {
  const unpaid = invoices
    .filter((i) => i.rentId === rentId && i.status !== 'PAID' && i.status !== 'CANCELLED')
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  if (unpaid.length === 0) return { status: 'paid' as const, nextDue: null as string | null };
  const overdue = new Date(unpaid[0].dueDate) < new Date();
  return { status: (overdue ? 'overdue' : 'due') as 'overdue' | 'due', nextDue: unpaid[0].dueDate };
}

// Where a tenant is in joining. Only the states that still need something from the property team
// are shown on a row; a tenant who has joined needs no badge.
const INVITATION_BADGE: Record<
  Exclude<InvitationState, 'JOINED'>,
  { label: string; cls: string }
> = {
  NOT_SENT: { label: 'Not invited yet', cls: 'bg-gray-100 text-gray-700' },
  INVITED: { label: 'Invited', cls: 'bg-blue-100 text-blue-700' },
  EXPIRED: { label: 'Invitation expired', cls: 'bg-amber-100 text-amber-800' },
};

export function TenantManagement({ onNavigate }: TenantManagementProps) {
  const { data: rents, loading, error, refetch } = useRents();
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sendingAll, setSendingAll] = useState(false);
  const { data: invoices } = useInvoices({ type: 'RENT' });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');

  const rows = rents.map((rent) => ({ rent, payment: paymentInfo(rent.id, invoices) }));
  // Tenants who still need an email (never sent, or the link ran out), one per person.
  const needInvitation = new Set(
    rents
      .filter((r) => r.invitation === 'NOT_SENT' || r.invitation === 'EXPIRED')
      .map((r) => r.tenantId),
  ).size;

  const apiMessage = (err: unknown, fallback: string) =>
    (err as { response?: { data?: { error?: string } } }).response?.data?.error ?? fallback;

  const sendOne = async (rentId: string) => {
    setSendingId(rentId);
    try {
      await api.rents.invite(rentId);
      toast.success('Invitation sent.');
      await refetch();
    } catch (err) {
      toast.error(apiMessage(err, 'Could not send the invitation.'));
    } finally {
      setSendingId(null);
    }
  };

  const sendAll = async () => {
    setSendingAll(true);
    try {
      const { sent, stillWaiting, limitReached, dailyLimit } = (await api.rents.inviteAll()).data
        .data;
      toast.success(
        stillWaiting > 0
          ? `Sent ${sent}. ${stillWaiting} still waiting${limitReached ? ` (today's limit is ${dailyLimit})` : ''}; try again tomorrow.`
          : `Sent ${sent}. Everyone has been invited.`,
      );
      await refetch();
    } catch (err) {
      toast.error(apiMessage(err, 'Could not send the invitations.'));
    } finally {
      setSendingAll(false);
    }
  };

  const statusFilters = [
    { id: 'all', label: 'All Tenants', count: rows.length },
    { id: 'paid', label: 'Paid', count: rows.filter((r) => r.payment.status === 'paid').length },
    { id: 'due', label: 'Due Soon', count: rows.filter((r) => r.payment.status === 'due').length },
    {
      id: 'overdue',
      label: 'Overdue',
      count: rows.filter((r) => r.payment.status === 'overdue').length,
    },
  ];

  const filteredRows = rows.filter(({ rent, payment }) => {
    const matchesSearch =
      (rent.tenant?.name.toLowerCase() ?? '').includes(searchTerm.toLowerCase()) ||
      (rent.unit?.property?.name.toLowerCase() ?? '').includes(searchTerm.toLowerCase());
    const matchesStatus = selectedStatus === 'all' || payment.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="mb-1 text-2xl font-semibold">Tenant Management</h1>
          <p className="text-gray-600">Manage your tenants and track rent payments</p>
        </div>
        <button
          onClick={() => onNavigate({ type: 'add-tenant' })}
          className="rounded-lg bg-blue-600 px-4 py-2 font-medium whitespace-nowrap text-white hover:bg-blue-700"
        >
          + Add Tenant
        </button>
      </div>

      {needInvitation > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm text-blue-900">
            {needInvitation} {needInvitation === 1 ? 'tenant has' : 'tenants have'} not been invited
            yet or {needInvitation === 1 ? 'has' : 'have'} an expired invitation. An invitation lets
            them set a password, sign in and complete their profile.
          </p>
          <button
            type="button"
            onClick={sendAll}
            disabled={sendingAll}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold whitespace-nowrap text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {sendingAll ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Send invitations
          </button>
        </div>
      )}

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 transform text-gray-400" />
          <input
            type="text"
            placeholder="Search tenants or properties..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2 pr-4 pl-10 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-2 overflow-x-auto">
        {statusFilters.map((filter) => (
          <button
            key={filter.id}
            onClick={() => setSelectedStatus(filter.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
              selectedStatus === filter.id
                ? 'bg-blue-600 text-white'
                : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {filter.label} <span className="ml-1 opacity-70">({filter.count})</span>
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-gray-500">Loading tenants…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Tenant List */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  Tenant
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  Property
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  Rent
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  Next Due
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  Risk
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredRows.map(({ rent, payment }, index) => (
                <tr
                  key={rent.id}
                  onClick={() => onNavigate({ type: 'tenant-detail', rentId: rent.id })}
                  className="cursor-pointer transition-colors hover:bg-gray-50"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-10 w-10 ${AVATAR_COLORS[index % AVATAR_COLORS.length]} flex items-center justify-center rounded-full font-semibold text-white`}
                      >
                        {(rent.tenant?.name ?? '?').charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium">{rent.tenant?.name ?? 'Unknown tenant'}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Mail className="h-3 w-3" />
                          {rent.tenant?.email ?? '—'}
                        </div>
                        {rent.invitation && rent.invitation !== 'JOINED' && (
                          <span
                            className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${INVITATION_BADGE[rent.invitation].cls}`}
                          >
                            {INVITATION_BADGE[rent.invitation].label}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <MapPin className="h-4 w-4" />
                      {rent.unit?.property?.name ?? '—'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-4 w-4 text-gray-400" />
                      <span className="font-semibold">₦{rent.rentAmount.toLocaleString()}</span>
                    </div>
                    <p className="text-xs text-gray-500">/{perFrequency(rent.paymentFrequency)}</p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        payment.status === 'paid'
                          ? 'bg-green-100 text-green-700'
                          : payment.status === 'due'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {payment.status === 'paid' ? (
                        <CheckCircle className="mr-1 inline h-3 w-3" />
                      ) : (
                        <AlertCircle className="mr-1 inline h-3 w-3" />
                      )}
                      {payment.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1 text-sm">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      {payment.nextDue ? new Date(payment.nextDue).toLocaleDateString() : '—'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        rent.riskScore === 'LOW'
                          ? 'bg-green-100 text-green-700'
                          : rent.riskScore === 'MEDIUM'
                            ? 'bg-yellow-100 text-yellow-700'
                            : rent.riskScore === 'HIGH'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {rent.riskScore ?? 'UNSCORED'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2">
                      <a
                        href={
                          rent.tenant?.phoneNumber ? `tel:${rent.tenant.phoneNumber}` : undefined
                        }
                        onClick={(e) => {
                          if (!rent.tenant?.phoneNumber) {
                            e.preventDefault();
                            toast.error('No phone number on file for this tenant.');
                          }
                        }}
                        className="rounded p-2 hover:bg-gray-100 sm:p-1"
                        title="Call tenant"
                      >
                        <Phone className="h-4 w-4 text-gray-600" />
                      </a>
                      <a
                        href={rent.tenant?.email ? `mailto:${rent.tenant.email}` : undefined}
                        className="rounded p-2 hover:bg-gray-100 sm:p-1"
                        title="Email tenant"
                      >
                        <Mail className="h-4 w-4 text-gray-600" />
                      </a>
                      {rent.invitation && rent.invitation !== 'JOINED' && (
                        <button
                          type="button"
                          onClick={() => sendOne(rent.id)}
                          disabled={sendingId === rent.id}
                          className="rounded p-2 hover:bg-gray-100 disabled:opacity-50 sm:p-1"
                          title={
                            rent.invitation === 'INVITED'
                              ? 'Send the invitation again'
                              : 'Send invitation'
                          }
                          aria-label={`${rent.invitation === 'INVITED' ? 'Resend' : 'Send'} invitation to ${rent.tenant?.name ?? 'tenant'}`}
                        >
                          {sendingId === rent.id ? (
                            <Loader2 className="h-4 w-4 animate-spin text-gray-600" />
                          ) : (
                            <Send className="h-4 w-4 text-gray-600" />
                          )}
                        </button>
                      )}
                      <button
                        onClick={() => onNavigate({ type: 'tenant-detail', rentId: rent.id })}
                        className="rounded p-2 hover:bg-gray-100 sm:p-1"
                        title="View details"
                      >
                        <FileText className="h-4 w-4 text-gray-600" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredRows.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-sm text-gray-400">
                    No tenants found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
