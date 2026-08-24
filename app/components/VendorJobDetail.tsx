import { useState } from 'react';
import { ArrowLeft, Wrench, MapPin, Calendar, DollarSign, User, Phone, CheckCircle, Clock, Image as ImageIcon, MessageSquare } from 'lucide-react';
import { useMaintenanceRequest, useUpdateMaintenanceRequest } from '@/hooks/useMaintenanceRequests';
import { useAccessCodes } from '@/hooks/useAccessCodes';

interface VendorJobDetailProps {
  jobId: string;
  onBack: () => void;
  onNavigate: (page: any) => void;
}

const priorityConfig: Record<string, { color: string; label: string }> = {
  EMERGENCY: { color: 'red', label: 'Emergency' },
  HIGH: { color: 'red', label: 'High Priority' },
  MEDIUM: { color: 'yellow', label: 'Medium Priority' },
  LOW: { color: 'green', label: 'Low Priority' },
};

const statusConfig: Record<string, { color: string; label: string; icon: any }> = {
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
  if (request.scheduledFor) entries.push({ text: 'Visit scheduled', time: new Date(request.scheduledFor).toLocaleString() });
  if (request.vendorNotes) entries.push({ text: request.vendorNotes, time: new Date(request.updatedAt).toLocaleString() });
  if (request.completedAt) entries.push({ text: 'Marked completed', time: new Date(request.completedAt).toLocaleString() });
  return entries.reverse();
}

export function VendorJobDetail({ jobId, onBack, onNavigate }: VendorJobDetailProps) {
  const { data: job, loading, refetch } = useMaintenanceRequest(jobId);
  const { submit: updateJob, submitting } = useUpdateMaintenanceRequest(jobId);
  const { data: accessCodes, loading: accessCodesLoading } = useAccessCodes(job?.unitId ?? null);
  const [notes, setNotes] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  if (loading) {
    return <div className="p-6 text-gray-500">Loading job…</div>;
  }

  if (!job) {
    return (
      <div className="p-6">
        <button onClick={onBack} className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-5 w-5" />
          Back to Jobs
        </button>
        <p className="text-gray-500">Job not found.</p>
      </div>
    );
  }

  const priority = priorityConfig[job.priority];
  const status = statusConfig[job.status] ?? statusConfig.SCHEDULED;
  const StatusIcon = status.icon;
  const timeline = buildTimeline(job);
  const activeCode = accessCodes.find((c) => c.status === 'ACTIVE');

  const handleUpdateStatus = async () => {
    setActionError(null);
    try {
      await updateJob({ status: 'IN_PROGRESS', ...(notes.trim() ? { vendorNotes: notes.trim() } : {}) });
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
      <button onClick={onBack} className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900">
        <ArrowLeft className="h-5 w-5" />
        Back to Jobs
      </button>

      {actionError && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{actionError}</div>}

      {/* Header */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex h-12 w-12 items-center justify-center rounded-lg bg-${priority.color}-50`}>
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
            <span className={`rounded-full px-3 py-1 text-sm font-medium bg-${priority.color}-100 text-${priority.color}-700`}>{priority.label}</span>
            <span className={`flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium bg-${status.color}-100 text-${status.color}-700`}>
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
              <p className="font-medium">{job.scheduledFor ? new Date(job.scheduledFor).toLocaleDateString() : 'Not scheduled'}</p>
            </div>
          </div>
          <div>
            <p className="mb-1 text-gray-600">{job.finalCost != null ? 'Final Payment' : 'Estimated Payment'}</p>
            <div className="flex items-center gap-1">
              <DollarSign className="h-4 w-4 text-green-600" />
              <p className="font-semibold text-green-600">
                {job.finalCost != null ? `₦${job.finalCost.toLocaleString()}` : job.costEstimate != null ? `₦${job.costEstimate.toLocaleString()}` : '—'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="space-y-6 lg:col-span-2">
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
                    {job.unit?.property ? `${job.unit.property.address}, ${job.unit.property.city}` : 'N/A'} · Unit {job.unit?.unitNumber}
                  </p>
                </div>
              </div>
              <div>
                <p className="mb-1 text-sm text-gray-600">Access Code</p>
                <p className="text-sm">
                  {accessCodesLoading
                    ? 'Loading…'
                    : activeCode
                      ? `${activeCode.code} (${activeCode.guestName ?? 'gate access'})`
                      : 'No active access code on file — contact tenant to arrange entry.'}
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
                  <label className="mb-2 block text-sm font-medium text-gray-700">Progress Notes</label>
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
            <h2 className="mb-4 font-semibold">Work Documentation</h2>
            {job.mediaUrls.length > 0 ? (
              <div className="grid grid-cols-3 gap-3">
                {job.mediaUrls.map((url, i) => (
                  <div key={i} className="flex aspect-square items-center justify-center rounded-lg border border-gray-200 bg-gray-100">
                    <div className="text-center">
                      <ImageIcon className="mx-auto mb-1 h-6 w-6 text-gray-400" />
                      <p className="text-xs text-gray-500">{url}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No photos uploaded for this job yet.</p>
            )}
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
                  onClick={() => onNavigate({ type: 'messages' })}
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
          {job.status !== 'COMPLETED' && job.status !== 'CANCELLED' && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-6">
              <h3 className="mb-2 font-semibold text-green-900">Ready to Complete?</h3>
              <p className="mb-4 text-sm text-green-800">Create your invoice for this job to get paid. Your property manager will mark the job as officially completed.</p>
              <button
                onClick={() => onNavigate({ type: 'vendor-create-invoice', jobId: job.id })}
                className="w-full rounded-lg bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-700"
              >
                Mark Complete & Create Invoice
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
