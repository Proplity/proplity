import { useState } from 'react';
import {
  ArrowLeft,
  Wrench,
  MapPin,
  DollarSign,
  AlertCircle,
  CheckCircle,
  Clock,
  Image as ImageIcon,
  Phone,
  Search,
  Star,
  X,
  UserCheck,
} from 'lucide-react';
import { useMaintenanceRequest, useUpdateMaintenanceRequest } from '@/hooks/useMaintenanceRequests';
import { useVendors } from '@/hooks/useVendors';

interface MaintenanceDetailProps {
  requestId: string;
  onBack: () => void;
}

const priorityConfig: Record<string, { color: string; label: string }> = {
  EMERGENCY: { color: 'red', label: 'Emergency' },
  HIGH: { color: 'red', label: 'High Priority' },
  MEDIUM: { color: 'yellow', label: 'Medium Priority' },
  LOW: { color: 'green', label: 'Low Priority' },
};

const statusConfig: Record<string, { color: string; label: string; icon: any }> = {
  SUBMITTED: { color: 'orange', label: 'New', icon: AlertCircle },
  IN_PROGRESS: { color: 'blue', label: 'In Progress', icon: Clock },
  SCHEDULED: { color: 'blue', label: 'Scheduled', icon: Clock },
  COMPLETED: { color: 'green', label: 'Completed', icon: CheckCircle },
  CANCELLED: { color: 'gray', label: 'Cancelled', icon: X },
};

// Same approach as TenantMaintenanceRequests (Phase 9.2): no activity-log
// model exists, so a short timeline is synthesized from the real
// timestamped fields the request actually has.
function buildTimeline(request: NonNullable<ReturnType<typeof useMaintenanceRequest>['data']>) {
  const entries: { text: string; time: string }[] = [
    { text: 'Request submitted', time: new Date(request.createdAt).toLocaleString() },
  ];
  if (request.vendor) entries.push({ text: `Assigned to ${request.vendor.name}`, time: new Date(request.updatedAt).toLocaleString() });
  if (request.scheduledFor) entries.push({ text: 'Visit scheduled', time: new Date(request.scheduledFor).toLocaleString() });
  if (request.vendorNotes) entries.push({ text: request.vendorNotes, time: new Date(request.updatedAt).toLocaleString() });
  if (request.completedAt) entries.push({ text: 'Marked completed', time: new Date(request.completedAt).toLocaleString() });
  return entries.reverse();
}

export function MaintenanceDetail({ requestId, onBack }: MaintenanceDetailProps) {
  const { data: request, loading, refetch } = useMaintenanceRequest(requestId);
  const { submit: updateRequest, submitting } = useUpdateMaintenanceRequest(requestId);
  const { data: vendors, loading: vendorsLoading } = useVendors();

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [vendorSearch, setVendorSearch] = useState('');
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [finalCost, setFinalCost] = useState('');
  const [completionProofUrl, setCompletionProofUrl] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  if (loading) {
    return <div className="p-6 text-gray-500">Loading request…</div>;
  }

  if (!request) {
    return (
      <div className="p-6">
        <button onClick={onBack} className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-5 w-5" />
          Back to Maintenance
        </button>
        <p className="text-gray-500">Request not found.</p>
      </div>
    );
  }

  const currentStatus = statusConfig[request.status];
  const currentPriority = priorityConfig[request.priority];
  const StatusIcon = currentStatus.icon;
  const timeline = buildTimeline(request);

  const filteredVendors = vendors.filter(
    (v) =>
      v.businessName.toLowerCase().includes(vendorSearch.toLowerCase()) ||
      v.categories.some((c) => c.toLowerCase().includes(vendorSearch.toLowerCase())),
  );

  const handleAssign = async (vendorId: string) => {
    setActionError(null);
    try {
      await updateRequest({ vendorId });
      setShowAssignModal(false);
      refetch();
    } catch {
      setActionError('Failed to assign vendor');
    }
  };

  const handleComplete = async () => {
    const cost = Number(finalCost);
    if (!completionProofUrl.trim() || !Number.isFinite(cost) || cost < 0) {
      setActionError('A completion proof URL and a valid final cost are required');
      return;
    }
    setActionError(null);
    try {
      await updateRequest({ status: 'COMPLETED', completionProofUrl: completionProofUrl.trim(), finalCost: cost });
      setShowCompleteModal(false);
      refetch();
    } catch {
      setActionError('Failed to mark as completed');
    }
  };

  const handleCancel = async () => {
    if (!confirm('Cancel this maintenance request?')) return;
    setActionError(null);
    try {
      await updateRequest({ status: 'CANCELLED' });
      refetch();
    } catch {
      setActionError('Failed to cancel request');
    }
  };

  return (
    <div className="p-6">
      <button onClick={onBack} className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900">
        <ArrowLeft className="h-5 w-5" />
        Back to Maintenance
      </button>

      {actionError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{actionError}</div>
      )}

      {/* Header */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex h-12 w-12 items-center justify-center rounded-lg bg-${currentPriority.color}-50`}>
              <Wrench className={`h-6 w-6 text-${currentPriority.color}-600`} />
            </div>
            <div>
              <h1 className="mb-1 text-2xl font-semibold">{request.title}</h1>
              <p className="text-sm text-gray-600">
                Request #{request.id.slice(0, 8)} • {request.category?.name ?? 'Uncategorized'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 text-sm font-medium bg-${currentPriority.color}-100 text-${currentPriority.color}-700`}
            >
              {currentPriority.label}
            </span>
            <span
              className={`flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium bg-${currentStatus.color}-100 text-${currentStatus.color}-700`}
            >
              <StatusIcon className="h-4 w-4" />
              {currentStatus.label}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="mb-1 text-gray-600">Submitted</p>
            <p className="font-medium">{new Date(request.createdAt).toLocaleString()}</p>
          </div>
          <div>
            <p className="mb-1 text-gray-600">Last Updated</p>
            <p className="font-medium">{new Date(request.updatedAt).toLocaleString()}</p>
          </div>
          <div>
            <p className="mb-1 text-gray-600">Property</p>
            <div className="flex items-center gap-1">
              <MapPin className="h-4 w-4 text-gray-400" />
              <p className="font-medium">
                {request.unit?.property?.name ?? '—'} · {request.unit?.unitNumber}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="space-y-6 lg:col-span-2">
          {/* Triage */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-3 font-semibold">Triage</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="mb-1 text-gray-600">Category</p>
                <p className="font-semibold">{request.category?.name ?? 'Uncategorized'}</p>
              </div>
              <div>
                <p className="mb-1 text-gray-600">Priority</p>
                <p className="font-semibold">{currentPriority.label}</p>
              </div>
              <div>
                <p className="mb-1 text-gray-600">Cost Estimate</p>
                <p className="font-semibold">
                  {request.costEstimate != null ? `₦${request.costEstimate.toLocaleString()}` : '—'}
                </p>
              </div>
              <div>
                <p className="mb-1 text-gray-600">Scheduled For</p>
                <p className="font-semibold">
                  {request.scheduledFor ? new Date(request.scheduledFor).toLocaleDateString() : 'Not scheduled'}
                </p>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-3 font-semibold">Description</h2>
            <p className="text-gray-700">{request.description}</p>
          </div>

          {/* Images */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-4 font-semibold">Photos & Evidence</h2>
            {request.mediaUrls.length > 0 ? (
              <div className="grid grid-cols-2 gap-4">
                {request.mediaUrls.map((url, i) => (
                  <div key={i} className="flex aspect-video items-center justify-center rounded-lg border border-gray-200 bg-gray-100">
                    <div className="text-center">
                      <ImageIcon className="mx-auto mb-2 h-8 w-8 text-gray-400" />
                      <p className="text-xs text-gray-600">{url}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No photos attached to this request.</p>
            )}
          </div>

          {/* Timeline */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-4 font-semibold">Timeline</h2>
            <div className="space-y-4">
              {timeline.map((item, index) => (
                <div key={index} className="flex items-start gap-4">
                  <div className="flex flex-col items-center">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    </div>
                    {index < timeline.length - 1 && <div className="h-12 w-0.5 bg-green-300"></div>}
                  </div>
                  <div className="flex-1 pb-4">
                    <p className="font-medium text-gray-900">{item.text}</p>
                    <p className="text-xs text-gray-500">{item.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Tenant Info */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-4 font-semibold">Submitted By</h2>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500 font-semibold text-white">
                {(request.tenant?.name ?? '?').charAt(0)}
              </div>
              <div>
                <p className="font-medium">{request.tenant?.name ?? 'Unknown tenant'}</p>
                <p className="text-xs text-gray-600">Tenant</p>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-gray-600">
                <Phone className="h-4 w-4" />
                {request.tenant?.phoneNumber ?? 'N/A'}
              </div>
              <div className="flex items-center gap-2 break-all text-gray-600">{request.tenant?.email}</div>
            </div>
          </div>

          {/* Assigned Vendor Card */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold">Assigned Vendor</h2>
              {request.vendor && (
                <span className="flex items-center gap-1 text-xs font-medium text-green-600">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500"></span>
                  Active
                </span>
              )}
            </div>

            {request.vendor ? (
              <>
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500 font-semibold text-white">
                    {request.vendor.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium">{request.vendor.name}</p>
                    {request.vendor.phoneNumber && (
                      <p className="flex items-center gap-1 text-xs text-gray-500">
                        <Phone className="h-3 w-3" />
                        {request.vendor.phoneNumber}
                      </p>
                    )}
                  </div>
                </div>
                {request.vendorRating && (
                  <div className="mb-4 flex items-center gap-1 text-sm">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`h-4 w-4 ${i < request.vendorRating!.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
                      />
                    ))}
                    <span className="ml-1 text-xs text-gray-600">Rated by tenant</span>
                  </div>
                )}
                <button
                  onClick={() => setShowAssignModal(true)}
                  className="w-full rounded-lg border border-blue-300 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50"
                >
                  Reassign Vendor
                </button>
              </>
            ) : (
              <div className="py-4 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                  <UserCheck className="h-6 w-6 text-gray-400" />
                </div>
                <p className="mb-4 text-sm text-gray-500">No vendor assigned yet</p>
                <button
                  onClick={() => setShowAssignModal(true)}
                  className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  + Assign Vendor
                </button>
              </div>
            )}
          </div>

          {/* Actions */}
          {request.status !== 'COMPLETED' && request.status !== 'CANCELLED' && (
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <h2 className="mb-4 font-semibold">Actions</h2>
              <div className="space-y-2">
                <button
                  onClick={() => setShowCompleteModal(true)}
                  disabled={submitting}
                  className="w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  Mark as Completed
                </button>
                <button
                  onClick={handleCancel}
                  disabled={submitting}
                  className="w-full rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  Cancel Request
                </button>
              </div>
            </div>
          )}

          {/* Cost Tracking */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-4 font-semibold">Cost Tracking</h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Estimated Cost</span>
                <span className="font-semibold">
                  {request.costEstimate != null ? `₦${request.costEstimate.toLocaleString()}` : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Final Cost</span>
                <span className="font-semibold">
                  {request.finalCost != null ? `₦${request.finalCost.toLocaleString()}` : 'Pending'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Assign Vendor Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowAssignModal(false)}>
          <div
            className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 p-6">
              <div>
                <h2 className="text-lg font-semibold">Select a Vendor</h2>
                <p className="text-sm text-gray-500">
                  Assigning for: {request.title} — {request.unit?.property?.name}
                </p>
              </div>
              <button onClick={() => setShowAssignModal(false)} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="border-b border-gray-100 p-4">
              <div className="relative">
                <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={vendorSearch}
                  onChange={(e) => setVendorSearch(e.target.value)}
                  placeholder="Search by business name or category..."
                  className="w-full rounded-lg border border-gray-300 py-2 pr-4 pl-9 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {vendorsLoading && <p className="text-sm text-gray-500">Loading vendors…</p>}
              {filteredVendors.map((vendor) => (
                <button
                  key={vendor.id}
                  onClick={() => handleAssign(vendor.id)}
                  disabled={submitting}
                  className="w-full rounded-xl border-2 border-gray-200 p-4 text-left transition-all hover:border-blue-300 hover:bg-gray-50 disabled:opacity-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-500 font-semibold text-white">
                        {vendor.businessName.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{vendor.businessName}</p>
                        <p className="mt-0.5 text-xs text-gray-500">
                          {vendor.categories.join(', ') || 'General'} {vendor.coverageArea ? `· ${vendor.coverageArea}` : ''}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-3">
                          {vendor.rating != null ? (
                            <span className="flex items-center gap-0.5">
                              {[...Array(5)].map((_, i) => (
                                <Star key={i} className={`h-3 w-3 ${i < Math.round(vendor.rating!) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
                              ))}
                              <span className="ml-1 text-xs text-gray-600">{vendor.rating.toFixed(1)}</span>
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">No ratings yet</span>
                          )}
                          <span className="text-xs text-gray-500">{vendor.jobsDone} jobs done</span>
                          {vendor.completionRate != null && (
                            <span className="text-xs font-medium text-green-600">{vendor.completionRate}% completion</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
              {!vendorsLoading && filteredVendors.length === 0 && (
                <p className="py-8 text-center text-sm text-gray-400">No vendors match your search.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mark Completed Modal */}
      {showCompleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowCompleteModal(false)}>
          <div className="w-full max-w-md rounded-xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-lg font-semibold">Mark as Completed</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-gray-600">Completion proof URL</label>
                <input
                  value={completionProofUrl}
                  onChange={(e) => setCompletionProofUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 flex items-center gap-1 text-sm text-gray-600">
                  <DollarSign className="h-3.5 w-3.5" /> Final cost (₦)
                </label>
                <input
                  value={finalCost}
                  onChange={(e) => setFinalCost(e.target.value)}
                  type="number"
                  min="0"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowCompleteModal(false)}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleComplete}
                disabled={submitting}
                className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {submitting ? 'Saving…' : 'Confirm Completion'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
