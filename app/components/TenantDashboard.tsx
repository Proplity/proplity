import { useState } from 'react';
import Link from 'next/link';
import {
  DollarSign,
  Home,
  Wrench,
  Calendar,
  CreditCard,
  MapPin,
  FileText,
  MessageSquare,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { useActiveRent, useRents, useRent } from '@/hooks/useRents';
import { useTenantSummary } from '@/hooks/useDashboardSummary';
import { useCardPayments, usePayInvoice } from '@/hooks/useInvoices';
import { useMaintenanceRequests } from '@/hooks/useMaintenanceRequests';
import { useAccessCodes, useCreateAccessCode } from '@/hooks/useAccessCodes';
import { AccessCodeCard } from './AccessCodeCard';
import { useOpenConversation } from '@/hooks/useOpenConversation';
import {
  useAutoPayMandates,
  usePaymentAuthorization,
  useCreateAutoPayMandate,
  useCancelAutoPayMandate,
} from '@/hooks/useAutoPay';
import { RentSignatureCard } from './TenantDetail';
import type { Page } from '@/app/dashboard/navigateToPage';
import { useFileViewer } from '@/context/FileViewerContext';
import { AttentionCard } from './AttentionCard';
import { ProfileCompletionBanner } from './ProfileCompletionBanner';
import { perFrequency } from '@/lib/paymentFrequency';

interface TenantDashboardProps {
  onNavigate?: (page: Page) => void;
}

const maintenanceStatusColor: Record<string, string> = {
  SUBMITTED: 'orange',
  IN_PROGRESS: 'blue',
  SCHEDULED: 'blue',
  COMPLETED: 'green',
  CANCELLED: 'gray',
};

export function TenantDashboard({ onNavigate }: TenantDashboardProps = {}) {
  const { openFile } = useFileViewer();
  const { data: rent, loading: rentLoading } = useActiveRent();
  // Balance, next due date and recent payments are summed on the server, so
  // they stay right past the first page of invoices (ISS-049).
  const { data: summary, loading: invoicesLoading } = useTenantSummary();
  const { data: maintenanceRequests } = useMaintenanceRequests();
  const { data: accessCodes, refetch: refetchAccessCodes } = useAccessCodes(rent?.unitId ?? null);
  const {
    submit: createAccessCode,
    submitting: creatingCode,
    error: codeError,
  } = useCreateAccessCode();
  const [showCodeForm, setShowCodeForm] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [codeValue, setCodeValue] = useState('');
  const [codeUntil, setCodeUntil] = useState('');
  const [codeSingleUse, setCodeSingleUse] = useState(true);

  const openCodeForm = () => {
    // A fresh 6-digit code by default; the tenant can type their own.
    setCodeValue(String(Math.floor(100000 + Math.random() * 900000)));
    setShowCodeForm(true);
  };

  const handleCreateCode = async () => {
    if (!rent) return;
    try {
      await createAccessCode({
        unitId: rent.unitId,
        code: codeValue.trim(),
        guestName: guestName.trim() || undefined,
        validFrom: new Date().toISOString(),
        validUntil: codeUntil ? new Date(`${codeUntil}T23:59:59`).toISOString() : null,
        singleUse: codeSingleUse,
      });
      setShowCodeForm(false);
      setGuestName('');
      setCodeUntil('');
      setCodeSingleUse(true);
      refetchAccessCodes();
    } catch {
      // surfaced through codeError
    }
  };
  const { open: openConversation } = useOpenConversation();

  const messageManager = () => {
    if (!rent) return;
    openConversation({ type: 'RENT_THREAD', rentId: rent.id });
  };
  const { submit: payInvoice, submitting: paying, error: payError } = usePayInvoice();
  const { available: cardsAvailable } = useCardPayments();

  const {
    data: autoPayMandates,
    loading: autoPayLoading,
    refetch: refetchAutoPay,
  } = useAutoPayMandates(rent?.id ?? null);
  const activeMandate = autoPayMandates[0] ?? null;
  const { data: authorization } = usePaymentAuthorization(rent?.id ?? null);
  const [settingUpAutoPay, setSettingUpAutoPay] = useState(false);
  const {
    submit: createMandate,
    submitting: creatingMandate,
    error: mandateError,
  } = useCreateAutoPayMandate();
  const { submit: cancelMandate, submitting: cancellingMandate } = useCancelAutoPayMandate();

  const handleSetupAutoPay = async () => {
    if (!rent || !authorization) return;
    try {
      await createMandate({
        rentId: rent.id,
        paymentMethodToken: authorization.authorizationCode,
        provider: 'PAYSTACK',
      });
      setSettingUpAutoPay(false);
      refetchAutoPay();
    } catch {
      // error surfaced below via mandateError
    }
  };

  const handleCancelAutoPay = async () => {
    if (!activeMandate) return;
    await cancelMandate(activeMandate.id);
    refetchAutoPay();
  };

  // A PENDING rent (awaiting signature, before a manager activates it)
  // never shows up via useActiveRent -- fetched separately so the tenant
  // still gets the signing prompt. A manager can also activate a rent after
  // signing but before the tenant has, so any rent that already carries a
  // signature keeps the card (the prompt, then the Fully Executed proof);
  // otherwise the tenant could never sign it.
  const { data: pendingRents } = useRents({ status: 'PENDING' });
  const signRentId = pendingRents[0]?.id ?? rent?.id ?? null;
  const { data: signRent, refetch: refetchSignRent } = useRent(signRentId);
  const showSignatureCard =
    !!signRent && (signRent.status === 'PENDING' || (signRent.signatures ?? []).length > 0);

  const property = rent?.unit?.property;
  const balance = summary?.money.balance ?? 0;
  const nextDue = summary?.nextDue ?? null;
  const payments = summary?.recentPayments ?? [];

  const handlePayRent = async () => {
    if (!nextDue) return;
    try {
      const result = await payInvoice(nextDue.id);
      window.location.href = result.authorizationUrl;
    } catch {
      // error state is already surfaced via the hook's `error`
    }
  };

  if (rentLoading || invoicesLoading) {
    return <div className="p-6 text-gray-500">Loading your rental information…</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="mb-1 text-2xl font-semibold">My Rental Dashboard</h1>
        <p className="text-gray-600">Welcome back! Here&apos;s your rental information.</p>
      </div>

      <ProfileCompletionBanner />

      <AttentionCard />

      {signRent && showSignatureCard && (
        <RentSignatureCard rent={signRent} onSigned={refetchSignRent} />
      )}

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
              <p className="text-sm font-medium">Neighbourhood Report</p>
              <p className="text-xs text-gray-500">View area insights & scores</p>
            </div>
          </button>
          <button
            onClick={messageManager}
            disabled={!rent}
            className="group flex items-center gap-3 rounded-lg border border-gray-200 p-4 text-left transition-colors hover:border-blue-300 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
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

      {!rent ? (
        <div className="rounded-lg border border-gray-200 bg-white p-6 text-center text-gray-500">
          No active rent found on your account.
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
                  {rent.status}
                </span>
              </div>
              <p className="mb-1 text-sm text-gray-600">Current Property</p>
              <p className="text-lg font-semibold">
                {property?.name ?? 'Unknown property'}
                {rent.unit ? `, Unit ${rent.unit.unitNumber}` : ''}
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
              <p className="mb-1 text-sm text-gray-600">
                {rent.serviceCharge > 0 ? 'Rent + Service Charge' : 'Rent'}
              </p>
              <p className="text-lg font-semibold">
                ₦{(rent.rentAmount + rent.serviceCharge).toLocaleString()}/
                {perFrequency(rent.paymentFrequency)}
              </p>
              {rent.serviceCharge > 0 && (
                <p className="mt-0.5 text-xs text-gray-400">
                  ₦{rent.rentAmount.toLocaleString()} rent + ₦{rent.serviceCharge.toLocaleString()}{' '}
                  service charge
                </p>
              )}
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
                  <p className="mb-1 text-sm text-gray-600">Rent Period</p>
                  <p className="font-medium">
                    {new Date(rent.startDate).toLocaleDateString()} -{' '}
                    {new Date(rent.endDate).toLocaleDateString()}
                  </p>
                </div>
                <div className="md:col-span-2">
                  <p className="mb-1 text-sm text-gray-600">Property Manager</p>
                  <p className="font-medium">
                    Reach your property manager any time via{' '}
                    <button onClick={messageManager} className="text-blue-600 hover:underline">
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
                    disabled={!nextDue || paying || cardsAvailable === false}
                    className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {paying
                      ? 'Redirecting to Paystack…'
                      : !nextDue
                        ? 'No Balance Due'
                        : cardsAvailable === false
                          ? 'Card Payment Not Available Yet'
                          : 'Pay Rent Online'}
                  </button>
                  {nextDue && cardsAvailable === false && (
                    <p className="text-sm text-gray-600">
                      Card payments are not available yet. You can still pay by bank transfer or
                      cash and record it under{' '}
                      <Link
                        href="/dashboard/payment-history"
                        className="font-medium text-blue-600 hover:text-blue-700"
                      >
                        Payment History
                      </Link>{' '}
                      (&quot;Paid another way&quot;).
                    </p>
                  )}
                  {payError && <p className="text-sm text-red-600">{payError}</p>}

                  {activeMandate ? (
                    <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                      <div className="flex items-center gap-2 text-green-800">
                        <CheckCircle className="h-4 w-4 shrink-0" />
                        <span className="text-sm font-medium">
                          Auto-pay is active
                          {authorization?.last4 ? ` (card ending ${authorization.last4})` : ''}
                        </span>
                      </div>
                      <button
                        onClick={handleCancelAutoPay}
                        disabled={cancellingMandate}
                        className="mt-2 text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                      >
                        {cancellingMandate ? 'Cancelling…' : 'Cancel Auto-Pay'}
                      </button>
                    </div>
                  ) : !settingUpAutoPay ? (
                    <button
                      onClick={() => setSettingUpAutoPay(true)}
                      disabled={autoPayLoading}
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Setup Auto-Pay
                    </button>
                  ) : (
                    <div className="space-y-3 rounded-lg border border-gray-200 p-4">
                      {authorization ? (
                        <>
                          <p className="text-sm text-gray-700">
                            Auto-pay each rent invoice using the card you last paid with
                            {authorization.last4 ? ` (ending ${authorization.last4}` : ''}
                            {authorization.bank ? `, ${authorization.bank}` : ''}
                            {authorization.last4 ? ')' : ''}?
                          </p>
                          {mandateError && <p className="text-sm text-red-600">{mandateError}</p>}
                          <div className="flex gap-2">
                            <button
                              onClick={handleSetupAutoPay}
                              disabled={creatingMandate}
                              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                            >
                              {creatingMandate ? 'Setting up…' : 'Enable Auto-Pay'}
                            </button>
                            <button
                              onClick={() => setSettingUpAutoPay(false)}
                              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                            >
                              Cancel
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-start gap-2 text-sm text-gray-700">
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                            <span>
                              {cardsAvailable === false
                                ? 'Card payments are not available yet, so auto-pay cannot be set up.'
                                : 'No saved card yet. Pay one rent invoice online with a card first — auto-pay reuses that same card for future charges.'}
                            </span>
                          </div>
                          <button
                            onClick={() => setSettingUpAutoPay(false)}
                            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                          >
                            Close
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div className="border-t border-gray-200 pt-4">
                  <p className="mb-3 text-sm font-medium">Recent Payments</p>
                  <div className="space-y-2">
                    {payments.map((payment) => (
                      <div key={payment.id} className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">
                          {new Date(payment.paidAt).toLocaleDateString()}
                        </span>
                        <span className="font-medium">₦{payment.amount.toLocaleString()}</span>
                        <span className="rounded bg-green-100 px-2 py-1 text-xs text-green-700">
                          {payment.type}
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
            <div className="flex items-center justify-between border-b border-gray-200 p-6">
              <h2 className="font-semibold">Access Codes</h2>
              <button
                onClick={() => (showCodeForm ? setShowCodeForm(false) : openCodeForm())}
                className="text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                {showCodeForm ? 'Cancel' : '+ New Guest Code'}
              </button>
            </div>
            <div className="p-6">
              {showCodeForm && (
                <div className="mb-4 grid grid-cols-1 gap-3 rounded-lg border border-gray-200 p-4 md:grid-cols-2">
                  <input
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Guest name (optional)"
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <input
                    value={codeValue}
                    onChange={(e) => setCodeValue(e.target.value)}
                    placeholder="Gate code (4+ characters)"
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <label className="text-xs text-gray-600">
                    Valid until (optional)
                    <input
                      type="date"
                      value={codeUntil}
                      onChange={(e) => setCodeUntil(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </label>
                  <label className="flex items-center gap-2 pt-5 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={codeSingleUse}
                      onChange={(e) => setCodeSingleUse(e.target.checked)}
                    />
                    One-time use
                  </label>
                  {codeError && <p className="text-xs text-red-600 md:col-span-2">{codeError}</p>}
                  <button
                    onClick={handleCreateCode}
                    disabled={creatingCode || codeValue.trim().length < 4}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 md:col-span-2"
                  >
                    {creatingCode ? 'Creating…' : 'Create Code'}
                  </button>
                </div>
              )}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {accessCodes.map((access) => (
                  <AccessCodeCard key={access.id} code={access} onChanged={refetchAccessCodes} />
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
              {rent.signedAgreementUrl ? (
                <button
                  type="button"
                  onClick={() =>
                    openFile({
                      url: rent.signedAgreementUrl!,
                      name: 'Signed Rent Agreement.pdf',
                      type: 'application/pdf',
                    })
                  }
                  className="flex w-full items-center justify-between rounded-lg border border-gray-200 p-3 text-left transition-colors hover:bg-gray-50"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">Signed Rent Agreement</p>
                    <p className="text-xs text-gray-500">
                      Since {new Date(rent.startDate).toLocaleDateString()}
                    </p>
                  </div>
                  <FileText className="h-4 w-4 text-blue-600" />
                </button>
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
