'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  X,
  ExternalLink,
  Building2,
  User,
  Mail,
  Phone,
  Clock,
  CheckCircle2,
  XCircle,
  Calendar,
  Sparkles,
  Globe,
  Lock,
  ShieldCheck,
  Send,
} from 'lucide-react';
import { api } from '@/lib/apiClient';
import type { Property } from '@/lib/api/types';

interface PropertyReviewDrawerProps {
  property: Property;
  onClose: () => void;
  onUpdated: () => void;
}

export function PropertyReviewDrawer({ property, onClose, onUpdated }: PropertyReviewDrawerProps) {
  const router = useRouter();
  const [moderationNotes, setModerationNotes] = useState(
    property.moderationNotes?.replace(/\[(APPROVED|EDITED)[^\]]*\]\s*/g, '').trim() || '',
  );
  const [submitting, setSubmitting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [approvingUnitId, setApprovingUnitId] = useState<string | null>(null);

  const handleApproveUnit = async (unitId: string) => {
    setApprovingUnitId(unitId);
    try {
      await api.properties.updateUnit(property.id, unitId, { action: 'APPROVE' });
      toast.success('Unit approved successfully!');
      onUpdated();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to approve unit';
      toast.error(message);
    } finally {
      setApprovingUnitId(null);
    }
  };

  const isApproved = property.moderationStatus === 'APPROVED';
  const isPending = property.moderationStatus === 'PENDING_REVIEW';
  const isRejected = property.moderationStatus === 'REJECTED';
  const isEdited = Boolean(property.moderationNotes?.includes('[EDITED]'));

  // Extract approval date if present
  let approvedDateStr: string | null = null;
  if (isApproved) {
    const match = property.moderationNotes?.match(/\[APPROVED:([^\]]+)\]/);
    if (match && match[1]) {
      try {
        approvedDateStr = new Date(match[1]).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
      } catch {}
    }
    if (!approvedDateStr && property.updatedAt) {
      approvedDateStr = new Date(property.updatedAt).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    }
  }

  const handleModerate = async (status: 'APPROVED' | 'REJECTED') => {
    setSubmitting(true);
    try {
      await api.properties.moderate(property.id, {
        status,
        moderationNotes: moderationNotes.trim() || undefined,
      });
      toast.success(
        status === 'APPROVED'
          ? `"${property.name}" approved successfully.`
          : `"${property.name}" listing marked as rejected.`,
      );
      onUpdated();
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Moderation action failed';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleTogglePublish = async () => {
    setPublishing(true);
    try {
      await api.properties.setPublished(property.id, !property.isPublished);
      toast.success(
        property.isPublished
          ? `Listing unpublished from public marketplace.`
          : `Listing published live on public marketplace!`,
      );
      onUpdated();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Publish toggle failed';
      toast.error(message);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <>
      {/* Backdrop with Click-Outside to Close */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer: Right-side on Desktop, Down-side on Mobile */}
      <aside
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[88vh] flex-col rounded-t-2xl bg-white shadow-2xl transition-transform md:inset-y-0 md:right-0 md:left-auto md:h-full md:max-h-full md:w-[540px] md:rounded-none"
        aria-label="Property Review Drawer"
      >
        {/* Drawer Header */}
        <div className="flex items-start justify-between border-b border-gray-200 p-5 md:p-6">
          <div className="pr-4">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  isApproved
                    ? 'bg-green-100 text-green-800'
                    : isRejected
                      ? 'bg-red-100 text-red-800'
                      : 'bg-yellow-100 text-yellow-800'
                }`}
              >
                {isApproved ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : isRejected ? (
                  <XCircle className="h-3.5 w-3.5" />
                ) : (
                  <Clock className="h-3.5 w-3.5" />
                )}
                {property.moderationStatus.replace(/_/g, ' ')}
              </span>

              {isEdited && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
                  <Sparkles className="h-3 w-3 text-amber-700" />
                  Edited by Landlord
                </span>
              )}

              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  property.isPublished ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700'
                }`}
              >
                {property.isPublished ? (
                  <>
                    <Globe className="h-3 w-3" /> Published
                  </>
                ) : (
                  <>
                    <Lock className="h-3 w-3" /> Unpublished
                  </>
                )}
              </span>
            </div>
            <h2 className="line-clamp-1 text-xl font-bold text-gray-900">{property.name}</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              {property.address}, {property.city}
              {property.state ? `, ${property.state}` : ''}
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close review popup"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 space-y-6 overflow-y-auto p-5 md:p-6">
          {/* Edited Banner */}
          {isEdited && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-4">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <div className="space-y-1 text-xs text-amber-900">
                  <p className="font-semibold">Listing was edited and resubmitted by Landlord</p>
                  <p className="text-amber-800">
                    The landlord updated property specs or photos. Please review the updated details
                    before re-approving for public marketplace discovery.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Timeline & Metadata */}
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-gray-100 bg-gray-50/80 p-4 text-xs">
            <div>
              <p className="mb-1 flex items-center gap-1 text-gray-500">
                <Calendar className="h-3.5 w-3.5 text-gray-400" />
                Submitted On
              </p>
              <p className="font-semibold text-gray-800">
                {new Date(property.createdAt).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            </div>
            <div>
              <p className="mb-1 flex items-center gap-1 text-gray-500">
                <ShieldCheck className="h-3.5 w-3.5 text-gray-400" />
                Date Approved
              </p>
              <p className="font-semibold text-gray-800">
                {approvedDateStr ?? (
                  <span className="font-normal text-gray-400">Pending approval</span>
                )}
              </p>
            </div>
          </div>

          {/* Landlord & Manager Info */}
          <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="text-xs font-bold tracking-wider text-gray-500 uppercase">
              Ownership & Management Contacts
            </h3>

            {/* Landlord */}
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
                {property.landlord?.name ? property.landlord.name.charAt(0).toUpperCase() : 'L'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold text-gray-900">
                    {property.landlord?.name ?? 'No Landlord Linked'}
                  </p>
                  <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                    Landlord
                  </span>
                </div>
                {property.landlord ? (
                  <div className="mt-1 space-y-0.5 text-xs text-gray-600">
                    <p className="flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                      <a
                        href={`mailto:${property.landlord.email}`}
                        className="truncate text-blue-600 hover:underline"
                      >
                        {property.landlord.email}
                      </a>
                    </p>
                    {property.landlord.phoneNumber && (
                      <p className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                        <a
                          href={`tel:${property.landlord.phoneNumber}`}
                          className="text-gray-700 hover:underline"
                        >
                          {property.landlord.phoneNumber}
                        </a>
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-gray-400">
                    Direct listing without owner association
                  </p>
                )}
              </div>
            </div>

            <div className="border-t border-gray-100" />

            {/* Property Manager */}
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                {property.manager?.name ? property.manager.name.charAt(0).toUpperCase() : 'M'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold text-gray-900">
                    {property.manager?.name ?? 'No Manager Assigned'}
                  </p>
                  <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                    Property Manager
                  </span>
                </div>
                {property.manager ? (
                  <div className="mt-1 space-y-0.5 text-xs text-gray-600">
                    <p className="flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                      <a
                        href={`mailto:${property.manager.email}`}
                        className="truncate text-blue-600 hover:underline"
                      >
                        {property.manager.email}
                      </a>
                    </p>
                    {property.manager.phoneNumber && (
                      <p className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                        <a
                          href={`tel:${property.manager.phoneNumber}`}
                          className="text-gray-700 hover:underline"
                        >
                          {property.manager.phoneNumber}
                        </a>
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-gray-400">Self-managed by landlord</p>
                )}
              </div>
            </div>
          </div>

          {/* Staged Pending Changes Diff (if any) */}
          {property.metadata?.pendingChanges && (
            <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-amber-900 uppercase">
                  <Sparkles className="h-4 w-4 text-amber-600" /> Proposed Edits Awaiting Review
                </h3>
                <span className="rounded-full bg-amber-200 px-2.5 py-0.5 text-[10px] font-bold text-amber-800 uppercase">
                  {property.metadata.pendingChanges.status === 'PENDING_REVIEW'
                    ? 'In Review'
                    : 'Draft'}
                </span>
              </div>

              {property.metadata.pendingChanges.property && (
                <div className="space-y-1.5 rounded-lg border border-amber-100 bg-white p-3 text-xs">
                  <p className="font-semibold text-gray-700">Proposed Property Details:</p>
                  {property.metadata.pendingChanges.property.name && (
                    <p className="text-gray-600">
                      <span className="font-medium text-gray-900">Name:</span>{' '}
                      {property.metadata.pendingChanges.property.name}
                    </p>
                  )}
                  {property.metadata.pendingChanges.property.address && (
                    <p className="text-gray-600">
                      <span className="font-medium text-gray-900">Address:</span>{' '}
                      {property.metadata.pendingChanges.property.address},{' '}
                      {property.metadata.pendingChanges.property.city}
                    </p>
                  )}
                  {property.metadata.pendingChanges.property.description && (
                    <p className="text-gray-600">
                      <span className="font-medium text-gray-900">Description:</span>{' '}
                      {property.metadata.pendingChanges.property.description}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Units Breakdown & Public/Private Visibility */}
          <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold tracking-wider text-gray-500 uppercase">
                Units Overview ({property.units?.length ?? 0} total)
              </h3>
            </div>

            <div className="divide-y divide-gray-100">
              {property.units && property.units.length > 0 ? (
                property.units.map((unit) => {
                  const isPendingUnit = unit.amenities?.includes('approval:pending');
                  const isPrivateUnit = unit.amenities?.includes('visibility:private');
                  const stagedUnit = property.metadata?.pendingChanges?.units?.[unit.id];

                  return (
                    <div key={unit.id} className="py-2.5 text-xs">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-900">Unit {unit.unitNumber}</p>
                          <p className="text-gray-500">
                            {unit.bedrooms} bed · {unit.bathrooms} bath · ₦
                            {unit.rentAmount.toLocaleString()}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {isPendingUnit ? (
                            <>
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                                <Clock className="h-3 w-3" /> Pending Review
                              </span>
                              <button
                                type="button"
                                onClick={() => handleApproveUnit(unit.id)}
                                disabled={approvingUnitId === unit.id}
                                className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                              >
                                {approvingUnitId === unit.id ? 'Approving…' : 'Approve Unit'}
                              </button>
                            </>
                          ) : isPrivateUnit ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-1 text-[11px] font-semibold text-purple-800">
                              <Lock className="h-3 w-3" /> Private Unit
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
                              <Globe className="h-3 w-3" /> Public Unit
                            </span>
                          )}
                        </div>
                      </div>

                      {stagedUnit && (
                        <div className="mt-2 flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-900">
                          <div>
                            <span className="font-semibold">Proposed Edit: </span>
                            {stagedUnit.rentAmount &&
                              `Rent: ₦${stagedUnit.rentAmount.toLocaleString()} `}
                            {stagedUnit.bedrooms && `· ${stagedUnit.bedrooms} bed `}
                            {stagedUnit.bathrooms && `· ${stagedUnit.bathrooms} bath`}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleApproveUnit(unit.id)}
                            disabled={approvingUnitId === unit.id}
                            className="rounded-md bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                          >
                            Approve
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="py-2 text-xs text-gray-400">No units registered yet.</p>
              )}
            </div>
          </div>

          {/* Moderation Notes & Review Form */}
          <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
            <label className="block text-xs font-bold tracking-wider text-gray-500 uppercase">
              Moderation Notes & Audit Feedback
            </label>
            <textarea
              value={moderationNotes}
              onChange={(e) => setModerationNotes(e.target.value)}
              placeholder="e.g. Verified certificate of occupancy and approved. Or: Please update unit exterior photo."
              rows={3}
              className="w-full rounded-lg border border-gray-300 p-3 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
            {property.moderationNotes && (
              <p className="rounded-lg border border-gray-100 bg-gray-50 p-2.5 text-[11px] text-gray-500 italic">
                <span className="font-medium text-gray-700">Audit Trail: </span>
                {property.moderationNotes}
              </p>
            )}
          </div>

          {/* Quick Actions in Drawer */}
          <div className="space-y-2 pt-2">
            {isPending && (
              <div className="flex gap-2">
                <button
                  onClick={() => handleModerate('APPROVED')}
                  disabled={submitting}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {submitting ? 'Approving…' : 'Approve Listing'}
                </button>
                <button
                  onClick={() => handleModerate('REJECTED')}
                  disabled={submitting}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-red-300 bg-red-50 py-3 text-xs font-bold text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50"
                >
                  <XCircle className="h-4 w-4" />
                  {submitting ? 'Rejecting…' : 'Reject Listing'}
                </button>
              </div>
            )}

            {isApproved && (
              <div className="flex gap-2">
                <button
                  onClick={handleTogglePublish}
                  disabled={publishing}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold text-white shadow-sm transition-colors ${
                    property.isPublished
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : 'bg-blue-600 hover:bg-blue-700'
                  } disabled:opacity-50`}
                >
                  {property.isPublished ? (
                    <>
                      <Lock className="h-4 w-4" />
                      {publishing ? 'Unpublishing…' : 'Unpublish Listing'}
                    </>
                  ) : (
                    <>
                      <Globe className="h-4 w-4" />
                      {publishing ? 'Publishing…' : 'Publish Listing'}
                    </>
                  )}
                </button>

                <button
                  onClick={() => handleModerate('REJECTED')}
                  disabled={submitting}
                  className="rounded-xl border border-red-200 px-4 py-3 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
                  title="Revoke approval and return listing to rejected"
                >
                  Revoke
                </button>
              </div>
            )}

            {isRejected && (
              <button
                onClick={() => handleModerate('APPROVED')}
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                {submitting ? 'Updating…' : 'Re-Approve Listing'}
              </button>
            )}
          </div>
        </div>

        {/* Drawer Footer with Prominent FULL VIEW Button */}
        <div className="flex items-center justify-between gap-3 border-t border-gray-200 bg-gray-50/80 p-4 md:p-5">
          <button
            onClick={onClose}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-100"
          >
            Close
          </button>

          <button
            onClick={() => {
              onClose();
              router.push(`/admin/properties/${property.id}`);
            }}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-md transition-all hover:bg-blue-700 active:scale-[0.99]"
          >
            FULL VIEW
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
        </div>
      </aside>
    </>
  );
}
