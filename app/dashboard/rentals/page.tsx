'use client';

import { useRouter } from 'next/navigation';
import { Building2, Home, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { useRents } from '@/hooks/useRents';
import type { Rent } from '@/lib/api/types';
import { perFrequency } from '@/lib/paymentFrequency';

const STATUS_META: Record<string, { label: string; icon: typeof Clock; className: string }> = {
  ACTIVE: { label: 'Active', icon: CheckCircle2, className: 'bg-green-100 text-green-800' },
  PENDING: { label: 'Pending', icon: Clock, className: 'bg-yellow-100 text-yellow-800' },
  EXPIRED: { label: 'Expired', icon: XCircle, className: 'bg-gray-100 text-gray-600' },
  TERMINATED: { label: 'Terminated', icon: XCircle, className: 'bg-red-100 text-red-700' },
};

// Tenants previously had no way to see anything beyond their single current
// rent (TenantDashboard's useActiveRent) -- no record of past tenancies
// once a rent expired/terminated, or renewed into a new rent row.
export default function MyRentalsPage() {
  const router = useRouter();
  // No status filter -- useRents is already server-scoped to "the caller's
  // own rents" for a tenant, so this returns every rent they've ever had.
  const { data: rents, loading, error } = useRents();

  const sorted = [...rents].sort(
    (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime(),
  );

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">My Rentals</h1>
        <p className="text-sm text-gray-500">
          {loading ? 'Loading…' : `${rents.length} rent${rents.length === 1 ? '' : 's'} on record`}
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-lg border border-gray-200 bg-gray-50"
            />
          ))}
        </div>
      )}

      {!loading && sorted.length === 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center text-gray-400">
          <Home className="mx-auto mb-3 h-8 w-8 text-gray-300" />
          You haven&apos;t rented a property yet. Browse listings to get started.
        </div>
      )}

      <div className="space-y-3">
        {sorted.map((rent: Rent) => {
          const meta = STATUS_META[rent.status] ?? STATUS_META.EXPIRED;
          const StatusIcon = meta.icon;
          const property = rent.unit?.property;
          return (
            <button
              key={rent.id}
              // /dashboard/tenants/[id] is the manager-facing rent console
              // (Terminate/Renew/Activate) -- a tenant viewing their own
              // rental history goes to the property page instead, which
              // already branches to a read-only view for the tenant role.
              onClick={() => property?.id && router.push(`/dashboard/properties/${property.id}`)}
              disabled={!property?.id}
              className="w-full rounded-lg border border-gray-200 bg-white p-5 text-left hover:bg-gray-50 disabled:cursor-default disabled:hover:bg-white"
            >
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                <div className="flex min-w-0 flex-1 basis-48 items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100">
                    <Building2 className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {property?.name ?? 'Property'}
                      {rent.unit?.unitNumber ? ` — Unit ${rent.unit.unitNumber}` : ''}
                    </p>
                    <p className="text-sm text-gray-500">{property?.address}</p>
                    <p className="mt-1 text-xs text-gray-400">
                      {new Date(rent.startDate).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}{' '}
                      –{' '}
                      {new Date(rent.endDate).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.className}`}
                  >
                    <StatusIcon className="h-3.5 w-3.5" />
                    {meta.label}
                  </div>
                  <p className="text-sm font-semibold text-gray-900">
                    ₦{rent.rentAmount.toLocaleString()}/{perFrequency(rent.paymentFrequency)}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
