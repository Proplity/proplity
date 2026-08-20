import {
  Droplet,
  Zap,
  Wrench,
  AlertCircle,
  Clock,
  CheckCircle,
  User,
  MapPin,
  Calendar,
  Wind,
} from 'lucide-react';
import { mockMaintenanceBoardRequests as requests } from '../store/maintenanceData';

interface MaintenanceBoardProps {
  onNavigate: (page: any) => void;
}

export function MaintenanceBoard({ onNavigate }: MaintenanceBoardProps) {

  const priorityColors = {
    high: 'bg-red-100 text-red-700 border-red-200',
    medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    low: 'bg-green-100 text-green-700 border-green-200',
  };

  const Column = ({ title, count, requests, icon: Icon, color }: any) => (
    <div className="min-w-[320px] rounded-lg bg-gray-50 p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`h-5 w-5 ${color}`} />
          <h3 className="font-semibold">{title}</h3>
          <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700">
            {count}
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {requests.map((request: any) => {
          const RequestIcon =
            request.category === 'Plumbing'
              ? Droplet
              : request.category === 'Electrical'
                ? Zap
                : request.category === 'HVAC'
                  ? Wind
                  : Wrench;
          return (
            <div
              key={request.id}
              className="rounded-lg border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md"
            >
              <div className="mb-2 flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                      request.priority === 'high'
                        ? 'bg-red-50'
                        : request.priority === 'medium'
                          ? 'bg-yellow-50'
                          : 'bg-green-50'
                    }`}
                  >
                    <RequestIcon
                      className={`h-4 w-4 ${
                        request.priority === 'high'
                          ? 'text-red-600'
                          : request.priority === 'medium'
                            ? 'text-yellow-600'
                            : 'text-green-600'
                      }`}
                    />
                  </div>
                  <span
                    className={`rounded px-2 py-1 text-xs font-medium ${priorityColors[request.priority as keyof typeof priorityColors]}`}
                  >
                    {request.priority.toUpperCase()}
                  </span>
                </div>
              </div>

              <h4 className="mb-1 font-semibold">{request.title}</h4>
              <p className="mb-3 text-sm text-gray-600">{request.description}</p>

              <div className="mb-3 space-y-2">
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <User className="h-3 w-3" />
                  {request.tenant}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <MapPin className="h-3 w-3" />
                  {request.property}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <Clock className="h-3 w-3" />
                  {request.submittedAt}
                </div>
              </div>

              {request.aiCategory && (
                <div className="mb-3 rounded border border-blue-200 bg-blue-50 p-2">
                  <p className="text-xs font-medium text-blue-700">AI Classification</p>
                  <p className="text-xs text-blue-600">{request.aiCategory}</p>
                  <p className="mt-1 text-xs text-gray-600">
                    Est: {request.estimatedCost || request.actualCost}
                  </p>
                </div>
              )}

              {request.assignedTo && (
                <div className="mb-2 flex items-center gap-2 text-xs text-green-600">
                  <CheckCircle className="h-3 w-3" />
                  Assigned to {request.assignedTo}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() =>
                    onNavigate({
                      type: 'maintenance-detail',
                      requestId: request.id,
                    })
                  }
                  className="flex-1 rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                >
                  View Details
                </button>
                {!request.completedAt && (
                  <button
                    onClick={() => alert(`Assigning vendor for: ${request.title}...`)}
                    className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium hover:bg-gray-50"
                  >
                    Assign
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="mb-1 text-2xl font-semibold">Maintenance Board</h1>
          <p className="text-gray-600">Kanban-style maintenance request management</p>
        </div>
        <button
          onClick={() => alert('Opening new maintenance request form...')}
          className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
        >
          + New Request
        </button>
      </div>

      {/* AI Insights */}
      <div className="rounded-lg border border-purple-200 bg-gradient-to-r from-purple-50 to-blue-50 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-purple-500">
            <Wrench className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="mb-1 font-semibold">AI Maintenance Intelligence</h3>
            <p className="mb-2 text-sm text-gray-700">
              2 requests have been automatically categorized and prioritized. Recommended vendor:
              John Electricals (95% reliability score)
            </p>
            <div className="flex gap-4 text-xs text-gray-600">
              <span>• Avg Resolution Time: 2.3 days</span>
              <span>• 94% First-time Fix Rate</span>
            </div>
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        <Column
          title="New Requests"
          count={requests.new.length}
          requests={requests.new}
          icon={AlertCircle}
          color="text-orange-600"
        />
        <Column
          title="In Progress"
          count={requests.inProgress.length}
          requests={requests.inProgress}
          icon={Clock}
          color="text-blue-600"
        />
        <Column
          title="Completed"
          count={requests.completed.length}
          requests={requests.completed}
          icon={CheckCircle}
          color="text-green-600"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="mb-1 text-sm text-gray-600">Total Requests</p>
          <p className="text-2xl font-semibold">27</p>
          <p className="mt-1 text-xs text-green-600">+5 this week</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="mb-1 text-sm text-gray-600">Avg Response Time</p>
          <p className="text-2xl font-semibold">4.2h</p>
          <p className="mt-1 text-xs text-green-600">-30% from last month</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="mb-1 text-sm text-gray-600">Resolution Rate</p>
          <p className="text-2xl font-semibold">94%</p>
          <p className="mt-1 text-xs text-green-600">+2% improvement</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="mb-1 text-sm text-gray-600">Total Spent (MTD)</p>
          <p className="text-2xl font-semibold">₦145K</p>
          <p className="mt-1 text-xs text-gray-600">Within budget</p>
        </div>
      </div>
    </div>
  );
}
