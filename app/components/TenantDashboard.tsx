import {
  DollarSign,
  Home,
  Wrench,
  Calendar,
  CreditCard,
  MapPin,
  Key,
  FileText,
  MessageSquare,
} from 'lucide-react';
import { useActiveLease, useLeases, useLease } from '@/hooks/useLeases';
import { useInvoices, usePayInvoice } from '@/hooks/useInvoices';
import { useMaintenanceRequests } from '@/hooks/useMaintenanceRequests';
import { useAccessCodes } from '@/hooks/useAccessCodes';
import { LeaseSignatureCard } from './TenantDetail';
import type { Invoice, Payment } from '@/lib/api/types';

interface TenantDashboardProps {
  onNavigate?: (page: any) => void;
}

const maintenanceStatusColor: Record<string, string> = {
  SUBMITTED: 'orange',
  IN_PROGRESS: 'blue',
  SCHEDULED: 'blue',
  COMPLETED: 'green',
  CANCELLED: 'gray',
};

function outstandingBalance(invoices: Invoice[]) {
  return invoices
    .filter((i) => i.status !== 'CANCELLED')
    .reduce((sum, i) => {
      const paid = i.payments.reduce((p, payment) => p + payment.amount, 0);
      return sum + Math.max(0, i.amount - paid);
    }, 0);
}

function recentPayments(invoices: Invoice[]) {
  return invoices
    .flatMap((invoice) => invoice.payments.map((payment) => ({ invoice, payment })))
    .sort((a, b) => new Date(b.payment.paidAt).getTime() - new Date(a.payment.paidAt).getTime())
    .slice(0, 3);
}

export function TenantDashboard({ onNavigate }: TenantDashboardProps = {}) {
  const { data: lease, loading: leaseLoading } = useActiveLease();
  const { data: invoices, loading: invoicesLoading } = useInvoices();
  const { data: maintenanceRequests } = useMaintenanceRequests();
  const { data: accessCodes } = useAccessCodes(lease?.unitId ?? null);
  const { submit: payInvoice, submitting: paying, error: payError } = usePayInvoice();

  // A PENDING lease (awaiting signature, before a manager activates it)
  // never shows up via useActiveLease -- fetched separately just to surface
  // the signing prompt, since that's the only reason a tenant needs to see
  // it before it's ACTIVE.
  const { data: pendingLeases } = useLeases({ status: 'PENDING' });
  const pendingLeaseId = pendingLeases[0]?.id ?? null;
  const { data: pendingLease, refetch: refetchPendingLease } = useLease(pendingLeaseId);

  const property = lease?.unit?.property;
  const balance = outstandingBalance(invoices);
  const nextDue = invoices
    .filter((i) => i.status === 'UNPAID' || i.status === 'PARTIALLY_PAID' || i.status === 'OVERDUE')
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];
  const payments = recentPayments(invoices);

  const handlePayRent = async () => {
    if (!nextDue) return;
    try {
      const result = await payInvoice(nextDue.id);
      window.location.href = result.authorizationUrl;
    } catch {
      // error state is already surfaced via the hook's `error`
    }
  };

  if (leaseLoading || invoicesLoading) {
    return <div className="p-6 text-gray-500">Loading your rental information…</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="mb-1 text-2xl font-semibold">My Rental Dashboard</h1>
        <p className="text-gray-600">Welcome back! Here's your rental information.</p>
      </div>

      {pendingLease && <LeaseSignatureCard lease={pendingLease} onSigned={refetchPendingLease} />}

      {/* Quick Actions */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 font-semibold">Quick Actions</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <button
            onClick={() => onNavigate?.({ type: 'neighbourhood-report' })}
            className="group flex items-center gap-3 rounded-lg border border-gray-200 p-4 text-left transition-colors hover:border-blue-300 hover:bg-blue-50"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50 group-hover:bg-purple-100">
              <FileText className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium">Generate Report</p>
              <p className="text-xs text-gray-500">Neighbourhood insights</p>
            </div>
          </button>
          <button
            onClick={() => onNavigate?.({ type: 'messages' })}
            className="group flex items-center gap-3 rounded-lg border border-gray-200 p-4 text-left transition-colors hover:border-blue-300 hover:bg-blue-50"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 group-hover:bg-blue-100">
              <MessageSquare className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium">Message Manager</p>
              <p className="text-xs text-gray-500">Get in touch</p>
            </div>
          </button>
          <button
            onClick={() => onNavigate?.({ type: 'maintenance-request-form' })}
            className="group flex items-center gap-3 rounded-lg border border-gray-200 p-4 text-left transition-colors hover:border-blue-300 hover:bg-blue-50"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50 group-hover:bg-orange-100">
              <Wrench className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm font-medium">Request Repair</p>
              <p className="text-xs text-gray-500">Submit issue</p>
            </div>
          </button>
        </div>
      </div>

      {!lease ? (
        <div className="rounded-lg border border-gray-200 bg-white p-6 text-center text-gray-500">
          No active lease found on your account.
        </div>
      ) : (
        <>
          {/* Quick Stats */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50">
                  <Home className="h-6 w-6 text-blue-600" />
                </div>
                <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                  {lease.status}
                </span>
              </div>
              <p className="mb-1 text-sm text-gray-600">Current Property</p>
              <p className="text-lg font-semibold">
                {property?.name ?? 'Unknown property'}
                {lease.unit ? `, Unit ${lease.unit.unitNumber}` : ''}
              </p>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-50">
                  <DollarSign className="h-6 w-6 text-green-600" />
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${balance > 0 ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}
                >
                  {balance > 0 ? 'Balance Due' : 'Paid'}
                </span>
              </div>
              <p className="mb-1 text-sm text-gray-600">Rent</p>
              <p className="text-lg font-semibold">
                ₦{lease.rentAmount.toLocaleString()}/{lease.paymentFrequency.toLowerCase()}
              </p>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-orange-50">
                  <Calendar className="h-6 w-6 text-orange-600" />
                </div>
              </div>
              <p className="mb-1 text-sm text-gray-600">Next Payment Due</p>
              <p className="text-lg font-semibold">
                {nextDue ? new Date(nextDue.dueDate).toLocaleDateString() : 'None outstanding'}
              </p>
            </div>
          </div>

          {/* Property Details */}
          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-200 p-6">
              <h2 className="font-semibold">Property Information</h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <p className="mb-1 text-sm text-gray-600">Address</p>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-gray-400" />
                    <p className="font-medium">
                      {property ? `${property.address}, ${property.city}` : 'N/A'}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-sm text-gray-600">Lease Period</p>
                  <p className="font-medium">
                    {new Date(lease.startDate).toLocaleDateString()} -{' '}
                    {new Date(lease.endDate).toLocaleDateString()}
                  </p>
                </div>
                <div className="md:col-span-2">
                  <p className="mb-1 text-sm text-gray-600">Property Manager</p>
                  <p className="font-medium">
                    Reach your property manager any time via{' '}
                    <button
                      onClick={() => onNavigate?.({ type: 'messages' })}
                      className="text-blue-600 hover:underline"
                    >
                      Messages
                    </button>
                    .
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Payment Section */}
            <div className="rounded-lg border border-gray-200 bg-white">
              <div className="border-b border-gray-200 p-6">
                <h2 className="font-semibold">Payment Information</h2>
              </div>
              <div className="space-y-4 p-6">
                <div
                  className={`flex items-center justify-between rounded-lg p-4 ${balance > 0 ? 'bg-orange-50' : 'bg-green-50'}`}
                >
                  <div>
                    <p className="text-sm text-gray-600">Current Balance</p>
                    <p
                      className={`text-2xl font-semibold ${balance > 0 ? 'text-orange-600' : 'text-green-600'}`}
                    >
                      ₦{balance.toLocaleString()}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {balance > 0 ? 'Outstanding across your invoices' : 'All payments up to date'}
                    </p>
                  </div>
                  <CreditCard
                    className={`h-12 w-12 ${balance > 0 ? 'text-orange-600' : 'text-green-600'}`}
                  />
                </div>

                <div className="space-y-2">
                  <button
                    onClick={handlePayRent}
                    disabled={!nextDue || paying}
                    className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {paying
                      ? 'Redirecting to Paystack…'
                      : nextDue
                        ? 'Pay Rent Online'
                        : 'No Balance Due'}
                  </button>
                  {payError && <p className="text-sm text-red-600">{payError}</p>}
                  <button
                    onClick={() => alert('Auto-pay setup is not available yet.')}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Setup Auto-Pay
                  </button>
                </div>

                <div className="border-t border-gray-200 pt-4">
                  <p className="mb-3 text-sm font-medium">Recent Payments</p>
                  <div className="space-y-2">
                    {payments.map(({ invoice, payment }) => (
                      <div key={payment.id} className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">
                          {new Date(payment.paidAt).toLocaleDateString()}
                        </span>
                        <span className="font-medium">₦{payment.amount.toLocaleString()}</span>
                        <span className="rounded bg-green-100 px-2 py-1 text-xs text-green-700">
                          {invoice.type}
                        </span>
                      </div>
                    ))}
                    {payments.length === 0 && (
                      <p className="text-sm text-gray-400">No payments recorded yet.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Maintenance Section */}
            <div className="rounded-lg border border-gray-200 bg-white">
              <div className="flex items-center justify-between border-b border-gray-200 p-6">
                <h2 className="font-semibold">Maintenance Requests</h2>
                <button
                  onClick={() => onNavigate?.({ type: 'tenant-maintenance' })}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  View All →
                </button>
              </div>
              <div className="space-y-4 p-6">
                <button
                  onClick={() => onNavigate?.({ type: 'maintenance-request-form' })}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-3 font-medium text-white hover:bg-orange-700"
                >
                  <Wrench className="h-5 w-5" />
                  Submit New Request
                </button>

                <div className="space-y-3">
                  <p className="text-sm font-medium">Recent Requests</p>
                  {maintenanceRequests.slice(0, 3).map((request) => {
                    const color = maintenanceStatusColor[request.status] ?? 'gray';
                    return (
                      <button
                        key={request.id}
                        onClick={() => onNavigate?.({ type: 'tenant-maintenance' })}
                        className="w-full cursor-pointer rounded-lg border border-gray-200 p-3 text-left transition-colors hover:border-blue-300 hover:bg-gray-50"
                      >
                        <div className="mb-1 flex items-center justify-between">
                          <p className="text-sm font-medium">{request.title}</p>
                          <span
                            className={`px-2 py-1 bg-${color}-100 text-${color}-700 rounded text-xs font-medium`}
                          >
                            {request.status.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">
                          {new Date(request.createdAt).toLocaleDateString()}
                        </p>
                      </button>
                    );
                  })}
                  {maintenanceRequests.length === 0 && (
                    <p className="text-sm text-gray-400">No maintenance requests yet.</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Access Codes */}
          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-200 p-6">
              <h2 className="font-semibold">Access Codes</h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {accessCodes.map((access) => (
                  <div key={access.id} className="rounded-lg border border-gray-200 p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <Key className="h-4 w-4 text-blue-600" />
                      <p className="text-sm font-medium">{access.guestName ?? 'Access Code'}</p>
                    </div>
                    <p className="mb-1 text-2xl font-bold text-blue-600">{access.code}</p>
                    <p className="text-xs text-gray-500">
                      {access.validUntil
                        ? `Expires ${new Date(access.validUntil).toLocaleDateString()}`
                        : 'No expiry'}
                    </p>
                  </div>
                ))}
                {accessCodes.length === 0 && (
                  <p className="text-sm text-gray-400 md:col-span-3">No active access codes.</p>
                )}
              </div>
            </div>
          </div>

          {/* Documents */}
          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-200 p-6">
              <h2 className="font-semibold">Documents</h2>
            </div>
            <div className="p-6">
              {lease.signedAgreementUrl ? (
                <a
                  href={lease.signedAgreementUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between rounded-lg border border-gray-200 p-3 hover:bg-gray-50"
                >
                  <div>
                    <p className="text-sm font-medium">Signed Lease Agreement</p>
                    <p className="text-xs text-gray-500">
                      Since {new Date(lease.startDate).toLocaleDateString()}
                    </p>
                  </div>
                  <FileText className="h-4 w-4 text-gray-600" />
                </a>
              ) : (
                <p className="text-sm text-gray-400">No documents on file yet.</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
