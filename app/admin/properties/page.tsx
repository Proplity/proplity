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
  Sparkles,
  LayoutGrid,
  List,
  ExternalLink,
  Globe,
  Lock,
  Calendar,
  User,
  ShieldCheck,
} from 'lucide-react';
import { useMyProperties } from '@/hooks/useProperties';
import { api } from '@/lib/apiClient';
import { ConfirmDialog } from '@/app/components/ConfirmDialog';
import { MergeDuplicateModal } from './MergeDuplicateModal';
import { PropertyReviewDrawer } from './PropertyReviewDrawer';
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

export function getApprovedDate(property: Property): string | null {
  if (property.moderationStatus !== 'APPROVED') return null;
  const match = property.moderationNotes?.match(/\[APPROVED:([^\]]+)\]/);
  if (match && match[1]) {
    try {
      return new Date(match[1]).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {}
  }
  if (property.updatedAt) {
    try {
      return new Date(property.updatedAt).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {}
  }
  return null;
}

export default function AdminPropertiesPage() {
  const router = useRouter();
  const { data: properties, loading, error, refetch } = useMyProperties();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<(typeof ALL_STATUSES)[number]>('PENDING_REVIEW');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [mergeCandidate, setMergeCandidate] = useState<Property | null>(null);
  const [unmergingId, setUnmergingId] = useState<string | null>(null);
  const [unmergeTargetProperty, setUnmergeTargetProperty] = useState<Property | null>(null);

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
      (p.manager?.name.toLowerCase().includes(term) ?? false) ||
      (p.landlord?.name.toLowerCase().includes(term) ?? false);

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

  const handleUnmerge = (property: Property) => {
    setUnmergeTargetProperty(property);
  };

  const handleConfirmUnmerge = async () => {
    if (!unmergeTargetProperty) return;
    setUnmergingId(unmergeTargetProperty.id);
    try {
      await api.properties.unmerge(unmergeTargetProperty.id);
      toast.success(`Unmerged "${unmergeTargetProperty.name}" -- it is now back in pending review.`);
      setUnmergeTargetProperty(null);
      refetch();
    } catch {
      toast.error('Failed to undo merge. Please try again.');
    } finally {
      setUnmergingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-7xl p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <button
            onClick={() => router.push('/admin')}
            className="mb-2 flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Properties & Moderation</h1>
            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
              {properties.length} platform listings
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Review submissions, audit compliance, verify ownership, and publish listings.
          </p>
        </div>
      </div>

      {/* Sticky Compact Filter Toolbar */}
      <div className="sticky top-0 z-30 -mx-6 px-6 py-2 bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-xs transition-all">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Status Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto py-0.5">
            {ALL_STATUSES.map((status) => {
              const isAll = status === 'ALL';
              const isMerged = status === 'MERGED';
              const label = isAll
                ? `All (${properties.length})`
                : isMerged
                  ? 'Merged'
                  : STATUS_META[status as Property['moderationStatus']].label;

              return (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition-colors ${
                    statusFilter === status
                      ? isMerged
                        ? 'bg-purple-700 text-white'
                        : 'bg-blue-600 text-white shadow-xs'
                      : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {label} {!isAll && `(${statusCounts[status] ?? 0})`}
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
                placeholder="Search listings…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white py-1 pr-3 pl-8 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none shadow-2xs"
              />
            </div>

            <div className="flex items-center rounded-lg border border-gray-200 bg-white p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
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
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
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

      {/* Error alert */}
      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}

      {/* =================================================================== */}
      {/* 1. CARDS / GRID VIEW (Modern default)                               */}
      {/* =================================================================== */}
      {viewMode === 'grid' && (
        <div>
          {loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
                  <div className="h-6 w-3/4 rounded bg-gray-100" />
                  <div className="h-4 w-1/2 rounded bg-gray-100" />
                  <div className="h-20 rounded-xl bg-gray-50" />
                  <div className="h-8 rounded-lg bg-gray-100" />
                </div>
              ))}
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center text-gray-400">
              {statusFilter === 'PENDING_REVIEW'
                ? 'Nothing is waiting on review right now.'
                : statusFilter === 'MERGED'
                  ? 'No merged properties found.'
                  : 'No properties match your filters.'}
            </div>
          )}

          {!loading && filtered.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((property) => {
                const meta = STATUS_META[property.moderationStatus];
                const StatusIcon = meta.icon;
                const isMerged = Boolean(property.mergedIntoId);
                const isEdited = Boolean(property.moderationNotes?.includes('[EDITED]'));
                const approvedDate = getApprovedDate(property);

                const publicUnitsCount = property.units.filter(
                  (u) => !u.amenities?.includes('visibility:private'),
                ).length;
                const privateUnitsCount = property.units.length - publicUnitsCount;

                return (
                  <div
                    key={property.id}
                    className="flex flex-col justify-between rounded-2xl border border-gray-200 bg-white p-5 shadow-xs hover:shadow-md transition-shadow"
                  >
                    <div>
                      {/* Status Badges Row */}
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.className}`}
                          >
                            <StatusIcon className="h-3 w-3" />
                            {meta.label}
                          </span>

                          {isEdited && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 border border-amber-300">
                              <Sparkles className="h-3 w-3 text-amber-700" />
                              Edited
                            </span>
                          )}

                          {isDuplicate(property) && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-800">
                              <Copy className="h-3 w-3" /> Duplicate
                            </span>
                          )}
                        </div>

                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            property.isPublished
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {property.isPublished ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                          {property.isPublished ? 'Published' : 'Unpublished'}
                        </span>
                      </div>

                      {/* Property Title & Address */}
                      <div className="flex items-start gap-3 mb-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                          <Building2 className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold text-gray-900 text-base line-clamp-1">
                            {property.name}
                          </h3>
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                            {property.address}, {property.city}
                          </p>
                        </div>
                      </div>

                      {/* Timeline: Submitted & Approved Dates */}
                      <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-50 p-3 text-xs mb-4">
                        <div>
                          <p className="text-gray-400 text-[10px] uppercase font-bold tracking-wider mb-0.5">
                            Submitted
                          </p>
                          <p className="font-medium text-gray-700">
                            {new Date(property.createdAt).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-400 text-[10px] uppercase font-bold tracking-wider mb-0.5">
                            Approved
                          </p>
                          <p className="font-medium text-gray-700">
                            {approvedDate ?? <span className="text-gray-400">—</span>}
                          </p>
                        </div>
                      </div>

                      {/* Ownership Details */}
                      <div className="space-y-1.5 text-xs text-gray-600 border-t border-gray-100 pt-3 mb-4">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400">Landlord:</span>
                          <span className="font-medium text-gray-900 truncate max-w-[180px]">
                            {property.landlord?.name ?? '—'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400">Manager:</span>
                          <span className="font-medium text-gray-900 truncate max-w-[180px]">
                            {property.manager?.name ?? '—'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400">Units:</span>
                          <span className="font-medium text-gray-900">
                            {property.units.length} total
                            {privateUnitsCount > 0
                              ? ` (${publicUnitsCount} public · ${privateUnitsCount} private)`
                              : ' (all public)'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Card Actions Footer */}
                    <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                      <button
                        onClick={() => setSelectedProperty(property)}
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-blue-600 bg-blue-50 py-2.5 text-xs font-bold text-blue-700 hover:bg-blue-100 active:scale-[0.99] transition-all"
                      >
                        {property.moderationStatus === 'PENDING_REVIEW' && !isMerged
                          ? 'Review'
                          : 'Review Details'}
                      </button>

                      <button
                        onClick={() => router.push(`/admin/properties/${property.id}`)}
                        className="flex items-center justify-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 active:scale-[0.99] transition-all"
                        title="Open Full View"
                      >
                        Full View
                        <ExternalLink className="h-3 w-3 text-gray-400" />
                      </button>

                      {isMerged ? (
                        <button
                          onClick={() => handleUnmerge(property)}
                          disabled={unmergingId === property.id}
                          className="rounded-xl border border-amber-300 bg-amber-50 p-2 text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                          title="Undo Merge"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                      ) : isDuplicate(property) ? (
                        <button
                          onClick={() => setMergeCandidate(property)}
                          className="rounded-xl border border-purple-300 bg-purple-50 p-2 text-purple-800 hover:bg-purple-100"
                          title="Merge Duplicate"
                        >
                          <GitMerge className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* 2. TABLE VIEW (Alternate tabular format)                            */}
      {/* =================================================================== */}
      {viewMode === 'table' && (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-xs">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50/80 text-xs font-semibold tracking-wider text-gray-500 uppercase">
              <tr>
                <th className="px-6 py-3.5 text-left">Property</th>
                <th className="px-6 py-3.5 text-left">Landlord</th>
                <th className="px-6 py-3.5 text-left">Manager</th>
                <th className="px-6 py-3.5 text-left">Units</th>
                <th className="px-6 py-3.5 text-left">Status</th>
                <th className="px-6 py-3.5 text-left">Submitted</th>
                <th className="px-6 py-3.5 text-left">Approved</th>
                <th className="px-6 py-3.5 text-left">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 8 }).map((__, j) => (
                      <td key={j} className="px-6 py-4">
                        <div className="h-4 rounded bg-gray-100" />
                      </td>
                    ))}
                  </tr>
                ))}

              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-400">
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
                  const isEdited = Boolean(property.moderationNotes?.includes('[EDITED]'));
                  const approvedDate = getApprovedDate(property);

                  return (
                    <tr key={property.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                            <Building2 className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 flex items-center gap-2">
                              {property.name}
                              {isEdited && (
                                <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-200">
                                  <Sparkles className="h-2.5 w-2.5" />
                                  Edited
                                </span>
                              )}
                              {isDuplicate(property) && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-800">
                                  <Copy className="h-3 w-3" />
                                  Duplicate
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-gray-500">
                              {property.address}, {property.city}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-700">
                        {property.landlord?.name ?? <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-6 py-4 text-gray-700">
                        {property.manager?.name ?? <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-6 py-4 text-gray-600 font-medium">{property.units.length}</td>
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
                      <td className="px-6 py-4 text-gray-500 text-xs">
                        {new Date(property.createdAt).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-6 py-4 text-gray-600 text-xs font-medium">
                        {approvedDate ?? <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSelectedProperty(property)}
                            className="rounded-lg border border-blue-600 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 transition-colors"
                          >
                            {property.moderationStatus === 'PENDING_REVIEW' && !isMerged
                              ? 'Review'
                              : 'View'}
                          </button>

                          <button
                            onClick={() => router.push(`/admin/properties/${property.id}`)}
                            className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                            title="Full View"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </button>

                          {isMerged ? (
                            <button
                              onClick={() => handleUnmerge(property)}
                              disabled={unmergingId === property.id}
                              className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                              title="Undo merge"
                            >
                              <RotateCcw className="h-3 w-3" />
                            </button>
                          ) : isDuplicate(property) ? (
                            <button
                              onClick={() => setMergeCandidate(property)}
                              className="rounded-lg border border-purple-300 bg-purple-50 px-2.5 py-1.5 text-xs font-medium text-purple-800 hover:bg-purple-100"
                              title="Merge duplicate"
                            >
                              <GitMerge className="h-3 w-3" />
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
            <div className="border-t border-gray-100 px-6 py-3.5 text-xs text-gray-400">
              Showing {filtered.length} of {properties.length} properties
            </div>
          )}
        </div>
      )}

      {/* Review Slide-Over Drawer Popup */}
      {selectedProperty && (
        <PropertyReviewDrawer
          property={selectedProperty}
          onClose={() => setSelectedProperty(null)}
          onUpdated={() => {
            refetch();
          }}
        />
      )}

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

      <ConfirmDialog
        open={Boolean(unmergeTargetProperty)}
        title="Undo Merge?"
        description={`Undo merge for "${unmergeTargetProperty?.name}"? The listing will return to pending review.`}
        confirmLabel="Undo Merge"
        cancelLabel="Keep Merged"
        variant="warning"
        isLoading={Boolean(unmergingId)}
        onCancel={() => setUnmergeTargetProperty(null)}
        onConfirm={handleConfirmUnmerge}
      />
    </div>
  );
}
