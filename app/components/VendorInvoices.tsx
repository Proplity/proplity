import Link from 'next/link';
import { useInvoices } from '@/hooks/useInvoices';
import type { Invoice } from '@/lib/api/types';

const STATUS_LABEL: Record<Invoice['status'], { text: string; cls: string }> = {
  UNPAID: { text: 'Awaiting payment', cls: 'bg-yellow-100 text-yellow-700' },
  PARTIALLY_PAID: { text: 'Part paid', cls: 'bg-blue-100 text-blue-700' },
  PAID: { text: 'Paid', cls: 'bg-green-100 text-green-700' },
  OVERDUE: { text: 'Overdue', cls: 'bg-red-100 text-red-700' },
  CANCELLED: { text: 'Cancelled', cls: 'bg-gray-100 text-gray-600' },
};

const naira = (n: number) => `₦${n.toLocaleString()}`;

// The vendor's own invoices (GET /invoices is already scoped to jobs assigned
// to them). New invoices are created from a job, so this page is the list and
// the job page is where one starts.
export function VendorInvoices() {
  const { data: invoices, loading, error } = useInvoices();
  const outstanding = invoices
    .filter((i) => i.status !== 'PAID' && i.status !== 'CANCELLED')
    .reduce((sum, i) => sum + i.amount, 0);

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-1 text-2xl font-bold">Invoices</h1>
      <p className="mb-6 text-sm text-gray-600">
        Invoices you have sent for completed jobs. To bill a new job, open it under{' '}
        <Link href="/dashboard" className="text-blue-600 underline">
          My Jobs
        </Link>{' '}
        and choose Mark Complete &amp; Create Invoice.
      </p>

      {error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {!loading && invoices.length > 0 && (
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-600">Outstanding</p>
          <p className="text-2xl font-bold">{naira(outstanding)}</p>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading invoices…</p>
      ) : invoices.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
          <p className="font-medium">No invoices yet</p>
          <p className="mt-1 text-sm text-gray-600">
            When you finish a job and create an invoice, it will appear here.
          </p>
          <Link
            href="/dashboard"
            className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Go to My Jobs
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
          {invoices.map((inv) => {
            const status = STATUS_LABEL[inv.status];
            return (
              <li key={inv.id} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="font-medium">{inv.invoiceNumber}</p>
                  <p className="truncate text-sm text-gray-600">
                    {inv.description?.split('\n')[0] ?? 'Maintenance invoice'}
                  </p>
                  <p className="text-xs text-gray-500">
                    Sent {new Date(inv.createdAt).toLocaleDateString('en-US')}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-semibold">{naira(inv.amount)}</p>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.cls}`}>
                    {status.text}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
