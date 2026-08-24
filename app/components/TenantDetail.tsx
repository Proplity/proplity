import { useState } from 'react';
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
import { useLease, useLeaseNotes, useCreateLeaseNote } from '@/hooks/useLeases';
import { useMaintenanceRequests } from '@/hooks/useMaintenanceRequests';

interface TenantDetailProps {
  leaseId: string;
  onBack: () => void;
}

export function TenantDetail({ leaseId, onBack }: TenantDetailProps) {
  const { data: lease, loading } = useLease(leaseId);
  const { data: notes, refetch: refetchNotes } = useLeaseNotes(leaseId);
  const { data: allRequests } = useMaintenanceRequests();
  const { submit: submitNote, submitting: savingNote } = useCreateLeaseNote(leaseId);
  const [newNote, setNewNote] = useState('');

  if (loading) {
    return <div className="p-6 text-gray-500">Loading tenant…</div>;
  }

  if (!lease || !lease.tenant) {
    return (
      <div className="p-6">
        <button onClick={onBack} className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-5 w-5" />
          Back to Tenants
        </button>
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

  return (
    <div className="p-6">
      <button onClick={onBack} className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900">
        <ArrowLeft className="h-5 w-5" />
        Back to Tenants
      </button>

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
            <h2 className="mb-4 font-semibold">Lease Information</h2>
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
                  <p className="font-medium">{nextDue ? new Date(nextDue).toLocaleDateString() : 'None outstanding'}</p>
                </div>
              </div>
            </div>

            <div className="mt-4 flex gap-2 border-t border-gray-200 pt-4">
              <button
                onClick={() => alert('Lease renewal is not available yet.')}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Renew Lease
              </button>
              <button
                onClick={() => alert('Sending notices is not available yet.')}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Send Notice
              </button>
            </div>
          </div>

          {/* Payment History */}
          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-200 p-6">
              <h2 className="font-semibold">Payment History</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {payments.map(({ payment }) => (
                    <tr key={payment.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm">{new Date(payment.paidAt).toLocaleDateString()}</td>
                      <td className="px-6 py-4 text-sm font-semibold">₦{payment.amount.toLocaleString()}</td>
                      <td className="px-6 py-4 text-sm">{payment.paymentMethod.replace('_', ' ')}</td>
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
                  <p className="mt-1 text-xs text-gray-500">{new Date(note.createdAt).toLocaleString()}</p>
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
              <a
                href={`mailto:${tenant.email}`}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Mail className="h-4 w-4" />
                Send Email
              </a>
              <a
                href={tenant.phoneNumber ? `https://wa.me/${tenant.phoneNumber.replace(/\D/g, '')}` : undefined}
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
                onClick={() => alert('Sending an invoice from here is not available yet.')}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <FileText className="h-4 w-4" />
                Send Invoice
              </button>
            </div>
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
          <div className="rounded-lg border border-purple-200 bg-gradient-to-br from-purple-50 to-blue-50 p-6">
            <h2 className="mb-3 font-semibold">Payment Reliability</h2>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                <span>{lease.paymentReliability ? `${lease.paymentReliability} payment history` : 'No score yet'}</span>
              </li>
              <li className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />
                <span>{maintenanceRequests.length} maintenance request(s) on this unit</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
