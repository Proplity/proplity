'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Search,
  Clock,
  CheckCircle2,
  XCircle,
  Flag,
  LayoutGrid,
  List,
  MapPin,
  Users,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
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

const ALL_STATUSES = ['ALL', 'PENDING_REVIEW', 'APPROVED', 'REJECTED'] as const;

export default function MyPropertiesPage() {
  const router = useRouter();
  const { data: properties, loading, error } = useMyProperties();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<(typeof ALL_STATUSES)[number]>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  const filtered = properties.filter((p) => {
    const matchesStatus = statusFilter === 'ALL' || p.moderationStatus === statusFilter;
    const term = search.toLowerCase();
    const matchesSearch =
      !term ||
      p.name.toLowerCase().includes(term) ||
      p.address.toLowerCase().includes(term) ||
      p.city.toLowerCase().includes(term);

    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">My Properties</h1>
        <p className="mt-1 text-sm text-gray-500">
          {loading
            ? 'Loading…'
            : `${properties.length} propert${properties.length === 1 ? 'y' : 'ies'} under your management`}
        </p>
      </div>

      {/* Sticky Compact Filter Toolbar */}
      <div className="sticky top-0 z-30 -mx-6 border-b border-gray-200 bg-white/95 px-6 py-2 shadow-xs backdrop-blur-md transition-all">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Status Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto py-0.5">
            {ALL_STATUSES.map((status) => {
              const isAll = status === 'ALL';
              const label = isAll
                ? `All (${properties.length})`
                : STATUS_META[status as Property['moderationStatus']].label;

              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition-colors ${
                    statusFilter === status
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Search Input & Desktop/Mobile View Switcher */}
          <div className="flex items-center gap-2">
            <div className="relative w-48 sm:w-56 md:w-64">
              <Search className="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search properties…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white py-1 pr-3 pl-8 text-xs shadow-2xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center rounded-lg border border-gray-200 bg-white p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                title="Switch to Card view"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Cards</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  viewMode === 'table'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                title="Switch to Table view"
              >
                <List className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Table</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}

      {/* =================================================================== */}
      {/* 1. CARDS / GRID VIEW (Default)                                      */}
      {/* =================================================================== */}
      {viewMode === 'grid' && (
        <div className="space-y-6">
          {loading && (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse space-y-4 rounded-2xl border border-gray-200 bg-white p-5"
                >
                  <div className="h-6 w-3/4 rounded bg-gray-200" />
                  <div className="h-4 w-1/2 rounded bg-gray-100" />
                  <div className="h-16 rounded-xl bg-gray-50" />
                  <div className="h-8 rounded-lg bg-gray-100" />
                </div>
              ))}
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center text-gray-400">
              {properties.length === 0
                ? "You aren't managing any properties yet."
                : 'No properties match your search.'}
            </div>
          )}

          {!loading && filtered.length > 0 && (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map((property) => {
                const meta = STATUS_META[property.moderationStatus];
                const StatusIcon = meta.icon;
                const occupied = property.units.filter((u) => u.status === 'OCCUPIED').length;

                return (
                  <div
                    key={property.id}
                    className="flex flex-col justify-between rounded-2xl border border-gray-200 bg-white p-5 shadow-xs transition-shadow hover:shadow-md"
                  >
                    <div>
                      {/* Top Badges */}
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.className}`}
                        >
                          <StatusIcon className="h-3 w-3" />
                          {meta.label}
                        </span>

                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            property.isPublished
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {property.isPublished ? 'Published' : 'Unpublished'}
                        </span>
                      </div>

                      {/* Property Identity */}
                      <div className="mb-4 flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                          <Building2 className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="line-clamp-1 text-base font-bold text-gray-900">
                            {property.name}
                          </h3>
                          <p className="mt-0.5 line-clamp-1 flex items-center gap-1 text-xs text-gray-500">
                            <MapPin className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                            {property.address}, {property.city}
                          </p>
                        </div>
                      </div>

                      {/* Units & Occupancy Box */}
                      <div className="mb-4 space-y-2 rounded-xl border border-gray-100 bg-gray-50/80 p-3 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500">Total Units</span>
                          <span className="font-bold text-gray-900">{property.units.length}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500">Occupancy</span>
                          <span className="font-semibold text-gray-700">
                            {occupied} / {property.units.length} occupied
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Button */}
                    <div className="border-t border-gray-100 pt-3">
                      <button
                        type="button"
                        onClick={() => router.push(`/dashboard/properties/${property.id}`)}
                        className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-blue-600 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-blue-700"
                      >
                        <span>View Details</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* 2. TABLE VIEW (Traditional)                                         */}
      {/* =================================================================== */}
      {viewMode === 'table' && (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
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
      )}
    </div>
  );
}
