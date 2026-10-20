import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  MapPin,
  Bed,
  Bath,
  Square,
  DollarSign,
  CheckCircle,
  Zap,
  Droplet,
  Shield,
  X,
  GitMerge,
  Globe,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  Sparkles,
  Edit3,
  Clock,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from './ConfirmDialog';
import { api } from '@/lib/apiClient';
import { formatViewingTime } from '@/lib/viewingSlots';
import { useAuth } from '@/context/AuthContext';
import { useProperty } from '@/hooks/useProperties';
import { useLeases } from '@/hooks/useLeases';
import { useInvoices } from '@/hooks/useInvoices';
import { useMaintenanceRequests } from '@/hooks/useMaintenanceRequests';
import { useApplications, useReviewApplication } from '@/hooks/useApplications';
import {
  useModerateProperty,
  useSetPropertyPublished,
  useImportUnits,
  usePropertyViewings,
  useUpdateViewing,
  useUnmergeProperty,
} from '@/hooks/useProperties';
import { useAnnouncements, useCreateAnnouncement } from '@/hooks/useAnnouncements';
import { useEquipment, useCreateEquipment } from '@/hooks/useEquipment';
import { PropertyPhotoManager } from './PropertyPhotoManager';
import { GateCheckCard } from './GateCheckCard';
import type { Page } from '../dashboard/navigateToPage';
import type { Application, Equipment, PropertyDetail as PropertyDetailData } from '@/lib/api/types';

interface PropertyDetailProps {
  propertyId: string;
  onNavigate?: (page: Page) => void;
}

const MANAGE_ROLES = ['manager', 'landlord', 'admin'];

const MODERATION_BADGE: Record<string, string> = {
  PENDING_REVIEW: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  FLAGGED: 'bg-orange-100 text-orange-700',
};

function StakeholdersCard({ property }: { property: PropertyDetailData }) {
  const landlord = property.landlord;
  const manager = property.manager;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-xs">
      <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-gray-900">
        <ShieldCheck className="h-4 w-4 text-blue-600" />
        Ownership & Management
      </h2>

      {/* Landlord details */}
      <div className="mb-3 rounded-xl border border-purple-100 bg-purple-50/60 p-3.5">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[11px] font-bold tracking-wider text-purple-800 uppercase">
            Landlord / Owner
          </span>
          <span className="rounded-full bg-purple-200/60 px-2 py-0.5 text-[10px] font-bold text-purple-900">
            Owner
          </span>
        </div>
        {landlord ? (
          <div className="space-y-1 text-xs">
            <p className="text-sm font-bold text-gray-900">{landlord.name}</p>
            <p className="flex items-center gap-1.5 truncate text-gray-600">
              <Mail className="h-3 w-3 shrink-0 text-gray-400" />
              {landlord.email}
            </p>
            {landlord.phoneNumber && (
              <p className="flex items-center gap-1.5 text-gray-600">
                <Phone className="h-3 w-3 shrink-0 text-gray-400" />
                {landlord.phoneNumber}
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-gray-500 italic">No landlord profile attached.</p>
        )}
      </div>

      {/* Manager details */}
      <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3.5">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[11px] font-bold tracking-wider text-blue-800 uppercase">
            Property Manager
          </span>
          <span className="rounded-full bg-blue-200/60 px-2 py-0.5 text-[10px] font-bold text-blue-900">
            Manager
          </span>
        </div>
        {manager ? (
          <div className="space-y-1 text-xs">
            <p className="text-sm font-bold text-gray-900">{manager.name}</p>
            <p className="flex items-center gap-1.5 truncate text-gray-600">
              <Mail className="h-3 w-3 shrink-0 text-gray-400" />
              {manager.email}
            </p>
            {manager.phoneNumber && (
              <p className="flex items-center gap-1.5 text-gray-600">
                <Phone className="h-3 w-3 shrink-0 text-gray-400" />
                {manager.phoneNumber}
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-gray-500 italic">Self-managed by landlord.</p>
        )}
      </div>
    </div>
  );
}

function EditPropertyModal({
  property,
  onClose,
  onSaved,
}: {
  property: PropertyDetailData;
  onClose: () => void;
  onSaved: () => void;
}) {
  const pendingChanges = property.metadata?.pendingChanges;
  const draftProp = pendingChanges?.property;

  const [name, setName] = useState(draftProp?.name ?? property.name);
  const [description, setDescription] = useState(
    draftProp?.description ?? property.description ?? '',
  );
  const [address, setAddress] = useState(draftProp?.address ?? property.address);
  const [city, setCity] = useState(draftProp?.city ?? property.city);
  const [state, setState] = useState(draftProp?.state ?? property.state ?? '');
  const [saving, setSaving] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSaveAndSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.properties.update(property.id, {
        name: name.trim(),
        description: description.trim(),
        address: address.trim(),
        city: city.trim(),
        state: state.trim(),
        submitForReview: true,
      });
      toast.success('Property updated! Submitted to admin for review.');
      onSaved();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to update property');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAsDraft = async () => {
    setSavingDraft(true);
    setError(null);
    try {
      await api.properties.update(property.id, {
        name: name.trim(),
        description: description.trim(),
        address: address.trim(),
        city: city.trim(),
        state: state.trim(),
        saveAsDraft: true,
      });
      toast.success('Changes saved as draft. Live listing remains active.');
      onSaved();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to save draft');
    } finally {
      setSavingDraft(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Edit Property Details</h2>
            {draftProp && (
              <p className="mt-0.5 text-xs font-medium text-blue-600">
                Editing unsent draft changes
              </p>
            )}
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSaveAndSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-700">Property Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-700">Street Address</label>
            <input
              type="text"
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700">City</label>
              <input
                type="text"
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700">State</label>
              <input
                type="text"
                required
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-700">Description</label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            You can <strong>Save as Draft</strong> without unpublishing or alerting admins, or{' '}
            <strong>Submit for Review</strong> when you are ready.
          </div>

          {error && <p className="text-xs font-medium text-red-600">{error}</p>}

          <div className="flex items-center justify-between border-t border-gray-100 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-3.5 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveAsDraft}
                disabled={saving || savingDraft}
                className="rounded-lg border border-blue-300 bg-blue-50 px-3.5 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
              >
                {savingDraft ? 'Saving Draft…' : 'Save as Draft'}
              </button>
              <button
                type="submit"
                disabled={saving || savingDraft}
                className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Submitting…' : 'Submit for Review'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function ListingStatusCard({
  property,
  onRefetch,
  onOpenEdit,
}: {
  property: PropertyDetailData;
  onRefetch: () => void;
  onOpenEdit?: () => void;
}) {
  const auth = useAuth();
  const isAdmin = auth.user?.role === 'admin';
  const isLandlordOrManager = auth.user?.role === 'landlord' || auth.user?.role === 'manager';
  const {
    submit: setPublished,
    submitting: publishing,
    error: publishError,
  } = useSetPropertyPublished(property.id);
  const {
    submit: moderate,
    submitting: moderating,
    error: moderateError,
  } = useModerateProperty(property.id);
  const [requestingApproval, setRequestingApproval] = useState(false);
  const [cancellingEdits, setCancellingEdits] = useState(false);
  const [deletingDraft, setDeletingDraft] = useState(false);
  const [submittingDraft, setSubmittingDraft] = useState(false);

  const pendingChanges = property.metadata?.pendingChanges;
  const isUnderReview = pendingChanges?.status === 'PENDING_REVIEW';
  const isDraft = pendingChanges?.status === 'DRAFT';

  const handleTogglePublish = async () => {
    try {
      await setPublished(!property.isPublished);
      onRefetch();
    } catch {
      // error surfaced via publishError below
    }
  };

  const handleModerate = async (status: 'APPROVED' | 'REJECTED') => {
    try {
      await moderate({ status });
      onRefetch();
    } catch {
      // error surfaced via moderateError below
    }
  };

  const handleRequestApproval = async () => {
    setRequestingApproval(true);
    try {
      await api.properties.update(property.id, {
        moderationStatus: 'PENDING_REVIEW',
      });
      toast.success('Approval requested! Listing submitted for admin review.');
      onRefetch();
    } catch {
      toast.error('Failed to request approval. Please try again.');
    } finally {
      setRequestingApproval(false);
    }
  };

  const handleCancelPendingEdits = async () => {
    setCancellingEdits(true);
    try {
      await api.properties.update(property.id, { cancelPendingEdits: true });
      toast.success('Approval request cancelled. Edits moved back to draft.');
      onRefetch();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Failed to cancel approval request.');
    } finally {
      setCancellingEdits(false);
    }
  };

  const handleDeleteDraftEdits = async () => {
    setDeletingDraft(true);
    try {
      await api.properties.update(property.id, { deletePendingEdits: true });
      toast.success('Draft edits discarded.');
      onRefetch();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Failed to delete draft edits.');
    } finally {
      setDeletingDraft(false);
    }
  };

  const handleSubmitDraftForReview = async () => {
    setSubmittingDraft(true);
    try {
      await api.properties.update(property.id, { submitForReview: true });
      toast.success('Draft submitted to admin for review!');
      onRefetch();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Failed to submit draft for review.');
    } finally {
      setSubmittingDraft(false);
    }
  };

  const isEdited = property.moderationNotes?.includes('[EDITED]');

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-xs">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">Listing Status</h2>
        {onOpenEdit && (
          <button
            type="button"
            onClick={onOpenEdit}
            className="flex items-center gap-1 rounded-lg border border-blue-200/60 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
          >
            <Edit3 className="h-3 w-3" />
            Edit Property
          </button>
        )}
      </div>

      {/* Under-Review Changes Alert */}
      {isUnderReview && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900">
          <div className="flex items-center justify-between font-semibold">
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 shrink-0 text-amber-600" /> Proposed Edits Under Review
            </span>
            <span className="rounded-full bg-amber-200/80 px-2 py-0.5 text-[10px] font-bold tracking-wider text-amber-800 uppercase">
              In Review
            </span>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-amber-800">
            Your proposed edits are awaiting admin moderation. Edits under review cannot be deleted
            directly; cancel the approval request first before deleting.
          </p>
          <div className="mt-2.5 flex items-center gap-2">
            <button
              type="button"
              onClick={handleCancelPendingEdits}
              disabled={cancellingEdits}
              className="rounded-lg bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-amber-800 disabled:opacity-50"
            >
              {cancellingEdits ? 'Cancelling…' : 'Cancel Approval Request'}
            </button>
            <button
              type="button"
              disabled
              title="Edits currently under review cannot be deleted directly. You must cancel the approval request first before deleting."
              className="flex cursor-not-allowed items-center gap-1 rounded-lg border border-amber-300/60 bg-amber-100/50 px-3 py-1.5 text-xs font-medium text-amber-700/60"
            >
              <Trash2 className="h-3 w-3" />
              Delete Pending Edits
            </button>
          </div>
        </div>
      )}

      {/* Saved Draft Changes Alert */}
      {isDraft && (
        <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-3.5 text-xs text-blue-900">
          <div className="flex items-center justify-between font-semibold">
            <span className="flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 shrink-0 text-blue-600" /> Saved Draft Edits
            </span>
            <span className="rounded-full bg-blue-200/80 px-2 py-0.5 text-[10px] font-bold tracking-wider text-blue-800 uppercase">
              Draft
            </span>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-blue-800">
            You have unsent draft edits saved privately. The live listing remains published with its
            current details.
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSubmitDraftForReview}
              disabled={submittingDraft}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {submittingDraft ? 'Submitting…' : 'Submit for Review'}
            </button>
            {onOpenEdit && (
              <button
                type="button"
                onClick={onOpenEdit}
                className="rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50"
              >
                Resume Editing
              </button>
            )}
            <button
              type="button"
              onClick={handleDeleteDraftEdits}
              disabled={deletingDraft}
              className="flex items-center gap-1 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 className="h-3 w-3" />
              {deletingDraft ? 'Deleting…' : 'Delete Pending Edits'}
            </button>
          </div>
        </div>
      )}

      {isEdited && !isUnderReview && !isDraft && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
          <Sparkles className="h-4 w-4 shrink-0 text-amber-600" />
          <span>Edited by owner/manager. Requires admin re-approval.</span>
        </div>
      )}

      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm text-gray-600">Moderation</span>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${MODERATION_BADGE[property.moderationStatus]}`}
        >
          {property.moderationStatus.replace('_', ' ')}
        </span>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm text-gray-600">Visibility</span>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            property.isPublished ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
          }`}
        >
          {property.isPublished ? 'Published' : 'Unpublished'}
        </span>
      </div>

      {isAdmin && property.moderationStatus === 'PENDING_REVIEW' && (
        <div className="mb-4 flex gap-2 border-t border-gray-100 pt-4">
          <button
            onClick={() => handleModerate('APPROVED')}
            disabled={moderating}
            className="flex-1 rounded-lg bg-green-600 px-3 py-2 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            Approve Listing
          </button>
          <button
            onClick={() => handleModerate('REJECTED')}
            disabled={moderating}
            className="flex-1 rounded-lg border border-red-300 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      )}

      {/* Landlord Request Approval (without publishing yet) */}
      {isLandlordOrManager && property.moderationStatus !== 'APPROVED' && (
        <div className="mb-3">
          <button
            type="button"
            onClick={handleRequestApproval}
            disabled={requestingApproval || property.moderationStatus === 'PENDING_REVIEW'}
            className="w-full rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {property.moderationStatus === 'PENDING_REVIEW'
              ? 'Awaiting Admin Review'
              : requestingApproval
                ? 'Requesting…'
                : 'Request Admin Approval'}
          </button>
          <p className="mt-1 text-center text-[11px] text-gray-400">
            Allows admin to review without making the listing public yet
          </p>
        </div>
      )}

      <button
        onClick={handleTogglePublish}
        disabled={publishing || (!property.isPublished && property.moderationStatus !== 'APPROVED')}
        title={
          !property.isPublished && property.moderationStatus !== 'APPROVED'
            ? 'An admin must approve this listing before it can be published'
            : undefined
        }
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {publishing ? 'Saving…' : property.isPublished ? 'Unpublish Listing' : 'Publish Listing'}
      </button>
      {(publishError || moderateError) && (
        <p className="mt-2 text-xs text-red-600">{publishError || moderateError}</p>
      )}
    </div>
  );
}

// Announcements: visible to every tenant of the property, postable only by
// its manager/landlord/admin -- no notification system exists to push
// these, this is a real, persisted read surface, not a fake preview.
function AnnouncementsCard({ propertyId, canManage }: { propertyId: string; canManage: boolean }) {
  const { data: announcements, loading, refetch } = useAnnouncements(propertyId);
  const { submit: createAnnouncement, submitting, error } = useCreateAnnouncement(propertyId);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const handleCreate = async () => {
    if (!title.trim() || !body.trim()) return;
    try {
      await createAnnouncement({ title: title.trim(), body: body.trim() });
      setTitle('');
      setBody('');
      setShowForm(false);
      refetch();
    } catch {
      // error surfaced below
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-200 p-6">
        <div>
          <h2 className="font-semibold">Announcements</h2>
          <p className="text-sm text-gray-500">Posted by the property&apos;s manager or landlord</p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowForm((s) => !s)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium hover:bg-gray-50"
          >
            {showForm ? 'Cancel' : 'New Announcement'}
          </button>
        )}
      </div>

      {showForm && (
        <div className="space-y-3 border-b border-gray-200 p-6">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Message"
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            onClick={handleCreate}
            disabled={submitting}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'Posting…' : 'Post Announcement'}
          </button>
        </div>
      )}

      <div className="divide-y divide-gray-200">
        {loading && <p className="p-6 text-sm text-gray-400">Loading…</p>}
        {!loading &&
          announcements.map((a) => (
            <div key={a.id} className="p-4">
              <div className="mb-1 flex items-center gap-2">
                {a.isPinned && <span className="text-xs font-medium text-amber-600">Pinned</span>}
                <p className="font-medium">{a.title}</p>
              </div>
              <p className="text-sm text-gray-600">{a.body}</p>
              <p className="mt-1 text-xs text-gray-400">
                {new Date(a.publishedAt).toLocaleDateString()}
              </p>
            </div>
          ))}
        {!loading && announcements.length === 0 && (
          <p className="p-6 text-sm text-gray-400">No announcements yet.</p>
        )}
      </div>
    </div>
  );
}

// Equipment: shared/property-wide assets (generators, elevators) tracked
// with warranty info -- manager/landlord/admin only.
function EquipmentCard({ propertyId }: { propertyId: string }) {
  const { data: equipment, loading, refetch } = useEquipment(propertyId);
  const { submit: createEquipment, submitting, error } = useCreateEquipment(propertyId);
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState<Equipment['type']>('OTHER');
  const [serialNumber, setSerialNumber] = useState('');

  const handleCreate = async () => {
    try {
      await createEquipment({ type, serialNumber: serialNumber.trim() || undefined });
      setSerialNumber('');
      setShowForm(false);
      refetch();
    } catch {
      // error surfaced below
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold">Equipment</h2>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          {showForm ? 'Cancel' : '+ Add'}
        </button>
      </div>

      {showForm && (
        <div className="mb-4 space-y-2 border-b border-gray-100 pb-4">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as Equipment['type'])}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            {(
              [
                'HVAC',
                'WATER_HEATER',
                'GENERATOR',
                'INVERTER',
                'APPLIANCE',
                'ELEVATOR',
                'OTHER',
              ] as const
            ).map((t) => (
              <option key={t} value={t}>
                {t.replace('_', ' ')}
              </option>
            ))}
          </select>
          <input
            value={serialNumber}
            onChange={(e) => setSerialNumber(e.target.value)}
            placeholder="Serial number (optional)"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            onClick={handleCreate}
            disabled={submitting}
            className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'Adding…' : 'Add Equipment'}
          </button>
        </div>
      )}

      <div className="space-y-2">
        {loading && <p className="text-sm text-gray-400">Loading…</p>}
        {!loading &&
          equipment.map((eq) => (
            <div key={eq.id} className="flex items-center justify-between text-sm">
              <span>{eq.type.replace('_', ' ')}</span>
              <span className="text-xs text-gray-400">
                {eq.serialNumber ?? (eq.unitId ? 'Unit-level' : 'Property-wide')}
              </span>
            </div>
          ))}
        {!loading && equipment.length === 0 && (
          <p className="text-sm text-gray-400">No equipment tracked yet.</p>
        )}
      </div>
    </div>
  );
}

// CSV/Excel bulk import of units -- PRD §5.1's "Import/export data (CSV,
// Excel)" bullet under Property & Unit Management. Partial success is
// expected (a bad row shouldn't block the good ones), so results always
// show a per-row error list rather than a single pass/fail.
function ImportUnitsControl({
  propertyId,
  onImported,
}: {
  propertyId: string;
  onImported: () => void;
}) {
  const { submit: importUnits, submitting, error } = useImportUnits(propertyId);
  const [result, setResult] = useState<{
    created: number;
    errors: { row: number; error: string }[];
  } | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setResult(null);
    try {
      const data = await importUnits(file);
      setResult(data);
      if (data.created > 0) onImported();
    } catch {
      // error surfaced below via the hook's own error state
    }
  };

  return (
    <div className="text-right">
      <label className="cursor-pointer rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
        {submitting ? 'Importing…' : 'Import Units (CSV/Excel)'}
        <input
          type="file"
          accept=".csv,.xlsx"
          onChange={handleFile}
          disabled={submitting}
          className="hidden"
        />
      </label>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {result && (
        <p className="mt-1 text-xs text-gray-500">
          {result.created} unit{result.created === 1 ? '' : 's'} created
          {result.errors.length > 0 &&
            `, ${result.errors.length} row(s) skipped (e.g. row ${result.errors[0].row}: ${result.errors[0].error})`}
        </p>
      )}
    </div>
  );
}

function ViewingRequestsCard({ propertyId }: { propertyId: string }) {
  const { data: viewings, refetch } = usePropertyViewings(propertyId);
  const { submit, submitting } = useUpdateViewing(propertyId);
  const [now] = useState(() => Date.now());
  const open = viewings.filter(
    (v) =>
      (v.status === 'REQUESTED' || v.status === 'CONFIRMED') &&
      new Date(v.scheduledAt).getTime() > now,
  );

  const act = async (viewingId: string, status: 'CONFIRMED' | 'CANCELLED') => {
    try {
      await submit({ viewingId, status });
    } catch {
      // the list is refetched either way, so a stale row corrects itself
    }
    refetch();
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-200 p-6">
        <h2 className="font-semibold">Viewing Requests</h2>
        <p className="text-sm text-gray-500">Upcoming viewings for this property</p>
      </div>
      <div className="divide-y divide-gray-200">
        {open.map((v) => (
          <div key={v.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="font-medium">{v.requestedBy?.name ?? 'Visitor'}</p>
              {v.requestedBy && (
                <>
                  <p className="text-xs text-gray-600">
                    {v.requestedBy.email}
                    {v.requestedBy.phoneNumber ? ` · ${v.requestedBy.phoneNumber}` : ''}
                  </p>
                  <div className="my-1 flex flex-wrap gap-1.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        v.requestedBy.hasIdOnFile
                          ? 'bg-green-100 text-green-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {v.requestedBy.hasIdOnFile ? 'ID on file' : 'No ID on file'}
                    </span>
                    {v.requestedBy.kycStatus === 'VERIFIED' && (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                        Identity verified
                      </span>
                    )}
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                      Member since{' '}
                      {new Date(v.requestedBy.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                </>
              )}
              <p className="text-xs text-gray-500">
                {formatViewingTime(v.scheduledAt)} (Lagos time)
                {v.notes ? ` · ${v.notes}` : ''}
              </p>
            </div>
            {v.status === 'CONFIRMED' ? (
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                  Confirmed
                </span>
                <button
                  onClick={() => act(v.id, 'CANCELLED')}
                  disabled={submitting}
                  className="text-xs text-gray-500 underline disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => act(v.id, 'CONFIRMED')}
                  disabled={submitting}
                  className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  Confirm
                </button>
                <button
                  onClick={() => act(v.id, 'CANCELLED')}
                  disabled={submitting}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Decline
                </button>
              </div>
            )}
          </div>
        ))}
        {open.length === 0 && <p className="p-6 text-sm text-gray-400">No upcoming viewings.</p>}
      </div>
    </div>
  );
}

function ApplicationRow({
  application,
  onReviewed,
}: {
  application: Application;
  onReviewed: () => void;
}) {
  const { submit: review, submitting } = useReviewApplication(application.id);
  const details = application.details as Record<string, unknown>;
  const name =
    application.applicant?.name ||
    [details.firstName, details.lastName].filter(Boolean).join(' ') ||
    'Applicant';

  const handleReview = async (status: 'APPROVED' | 'REJECTED') => {
    try {
      await review({ status });
      onReviewed();
    } catch {
      // errors are rare here (409 if already reviewed) -- refetch either way
      onReviewed();
    }
  };

  return (
    <div className="p-4">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <p className="font-medium">{name}</p>
          <p className="text-xs text-gray-500">
            Unit {application.unit?.unitNumber} · {details.email as string}
          </p>
        </div>
        <span className="text-xs text-gray-400">
          {new Date(application.createdAt).toLocaleDateString()}
        </span>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => handleReview('APPROVED')}
          disabled={submitting}
          className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          <CheckCircle className="h-3.5 w-3.5" />
          Approve
        </button>
        <button
          onClick={() => handleReview('REJECTED')}
          disabled={submitting}
          className="flex items-center gap-1 rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          <X className="h-3.5 w-3.5" />
          Reject
        </button>
      </div>
    </div>
  );
}

export function PropertyDetail({ propertyId, onNavigate }: PropertyDetailProps) {
  const auth = useAuth();
  const { data: property, loading, refetch: refetchProperty } = useProperty(propertyId);
  const { data: leases } = useLeases();
  const { data: invoices } = useInvoices();
  const { data: maintenanceRequests } = useMaintenanceRequests();
  const { data: pendingApplications, refetch: refetchApplications } = useApplications({
    status: 'PENDING',
  });
  const { data: approvedApplications, refetch: refetchApproved } = useApplications({
    status: 'APPROVED',
  });
  const { submit: unmergeProperty, submitting: unmerging } = useUnmergeProperty(propertyId);
  const [showUnmergeConfirm, setShowUnmergeConfirm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const handleUnmerge = async () => {
    try {
      await unmergeProperty();
      setShowUnmergeConfirm(false);
      refetchProperty();
      toast.success(`Unmerged "${property?.name}" -- listing returned to pending review.`);
    } catch {
      toast.error('Failed to undo merge. Please try again.');
    }
  };

  if (loading) {
    return <div className="p-6 text-gray-500">Loading property…</div>;
  }

  if (!property) {
    return (
      <div className="p-6">
        <Link
          href="/dashboard"
          className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-5 w-5" />
          Back
        </Link>
        <p className="text-gray-500">Property not found.</p>
      </div>
    );
  }

  // Role + ownership gate: the underlying leases/invoices/maintenance hooks
  // are already server-scoped to the caller's own data, so a tenant Browse
  // this page never actually receives another tenant's records -- this gate
  // is what decides whether to *render* the manager-only sections at all.
  const canManage =
    !!auth.user &&
    MANAGE_ROLES.includes(auth.user.role) &&
    (auth.user.role === 'admin' ||
      auth.user.id === property.managerId ||
      auth.user.id === property.landlordId);

  const propertyLeases = leases.filter((l) => l.unit?.propertyId === propertyId);
  const propertyApplications = pendingApplications.filter(
    (a) => a.unit?.property.id === propertyId,
  );
  // Approved but no tenancy yet: the manager's next step (ISS-046).
  const awaitingTenancy = approvedApplications.filter(
    (a) => a.unit?.property.id === propertyId && !a.leaseId,
  );
  const propertyInvoices = invoices.filter((i) => i.lease?.unit.property.id === propertyId);
  const propertyMaintenance = maintenanceRequests
    .filter((r) => r.unit?.propertyId === propertyId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const collected = propertyInvoices
    .flatMap((i) => i.payments)
    .reduce((sum, p) => sum + p.amount, 0);
  const pending = propertyInvoices
    .filter((i) => i.status !== 'PAID' && i.status !== 'CANCELLED')
    .reduce(
      (sum, i) => sum + Math.max(0, i.amount - i.payments.reduce((s, p) => s + p.amount, 0)),
      0,
    );
  const maintenanceCosts = propertyMaintenance
    .filter((r) => r.status === 'COMPLETED')
    .reduce((sum, r) => sum + (r.finalCost ?? 0), 0);
  const totalListedRent = property.units.reduce((sum, u) => sum + u.rentAmount, 0);
  const netIncome = collected - maintenanceCosts;

  const amenities = Array.from(new Set(property.units.flatMap((u) => u.amenities))).filter(
    (a) => !a.startsWith('visibility:'),
  );
  const anyVacant = property.units.some((u) => u.status === 'VACANT');
  const verified = property.moderationStatus === 'APPROVED';
  const cheapestUnit = [...property.units].sort((a, b) => a.rentAmount - b.rentAmount)[0];

  const handleToggleUnitVisibility = async (unit: PropertyDetailData['units'][number]) => {
    const isPrivate = unit.amenities?.includes('visibility:private');
    const currentAmenities = unit.amenities ?? [];
    const updatedAmenities = isPrivate
      ? currentAmenities.filter((a) => a !== 'visibility:private')
      : [...currentAmenities, 'visibility:private'];

    try {
      await api.properties.updateUnit(property.id, unit.id, {
        amenities: updatedAmenities,
      });
      toast.success(
        isPrivate
          ? `Unit ${unit.unitNumber} is now PUBLIC on the marketplace.`
          : `Unit ${unit.unitNumber} is now PRIVATE (only visible to managers & tenants).`,
      );
      refetchProperty();
    } catch {
      toast.error('Failed to update unit visibility. Please try again.');
    }
  };

  const neighborhood = {
    safety: property.securityRating != null ? Math.round(property.securityRating / 10) : null,
    accessibility:
      property.roadConditionScore != null ? Math.round(property.roadConditionScore / 10) : null,
    powerReliability:
      property.powerReliabilityScore != null
        ? Math.round(property.powerReliabilityScore / 10)
        : null,
  };

  return (
    <div className="p-6">
      <Link
        href="/dashboard"
        className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-5 w-5" />
        Back
      </Link>

      {/* Edited Property Banner */}
      {property.moderationNotes?.includes('[EDITED]') && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-200 text-amber-900">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold">This property was recently edited.</p>
              <p className="text-xs text-amber-700">
                Property details were revised and automatically resubmitted to platform
                administrators for re-review.
              </p>
            </div>
          </div>
          <span className="rounded-full bg-amber-200 px-3 py-1 text-xs font-bold text-amber-950">
            Awaiting Admin Review
          </span>
        </div>
      )}

      {/* Merged Listing Banner */}
      {property.mergedIntoId && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-purple-200 bg-purple-50 p-4 text-purple-900">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-100 text-purple-700">
              <GitMerge className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">
                This listing was merged into{' '}
                {property.mergedInto?.name ? `"${property.mergedInto.name}"` : 'another property'}.
              </p>
              <p className="text-xs text-purple-700">
                It is currently unpublished and marked as rejected in moderation.
              </p>
            </div>
          </div>
          {auth.user?.role === 'admin' && (
            <button
              onClick={() => setShowUnmergeConfirm(true)}
              disabled={unmerging}
              className="rounded-lg border border-purple-300 bg-white px-3 py-1.5 text-xs font-semibold text-purple-800 hover:bg-purple-100 disabled:opacity-50"
            >
              {unmerging ? 'Undoing…' : 'Undo Merge'}
            </button>
          )}
        </div>
      )}

      {/* Merged Duplicates Notice (if canonical property has duplicates merged into it) */}
      {property.mergedFrom && property.mergedFrom.length > 0 && (
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 text-blue-900">
          <div className="flex items-center gap-2">
            <GitMerge className="h-4 w-4 text-blue-600" />
            <p className="text-xs font-medium">
              Canonical listing: {property.mergedFrom.length} duplicate listing
              {property.mergedFrom.length === 1 ? '' : 's'} merged into this property:{' '}
              {property.mergedFrom.map((p) => p.name).join(', ')}.
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-4 flex flex-col items-start gap-3 sm:flex-row sm:justify-between">
          <div>
            <h1 className="mb-2 text-2xl font-semibold">{property.name}</h1>
            <div className="mb-2 flex items-start gap-2 text-gray-600">
              <MapPin className="mt-1 h-4 w-4 shrink-0" />
              <span>
                {property.address}, {property.city}
                {property.state ? `, ${property.state}` : ''}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {verified && (
              <div className="flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
                <Shield className="h-4 w-4" />
                Verified
              </div>
            )}
            <span
              className={`rounded-full px-3 py-1 text-sm font-medium ${
                anyVacant ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
              }`}
            >
              {anyVacant ? 'Has Vacancy' : 'Fully Occupied'}
            </span>
          </div>
        </div>

        {/* Property Stats */}
        <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="flex items-center gap-2">
            <Bed className="h-5 w-5 text-gray-400" />
            <span className="font-medium">{cheapestUnit?.bedrooms ?? 0} Bedrooms</span>
          </div>
          <div className="flex items-center gap-2">
            <Bath className="h-5 w-5 text-gray-400" />
            <span className="font-medium">{cheapestUnit?.bathrooms ?? 0} Bathrooms</span>
          </div>
          <div className="flex items-center gap-2">
            <Square className="h-5 w-5 text-gray-400" />
            <span className="font-medium">
              {cheapestUnit?.sqft ? `${cheapestUnit.sqft.toLocaleString()} sq ft` : 'N/A'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            <span className="font-semibold text-green-600">
              ₦{(cheapestUnit?.rentAmount ?? 0).toLocaleString()}/
              {(cheapestUnit?.listedPaymentFrequency ?? 'year').toLowerCase()}
            </span>
          </div>
        </div>
        <p className="mb-4 text-xs text-gray-500">
          {property.units.length} unit{property.units.length === 1 ? '' : 's'} total ·{' '}
          {property.units.filter((u) => u.status === 'VACANT').length} vacant
        </p>

        {/* Trust Score */}
        <div className="flex items-center justify-between gap-4 border-t border-gray-200 pt-4">
          <div className="flex items-center gap-2">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-50">
              <span className="text-lg font-bold text-green-600">{property.trustScore ?? '—'}</span>
            </div>
            <div>
              <p className="text-sm text-gray-600">Trust Score</p>
              <p className="text-sm font-medium text-green-600">
                {property.reviewStats.count > 0
                  ? `${property.reviewStats.averageRating?.toFixed(1)} avg (${property.reviewStats.count} reviews)`
                  : 'No reviews yet'}
              </p>
            </div>
          </div>

          {/* Action Buttons for Tenants browsing a vacant property */}
          {!canManage && onNavigate && anyVacant && (
            <div className="flex gap-3">
              <button
                onClick={() => onNavigate({ type: 'schedule-viewing', propertyId: property.id })}
                className="rounded-lg border-2 border-blue-600 px-6 py-3 font-semibold text-blue-600 transition-colors hover:bg-blue-50"
              >
                Schedule Viewing
              </button>
              <button
                onClick={() =>
                  onNavigate({ type: 'property-application', propertyId: property.id })
                }
                className="rounded-lg bg-green-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-green-700"
              >
                Apply Now
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="space-y-6 lg:col-span-2">
          {/* Photos & Media management */}
          <PropertyPhotoManager
            property={property}
            onUpdated={refetchProperty}
            canManage={canManage}
          />

          {/* Units & Tenants -- manager/landlord/admin only */}
          {canManage && (
            <div className="rounded-lg border border-gray-200 bg-white">
              <div className="flex items-center justify-between border-b border-gray-200 p-6">
                <h2 className="font-semibold">Units & Tenants</h2>
                <ImportUnitsControl propertyId={property.id} onImported={refetchProperty} />
              </div>
              <div className="divide-y divide-gray-200">
                {property.units.map((unit) => {
                  const lease = propertyLeases.find(
                    (l) => l.unitId === unit.id && l.status === 'ACTIVE',
                  );
                  return (
                    <div key={unit.id} className="p-6">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <p className="font-semibold text-gray-900">Unit {unit.unitNumber}</p>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              unit.amenities?.includes('visibility:private')
                                ? 'border border-amber-200 bg-amber-100 text-amber-800'
                                : 'border border-blue-200 bg-blue-100 text-blue-800'
                            }`}
                          >
                            {unit.amenities?.includes('visibility:private') ? (
                              <Lock className="h-3 w-3" />
                            ) : (
                              <Globe className="h-3 w-3" />
                            )}
                            {unit.amenities?.includes('visibility:private')
                              ? 'Private (Selected Few)'
                              : 'Public (Marketplace)'}
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-500">
                            {unit.bedrooms} bed · {unit.bathrooms} bath · ₦
                            {unit.rentAmount.toLocaleString()}/
                            {unit.listedPaymentFrequency.toLowerCase()}
                          </span>
                          {canManage && (
                            <button
                              type="button"
                              onClick={() => handleToggleUnitVisibility(unit)}
                              className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              {unit.amenities?.includes('visibility:private')
                                ? 'Make Public'
                                : 'Make Private'}
                            </button>
                          )}
                        </div>
                      </div>

                      {property.metadata?.pendingChanges?.units?.[unit.id] &&
                        (() => {
                          const stagedUnit = property.metadata.pendingChanges.units[unit.id];
                          const isPendingReview =
                            property.metadata.pendingChanges.status === 'PENDING_REVIEW';
                          return (
                            <div className="mb-3 flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50/70 p-2.5 text-xs text-amber-900">
                              <div className="flex items-center gap-1.5">
                                <Sparkles className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                                <span>
                                  Proposed unit edits:{' '}
                                  {stagedUnit.rentAmount !== undefined && (
                                    <span className="font-semibold">
                                      Rent: ₦{Number(stagedUnit.rentAmount).toLocaleString()}{' '}
                                    </span>
                                  )}
                                  {stagedUnit.bedrooms !== undefined && (
                                    <span className="font-semibold">
                                      {stagedUnit.bedrooms} bed{' '}
                                    </span>
                                  )}
                                  {stagedUnit.bathrooms !== undefined && (
                                    <span className="font-semibold">
                                      {stagedUnit.bathrooms} bath{' '}
                                    </span>
                                  )}
                                  ({isPendingReview ? 'Under Review' : 'Draft'})
                                </span>
                              </div>
                              {canManage && (
                                <div>
                                  {!isPendingReview ? (
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        try {
                                          await api.properties.updateUnit(property.id, unit.id, {
                                            deletePendingEdits: true,
                                          });
                                          toast.success(
                                            `Deleted pending edits for Unit ${unit.unitNumber}`,
                                          );
                                          refetchProperty();
                                        } catch (err: unknown) {
                                          const msg = (
                                            err as { response?: { data?: { error?: string } } }
                                          )?.response?.data?.error;
                                          toast.error(msg || 'Failed to delete unit edits');
                                        }
                                      }}
                                      className="flex items-center gap-1 text-[11px] font-medium text-red-600 hover:text-red-700 hover:underline"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                      Delete Pending Edits
                                    </button>
                                  ) : (
                                    <span className="text-[10px] text-amber-700 italic">
                                      Under review: cancel review first to delete
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      {lease && lease.tenant ? (
                        <>
                          <div className="mb-3 flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500 text-sm font-semibold text-white">
                                {lease.tenant.name.charAt(0)}
                              </div>
                              <div>
                                <p className="font-medium">{lease.tenant.name}</p>
                                <p className="text-sm text-gray-600">{lease.tenant.email}</p>
                              </div>
                            </div>
                            <button
                              onClick={() =>
                                onNavigate?.({ type: 'tenant-detail', leaseId: lease.id })
                              }
                              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium hover:bg-gray-50"
                            >
                              View Tenant
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="text-gray-600">Phone</p>
                              <p className="font-medium">{lease.tenant.phoneNumber ?? 'N/A'}</p>
                            </div>
                            <div>
                              <p className="text-gray-600">Lease End</p>
                              <p className="font-medium">
                                {new Date(lease.endDate).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        </>
                      ) : (
                        <p className="text-sm text-gray-400">
                          {unit.status === 'VACANT'
                            ? 'Vacant'
                            : `No active lease (${unit.status.toLowerCase()})`}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Rental Applications -- manager/landlord/admin only */}
          {canManage && (
            <div className="rounded-lg border border-gray-200 bg-white">
              <div className="border-b border-gray-200 p-6">
                <h2 className="font-semibold">Rental Applications</h2>
                <p className="text-sm text-gray-500">
                  Pending applications for units on this property
                </p>
              </div>
              <div className="divide-y divide-gray-200">
                {propertyApplications.map((application) => (
                  <ApplicationRow
                    key={application.id}
                    application={application}
                    onReviewed={() => {
                      refetchApplications();
                      refetchApproved();
                    }}
                  />
                ))}
                {propertyApplications.length === 0 && (
                  <p className="p-6 text-sm text-gray-400">No pending applications.</p>
                )}
                {awaitingTenancy.length > 0 && (
                  <div className="bg-green-50 p-4">
                    <p className="mb-2 text-sm font-medium text-green-900">
                      Approved, ready to set up a tenancy
                    </p>
                    {awaitingTenancy.map((a) => (
                      <div key={a.id} className="flex items-center justify-between py-1.5">
                        <p className="text-sm text-green-900">
                          {a.applicant?.name ?? 'Applicant'} · Unit {a.unit?.unitNumber}
                        </p>
                        <Link
                          href={`/dashboard/tenants/add?applicationId=${a.id}`}
                          className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
                        >
                          Create tenancy
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {canManage && <ViewingRequestsCard propertyId={property.id} />}

          {/* Announcements -- visible to every tenant of the property */}
          <AnnouncementsCard propertyId={property.id} canManage={canManage} />

          {/* Description */}
          {property.description && (
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <h2 className="mb-3 font-semibold">Description</h2>
              <p className="text-gray-700">{property.description}</p>
            </div>
          )}

          {/* Amenities */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-3 font-semibold">Amenities & Features</h2>
            {amenities.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {amenities.map((amenity) => (
                  <div key={amenity} className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="text-sm">{amenity}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No amenities listed.</p>
            )}
          </div>

          {/* Neighborhood Intelligence */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-4 font-semibold">Neighborhood Intelligence</h2>
            <div className="space-y-4">
              {(
                [
                  {
                    label: 'Safety Rating',
                    value: neighborhood.safety,
                    Icon: Shield,
                    color: 'bg-green-500',
                  },
                  {
                    label: 'Accessibility',
                    value: neighborhood.accessibility,
                    Icon: MapPin,
                    color: 'bg-blue-500',
                  },
                  {
                    label: 'Power Reliability',
                    value: neighborhood.powerReliability,
                    Icon: Zap,
                    color: 'bg-yellow-500',
                  },
                ] as const
              ).map(
                ({ label, value, Icon, color }) =>
                  value != null && (
                    <div key={label}>
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-gray-600" />
                          <span className="text-sm">{label}</span>
                        </div>
                        <span className="text-sm font-semibold">{value}/10</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                        <div
                          className={`h-full ${color} rounded-full`}
                          style={{ width: `${value * 10}%` }}
                        ></div>
                      </div>
                    </div>
                  ),
              )}
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Droplet className="h-4 w-4" />
                Water Supply: {property.waterSupplyType.replace('_', ' ')}
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar -- manager/landlord/admin only */}
        {canManage && (
          <div className="space-y-6">
            <ListingStatusCard
              property={property}
              onRefetch={refetchProperty}
              onOpenEdit={() => setShowEditModal(true)}
            />
            <StakeholdersCard property={property} />
            <EquipmentCard propertyId={property.id} />
            {canManage && <GateCheckCard units={property.units} />}
            <Link
              href={`/dashboard/properties/${property.id}/neighbourhood`}
              className="block rounded-lg border border-gray-200 bg-white p-6 hover:bg-gray-50"
            >
              <h2 className="font-semibold">Neighbourhood report</h2>
              <p className="mt-1 text-sm text-gray-500">
                {property.neighbourhoodReports?.length
                  ? 'Update what tenants and applicants see.'
                  : 'No report yet. Add one for tenants and applicants.'}
              </p>
            </Link>

            {/* Financial Summary */}
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <h2 className="mb-4 font-semibold">Financial Summary</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                  <span className="text-sm text-gray-600">Total Listed Rent</span>
                  <span className="font-semibold">₦{totalListedRent.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                  <span className="text-sm text-gray-600">Collected</span>
                  <span className="font-semibold text-green-600">
                    ₦{collected.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                  <span className="text-sm text-gray-600">Pending</span>
                  <span className="font-semibold">₦{pending.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                  <span className="text-sm text-gray-600">Maintenance Costs</span>
                  <span className="font-semibold text-red-600">
                    ₦{maintenanceCosts.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-sm font-semibold">Net Income</span>
                  <span className="font-bold text-green-600">₦{netIncome.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Maintenance History */}
            <div className="rounded-lg border border-gray-200 bg-white">
              <div className="border-b border-gray-200 p-6">
                <h2 className="font-semibold">Recent Maintenance</h2>
              </div>
              <div className="divide-y divide-gray-200">
                {propertyMaintenance.slice(0, 5).map((item) => (
                  <div key={item.id} className="p-4">
                    <div className="mb-1 flex items-center justify-between">
                      <p className="text-sm font-medium">{item.title}</p>
                      <span className="rounded bg-green-100 px-2 py-1 text-xs text-green-700">
                        {item.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-600">
                      <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                      <span className="font-medium">
                        {item.finalCost != null ? `₦${item.finalCost.toLocaleString()}` : '—'}
                      </span>
                    </div>
                  </div>
                ))}
                {propertyMaintenance.length === 0 && (
                  <p className="p-4 text-sm text-gray-400">No maintenance history yet.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {showEditModal && (
        <EditPropertyModal
          property={property}
          onClose={() => setShowEditModal(false)}
          onSaved={refetchProperty}
        />
      )}

      <ConfirmDialog
        open={showUnmergeConfirm}
        title="Undo Merge?"
        description={`Are you sure you want to undo merge for "${property.name}"? The listing will return to pending review.`}
        confirmLabel="Undo Merge"
        cancelLabel="Keep Merged"
        variant="warning"
        isLoading={unmerging}
        onCancel={() => setShowUnmergeConfirm(false)}
        onConfirm={handleUnmerge}
      />
    </div>
  );
}
