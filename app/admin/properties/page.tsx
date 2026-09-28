'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Search, ArrowLeft, Clock, CheckCircle2, XCircle, Flag } from 'lucide-react';
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

const ALL_STATUSES = ['ALL', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'FLAGGED'] as const;

export default function AdminPropertiesPage() {
  const router = useRouter();
  const { data: properties, loading, error } = useMyProperties();
  const [search, setSearch] = useState('');
  // Pending listings are the ones an admin actually needs to act on -- default
  // to that filter instead of "ALL" so the queue this page exists for is
  // what's visible the moment it loads.
  const [statusFilter, setStatusFilter] = useState<(typeof ALL_STATUSES)[number]>('PENDING_REVIEW');

  const filtered = properties.filter((p) => {
    const matchesStatus = statusFilter === 'ALL' || p.moderationStatus === statusFilter;
    const term = search.toLowerCase();
    const matchesSearch =
      !term ||
      p.name.toLowerCase().includes(term) ||
      p.address.toLowerCase().includes(term) ||
      p.city.toLowerCase().includes(term) ||
      (p.manager?.name.toLowerCase().includes(term) ?? false);
    return matchesStatus && matchesSearch;
  });

  const statusCounts = ALL_STATUSES.slice(1).reduce<Record<string, number>>((acc, status) => {
    acc[status] = properties.filter((p) => p.moderationStatus === status).length;
    return acc;
  }, {});

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push('/admin')}
          className="flex items-center gap-1 rounded-lg p-2 text-gray-500 hover:bg-gray-100"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-2xl font-semibold">Properties</h1>
          <p className="text-sm text-gray-500">
            {loading ? 'Loading…' : `${properties.length} listings across the platform`}
          </p>
        </div>
      </div>

      {/* Status summary chips */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setStatusFilter('ALL')}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            statusFilter === 'ALL'
              ? 'bg-blue-600 text-white'
              : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          All ({properties.length})
        </button>
        {(ALL_STATUSES.slice(1) as Property['moderationStatus'][]).map((status) => {
          const meta = STATUS_META[status];
          return (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                statusFilter === status
                  ? 'bg-blue-600 text-white'
                  : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {meta.label} ({statusCounts[status] ?? 0})
            </button>
          );
        })}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name, address or manager…"
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
              <th className="px-6 py-3 text-left">Manager</th>
              <th className="px-6 py-3 text-left">Units</th>
              <th className="px-6 py-3 text-left">Status</th>
              <th className="px-6 py-3 text-left">Submitted</th>
              <th className="px-6 py-3 text-left">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading &&
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {Array.from({ length: 6 }).map((__, j) => (
                    <td key={j} className="px-6 py-4">
                      <div className="h-4 rounded bg-gray-100" />
                    </td>
                  ))}
                </tr>
              ))}

            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                  {statusFilter === 'PENDING_REVIEW'
                    ? 'Nothing is waiting on review right now.'
                    : 'No properties match your filters.'}
                </td>
              </tr>
            )}

            {!loading &&
              filtered.map((property) => {
                const meta = STATUS_META[property.moderationStatus];
                const StatusIcon = meta.icon;
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
                    <td className="px-6 py-4 text-gray-600">
                      {property.manager?.name ?? <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-6 py-4 text-gray-600">{property.units.length}</td>
                    <td className="px-6 py-4">
                      <div
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.className}`}
                      >
                        <StatusIcon className="h-3.5 w-3.5" />
                        {meta.label}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {new Date(property.createdAt).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => router.push(`/dashboard/properties/${property.id}`)}
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        {property.moderationStatus === 'PENDING_REVIEW' ? 'Review' : 'View'}
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
