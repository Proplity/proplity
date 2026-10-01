import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Calendar,
  DollarSign,
  FileText,
  CheckCircle,
  AlertCircle,
  MessageSquare,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  useLease,
  useLeaseNotes,
  useCreateLeaseNote,
  useUpdateLeaseTerms,
  useUpdateLeaseStatus,
  useRenewLease,
  useCreateNotice,
  useSignLease,
} from '@/hooks/useLeases';
import { useCreateInvoice } from '@/hooks/useInvoices';
import { useMaintenanceRequests } from '@/hooks/useMaintenanceRequests';
import { useViolations, useCreateViolation, useUpdateViolation } from '@/hooks/useViolations';
import { useOpenConversation } from '@/hooks/useOpenConversation';
import { useConditionReports, useCreateConditionReport } from '@/hooks/useConditionReports';
import type { Lease, Violation, Notice, CreateInvoiceInput } from '@/lib/api/types';

interface TenantDetailProps {
  leaseId: string;
}

// Click-wrap e-signature: typed full legal name + timestamp + IP, not a
// drawn/uploaded image (no file-storage endpoint exists anywhere in this
// codebase). Fully executed once both a tenant-side and a landlord-side
// signature exist -- lease.agreementSignedAt tracks that, computed
// server-side in the sign route.
export function LeaseSignatureCard({ lease, onSigned }: { lease: Lease; onSigned: () => void }) {
  const auth = useAuth();
  const { submit: sign, submitting, error } = useSignLease(lease.id);
  const [fullName, setFullName] = useState('');

  const signatures = lease.signatures ?? [];
  const myUserId = auth.user?.id;
  const alreadySigned = signatures.some((s) => s.signerId === myUserId);
  const tenantSignature = signatures.find((s) => s.signerRole === 'TENANT');
  const landlordSideSignature = signatures.find((s) =>
    ['MANAGER', 'LANDLORD', 'ADMIN'].includes(s.signerRole),
  );

  const handleSign = async () => {
    if (!fullName.trim()) return;
    try {
      await sign(fullName.trim());
      setFullName('');
      onSigned();
    } catch {
      // error surfaced below
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold">Lease Agreement Signature</h2>
        {lease.agreementSignedAt && (
          <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
            Fully Executed
          </span>
        )}
      </div>

      <div className="mb-4 space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Tenant</span>
          <span className={tenantSignature ? 'font-medium text-green-700' : 'text-gray-400'}>
            {tenantSignature
              ? `Signed by ${tenantSignature.fullNameTyped} on ${new Date(tenantSignature.signedAt).toLocaleDateString()}`
              : 'Not yet signed'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Landlord/Manager</span>
          <span className={landlordSideSignature ? 'font-medium text-green-700' : 'text-gray-400'}>
            {landlordSideSignature
              ? `Signed by ${landlordSideSignature.fullNameTyped} on ${new Date(landlordSideSignature.signedAt).toLocaleDateString()}`
              : 'Not yet signed'}
          </span>
        </div>
      </div>

      {!alreadySigned && (
        <div className="space-y-2 border-t border-gray-100 pt-4">
          <label className="block text-sm text-gray-600">
            Type your full legal name to sign this agreement
          </label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Full name"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            onClick={handleSign}
            disabled={submitting || !fullName.trim()}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'Signing…' : 'Sign Agreement'}
          </button>
        </div>
      )}
    </div>
  );
}

const VIOLATION_BADGE: Record<Violation['status'], string> = {
  OPEN: 'bg-red-100 text-red-700',
  UNDER_REVIEW: 'bg-yellow-100 text-yellow-700',
  RESOLVED: 'bg-green-100 text-green-700',
};

// Violations: manager/landlord/admin reports rule breaches against a
// unit's tenant, tracks OPEN -> UNDER_REVIEW -> RESOLVED.
function ViolationsCard({ propertyId, unitId }: { propertyId: string; unitId: string }) {
  const { data: violations, loading, refetch } = useViolations(propertyId, unitId);
  const { submit: createViolation, submitting, error } = useCreateViolation(propertyId, unitId);
  const { submit: updateViolation } = useUpdateViolation(propertyId, unitId);
  const [showForm, setShowForm] = useState(false);
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<Violation['severity']>('MINOR');

  const handleCreate = async () => {
    if (!description.trim()) return;
    try {
      await createViolation({ description: description.trim(), severity });
      setDescription('');
      setShowForm(false);
      refetch();
    } catch {
      // error surfaced below
    }
  };

  const handleResolve = async (violationId: string) => {
    await updateViolation({ violationId, status: 'RESOLVED' });
    refetch();
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold">Violations</h2>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          {showForm ? 'Cancel' : '+ Report'}
        </button>
      </div>

      {showForm && (
        <div className="mb-4 space-y-2 border-b border-gray-100 pb-4">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What happened?"
            rows={2}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value as Violation['severity'])}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="MINOR">Minor</option>
            <option value="MODERATE">Moderate</option>
            <option value="SEVERE">Severe</option>
          </select>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            onClick={handleCreate}
            disabled={submitting}
            className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'Reporting…' : 'Report Violation'}
          </button>
        </div>
      )}

      <div className="space-y-3">
        {loading && <p className="text-sm text-gray-400">Loading…</p>}
        {!loading &&
          violations.map((v) => (
            <div key={v.id} className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm">{v.description}</p>
                <p className="text-xs text-gray-400">
                  {new Date(v.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${VIOLATION_BADGE[v.status]}`}
                >
                  {v.status.replace('_', ' ')}
                </span>
                {v.status !== 'RESOLVED' && (
                  <button
                    onClick={() => handleResolve(v.id)}
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    Mark Resolved
                  </button>
                )}
              </div>
            </div>
          ))}
        {!loading && violations.length === 0 && (
          <p className="text-sm text-gray-400">No violations on record.</p>
        )}
      </div>
    </div>
  );
}

// Condition reports: move-in/move-out inspections. rooms is a free-form
// JSON blob (per-room notes) -- kept as a single free-text field here since
// there's no room-by-room UI, matching how the API accepts it as JSON.
// aiFlags is never populated by any code path -- no AI/image-analysis
// integration exists anywhere in this codebase.
function ConditionReportsCard({ propertyId, unitId }: { propertyId: string; unitId: string }) {
  const { data: reports, loading, refetch } = useConditionReports(propertyId, unitId);
  const { submit: createReport, submitting, error } = useCreateConditionReport(propertyId, unitId);
  const [showForm, setShowForm] = useState(false);
  const [notes, setNotes] = useState('');

  const handleCreate = async () => {
    if (!notes.trim()) return;
    try {
      await createReport({ rooms: { notes: notes.trim() } });
      setNotes('');
      setShowForm(false);
      refetch();
    } catch {
      // error surfaced below
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold">Condition Reports</h2>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          {showForm ? 'Cancel' : '+ New Report'}
        </button>
      </div>

      {showForm && (
        <div className="mb-4 space-y-2 border-b border-gray-100 pb-4">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Condition notes (e.g. move-in inspection findings)"
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            onClick={handleCreate}
            disabled={submitting}
            className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'Saving…' : 'Save Report'}
          </button>
        </div>
      )}

      <div className="space-y-3">
        {loading && <p className="text-sm text-gray-400">Loading…</p>}
        {!loading &&
          reports.map((r) => (
            <div key={r.id}>
              <p className="text-sm">{(r.rooms as { notes?: string }).notes ?? 'No notes'}</p>
              <p className="text-xs text-gray-400">{new Date(r.reportedAt).toLocaleDateString()}</p>
            </div>
          ))}
        {!loading && reports.length === 0 && (
          <p className="text-sm text-gray-400">No condition reports yet.</p>
        )}
      </div>
    </div>
  );
}

export function TenantDetail({ leaseId }: TenantDetailProps) {
  const router = useRouter();
  const { data: lease, loading, refetch: refetchLease } = useLease(leaseId);
  const { data: notes, refetch: refetchNotes } = useLeaseNotes(leaseId);
  const { data: allRequests } = useMaintenanceRequests();
  const { submit: submitNote, submitting: savingNote } = useCreateLeaseNote(leaseId);
  const { submit: submitTerms, submitting: savingTerms } = useUpdateLeaseTerms(leaseId);
  const { submit: submitStatus, submitting: savingStatus } = useUpdateLeaseStatus(leaseId);
  const {
    submit: submitRenew,
    submitting: savingRenew,
    error: renewError,
  } = useRenewLease(leaseId);
  const {
    submit: submitNotice,
    submitting: savingNotice,
    error: noticeError,
  } = useCreateNotice(leaseId);
  const {
    submit: submitInvoice,
    submitting: savingInvoice,
    error: invoiceError,
  } = useCreateInvoice();
  const { open: openConversation } = useOpenConversation();
  const [newNote, setNewNote] = useState('');
  const [editingTerms, setEditingTerms] = useState(false);
  const [termsDraft, setTermsDraft] = useState({
    gracePeriodDays: '7',
    lateFeeType: 'PERCENTAGE' as 'PERCENTAGE' | 'FIXED',
    lateFeePercentage: '0',
    lateFeeFlatAmount: '0',
  });
  const [renewingLease, setRenewingLease] = useState(false);
  const [renewDraft, setRenewDraft] = useState({
    startDate: '',
    endDate: '',
    rentAmount: '',
    deposit: '',
  });
  const [sendingNotice, setSendingNotice] = useState(false);
  const [noticeDraft, setNoticeDraft] = useState<{ type: Notice['type']; content: string }>({
    type: 'PAYMENT_REMINDER',
    content: '',
  });
  const [sendingInvoice, setSendingInvoice] = useState(false);
  const [invoiceDraft, setInvoiceDraft] = useState<{
    type: CreateInvoiceInput['type'];
    amount: string;
    dueDate: string;
    description: string;
  }>({
    type: 'UTILITY',
    amount: '',
    dueDate: '',
    description: '',
  });

  if (loading) {
    return <div className="p-6 text-gray-500">Loading tenant…</div>;
  }

  if (!lease || !lease.tenant) {
    return (
      <div className="p-6">
        <Link
          href="/dashboard/tenants"
          className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Tenants
        </Link>
        <p className="text-gray-500">Tenant not found.</p>
      </div>
    );
  }

  const tenant = lease.tenant;
  const property = lease.unit?.property;

  // "Rent status" and "next due" derived the same way as TenantManagement's
  // list -- no stored field, computed from this lease's RENT invoices.
  const unpaidInvoices = (lease.invoices ?? [])
    .filter((i) => i.status !== 'PAID' && i.status !== 'CANCELLED')
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  const rentPaid = unpaidInvoices.length === 0;
  const nextDue = unpaidInvoices[0]?.dueDate ?? null;

  const payments = (lease.invoices ?? [])
    .flatMap((invoice) => invoice.payments.map((payment) => ({ invoice, payment })))
    .sort((a, b) => new Date(b.payment.paidAt).getTime() - new Date(a.payment.paidAt).getTime());

  const maintenanceRequests = allRequests.filter((r) => r.unitId === lease.unitId);

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    await submitNote(newNote.trim());
    setNewNote('');
    refetchNotes();
  };

  const openTermsEditor = () => {
    setTermsDraft({
      gracePeriodDays: String(lease.gracePeriodDays),
      lateFeeType: lease.lateFeeType,
      lateFeePercentage: String(lease.lateFeePercentage),
      lateFeeFlatAmount: String(lease.lateFeeFlatAmount),
    });
    setEditingTerms(true);
  };

  const handleSaveTerms = async () => {
    await submitTerms({
      gracePeriodDays: parseInt(termsDraft.gracePeriodDays, 10) || 0,
      lateFeeType: termsDraft.lateFeeType,
      lateFeePercentage: parseFloat(termsDraft.lateFeePercentage) || 0,
      lateFeeFlatAmount: parseFloat(termsDraft.lateFeeFlatAmount) || 0,
    });
    setEditingTerms(false);
    refetchLease();
  };

  // Renewal term defaults to a same-length term starting the day after the
  // current lease ends -- editable before submitting, not just a guess.
  const openRenewEditor = () => {
    const currentEnd = new Date(lease.endDate);
    const currentStart = new Date(lease.startDate);
    const termMs = currentEnd.getTime() - currentStart.getTime();
    const nextStart = new Date(currentEnd.getTime() + 24 * 60 * 60 * 1000);
    const nextEnd = new Date(nextStart.getTime() + termMs);
    const toInputDate = (d: Date) => d.toISOString().slice(0, 10);
    setRenewDraft({
      startDate: toInputDate(nextStart),
      endDate: toInputDate(nextEnd),
      rentAmount: String(lease.rentAmount),
      deposit: String(lease.deposit),
    });
    setRenewingLease(true);
  };

  const handleRenew = async () => {
    try {
      const newLease = await submitRenew({
        startDate: renewDraft.startDate,
        endDate: renewDraft.endDate,
        rentAmount: parseFloat(renewDraft.rentAmount) || 0,
        deposit: parseFloat(renewDraft.deposit) || 0,
      });
      setRenewingLease(false);
      // Renewal creates a NEW lease row (old one flips to EXPIRED) -- follow
      // onto its detail page rather than showing this now-expired one.
      if (newLease?.id) {
        router.push(`/dashboard/tenants/${newLease.id}`);
      } else {
        refetchLease();
      }
    } catch {
      // error surfaced below via renewError
    }
  };

  const handleSendNotice = async () => {
    try {
      await submitNotice({
        type: noticeDraft.type,
        content: noticeDraft.content.trim() || undefined,
        status: 'SENT',
      });
      setNoticeDraft({ type: 'PAYMENT_REMINDER', content: '' });
      setSendingNotice(false);
      refetchLease();
    } catch {
      // error surfaced below via noticeError
    }
  };

  const handleSendInvoice = async () => {
    try {
      await submitInvoice({
        leaseId,
        type: invoiceDraft.type,
        amount: parseFloat(invoiceDraft.amount) || 0,
        dueDate: invoiceDraft.dueDate,
        description: invoiceDraft.description.trim() || undefined,
      });
      setInvoiceDraft({ type: 'UTILITY', amount: '', dueDate: '', description: '' });
      setSendingInvoice(false);
      refetchLease();
    } catch {
      // error surfaced below via invoiceError
    }
  };

  return (
    <div className="p-6">
      <Link
        href="/dashboard/tenants"
        className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-5 w-5" />
        Back to Tenants
      </Link>

      {/* Header */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-500 text-3xl font-semibold text-white">
              {tenant.name.charAt(0)}
            </div>
            <div>
              <h1 className="mb-2 text-2xl font-semibold">{tenant.name}</h1>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <Mail className="h-4 w-4" />
                  {tenant.email}
                </div>
                <div className="flex items-center gap-1">
                  <Phone className="h-4 w-4" />
                  {tenant.phoneNumber ?? 'N/A'}
                </div>
              </div>
              <div className="mt-2 flex items-center gap-1 text-sm text-gray-600">
                <MapPin className="h-4 w-4" />
                {property ? `${property.name} · Unit ${lease.unit?.unitNumber}` : 'N/A'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`rounded-full px-3 py-1 text-sm font-medium ${
                rentPaid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}
            >
              {rentPaid ? 'Rent Paid' : 'Balance Due'}
            </span>
            <span
              className={`rounded-full px-3 py-1 text-sm font-medium ${
                lease.riskScore === 'LOW'
                  ? 'bg-green-100 text-green-700'
                  : lease.riskScore === 'MEDIUM'
                    ? 'bg-yellow-100 text-yellow-700'
                    : lease.riskScore === 'HIGH'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-gray-100 text-gray-500'
              }`}
            >
              {lease.riskScore ? `${lease.riskScore} Risk` : 'Unscored'}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="space-y-6 lg:col-span-2">
          {/* Lease Information */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold">Lease Information</h2>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  lease.status === 'ACTIVE'
                    ? 'bg-green-100 text-green-700'
                    : lease.status === 'PENDING'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-gray-100 text-gray-500'
                }`}
              >
                {lease.status}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="mb-1 text-sm text-gray-600">Lease Start</p>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <p className="font-medium">{new Date(lease.startDate).toLocaleDateString()}</p>
                </div>
              </div>
              <div>
                <p className="mb-1 text-sm text-gray-600">Lease End</p>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <p className="font-medium">{new Date(lease.endDate).toLocaleDateString()}</p>
                </div>
              </div>
              <div>
                <p className="mb-1 text-sm text-gray-600">Rent</p>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  <p className="font-semibold text-green-600">
                    ₦{lease.rentAmount.toLocaleString()}/{lease.paymentFrequency.toLowerCase()}
                  </p>
                </div>
              </div>
              <div>
                <p className="mb-1 text-sm text-gray-600">Next Due</p>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-orange-600" />
                  <p className="font-medium">
                    {nextDue ? new Date(nextDue).toLocaleDateString() : 'None outstanding'}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 flex gap-2 border-t border-gray-200 pt-4">
              {lease.status === 'PENDING' && (
                <button
                  onClick={async () => {
                    await submitStatus('ACTIVE');
                    refetchLease();
                  }}
                  disabled={savingStatus}
                  className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {savingStatus ? 'Activating…' : 'Activate Lease'}
                </button>
              )}
              {lease.status === 'ACTIVE' && (
                <button
                  onClick={async () => {
                    if (!confirm('Terminate this lease? The unit will be freed up as vacant.'))
                      return;
                    await submitStatus('TERMINATED');
                    refetchLease();
                  }}
                  disabled={savingStatus}
                  className="flex-1 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  {savingStatus ? 'Terminating…' : 'Terminate Lease'}
                </button>
              )}
              <button
                onClick={openRenewEditor}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Renew Lease
              </button>
              <button
                onClick={() => setSendingNotice(true)}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Send Notice
              </button>
            </div>

            {renewingLease && (
              <div className="mt-4 space-y-4 border-t border-gray-200 pt-4">
                <h3 className="text-sm font-semibold text-gray-800">Renew Lease</h3>
                <p className="text-xs text-gray-500">
                  Creates a new lease starting after the current one ends. The current lease is
                  marked Expired once the new one is created.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm text-gray-600">New Start Date</label>
                    <input
                      type="date"
                      value={renewDraft.startDate}
                      onChange={(e) => setRenewDraft((s) => ({ ...s, startDate: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-gray-600">New End Date</label>
                    <input
                      type="date"
                      value={renewDraft.endDate}
                      onChange={(e) => setRenewDraft((s) => ({ ...s, endDate: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-gray-600">Rent Amount (₦)</label>
                    <input
                      type="number"
                      min={0}
                      value={renewDraft.rentAmount}
                      onChange={(e) => setRenewDraft((s) => ({ ...s, rentAmount: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-gray-600">Deposit (₦)</label>
                    <input
                      type="number"
                      min={0}
                      value={renewDraft.deposit}
                      onChange={(e) => setRenewDraft((s) => ({ ...s, deposit: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
                {renewError && <p className="text-sm text-red-600">{renewError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={handleRenew}
                    disabled={savingRenew}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {savingRenew ? 'Renewing…' : 'Confirm Renewal'}
                  </button>
                  <button
                    onClick={() => setRenewingLease(false)}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {sendingNotice && (
              <div className="mt-4 space-y-4 border-t border-gray-200 pt-4">
                <h3 className="text-sm font-semibold text-gray-800">Send Notice</h3>
                <div>
                  <label className="mb-1 block text-sm text-gray-600">Notice Type</label>
                  <select
                    value={noticeDraft.type}
                    onChange={(e) =>
                      setNoticeDraft((s) => ({
                        ...s,
                        type: e.target.value as Notice['type'],
                      }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="PAYMENT_REMINDER">Payment Reminder</option>
                    <option value="RENT_INCREASE">Rent Increase</option>
                    <option value="RENEWAL_OFFER">Renewal Offer</option>
                    <option value="DEFAULT_NOTICE">Default Notice</option>
                    <option value="EXPIRATION_ALERT">Expiration Alert</option>
                    <option value="TERMINATION_NOTICE">Termination Notice</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm text-gray-600">Message</label>
                  <textarea
                    value={noticeDraft.content}
                    onChange={(e) => setNoticeDraft((s) => ({ ...s, content: e.target.value }))}
                    rows={3}
                    placeholder="What does the tenant need to know?"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                {noticeError && <p className="text-sm text-red-600">{noticeError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={handleSendNotice}
                    disabled={savingNotice}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {savingNotice ? 'Sending…' : 'Send Notice'}
                  </button>
                  <button
                    onClick={() => setSendingNotice(false)}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Late Fee & Grace Period */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold">Late Fee & Grace Period</h2>
              {!editingTerms && (
                <button
                  onClick={openTermsEditor}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  Edit
                </button>
              )}
            </div>

            {editingTerms ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm text-gray-600">Grace Period (days)</label>
                    <input
                      type="number"
                      min={0}
                      value={termsDraft.gracePeriodDays}
                      onChange={(e) =>
                        setTermsDraft((s) => ({ ...s, gracePeriodDays: e.target.value }))
                      }
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-gray-600">Late Fee Type</label>
                    <select
                      value={termsDraft.lateFeeType}
                      onChange={(e) =>
                        setTermsDraft((s) => ({
                          ...s,
                          lateFeeType: e.target.value as 'PERCENTAGE' | 'FIXED',
                        }))
                      }
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value="PERCENTAGE">Percentage of rent</option>
                      <option value="FIXED">Flat amount (₦)</option>
                    </select>
                  </div>
                </div>
                {termsDraft.lateFeeType === 'PERCENTAGE' ? (
                  <div>
                    <label className="mb-1 block text-sm text-gray-600">Late Fee Percentage</label>
                    <input
                      type="number"
                      min={0}
                      step="0.1"
                      value={termsDraft.lateFeePercentage}
                      onChange={(e) =>
                        setTermsDraft((s) => ({ ...s, lateFeePercentage: e.target.value }))
                      }
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                    {parseFloat(termsDraft.lateFeePercentage) > 0 && (
                      <p className="mt-1 text-xs text-gray-400">
                        ≈ ₦
                        {(
                          (lease.rentAmount * parseFloat(termsDraft.lateFeePercentage)) /
                          100
                        ).toLocaleString()}{' '}
                        per overdue invoice
                      </p>
                    )}
                  </div>
                ) : (
                  <div>
                    <label className="mb-1 block text-sm text-gray-600">Flat Amount (₦)</label>
                    <input
                      type="number"
                      min={0}
                      value={termsDraft.lateFeeFlatAmount}
                      onChange={(e) =>
                        setTermsDraft((s) => ({ ...s, lateFeeFlatAmount: e.target.value }))
                      }
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveTerms}
                    disabled={savingTerms}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {savingTerms ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    onClick={() => setEditingTerms(false)}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="mb-1 text-sm text-gray-600">Grace Period</p>
                  <p className="font-medium">{lease.gracePeriodDays} days</p>
                </div>
                <div>
                  <p className="mb-1 text-sm text-gray-600">Late Fee</p>
                  <p className="font-medium">
                    {lease.lateFeeType === 'FIXED'
                      ? lease.lateFeeFlatAmount > 0
                        ? `₦${lease.lateFeeFlatAmount.toLocaleString()} flat`
                        : 'None'
                      : lease.lateFeePercentage > 0
                        ? `${lease.lateFeePercentage}% of rent`
                        : 'None'}
                  </p>
                </div>
              </div>
            )}
          </div>

          <LeaseSignatureCard lease={lease} onSigned={refetchLease} />

          {property && (
            <>
              <ViolationsCard propertyId={property.id} unitId={lease.unitId} />
              <ConditionReportsCard propertyId={property.id} unitId={lease.unitId} />
            </>
          )}

          {/* Payment History */}
          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-200 p-6">
              <h2 className="font-semibold">Payment History</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Method
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Reference
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {payments.map(({ payment }) => (
                    <tr key={payment.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm">
                        {new Date(payment.paidAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold">
                        ₦{payment.amount.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {payment.paymentMethod.replace('_', ' ')}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-gray-500">
                        {payment.transactionRef ?? '—'}
                      </td>
                    </tr>
                  ))}
                  {payments.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-400">
                        No payments recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Maintenance Requests */}
          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-200 p-6">
              <h2 className="font-semibold">Maintenance Requests</h2>
            </div>
            <div className="divide-y divide-gray-200">
              {maintenanceRequests.map((request) => (
                <div key={request.id} className="p-4 hover:bg-gray-50">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="font-medium">{request.title}</p>
                    <span
                      className={`rounded px-2 py-1 text-xs font-medium ${
                        request.status === 'COMPLETED'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {request.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <span>{new Date(request.createdAt).toLocaleDateString()}</span>
                    <span
                      className={`rounded px-2 py-1 text-xs ${
                        request.priority === 'HIGH' || request.priority === 'EMERGENCY'
                          ? 'bg-red-100 text-red-700'
                          : request.priority === 'MEDIUM'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {request.priority} Priority
                    </span>
                  </div>
                </div>
              ))}
              {maintenanceRequests.length === 0 && (
                <p className="p-4 text-sm text-gray-400">No maintenance requests for this unit.</p>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-4 font-semibold">Manager Notes</h2>
            <div className="space-y-3">
              {notes.map((note) => (
                <div key={note.id} className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
                  <p className="text-sm text-gray-800">{note.body}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {new Date(note.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add a note about this tenant..."
                className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                rows={2}
              />
              <button
                onClick={handleAddNote}
                disabled={savingNote || !newNote.trim()}
                className="w-full rounded-lg border-2 border-dashed border-gray-300 p-3 text-sm text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingNote ? 'Saving…' : '+ Add Note'}
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-4 font-semibold">Quick Actions</h2>
            <div className="space-y-2">
              <a
                href={tenant.phoneNumber ? `tel:${tenant.phoneNumber}` : undefined}
                onClick={(e) => {
                  if (!tenant.phoneNumber) {
                    e.preventDefault();
                    alert('No phone number on file for this tenant.');
                  }
                }}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <Phone className="h-4 w-4" />
                Call Tenant
              </a>
              <button
                onClick={() => openConversation({ type: 'LEASE_THREAD', leaseId })}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <MessageSquare className="h-4 w-4" />
                Message Tenant
              </button>
              <a
                href={`mailto:${tenant.email}`}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Mail className="h-4 w-4" />
                Send Email
              </a>
              <a
                href={
                  tenant.phoneNumber
                    ? `https://wa.me/${tenant.phoneNumber.replace(/\D/g, '')}`
                    : undefined
                }
                target="_blank"
                rel="noreferrer"
                onClick={(e) => {
                  if (!tenant.phoneNumber) {
                    e.preventDefault();
                    alert('No phone number on file for this tenant.');
                  }
                }}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <MessageSquare className="h-4 w-4" />
                WhatsApp
              </a>
              <button
                onClick={() => setSendingInvoice(true)}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <FileText className="h-4 w-4" />
                Send Invoice
              </button>
            </div>

            {sendingInvoice && (
              <div className="mt-4 space-y-3 border-t border-gray-200 pt-4">
                <h3 className="text-sm font-semibold text-gray-800">Send Invoice</h3>
                <div>
                  <label className="mb-1 block text-sm text-gray-600">Invoice Type</label>
                  <select
                    value={invoiceDraft.type}
                    onChange={(e) =>
                      setInvoiceDraft((s) => ({
                        ...s,
                        type: e.target.value as CreateInvoiceInput['type'],
                      }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="UTILITY">Utility</option>
                    <option value="LATE_FEE">Late Fee</option>
                    <option value="ASSOCIATION_FEE">Association Fee</option>
                    <option value="SECURITY_DEPOSIT">Security Deposit</option>
                    <option value="SERVICE_CHARGE">Service Charge</option>
                    <option value="MAINTENANCE">Maintenance</option>
                    <option value="RENT">Rent</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm text-gray-600">Amount (₦)</label>
                  <input
                    type="number"
                    min={0}
                    value={invoiceDraft.amount}
                    onChange={(e) => setInvoiceDraft((s) => ({ ...s, amount: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-gray-600">Due Date</label>
                  <input
                    type="date"
                    value={invoiceDraft.dueDate}
                    onChange={(e) => setInvoiceDraft((s) => ({ ...s, dueDate: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-gray-600">Description (optional)</label>
                  <input
                    type="text"
                    value={invoiceDraft.description}
                    onChange={(e) =>
                      setInvoiceDraft((s) => ({ ...s, description: e.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                {invoiceError && <p className="text-sm text-red-600">{invoiceError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={handleSendInvoice}
                    disabled={savingInvoice || !invoiceDraft.amount || !invoiceDraft.dueDate}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {savingInvoice ? 'Sending…' : 'Send Invoice'}
                  </button>
                  <button
                    onClick={() => setSendingInvoice(false)}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Emergency Contact */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-4 font-semibold">Emergency Contact</h2>
            {tenant.emergencyContactName ? (
              <div className="space-y-2">
                <div>
                  <p className="text-sm text-gray-600">Name</p>
                  <p className="font-medium">{tenant.emergencyContactName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Relationship</p>
                  <p className="font-medium">{tenant.emergencyContactRelationship ?? 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Phone</p>
                  <p className="font-medium">{tenant.emergencyContactPhone ?? 'N/A'}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400">No emergency contact on file.</p>
            )}
          </div>

          {/* Documents */}
          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-200 p-6">
              <h2 className="font-semibold">Documents</h2>
            </div>
            <div className="p-4">
              {lease.signedAgreementUrl ? (
                <a
                  href={lease.signedAgreementUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between rounded-lg p-2 hover:bg-gray-50"
                >
                  <p className="text-sm font-medium">Signed Lease Agreement</p>
                  <FileText className="h-4 w-4 text-gray-600" />
                </a>
              ) : (
                <p className="text-sm text-gray-400">No documents on file yet.</p>
              )}
            </div>
          </div>

          {/* Insights */}
          <div className="rounded-lg border border-purple-200 bg-linear-to-br from-purple-50 to-blue-50 p-6">
            <h2 className="mb-3 font-semibold">Payment Reliability</h2>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                <span>
                  {lease.paymentReliability
                    ? `${lease.paymentReliability} payment history`
                    : 'No score yet'}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                <span>{maintenanceRequests.length} maintenance request(s) on this unit</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
