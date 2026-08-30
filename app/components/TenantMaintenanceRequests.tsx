import { useState } from 'react';
import {
  Wrench,
  CheckCircle,
  Clock,
  AlertCircle,
  Search,
  Plus,
  X,
  ChevronDown,
  MapPin,
} from 'lucide-react';
import { useMaintenanceRequests } from '@/hooks/useMaintenanceRequests';
import type { MaintenanceRequest } from '@/lib/api/types';

interface TenantMaintenanceRequestsProps {
  onNavigate: (page: any) => void;
}

const statusConfig = {
  SUBMITTED: { label: 'New', color: 'bg-orange-100 text-orange-700', icon: AlertCircle },
  IN_PROGRESS: { label: 'In Progress', color: 'bg-blue-100 text-blue-700', icon: Clock },
  SCHEDULED: { label: 'Scheduled', color: 'bg-blue-100 text-blue-700', icon: Clock },
  COMPLETED: { label: 'Completed', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  CANCELLED: { label: 'Cancelled', color: 'bg-gray-100 text-gray-600', icon: X },
};

const priorityConfig = {
  EMERGENCY: { label: 'Emergency', color: 'text-red-700 bg-red-50 border-red-300' },
  HIGH: { label: 'High', color: 'text-red-600 bg-red-50 border-red-200' },
  MEDIUM: { label: 'Medium', color: 'text-yellow-700 bg-yellow-50 border-yellow-200' },
  LOW: { label: 'Low', color: 'text-gray-600 bg-gray-50 border-gray-200' },
};

// No activity-log model exists for a MaintenanceRequest (CLAUDE.md doesn't
// list one) -- synthesized from the real timestamped fields we do have
// instead of fabricating a per-event history.
function buildTimeline(request: MaintenanceRequest) {
  const entries: { text: string; time: string }[] = [
    { text: 'Request submitted', time: new Date(request.createdAt).toLocaleString() },
  ];
  if (request.vendor) {
    entries.push({
      text: `Assigned to ${request.vendor.name}`,
      time: new Date(request.updatedAt).toLocaleString(),
    });
  }
  if (request.scheduledFor) {
    entries.push({
      text: 'Visit scheduled',
      time: new Date(request.scheduledFor).toLocaleString(),
    });
  }
  if (request.vendorNotes) {
    entries.push({ text: request.vendorNotes, time: new Date(request.updatedAt).toLocaleString() });
  }
  if (request.completedAt) {
    entries.push({
      text: 'Marked completed',
      time: new Date(request.completedAt).toLocaleString(),
    });
  }
  return entries.reverse();
}

export function TenantMaintenanceRequests({ onNavigate }: TenantMaintenanceRequestsProps) {
  const { data: allRequests, loading, error } = useMaintenanceRequests();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = allRequests.filter((r) => {
    const matchSearch =
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      (r.category?.name.toLowerCase().includes(search.toLowerCase()) ?? false) ||
      r.id.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const counts = {
    all: allRequests.length,
    SUBMITTED: allRequests.filter((r) => r.status === 'SUBMITTED').length,
    IN_PROGRESS: allRequests.filter((r) => r.status === 'IN_PROGRESS' || r.status === 'SCHEDULED')
      .length,
    COMPLETED: allRequests.filter((r) => r.status === 'COMPLETED').length,
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="mb-1 text-2xl font-semibold">Maintenance Requests</h1>
          <p className="text-sm text-gray-500">Track and manage your maintenance requests</p>
        </div>
        <button
          onClick={() => onNavigate({ type: 'maintenance-request-form' })}
          className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-orange-700"
        >
          <Plus className="h-4 w-4" />
          New Request
        </button>
      </div>

      {/* Summary Chips */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'all', label: `All (${counts.all})` },
          { id: 'SUBMITTED', label: `New (${counts.SUBMITTED})` },
          { id: 'IN_PROGRESS', label: `In Progress (${counts.IN_PROGRESS})` },
          { id: 'COMPLETED', label: `Completed (${counts.COMPLETED})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setStatusFilter(tab.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              statusFilter === tab.id
                ? 'bg-blue-600 text-white'
                : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
        <div className="relative ml-auto">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search requests..."
            className="w-52 rounded-lg border border-gray-300 py-2 pr-4 pl-9 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
      </div>

      {loading && <p className="text-sm text-gray-500">Loading requests…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Request List */}
      <div className="space-y-3">
        {filtered.map((request) => {
          const sConfig = statusConfig[request.status];
          const pConfig = priorityConfig[request.priority];
          const SIcon = sConfig.icon;
          const isExpanded = expandedId === request.id;
          const timeline = buildTimeline(request);

          return (
            <div
              key={request.id}
              className="overflow-hidden rounded-xl border border-gray-200 bg-white transition-shadow hover:shadow-md"
            >
              {/* Card Header — clickable */}
              <button
                className="w-full p-5 text-left"
                onClick={() => setExpandedId(isExpanded ? null : request.id)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                        request.status === 'COMPLETED'
                          ? 'bg-green-50'
                          : request.status === 'IN_PROGRESS' || request.status === 'SCHEDULED'
                            ? 'bg-blue-50'
                            : 'bg-orange-50'
                      }`}
                    >
                      <Wrench
                        className={`h-5 w-5 ${
                          request.status === 'COMPLETED'
                            ? 'text-green-600'
                            : request.status === 'IN_PROGRESS' || request.status === 'SCHEDULED'
                              ? 'text-blue-600'
                              : 'text-orange-600'
                        }`}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-gray-400">
                          {request.id.slice(0, 8)}
                        </span>
                        <span
                          className={`rounded border px-2 py-0.5 text-xs font-medium ${pConfig.color}`}
                        >
                          {pConfig.label}
                        </span>
                      </div>
                      <p className="font-semibold text-gray-900">{request.title}</p>
                      <p className="mt-0.5 truncate text-sm text-gray-500">{request.description}</p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    <div className="hidden text-right sm:block">
                      <p className="text-xs text-gray-400">Submitted</p>
                      <p className="text-xs font-medium text-gray-600">
                        {new Date(request.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${sConfig.color}`}
                    >
                      <SIcon className="h-3 w-3" />
                      {sConfig.label}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    />
                  </div>
                </div>
              </button>

              {/* Expanded Detail */}
              {isExpanded && (
                <div className="space-y-5 border-t border-gray-100 px-5 pt-4 pb-5">
                  {/* Details row */}
                  <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                    <div>
                      <p className="mb-0.5 text-xs text-gray-400">Category</p>
                      <p className="font-medium">{request.category?.name ?? 'Uncategorized'}</p>
                    </div>
                    <div>
                      <p className="mb-0.5 text-xs text-gray-400">Unit</p>
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-gray-400" />
                        <p className="text-xs font-medium">{request.unit?.unitNumber ?? 'N/A'}</p>
                      </div>
                    </div>
                    <div>
                      <p className="mb-0.5 text-xs text-gray-400">Assigned To</p>
                      <p className="font-medium">{request.vendor?.name ?? 'Awaiting assignment'}</p>
                    </div>
                    <div>
                      <p className="mb-0.5 text-xs text-gray-400">
                        {request.completedAt ? 'Resolved' : 'Submitted'}
                      </p>
                      <p className="font-medium">
                        {new Date(request.completedAt ?? request.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {/* Full description */}
                  <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
                    {request.description}
                  </div>

                  {/* Timeline */}
                  <div>
                    <p className="mb-3 text-xs font-semibold tracking-wide text-gray-500 uppercase">
                      Activity Timeline
                    </p>
                    <div className="space-y-3">
                      {timeline.map((update, i) => (
                        <div key={i} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div
                              className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${i === 0 ? 'bg-blue-500' : 'bg-green-500'}`}
                            />
                            {i < timeline.length - 1 && (
                              <div
                                className="mt-1 w-px flex-1 bg-gray-200"
                                style={{ minHeight: '16px' }}
                              />
                            )}
                          </div>
                          <div className="flex-1 pb-1">
                            <p className="text-sm text-gray-800">{update.text}</p>
                            <p className="mt-0.5 text-xs text-gray-400">{update.time}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && !loading && (
          <div className="py-16 text-center text-gray-400">
            <Wrench className="mx-auto mb-3 h-10 w-10 opacity-30" />
            <p className="text-sm">No maintenance requests found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
