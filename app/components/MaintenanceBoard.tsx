import { Droplet, Zap, Wrench, AlertCircle, Clock, CheckCircle, User, MapPin, Wind } from 'lucide-react';
import { useMaintenanceRequests } from '@/hooks/useMaintenanceRequests';
import type { MaintenanceRequest } from '@/lib/api/types';

interface MaintenanceBoardProps {
  onNavigate: (page: any) => void;
}

const priorityColors: Record<string, string> = {
  EMERGENCY: 'bg-red-100 text-red-700 border-red-300',
  HIGH: 'bg-red-100 text-red-700 border-red-200',
  MEDIUM: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  LOW: 'bg-green-100 text-green-700 border-green-200',
};

function Column({
  title,
  requests,
  icon: Icon,
  color,
  onNavigate,
  loading,
}: {
  title: string;
  requests: MaintenanceRequest[];
  icon: any;
  color: string;
  onNavigate: (page: any) => void;
  loading: boolean;
}) {
  return (
    <div className="min-w-[320px] rounded-lg bg-gray-50 p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`h-5 w-5 ${color}`} />
          <h3 className="font-semibold">{title}</h3>
          <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700">
            {requests.length}
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {requests.map((request) => {
          const categoryName = request.category?.name;
          const RequestIcon =
            categoryName === 'Plumbing' ? Droplet : categoryName === 'Electrical' ? Zap : categoryName === 'HVAC' ? Wind : Wrench;
          const priorityBg =
            request.priority === 'HIGH' || request.priority === 'EMERGENCY'
              ? 'bg-red-50'
              : request.priority === 'MEDIUM'
                ? 'bg-yellow-50'
                : 'bg-green-50';
          const priorityText =
            request.priority === 'HIGH' || request.priority === 'EMERGENCY'
              ? 'text-red-600'
              : request.priority === 'MEDIUM'
                ? 'text-yellow-600'
                : 'text-green-600';

          return (
            <div
              key={request.id}
              className="rounded-lg border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md"
            >
              <div className="mb-2 flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${priorityBg}`}>
                    <RequestIcon className={`h-4 w-4 ${priorityText}`} />
                  </div>
                  <span className={`rounded px-2 py-1 text-xs font-medium ${priorityColors[request.priority]}`}>
                    {request.priority}
                  </span>
                </div>
              </div>

              <h4 className="mb-1 font-semibold">{request.title}</h4>
              <p className="mb-3 text-sm text-gray-600">{request.description}</p>

              <div className="mb-3 space-y-2">
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <User className="h-3 w-3" />
                  {request.tenant?.name ?? 'Unknown tenant'}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <MapPin className="h-3 w-3" />
                  {request.unit?.property?.name ?? '—'} · {request.unit?.unitNumber}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <Clock className="h-3 w-3" />
                  {new Date(request.createdAt).toLocaleDateString()}
                </div>
              </div>

              {request.categoryId && (
                <div className="mb-3 rounded border border-blue-200 bg-blue-50 p-2">
                  <p className="text-xs font-medium text-blue-700">Category</p>
                  <p className="text-xs text-blue-600">{categoryName}</p>
                  {(request.costEstimate ?? request.finalCost) != null && (
                    <p className="mt-1 text-xs text-gray-600">
                      {request.finalCost != null
                        ? `Final: ₦${request.finalCost.toLocaleString()}`
                        : `Est: ₦${request.costEstimate!.toLocaleString()}`}
                    </p>
                  )}
                </div>
              )}

              {request.vendor && (
                <div className="mb-2 flex items-center gap-2 text-xs text-green-600">
                  <CheckCircle className="h-3 w-3" />
                  Assigned to {request.vendor.name}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => onNavigate({ type: 'maintenance-detail', requestId: request.id })}
                  className="flex-1 rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                >
                  View Details
                </button>
              </div>
            </div>
          );
        })}
        {requests.length === 0 && !loading && <p className="text-sm text-gray-400">Nothing here.</p>}
      </div>
    </div>
  );
}

export function MaintenanceBoard({ onNavigate }: MaintenanceBoardProps) {
  const { data: requests, loading, error } = useMaintenanceRequests();

  const newRequests = requests.filter((r) => r.status === 'SUBMITTED');
  const inProgress = requests.filter((r) => r.status === 'IN_PROGRESS' || r.status === 'SCHEDULED');
  const completed = requests.filter((r) => r.status === 'COMPLETED');

  const resolvedCount = completed.length + requests.filter((r) => r.status === 'CANCELLED').length;
  const resolutionRate = requests.length > 0 ? Math.round((completed.length / requests.length) * 100) : 0;
  const totalCost = completed.reduce((sum, r) => sum + (r.finalCost ?? 0), 0);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="mb-1 text-2xl font-semibold">Maintenance Board</h1>
          <p className="text-gray-600">Kanban-style maintenance request management</p>
        </div>
      </div>

      {loading && <p className="text-sm text-gray-500">Loading requests…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        <Column title="New Requests" requests={newRequests} icon={AlertCircle} color="text-orange-600" onNavigate={onNavigate} loading={loading} />
        <Column title="In Progress" requests={inProgress} icon={Clock} color="text-blue-600" onNavigate={onNavigate} loading={loading} />
        <Column title="Completed" requests={completed} icon={CheckCircle} color="text-green-600" onNavigate={onNavigate} loading={loading} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="mb-1 text-sm text-gray-600">Total Requests</p>
          <p className="text-2xl font-semibold">{loading ? '—' : requests.length}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="mb-1 text-sm text-gray-600">Resolution Rate</p>
          <p className="text-2xl font-semibold">{loading ? '—' : `${resolutionRate}%`}</p>
          <p className="mt-1 text-xs text-gray-500">{loading ? '—' : `${resolvedCount} closed of ${requests.length}`}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="mb-1 text-sm text-gray-600">Total Spent (Completed)</p>
          <p className="text-2xl font-semibold">{loading ? '—' : `₦${totalCost.toLocaleString()}`}</p>
        </div>
      </div>
    </div>
  );
}
