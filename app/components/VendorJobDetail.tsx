import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Wrench,
  MapPin,
  Calendar,
  DollarSign,
  User,
  Phone,
  CheckCircle,
  Clock,
  MessageSquare,
  AlertTriangle,
  type LucideIcon,
} from 'lucide-react';
import { useMaintenanceRequest, useUpdateMaintenanceRequest } from '@/hooks/useMaintenanceRequests';
import { useOpenConversation } from '@/hooks/useOpenConversation';
import { MAX_EVIDENCE_PHOTOS } from '@/lib/repairEvidence';
import { PhotoGrid, PhotoPicker } from './RepairPhotos';
import type { Page } from '@/app/dashboard/navigateToPage';

interface VendorJobDetailProps {
  jobId: string;
  onNavigate: (page: Page) => void;
}

const priorityConfig: Record<string, { color: string; label: string }> = {
  EMERGENCY: { color: 'red', label: 'Emergency' },
  HIGH: { color: 'red', label: 'High Priority' },
  MEDIUM: { color: 'yellow', label: 'Medium Priority' },
  LOW: { color: 'green', label: 'Low Priority' },
};

const statusConfig: Record<string, { color: string; label: string; icon: LucideIcon }> = {
  SCHEDULED: { color: 'orange', label: 'Scheduled', icon: Calendar },
  IN_PROGRESS: { color: 'blue', label: 'In Progress', icon: Clock },
  COMPLETED: { color: 'green', label: 'Completed', icon: CheckCircle },
  CANCELLED: { color: 'gray', label: 'Cancelled', icon: Clock },
};

// Same synthesized-timeline approach used in MaintenanceDetail (Phase 9.3a)
// and TenantMaintenanceRequests (Phase 9.2) -- no activity-log model exists.
function buildTimeline(request: NonNullable<ReturnType<typeof useMaintenanceRequest>['data']>) {
  const entries: { text: string; time: string }[] = [
    { text: 'Job assigned', time: new Date(request.createdAt).toLocaleString() },
  ];
  if (request.scheduledFor)
    entries.push({
      text: 'Visit scheduled',
      time: new Date(request.scheduledFor).toLocaleString(),
    });
  if (request.vendorNotes)
    entries.push({ text: request.vendorNotes, time: new Date(request.updatedAt).toLocaleString() });
  if (request.completedAt)
    entries.push({
      text: 'Marked completed',
      time: new Date(request.completedAt).toLocaleString(),
    });
  if (request.confirmationRespondedAt)
    entries.push({
      text:
        request.confirmationStatus === 'DISPUTED'
          ? 'Tenant says it is still a problem'
          : 'Tenant confirmed it is fixed',
      time: new Date(request.confirmationRespondedAt).toLocaleString(),
    });
  if (request.approvedAt)
    entries.push({
      text: `Approved by ${request.approvedBy?.name ?? 'the property team'}`,
      time: new Date(request.approvedAt).toLocaleString(),
    });
  return entries.reverse();
}

export function VendorJobDetail({ jobId, onNavigate }: VendorJobDetailProps) {
  const { data: job, loading, refetch } = useMaintenanceRequest(jobId);
  const { open: openConversation } = useOpenConversation();
  const { submit: updateJob, submitting, error: updateError } = useUpdateMaintenanceRequest(jobId);
  const [notes, setNotes] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  if (loading) {
    return <div className="p-6 text-gray-500">Loading job…</div>;
  }

  if (!job) {
    return (
      <div className="p-6">
        <Link
          href="/dashboard"
          className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Jobs
        </Link>
        <p className="text-gray-500">Job not found.</p>
      </div>
    );
  }

  const priority = priorityConfig[job.priority];
  const status = statusConfig[job.status] ?? statusConfig.SCHEDULED;
  const StatusIcon = status.icon;
  const timeline = buildTimeline(job);
  const isOpen = job.status !== 'COMPLETED' && job.status !== 'CANCELLED';
  // Once the tenant has confirmed or the property team has approved, the evidence is locked.
  const signedOff = Boolean(job.approvedAt) || job.confirmationStatus === 'CONFIRMED';
  const canEditPhotos = job.status !== 'CANCELLED' && !signedOff;
  const alreadyInvoiced = (job.invoices ?? []).some((inv) => inv.status !== 'CANCELLED');

  const savePhotos = async (side: 'beforePhotoUrls' | 'afterPhotoUrls', urls: string[]) => {
    setActionError(null);
    try {
      await updateJob({ [side]: urls.slice(0, MAX_EVIDENCE_PHOTOS) });
      refetch();
    } catch {
      // surfaced through updateError
    }
  };

  // A job that was sent back already has its invoice, so finishing it again needs no new bill.
  const handleMarkDone = async () => {
    setActionError(null);
    try {
      await updateJob({ status: 'COMPLETED' });
      refetch();
    } catch {
      // surfaced through updateError
    }
  };

  const handleUpdateStatus = async () => {
    setActionError(null);
    try {
      await updateJob({
        status: 'IN_PROGRESS',
        ...(notes.trim() ? { vendorNotes: notes.trim() } : {}),
      });
      setNotes('');
      refetch();
    } catch {
      setActionError('Failed to update job status');
    }
  };

  const handleSaveNotes = async () => {
    if (!notes.trim()) return;
    setActionError(null);
    try {
      await updateJob({ vendorNotes: notes.trim() });
      setNotes('');
      refetch();
    } catch {
      setActionError('Failed to save notes');
    }
  };

  return (
    <div className="p-6">
      <Link
        href="/dashboard"
        className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-5 w-5" />
        Back to Jobs
      </Link>

      {(actionError ?? updateError) && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {actionError ?? updateError}
        </div>
      )}

      {/* Header */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-lg bg-${priority.color}-50`}
            >
              <Wrench className={`h-6 w-6 text-${priority.color}-600`} />
            </div>
            <div>
              <h1 className="mb-1 text-2xl font-semibold">{job.title}</h1>
              <p className="text-sm text-gray-600">
                Job #{job.id.slice(0, 8)} • {job.category?.name ?? 'Uncategorized'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 text-sm font-medium bg-${priority.color}-100 text-${priority.color}-700`}
            >
              {priority.label}
            </span>
            <span
              className={`flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium bg-${status.color}-100 text-${status.color}-700`}
            >
              <StatusIcon className="h-4 w-4" />
              {status.label}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="mb-1 text-gray-600">Assigned</p>
            <p className="font-medium">{new Date(job.createdAt).toLocaleDateString()}</p>
          </div>
          <div>
            <p className="mb-1 text-gray-600">Scheduled</p>
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4 text-gray-400" />
              <p className="font-medium">
                {job.scheduledFor
                  ? new Date(job.scheduledFor).toLocaleDateString()
                  : 'Not scheduled'}
              </p>
            </div>
          </div>
          <div>
            <p className="mb-1 text-gray-600">
              {job.finalCost != null ? 'Final Payment' : 'Estimated Payment'}
            </p>
            <div className="flex items-center gap-1">
              <DollarSign className="h-4 w-4 text-green-600" />
              <p className="font-semibold text-green-600">
                {job.finalCost != null
                  ? `₦${job.finalCost.toLocaleString()}`
                  : job.costEstimate != null
                    ? `₦${job.costEstimate.toLocaleString()}`
                    : '—'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="space-y-6 lg:col-span-2">
          {/* The tenant said the earlier work did not fix it */}
          {job.disputeReason && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-6">
              <h2 className="mb-2 flex items-center gap-2 font-semibold text-red-900">
                <AlertTriangle className="h-5 w-5" />
                The tenant says this is still a problem
              </h2>
              <p className="text-sm whitespace-pre-line text-red-900">{job.disputeReason}</p>
              <div className="mt-3">
                <PhotoGrid urls={job.disputePhotoUrls ?? []} label="Tenant photo" />
              </div>
            </div>
          )}

          {/* Description */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-3 font-semibold">Job Description</h2>
            <p className="text-gray-700">{job.description}</p>
          </div>

          {/* Property Info */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-4 font-semibold">Property Information</h2>
            <div className="space-y-3">
              <div>
                <p className="mb-1 text-sm text-gray-600">Address</p>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-gray-400" />
                  <p className="font-medium">
                    {job.unit?.property
                      ? `${job.unit.property.address}, ${job.unit.property.city}`
                      : 'N/A'}{' '}
                    · Unit {job.unit?.unitNumber}
                  </p>
                </div>
              </div>
              <div>
                <p className="mb-1 text-sm text-gray-600">Entry</p>
                <p className="text-sm text-gray-700">
                  Entry is arranged with the tenant: message them or call the number shown here.
                  Gate codes are not shared with vendors in the app.
                </p>
              </div>
            </div>
          </div>

          {/* Status Update */}
          {job.status !== 'COMPLETED' && job.status !== 'CANCELLED' && (
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <h2 className="mb-4 font-semibold">Update Job Status</h2>
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Progress Notes
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add notes about the work progress..."
                    rows={3}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div className="flex gap-2">
                  {job.status === 'SCHEDULED' && (
                    <button
                      onClick={handleUpdateStatus}
                      disabled={submitting}
                      className="flex-1 rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {submitting ? 'Saving…' : 'Mark In Progress'}
                    </button>
                  )}
                  <button
                    onClick={handleSaveNotes}
                    disabled={submitting || !notes.trim()}
                    className="flex-1 rounded-lg border border-gray-300 px-4 py-3 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Save Notes
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Photos */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-1 font-semibold">Work Photos</h2>
            <p className="mb-4 text-sm text-gray-500">
              Show the work. At least one photo of the finished job is needed to close it.
              {signedOff && ' This repair has been signed off, so its photos are locked.'}
            </p>

            <div className="space-y-5">
              <div>
                <p className="mb-2 text-sm font-medium text-gray-700">Before the work</p>
                <PhotoGrid
                  urls={job.beforePhotoUrls ?? []}
                  label="Before photo"
                  emptyText="No before photos yet."
                  onRemove={
                    canEditPhotos
                      ? (url) =>
                          savePhotos(
                            'beforePhotoUrls',
                            (job.beforePhotoUrls ?? []).filter((u) => u !== url),
                          )
                      : undefined
                  }
                />
                {canEditPhotos && (
                  <div className="mt-2">
                    <PhotoPicker
                      label="Add before photos"
                      disabled={submitting}
                      full={(job.beforePhotoUrls ?? []).length >= MAX_EVIDENCE_PHOTOS}
                      onUploaded={(urls) =>
                        savePhotos('beforePhotoUrls', [...(job.beforePhotoUrls ?? []), ...urls])
                      }
                    />
                  </div>
                )}
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-gray-700">After the work</p>
                <PhotoGrid
                  urls={job.afterPhotoUrls ?? []}
                  label="After photo"
                  emptyText="No after photos yet."
                  onRemove={
                    canEditPhotos
                      ? (url) =>
                          savePhotos(
                            'afterPhotoUrls',
                            (job.afterPhotoUrls ?? []).filter((u) => u !== url),
                          )
                      : undefined
                  }
                />
                {canEditPhotos && (
                  <div className="mt-2">
                    <PhotoPicker
                      label="Add after photos"
                      disabled={submitting}
                      full={(job.afterPhotoUrls ?? []).length >= MAX_EVIDENCE_PHOTOS}
                      onUploaded={(urls) =>
                        savePhotos('afterPhotoUrls', [...(job.afterPhotoUrls ?? []), ...urls])
                      }
                    />
                  </div>
                )}
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-gray-700">Photos from the tenant</p>
                <PhotoGrid
                  urls={job.mediaUrls ?? []}
                  label="Tenant photo"
                  emptyText="The tenant attached no photos."
                />
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Property Manager */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-4 font-semibold">Property Manager</h2>
            {job.unit?.property?.manager ? (
              <>
                <div className="mb-4">
                  <p className="font-medium">{job.unit.property.manager.name}</p>
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Phone className="h-4 w-4" />
                      {job.unit.property.manager.phoneNumber ?? 'N/A'}
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <User className="h-4 w-4" />
                      {job.unit.property.manager.email}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() =>
                    openConversation({ type: 'MAINTENANCE_THREAD', maintenanceRequestId: job.id })
                  }
                  className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  <MessageSquare className="mr-2 inline h-4 w-4" />
                  Message Manager
                </button>
              </>
            ) : (
              <p className="text-sm text-gray-400">No property manager on file.</p>
            )}
          </div>

          {/* Tenant Info */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-4 font-semibold">Tenant</h2>
            <div className="mb-4">
              <p className="font-medium">{job.tenant?.name ?? 'Unknown tenant'}</p>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <Phone className="h-4 w-4" />
                  {job.tenant?.phoneNumber ?? 'N/A'}
                </div>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-4 font-semibold">Job Timeline</h2>
            <div className="space-y-4">
              {timeline.map((item, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    </div>
                    {index < timeline.length - 1 && <div className="h-8 w-0.5 bg-green-300"></div>}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{item.text}</p>
                    <p className="text-xs text-gray-500">{item.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Complete Job */}
          {isOpen && !alreadyInvoiced && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-6">
              <h3 className="mb-2 font-semibold text-green-900">Ready to Complete?</h3>
              <p className="mb-4 text-sm text-green-800">
                Create your invoice for this job to get paid and close it out.
              </p>
              <button
                onClick={() => onNavigate({ type: 'vendor-create-invoice', jobId: job.id })}
                className="w-full rounded-lg bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-700"
              >
                Mark Complete & Create Invoice
              </button>
            </div>
          )}

          {isOpen && alreadyInvoiced && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-6">
              <h3 className="mb-2 font-semibold text-green-900">Finished the work?</h3>
              <p className="mb-4 text-sm text-green-800">
                Your invoice is already sent, so there is no new bill. Add a photo of the finished
                work, then mark the job done.
              </p>
              <button
                onClick={handleMarkDone}
                disabled={submitting}
                className="w-full rounded-lg bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {submitting ? 'Saving…' : 'Mark work done'}
              </button>
            </div>
          )}

          {job.status === 'COMPLETED' && (
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <h3 className="mb-2 font-semibold">Sign-off</h3>
              <p className="text-sm text-gray-700">
                {job.approvedAt
                  ? `Approved by ${job.approvedBy?.name ?? 'the property team'}.`
                  : job.confirmationStatus === 'CONFIRMED'
                    ? 'The tenant confirmed the repair is fixed.'
                    : job.confirmationStatus === 'AWAITING_TENANT'
                      ? 'Waiting for the tenant to confirm the repair is fixed. This does not hold up your payment.'
                      : job.confirmationStatus === 'DISPUTED'
                        ? 'The tenant says it is still a problem. The property team will decide what happens next.'
                        : 'Finished. Nothing more is needed from you.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
