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
  MessageSquare,
  Calendar,
  MapPin,
  Image as ImageIcon,
} from 'lucide-react';

interface TenantMaintenanceRequestsProps {
  onNavigate: (page: any) => void;
}

const allRequests = [
  {
    id: 'MR-031',
    title: 'AC Maintenance',
    category: 'HVAC',
    description:
      'The air conditioning unit in the master bedroom has stopped cooling properly. It runs but blows warm air.',
    status: 'completed',
    priority: 'medium',
    submittedDate: 'May 28, 2026',
    resolvedDate: 'May 31, 2026',
    assignedVendor: 'CoolBreeze AC Techs',
    property: 'Lekki Phase 1, Apt 203',
    updates: [
      { time: 'May 28, 2026 10:00am', text: 'Request submitted', by: 'You' },
      {
        time: 'May 28, 2026 11:30am',
        text: 'Assigned to CoolBreeze AC Techs',
        by: 'Manager',
      },
      {
        time: 'May 31, 2026 2:00pm',
        text: 'Work completed and confirmed',
        by: 'CoolBreeze AC Techs',
      },
    ],
  },
  {
    id: 'MR-032',
    title: 'Bathroom Faucet Leak',
    category: 'Plumbing',
    description:
      'The bathroom faucet in the main bathroom is leaking constantly. Water is dripping even when fully closed.',
    status: 'in_progress',
    priority: 'high',
    submittedDate: 'Jun 1, 2026',
    resolvedDate: null,
    assignedVendor: 'AquaFix Plumbers',
    property: 'Lekki Phase 1, Apt 203',
    updates: [
      { time: 'Jun 1, 2026 9:00am', text: 'Request submitted', by: 'You' },
      {
        time: 'Jun 1, 2026 10:15am',
        text: 'Classified as High Priority Plumbing',
        by: 'AI System',
      },
      {
        time: 'Jun 1, 2026 11:00am',
        text: 'Assigned to AquaFix Plumbers',
        by: 'Manager',
      },
      {
        time: 'Jun 2, 2026 8:00am',
        text: 'Vendor en route to property',
        by: 'AquaFix Plumbers',
      },
    ],
  },
  {
    id: 'MR-028',
    title: 'Kitchen Light Flickering',
    category: 'Electrical',
    description:
      'The kitchen ceiling light flickers intermittently. It has been happening for the past 2 weeks.',
    status: 'completed',
    priority: 'low',
    submittedDate: 'May 10, 2026',
    resolvedDate: 'May 13, 2026',
    assignedVendor: 'PowerLine Electricals',
    property: 'Lekki Phase 1, Apt 203',
    updates: [
      { time: 'May 10, 2026', text: 'Request submitted', by: 'You' },
      {
        time: 'May 11, 2026',
        text: 'Assigned to PowerLine Electricals',
        by: 'Manager',
      },
      {
        time: 'May 13, 2026',
        text: 'Faulty bulb socket replaced, issue resolved',
        by: 'PowerLine Electricals',
      },
    ],
  },
  {
    id: 'MR-025',
    title: 'Gate Intercom Not Working',
    category: 'General',
    description:
      'The intercom at the main gate is not functioning. I cannot hear or speak to visitors.',
    status: 'completed',
    priority: 'medium',
    submittedDate: 'Apr 20, 2026',
    resolvedDate: 'Apr 22, 2026',
    assignedVendor: 'FixIt Pro Services',
    property: 'Lekki Phase 1, Apt 203',
    updates: [
      { time: 'Apr 20, 2026', text: 'Request submitted', by: 'You' },
      {
        time: 'Apr 22, 2026',
        text: 'Intercom unit replaced and tested',
        by: 'FixIt Pro Services',
      },
    ],
  },
  {
    id: 'MR-033',
    title: 'Broken Window Hinge',
    category: 'General',
    description:
      'The window hinge in the second bedroom is broken. The window cannot stay open and slams shut.',
    status: 'new',
    priority: 'low',
    submittedDate: 'Jun 3, 2026',
    resolvedDate: null,
    assignedVendor: null,
    property: 'Lekki Phase 1, Apt 203',
    updates: [
      {
        time: 'Jun 3, 2026 8:45am',
        text: 'Request submitted, awaiting assignment',
        by: 'You',
      },
    ],
  },
];

const statusConfig = {
  new: {
    label: 'New',
    color: 'bg-orange-100 text-orange-700',
    icon: AlertCircle,
  },
  in_progress: {
    label: 'In Progress',
    color: 'bg-blue-100 text-blue-700',
    icon: Clock,
  },
  completed: {
    label: 'Completed',
    color: 'bg-green-100 text-green-700',
    icon: CheckCircle,
  },
};

const priorityConfig = {
  high: { label: 'High', color: 'text-red-600 bg-red-50 border-red-200' },
  medium: {
    label: 'Medium',
    color: 'text-yellow-700 bg-yellow-50 border-yellow-200',
  },
  low: { label: 'Low', color: 'text-gray-600 bg-gray-50 border-gray-200' },
};

export function TenantMaintenanceRequests({ onNavigate }: TenantMaintenanceRequestsProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = allRequests.filter((r) => {
    const matchSearch =
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.category.toLowerCase().includes(search.toLowerCase()) ||
      r.id.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const counts = {
    all: allRequests.length,
    new: allRequests.filter((r) => r.status === 'new').length,
    in_progress: allRequests.filter((r) => r.status === 'in_progress').length,
    completed: allRequests.filter((r) => r.status === 'completed').length,
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="mb-1 text-2xl font-semibold">Maintenance Requests</h1>
          <p className="text-sm text-gray-500">
            Track and manage your maintenance requests for Lekki Phase 1, Apt 203
          </p>
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
          { id: 'new', label: `New (${counts.new})` },
          { id: 'in_progress', label: `In Progress (${counts.in_progress})` },
          { id: 'completed', label: `Completed (${counts.completed})` },
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

      {/* Request List */}
      <div className="space-y-3">
        {filtered.map((request) => {
          const sConfig = statusConfig[request.status as keyof typeof statusConfig];
          const pConfig = priorityConfig[request.priority as keyof typeof priorityConfig];
          const SIcon = sConfig.icon;
          const isExpanded = expandedId === request.id;

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
                        request.status === 'completed'
                          ? 'bg-green-50'
                          : request.status === 'in_progress'
                            ? 'bg-blue-50'
                            : 'bg-orange-50'
                      }`}
                    >
                      <Wrench
                        className={`h-5 w-5 ${
                          request.status === 'completed'
                            ? 'text-green-600'
                            : request.status === 'in_progress'
                              ? 'text-blue-600'
                              : 'text-orange-600'
                        }`}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-gray-400">{request.id}</span>
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
                      <p className="text-xs font-medium text-gray-600">{request.submittedDate}</p>
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
                      <p className="font-medium">{request.category}</p>
                    </div>
                    <div>
                      <p className="mb-0.5 text-xs text-gray-400">Property</p>
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-gray-400" />
                        <p className="text-xs font-medium">{request.property}</p>
                      </div>
                    </div>
                    <div>
                      <p className="mb-0.5 text-xs text-gray-400">Assigned To</p>
                      <p className="font-medium">
                        {request.assignedVendor ?? 'Awaiting assignment'}
                      </p>
                    </div>
                    <div>
                      <p className="mb-0.5 text-xs text-gray-400">
                        {request.resolvedDate ? 'Resolved' : 'Submitted'}
                      </p>
                      <p className="font-medium">{request.resolvedDate ?? request.submittedDate}</p>
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
                      {request.updates.map((update, i) => (
                        <div key={i} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div
                              className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                                i === 0 ? 'bg-blue-500' : 'bg-green-500'
                              }`}
                            />
                            {i < request.updates.length - 1 && (
                              <div
                                className="mt-1 w-px flex-1 bg-gray-200"
                                style={{ minHeight: '16px' }}
                              />
                            )}
                          </div>
                          <div className="flex-1 pb-1">
                            <p className="text-sm text-gray-800">{update.text}</p>
                            <p className="mt-0.5 text-xs text-gray-400">
                              {update.time} · {update.by}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  {request.status !== 'completed' && (
                    <div className="flex gap-2 pt-1">
                      <button className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
                        <MessageSquare className="h-3.5 w-3.5" />
                        Message Vendor
                      </button>
                      <button className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
                        <ImageIcon className="h-3.5 w-3.5" />
                        Add Photo
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="py-16 text-center text-gray-400">
            <Wrench className="mx-auto mb-3 h-10 w-10 opacity-30" />
            <p className="text-sm">No maintenance requests found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
