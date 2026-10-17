'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Building2,
  Search,
  ArrowLeft,
  Clock,
  CheckCircle2,
  XCircle,
  Flag,
  Copy,
  GitMerge,
  RotateCcw,
} from 'lucide-react';
import { useMyProperties } from '@/hooks/useProperties';
import { api } from '@/lib/apiClient';
import { MergeDuplicateModal } from './MergeDuplicateModal';
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

const ALL_STATUSES = [
  'ALL',
  'PENDING_REVIEW',
  'APPROVED',
  'REJECTED',
  'FLAGGED',
  'MERGED',
] as const;

export default function AdminPropertiesPage() {
  const router = useRouter();
  const { data: properties, loading, error, refetch } = useMyProperties();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<(typeof ALL_STATUSES)[number]>('PENDING_REVIEW');
  const [mergeCandidate, setMergeCandidate] = useState<Property | null>(null);
  const [unmergingId, setUnmergingId] = useState<string | null>(null);

  // ISS-025: listings that share an address fingerprint with another live listing.
  // Merged-away ones are excluded from the active duplicate groups.
  const duplicateCounts = properties.reduce<Record<string, number>>((acc, p) => {
    if (p.listingHash && !p.mergedIntoId) {
      acc[p.listingHash] = (acc[p.listingHash] ?? 0) + 1;
    }
    return acc;
  }, {});

  const isDuplicate = (p: Property) =>
    !p.mergedIntoId && !!p.listingHash && duplicateCounts[p.listingHash] > 1;

  const filtered = properties.filter((p) => {
    let matchesStatus = true;
    if (statusFilter === 'MERGED') {
      matchesStatus = Boolean(p.mergedIntoId);
    } else if (statusFilter !== 'ALL') {
      matchesStatus = !p.mergedIntoId && p.moderationStatus === statusFilter;
    }

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
    if (status === 'MERGED') {
      acc[status] = properties.filter((p) => Boolean(p.mergedIntoId)).length;
    } else {
      acc[status] = properties.filter(
        (p) => !p.mergedIntoId && p.moderationStatus === status,
      ).length;
    }
    return acc;
  }, {});

  const handleUnmerge = async (property: Property) => {
    if (!confirm(`Undo merge for "${property.name}"? The listing will return to pending review.`)) {
      return;
    }
    setUnmergingId(property.id);
    try {
      await api.properties.unmerge(property.id);
      toast.success(`Merge undone for "${property.name}"`);
      refetch();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : 'Failed to undo merge';
      toast.error(msg || 'Failed to undo merge');
    } finally {
      setUnmergingId(null);
    }
  };

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
        {ALL_STATUSES.slice(1).map((status) => {
          const isMerged = status === 'MERGED';
          const label = isMerged
            ? 'Merged'
            : STATUS_META[status as Property['moderationStatus']].label;
          return (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                statusFilter === status
                  ? isMerged
                    ? 'bg-purple-700 text-white'
                    : 'bg-blue-600 text-white'
                  : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {label} ({statusCounts[status] ?? 0})
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

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
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
                    : statusFilter === 'MERGED'
                      ? 'No merged properties found.'
                      : 'No properties match your filters.'}
                </td>
              </tr>
            )}

            {!loading &&
              filtered.map((property) => {
                const meta = STATUS_META[property.moderationStatus];
                const StatusIcon = meta.icon;
                const isMerged = Boolean(property.mergedIntoId);

                return (
                  <tr key={property.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                          <Building2 className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {property.name}
                            {isDuplicate(property) && (
                              <span
                                className="ml-2 inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800"
                                title="Another listing has the same address and city"
                              >
                                <Copy className="h-3 w-3" />
                                Possible duplicate
                              </span>
                            )}
                            {isMerged && (
                              <span
                                className="ml-2 inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700"
                                title={
                                  property.mergedInto
                                    ? `Merged into ${property.mergedInto.name}`
                                    : 'Merged listing'
                                }
                              >
                                <GitMerge className="h-3 w-3 text-purple-600" />
                                Merged
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-gray-500">
                            {property.address}, {property.city}
                            {isMerged && property.mergedInto && (
                              <span className="text-purple-600">
                                {' '}
                                · Merged into: {property.mergedInto.name}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {property.manager?.name ?? <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-6 py-4 text-gray-600">{property.units.length}</td>
                    <td className="px-6 py-4">
                      {isMerged ? (
                        <div className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-800">
                          <GitMerge className="h-3.5 w-3.5" />
                          Merged
                        </div>
                      ) : (
                        <div
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.className}`}
                        >
                          <StatusIcon className="h-3.5 w-3.5" />
                          {meta.label}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {new Date(property.createdAt).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => router.push(`/admin/properties/${property.id}`)}
                          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                        >
                          {property.moderationStatus === 'PENDING_REVIEW' && !isMerged
                            ? 'Review'
                            : 'View'}
                        </button>
                        {isMerged ? (
                          <button
                            onClick={() => handleUnmerge(property)}
                            disabled={unmergingId === property.id}
                            className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                            title="Undo merge and return listing to pending review"
                          >
                            <RotateCcw className="h-3 w-3" />
                            {unmergingId === property.id ? 'Undoing…' : 'Undo Merge'}
                          </button>
                        ) : isDuplicate(property) ? (
                          <button
                            onClick={() => setMergeCandidate(property)}
                            className="inline-flex items-center gap-1 rounded-lg border border-purple-300 bg-purple-50 px-2.5 py-1.5 text-xs font-medium text-purple-800 hover:bg-purple-100"
                            title="Merge this duplicate listing into a canonical property"
                          >
                            <GitMerge className="h-3 w-3" />
                            Merge
                          </button>
                        ) : null}
                      </div>
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

      {/* Merge Duplicate Modal */}
      {mergeCandidate && (
        <MergeDuplicateModal
          sourceProperty={mergeCandidate}
          allProperties={properties}
          onClose={() => setMergeCandidate(null)}
          onMerged={() => {
            setMergeCandidate(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}
