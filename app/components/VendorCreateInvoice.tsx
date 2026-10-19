import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, Send, AlertCircle } from 'lucide-react';
import { useCreateInvoice } from '@/hooks/useInvoices';
import { useMaintenanceRequest } from '@/hooks/useMaintenanceRequests';
import { useBankAccounts } from '@/hooks/useBankAccounts';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

interface VendorCreateInvoiceProps {
  jobId: string;
}

export function VendorCreateInvoice({ jobId }: VendorCreateInvoiceProps) {
  const router = useRouter();
  const { submit, submitting, error } = useCreateInvoice();
  const { user } = useAuth();
  const { data: job, loading: jobLoading, error: jobError } = useMaintenanceRequest(jobId);
  const { data: bankAccounts } = useBankAccounts();
  const bank = bankAccounts.find((b) => b.isDefault) ?? bankAccounts[0];
  // Sending this invoice closes the job, and a job closes only once the finished work is shown.
  const needsPhotos =
    !!job &&
    job.workflow?.autoCompleteOnInvoice === true &&
    job.workflow?.evidenceRequired === true &&
    ['SUBMITTED', 'SCHEDULED', 'IN_PROGRESS'].includes(job.status) &&
    (job.afterPhotoUrls ?? []).length === 0 &&
    !job.completionProofUrl;
  const [notes, setNotes] = useState('');
  // Starts with one blank row: the vendor itemises their own work (ISS-044).
  const [lineItems, setLineItems] = useState([
    { id: 1, description: '', quantity: 1, rate: 0, amount: 0 },
  ]);
  const completedOn = job?.completedAt
    ? new Date(job.completedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Not marked complete yet';

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      { id: Date.now(), description: '', quantity: 1, rate: 0, amount: 0 },
    ]);
  };

  const removeLineItem = (id: number) => {
    setLineItems(lineItems.filter((item) => item.id !== id));
  };

  const updateLineItem = (id: number, field: string, value: string | number) => {
    setLineItems(
      lineItems.map((item) => {
        if (item.id === id) {
          const updated = { ...item, [field]: value };
          if (field === 'quantity' || field === 'rate') {
            updated.amount = updated.quantity * updated.rate;
          }
          return updated;
        }
        return item;
      }),
    );
  };

  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
  const tax = subtotal * 0.075; // 7.5% VAT
  const total = subtotal + tax;

  const canSubmit = lineItems.some((item) => item.description.trim() && item.amount > 0);

  const handleSubmit = async () => {
    // Invoice has a single amount + one description string, no line-item
    // breakdown in the schema -- the itemized rows are summed into amount
    // and rendered as text into description instead of being lost.
    const description = lineItems
      .filter((item) => item.description)
      .map(
        (item) =>
          `${item.description} — ${item.quantity} x ₦${item.rate.toLocaleString()} = ₦${item.amount.toLocaleString()}`,
      )
      .join('\n');
    const fullDescription = notes.trim() ? `${description}\n\nNotes: ${notes.trim()}` : description;

    try {
      await submit({
        maintenanceRequestId: jobId,
        type: 'MAINTENANCE',
        amount: total,
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        description: fullDescription,
      });
      toast.success('Invoice submitted. The property manager will review it.');
      router.push('/dashboard');
    } catch {
      // error state is already surfaced via the hook's `error`
    }
  };

  return (
    <div className="mx-auto max-w-5xl p-6">
      <Link
        href="/dashboard"
        className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-5 w-5" />
        Back
      </Link>

      <div className="rounded-lg border border-gray-200 bg-white p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="mb-2 text-3xl font-bold">INVOICE</h1>
              <p className="text-sm text-gray-600">For job #{jobId.slice(0, 8)}</p>
              <p className="text-sm text-gray-600">
                Date:{' '}
                {new Date().toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
            <div className="text-right">
              <p className="mb-1 text-sm text-gray-600">Status</p>
              <span className="rounded-full bg-yellow-100 px-3 py-1 text-sm font-medium text-yellow-700">
                Draft
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8">
            {/* From */}
            <div>
              <p className="mb-2 text-sm font-semibold text-gray-600">FROM</p>
              <div className="space-y-1 text-sm">
                <p className="font-semibold">{user?.name}</p>
                {user?.phoneNumber && <p className="text-gray-600">{user.phoneNumber}</p>}
                <p className="text-gray-600">{user?.email}</p>
              </div>
            </div>

            {/* To */}
            <div>
              <p className="mb-2 text-sm font-semibold text-gray-600">BILL TO</p>
              <div className="space-y-1 text-sm">
                <p className="font-semibold">{job?.unit?.property?.name ?? '—'}</p>
                {job?.unit && <p className="text-gray-600">Unit {job.unit.unitNumber}</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Job Details */}
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="mb-1 text-sm font-semibold text-blue-900">Job Details</p>
          <p className="text-sm text-blue-800">
            {jobLoading ? 'Loading job…' : (job?.title ?? 'Job not found')} • Job #
            {jobId.slice(0, 8)}
          </p>
          <p className="text-sm text-blue-800">Completed: {completedOn}</p>
          {jobError && <p className="mt-1 text-sm text-red-700">{jobError}</p>}
        </div>

        {/* Line Items */}
        <div className="mb-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b-2 border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                    Description
                  </th>
                  <th className="w-24 px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                    Qty
                  </th>
                  <th className="w-32 px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                    Rate (₦)
                  </th>
                  <th className="w-32 px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                    Amount (₦)
                  </th>
                  <th className="w-12 px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {lineItems.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                        placeholder="Item description"
                        className="w-full rounded border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) =>
                          updateLineItem(item.id, 'quantity', parseFloat(e.target.value) || 0)
                        }
                        className="w-full rounded border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        value={item.rate}
                        onChange={(e) =>
                          updateLineItem(item.id, 'rate', parseFloat(e.target.value) || 0)
                        }
                        className="w-full rounded border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {item.amount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => removeLineItem(item.id)}
                        className="rounded p-2 text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            onClick={addLineItem}
            className="mt-3 flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            <Plus className="h-4 w-4" />
            Add Line Item
          </button>
        </div>

        {/* Totals */}
        <div className="mb-8 flex justify-end">
          <div className="w-80 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-semibold">₦{subtotal.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">VAT (7.5%)</span>
              <span className="font-semibold">₦{tax.toLocaleString()}</span>
            </div>
            <div className="border-t-2 border-gray-300 pt-3">
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold">Total</span>
                <span className="text-2xl font-bold text-green-600">₦{total.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Details */}
        <div className="mb-8 rounded-lg bg-gray-50 p-4">
          <p className="mb-3 text-sm font-semibold">Payment Details</p>
          {bank ? (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Bank Name</p>
                <p className="font-medium">{bank.bankName}</p>
              </div>
              <div>
                <p className="text-gray-600">Account Name</p>
                <p className="font-medium">{bank.accountName}</p>
              </div>
              <div>
                <p className="text-gray-600">Account Number</p>
                <p className="font-medium">{bank.accountNumber}</p>
              </div>
              <div>
                <p className="text-gray-600">Payment Terms</p>
                <p className="font-medium">Due upon receipt</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-600">
              No bank account is saved on your profile yet. Add payment instructions in the notes
              below so the property manager knows where to pay.
            </p>
          )}
        </div>

        {/* Notes */}
        <div className="mb-8">
          <label className="mb-2 block text-sm font-semibold">Additional Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any additional notes or payment instructions..."
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        {needsPhotos && (
          <div
            role="alert"
            className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Sending this invoice closes the job, so add at least one photo of the finished work
              first.{' '}
              <Link href={`/dashboard/vendor/jobs/${jobId}`} className="font-medium underline">
                Add photos to the job
              </Link>
            </p>
          </div>
        )}

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={submitting || !canSubmit || needsPhotos}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="h-5 w-5" />
            {submitting ? 'Submitting…' : 'Submit Invoice'}
          </button>
          <Link
            href="/dashboard"
            className="flex items-center justify-center rounded-lg border border-gray-300 px-6 py-3 font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Link>
        </div>

        {/* Info */}
        <div className="mt-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <p className="text-sm text-yellow-800">
            <strong>Note:</strong> Once submitted, the property manager can review this invoice
            under their invoices.
          </p>
        </div>
      </div>
    </div>
  );
}
