'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Search, Clock, CheckCircle2, XCircle, Flag } from 'lucide-react';
import { useMyProperties } from '@/hooks/useProperties';
import type { Property } from '@/lib/api/types';

const STATUS_META: Record<
  Property['moderationStatus'],
  { label: string; icon: typeof Clock; className: string }
> = {
  PENDING_REVIEW: {
    label: 'Pending Review',
    icon: Clock,
    className: 'bg-yellow-100 text-yellow-800',
  },
  APPROVED: { label: 'Approved', icon: CheckCircle2, className: 'bg-green-100 text-green-800' },
  REJECTED: { label: 'Rejected', icon: XCircle, className: 'bg-red-100 text-red-800' },
  FLAGGED: { label: 'Flagged', icon: Flag, className: 'bg-orange-100 text-orange-800' },
};

// Manager-facing counterpart to the landlord's "Portfolio" dashboard (which
// already lists their own properties inline) and the admin moderation
// queue at /admin/properties -- managers previously had no list at all,
// just a bare property COUNT tile on their generic Dashboard.
export default function MyPropertiesPage() {
  const router = useRouter();
  const { data: properties, loading, error } = useMyProperties();
  const [search, setSearch] = useState('');

  const filtered = properties.filter((p) => {
    const term = search.toLowerCase();
    return (
      !term ||
      p.name.toLowerCase().includes(term) ||
      p.address.toLowerCase().includes(term) ||
      p.city.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">My Properties</h1>
        <p className="text-sm text-gray-500">
          {loading
            ? 'Loading…'
            : `${properties.length} propert${properties.length === 1 ? 'y' : 'ies'} under your management`}
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name, address or city…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-gray-200 py-2 pr-4 pl-9 text-sm focus:border-blue-400 focus:ring-1 focus:ring-blue-400 focus:outline-none"
        />
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-xs font-medium tracking-wide text-gray-500 uppercase">
            <tr>
              <th className="px-6 py-3 text-left">Property</th>
              <th className="px-6 py-3 text-left">Units</th>
              <th className="px-6 py-3 text-left">Occupied</th>
              <th className="px-6 py-3 text-left">Status</th>
              <th className="px-6 py-3 text-left">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading &&
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {Array.from({ length: 5 }).map((__, j) => (
                    <td key={j} className="px-6 py-4">
                      <div className="h-4 rounded bg-gray-100" />
                    </td>
                  ))}
                </tr>
              ))}

            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                  {properties.length === 0
                    ? "You aren't managing any properties yet."
                    : 'No properties match your search.'}
                </td>
              </tr>
            )}

            {!loading &&
              filtered.map((property) => {
                const meta = STATUS_META[property.moderationStatus];
                const StatusIcon = meta.icon;
                const occupied = property.units.filter((u) => u.status === 'OCCUPIED').length;
                return (
                  <tr key={property.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                          <Building2 className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{property.name}</p>
                          <p className="text-xs text-gray-500">
                            {property.address}, {property.city}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{property.units.length}</td>
                    <td className="px-6 py-4 text-gray-600">
                      {occupied}/{property.units.length}
                    </td>
                    <td className="px-6 py-4">
                      <div
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.className}`}
                      >
                        <StatusIcon className="h-3.5 w-3.5" />
                        {meta.label}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => router.push(`/dashboard/properties/${property.id}`)}
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>

        {!loading && filtered.length > 0 && (
          <div className="border-t border-gray-100 px-6 py-3 text-xs text-gray-400">
            Showing {filtered.length} of {properties.length} properties
          </div>
        )}
      </div>
    </div>
  );
}
