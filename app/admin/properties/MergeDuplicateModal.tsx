'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { GitMerge, X, Building2, AlertTriangle, CheckCircle2, Loader2, Search } from 'lucide-react';
import { api } from '@/lib/apiClient';
import type { Property } from '@/lib/api/types';

interface MergeDuplicateModalProps {
  sourceProperty: Property;
  allProperties: Property[];
  onClose: () => void;
  onMerged: () => void;
}

export function MergeDuplicateModal({
  sourceProperty,
  allProperties,
  onClose,
  onMerged,
}: MergeDuplicateModalProps) {
  // Matching candidates based on listingHash that are not already merged and not the source itself
  const fingerprintMatches = allProperties.filter(
    (p) =>
      p.id !== sourceProperty.id &&
      !p.mergedIntoId &&
      p.listingHash &&
      p.listingHash === sourceProperty.listingHash,
  );

  const [selectedTargetId, setSelectedTargetId] = useState<string>(fingerprintMatches[0]?.id ?? '');
  const [searchTerm, setSearchTerm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Available properties for selection: fingerprint matches first, or filtered search
  const displayedCandidates = searchTerm.trim()
    ? allProperties.filter(
        (p) =>
          p.id !== sourceProperty.id &&
          !p.mergedIntoId &&
          (p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.city.toLowerCase().includes(searchTerm.toLowerCase())),
      )
    : fingerprintMatches.length > 0
      ? fingerprintMatches
      : allProperties.filter((p) => p.id !== sourceProperty.id && !p.mergedIntoId);

  const targetProperty = allProperties.find((p) => p.id === selectedTargetId);

  const handleMerge = async () => {
    if (!selectedTargetId) {
      setError('Please select a target canonical property to merge into.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await api.properties.merge(sourceProperty.id, selectedTargetId);
      toast.success(
        `Merged "${sourceProperty.name}" into "${targetProperty?.name ?? 'canonical listing'}"`,
      );
      onMerged();
      onClose();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : 'Failed to merge property';
      setError(msg || 'Failed to merge property');
      toast.error('Merge failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
              <GitMerge className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Merge Duplicate Listing</h3>
              <p className="text-xs text-gray-500">
                Resolve duplicate property submissions into a single canonical listing
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-700">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Source property banner */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
            <p className="text-xs font-semibold tracking-wider text-amber-800 uppercase">
              Duplicate to be merged (Will be unpublished & marked rejected)
            </p>
            <div className="mt-2 flex items-start gap-3">
              <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
              <div>
                <p className="font-semibold text-gray-900">{sourceProperty.name}</p>
                <p className="text-xs text-gray-600">
                  {sourceProperty.address}, {sourceProperty.city} · {sourceProperty.units.length}{' '}
                  unit
                  {sourceProperty.units.length === 1 ? '' : 's'}
                </p>
                <p className="mt-1 text-[11px] text-gray-500">
                  Managed by: {sourceProperty.manager?.name ?? 'Unassigned'} · Created:{' '}
                  {new Date(sourceProperty.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          {/* Target selection */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-semibold text-gray-800">
                Select Canonical Property (To keep active)
              </label>
              {fingerprintMatches.length > 0 && (
                <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[11px] font-medium text-purple-800">
                  {fingerprintMatches.length} matching address fingerprint
                </span>
              )}
            </div>

            {fingerprintMatches.length === 0 && (
              <div className="relative mb-3">
                <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search properties by name or address…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 py-2 pr-3 pl-9 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            )}

            <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
              {displayedCandidates.length === 0 ? (
                <p className="py-6 text-center text-xs text-gray-400">
                  No candidate properties found.
                </p>
              ) : (
                displayedCandidates.map((candidate) => {
                  const isSelected = candidate.id === selectedTargetId;
                  const isFingerprintMatch = candidate.listingHash === sourceProperty.listingHash;

                  return (
                    <div
                      key={candidate.id}
                      onClick={() => setSelectedTargetId(candidate.id)}
                      className={`flex cursor-pointer items-start justify-between rounded-xl border p-3.5 transition-colors ${
                        isSelected
                          ? 'border-purple-600 bg-purple-50/50 ring-1 ring-purple-600'
                          : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="radio"
                          name="targetProperty"
                          checked={isSelected}
                          onChange={() => setSelectedTargetId(candidate.id)}
                          className="mt-1 h-4 w-4 text-purple-600 focus:ring-purple-500"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-gray-900">{candidate.name}</p>
                            {isFingerprintMatch && (
                              <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium text-purple-700">
                                Same address
                              </span>
                            )}
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                candidate.moderationStatus === 'APPROVED'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-yellow-100 text-yellow-700'
                              }`}
                            >
                              {candidate.moderationStatus.replace('_', ' ')}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600">
                            {candidate.address}, {candidate.city} · {candidate.units.length} unit
                            {candidate.units.length === 1 ? '' : 's'}
                          </p>
                          <p className="mt-1 text-[11px] text-gray-400">
                            Manager: {candidate.manager?.name ?? 'None'} · Created:{' '}
                            {new Date(candidate.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      {isSelected && <CheckCircle2 className="h-5 w-5 shrink-0 text-purple-600" />}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Explanation Banner */}
          <div className="space-y-1 rounded-lg bg-gray-50 p-3.5 text-xs text-gray-600">
            <p className="font-medium text-gray-800">What happens when you merge:</p>
            <p>• The duplicate listing will be set to unpublished and marked as rejected.</p>
            <p>
              • It will be linked to the canonical property via{' '}
              <code className="text-purple-700">mergedIntoId</code>.
            </p>
            <p>• Prospective tenants and search queries will only see the canonical listing.</p>
            <p>• You can undo this merge at any time from the admin properties list.</p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleMerge}
            disabled={submitting || !selectedTargetId}
            className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-5 py-2 text-sm font-semibold text-white shadow-xs hover:bg-purple-700 disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Merging…
              </>
            ) : (
              'Confirm Merge'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
