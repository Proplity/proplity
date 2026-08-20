import { useState } from 'react';
import {
  Wrench,
  DollarSign,
  CheckCircle,
  Clock,
  AlertCircle,
  TrendingUp,
  Star,
  Calendar,
  MapPin,
  Phone,
  FileText,
} from 'lucide-react';
import { mockVendorDashboardJobs as jobs } from '../store/mockData';

interface VendorDashboardProps {
  onNavigate: (page: any) => void;
}

export function VendorDashboard({ onNavigate }: VendorDashboardProps) {
  const [activeFilter, setActiveFilter] = useState('all');

  const stats = {
    activeJobs: jobs.filter((j) => j.status === 'assigned' || j.status === 'in_progress').length,
    completedThisMonth: 12,
    totalEarnings: 145000,
    pendingPayments: 28000,
    rating: 4.8,
    completionRate: 95,
  };

  const filteredJobs =
    activeFilter === 'all' ? jobs : jobs.filter((j) => j.status === activeFilter);

  const statusConfig = {
    assigned: { color: 'orange', label: 'New Job', icon: AlertCircle },
    in_progress: { color: 'blue', label: 'In Progress', icon: Clock },
    completed: { color: 'green', label: 'Completed', icon: CheckCircle },
  };

  const priorityConfig = {
    high: { color: 'red', label: 'High' },
    medium: { color: 'yellow', label: 'Medium' },
    low: { color: 'green', label: 'Low' },
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="mb-1 text-2xl font-semibold">Vendor Dashboard</h1>
        <p className="text-gray-600">Manage your jobs and track your earnings</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-orange-50">
              <Wrench className="h-6 w-6 text-orange-600" />
            </div>
            <TrendingUp className="h-5 w-5 text-green-600" />
          </div>
          <p className="mb-1 text-2xl font-semibold">{stats.activeJobs}</p>
          <p className="text-sm text-gray-600">Active Jobs</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-50">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <p className="mb-1 text-2xl font-semibold">{stats.completedThisMonth}</p>
          <p className="text-sm text-gray-600">Completed This Month</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50">
              <DollarSign className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <p className="mb-1 text-2xl font-semibold text-green-600">
            ₦{stats.totalEarnings.toLocaleString()}
          </p>
          <p className="text-sm text-gray-600">Total Earnings (MTD)</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-yellow-50">
              <FileText className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
          <p className="mb-1 text-2xl font-semibold text-yellow-600">
            ₦{stats.pendingPayments.toLocaleString()}
          </p>
          <p className="text-sm text-gray-600">Pending Payments</p>
        </div>
      </div>

      {/* Vendor Profile Card */}
      <div className="rounded-lg border border-blue-200 bg-gradient-to-r from-blue-50 to-purple-50 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-2xl font-semibold text-white">
              AQ
            </div>
            <div>
              <h3 className="text-xl font-semibold">AquaFix Plumbers</h3>
              <div className="mt-1 flex items-center gap-3">
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`h-4 w-4 ${i < Math.floor(stats.rating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
                    />
                  ))}
                  <span className="ml-1 text-sm font-medium">{stats.rating}</span>
                </div>
                <span className="text-sm text-gray-600">•</span>
                <span className="text-sm font-medium text-green-600">
                  {stats.completionRate}% Completion Rate
                </span>
              </div>
            </div>
          </div>
          <button className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700">
            Edit Profile
          </button>
        </div>
      </div>

      {/* Job Filters */}
      <div className="flex gap-2 overflow-x-auto">
        {[
          { id: 'all', label: 'All Jobs', count: jobs.length },
          {
            id: 'assigned',
            label: 'New Jobs',
            count: jobs.filter((j) => j.status === 'assigned').length,
          },
          {
            id: 'in_progress',
            label: 'In Progress',
            count: jobs.filter((j) => j.status === 'in_progress').length,
          },
          {
            id: 'completed',
            label: 'Completed',
            count: jobs.filter((j) => j.status === 'completed').length,
          },
        ].map((filter) => (
          <button
            key={filter.id}
            onClick={() => setActiveFilter(filter.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
              activeFilter === filter.id
                ? 'bg-blue-600 text-white'
                : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {filter.label} ({filter.count})
          </button>
        ))}
      </div>

      {/* Job List */}
      <div className="space-y-4">
        {filteredJobs.map((job) => {
          const status = statusConfig[job.status as keyof typeof statusConfig];
          const priority = priorityConfig[job.priority as keyof typeof priorityConfig];
          const StatusIcon = status.icon;

          return (
            <div
              key={job.id}
              onClick={() => onNavigate({ type: 'vendor-job-detail', jobId: job.id })}
              className="cursor-pointer rounded-lg border border-gray-200 bg-white p-6 transition-shadow hover:shadow-md"
            >
              <div className="mb-4 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-lg bg-${priority.color}-50`}
                  >
                    <Wrench className={`h-6 w-6 text-${priority.color}-600`} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">{job.title}</h3>
                    <p className="text-sm text-gray-600">
                      Job #{job.id} • {job.category}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-sm font-medium bg-${priority.color}-100 text-${priority.color}-700`}
                  >
                    {priority.label} Priority
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 text-sm font-medium bg-${status.color}-100 text-${status.color}-700 flex items-center gap-1`}
                  >
                    <StatusIcon className="h-4 w-4" />
                    {status.label}
                  </span>
                </div>
              </div>

              <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-4">
                <div>
                  <p className="mb-1 text-xs text-gray-600">Property</p>
                  <div className="flex items-center gap-1">
                    <MapPin className="h-4 w-4 text-gray-400" />
                    <p className="text-sm font-medium">{job.property}</p>
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-xs text-gray-600">
                    {job.status === 'completed' ? 'Completed' : 'Assigned'}
                  </p>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <p className="text-sm font-medium">
                      {job.status === 'completed' ? job.completedDate : job.assignedDate}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-xs text-gray-600">Payment</p>
                  <div className="flex items-center gap-1">
                    <DollarSign className="h-4 w-4 text-green-600" />
                    <p className="text-sm font-semibold text-green-600">
                      {job.actualPay || job.estimatedPay}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-xs text-gray-600">Contact</p>
                  <div className="flex items-center gap-1">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <p className="text-sm font-medium">{job.propertyManager}</p>
                  </div>
                </div>
              </div>

              {job.scheduledDate && job.status !== 'completed' && (
                <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
                  <p className="text-sm text-blue-800">
                    <Calendar className="mr-1 inline h-4 w-4" />
                    Scheduled: {job.scheduledDate}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between border-t border-gray-200 pt-4">
                <div>
                  {job.status === 'completed' && (
                    <span
                      className={`rounded px-3 py-1 text-xs font-medium ${
                        job.invoiceStatus === 'paid'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      Invoice: {job.invoiceStatus === 'paid' ? 'Paid' : 'Pending'}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  {job.status === 'assigned' && (
                    <>
                      <button className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">
                        Accept Job
                      </button>
                      <button className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                        Decline
                      </button>
                    </>
                  )}
                  {job.status === 'in_progress' && (
                    <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                      Update Status
                    </button>
                  )}
                  {job.status === 'completed' && job.invoiceStatus === 'pending' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigate({
                          type: 'vendor-create-invoice',
                          jobId: job.id,
                        });
                      }}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      Create Invoice
                    </button>
                  )}
                  <button className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                    View Details
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="mb-4 font-semibold">This Week</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Jobs Completed</span>
              <span className="font-semibold">3</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Earnings</span>
              <span className="font-semibold text-green-600">₦46,000</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Avg Response Time</span>
              <span className="font-semibold">2.3 hours</span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="mb-4 font-semibold">Performance</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Jobs This Month</span>
              <span className="font-semibold">12</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">On-Time Rate</span>
              <span className="font-semibold text-green-600">98%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Customer Rating</span>
              <span className="font-semibold">{stats.rating} ⭐</span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="mb-4 font-semibold">Payments</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Total Paid</span>
              <span className="font-semibold text-green-600">₦117,000</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Pending</span>
              <span className="font-semibold text-yellow-600">₦28,000</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Next Payout</span>
              <span className="font-semibold">May 15, 2026</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
