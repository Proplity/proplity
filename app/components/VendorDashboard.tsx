import { useState } from 'react';
import {
  Wrench,
  DollarSign,
  CheckCircle,
  Clock,
  AlertCircle,
  Star,
  Calendar,
  MapPin,
  Phone,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useMaintenanceRequests } from '@/hooks/useMaintenanceRequests';
import { useInvoices } from '@/hooks/useInvoices';

interface VendorDashboardProps {
  onNavigate: (page: any) => void;
}

const statusConfig = {
  SCHEDULED: { color: 'orange', label: 'Scheduled', icon: AlertCircle },
  IN_PROGRESS: { color: 'blue', label: 'In Progress', icon: Clock },
  COMPLETED: { color: 'green', label: 'Completed', icon: CheckCircle },
  CANCELLED: { color: 'gray', label: 'Cancelled', icon: AlertCircle },
} as const;

const priorityConfig = {
  EMERGENCY: { color: 'red', label: 'Emergency' },
  HIGH: { color: 'red', label: 'High' },
  MEDIUM: { color: 'yellow', label: 'Medium' },
  LOW: { color: 'green', label: 'Low' },
} as const;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function isThisMonth(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

export function VendorDashboard({ onNavigate }: VendorDashboardProps) {
  const auth = useAuth();
  const [activeFilter, setActiveFilter] = useState<
    'all' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED'
  >('all');

  const { data: jobs, loading: jobsLoading } = useMaintenanceRequests();
  const { data: invoices, loading: invoicesLoading } = useInvoices();
  const loading = jobsLoading || invoicesLoading;

  const now = new Date();
  const completedJobs = jobs.filter((j) => j.status === 'COMPLETED');
  const activeJobs = jobs.filter((j) => j.status === 'IN_PROGRESS' || j.status === 'SCHEDULED');
  const completedThisMonth = completedJobs.filter(
    (j) => j.completedAt && isThisMonth(j.completedAt),
  );
  const totalEarningsMTD = completedThisMonth.reduce((sum, j) => sum + (j.finalCost ?? 0), 0);

  // Invoice status per job -- an invoice is created automatically when a
  // job is marked COMPLETED (see PATCH /maintenance/requests/[id]), or
  // manually via VendorCreateInvoice. Pending = invoiced but not yet PAID.
  const jobInvoice = (jobId: string) => invoices.find((i) => i.maintenanceRequestId === jobId);
  const pendingPayments = completedJobs.reduce((sum, j) => {
    const invoice = jobInvoice(j.id);
    if (!invoice || invoice.status === 'PAID') return sum;
    return sum + invoice.amount;
  }, 0);

  // Rating/completion rate computed from this vendor's own jobs -- GET
  // /vendors (built in Phase 9.3a) is MANAGER/LANDLORD/ADMIN-only, so a
  // vendor's own stats are derived client-side from their own scoped
  // maintenance requests instead of calling that endpoint.
  const ratings = jobs.map((j) => j.vendorRating?.rating).filter((r): r is number => r != null);
  const avgRating = ratings.length ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length : null;
  const completionRate =
    jobs.length > 0 ? Math.round((completedJobs.length / jobs.length) * 100) : 0;

  const filteredJobs =
    activeFilter === 'all' ? jobs : jobs.filter((j) => j.status === activeFilter);

  const weekAgo = new Date(now.getTime() - 7 * MS_PER_DAY);
  const completedThisWeek = completedJobs.filter(
    (j) => j.completedAt && new Date(j.completedAt) >= weekAgo,
  );
  const earningsThisWeek = completedThisWeek.reduce((sum, j) => sum + (j.finalCost ?? 0), 0);

  const onTimeEligible = completedJobs.filter((j) => j.scheduledFor);
  const onTimeCount = onTimeEligible.filter(
    (j) => new Date(j.completedAt!) <= new Date(j.scheduledFor!),
  ).length;
  const onTimeRate =
    onTimeEligible.length > 0 ? Math.round((onTimeCount / onTimeEligible.length) * 100) : null;

  const totalPaid = completedJobs.reduce((sum, j) => {
    const invoice = jobInvoice(j.id);
    return invoice?.status === 'PAID' ? sum + invoice.amount : sum;
  }, 0);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="mb-1 text-2xl font-semibold">Vendor Dashboard</h1>
        <p className="text-gray-600">Manage your jobs and track your earnings</p>
      </div>

      {loading && <p className="text-sm text-gray-500">Loading your jobs…</p>}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-orange-50">
              <Wrench className="h-6 w-6 text-orange-600" />
            </div>
          </div>
          <p className="mb-1 text-2xl font-semibold">{loading ? '—' : activeJobs.length}</p>
          <p className="text-sm text-gray-600">Active Jobs</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-50">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <p className="mb-1 text-2xl font-semibold">{loading ? '—' : completedThisMonth.length}</p>
          <p className="text-sm text-gray-600">Completed This Month</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50">
              <DollarSign className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <p className="mb-1 text-2xl font-semibold text-green-600">
            {loading ? '—' : `₦${totalEarningsMTD.toLocaleString()}`}
          </p>
          <p className="text-sm text-gray-600">Total Earnings (MTD)</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-yellow-50">
              <DollarSign className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
          <p className="mb-1 text-2xl font-semibold text-yellow-600">
            {loading ? '—' : `₦${pendingPayments.toLocaleString()}`}
          </p>
          <p className="text-sm text-gray-600">Pending Payments</p>
        </div>
      </div>

      {/* Vendor Profile Card */}
      <div className="rounded-lg border border-blue-200 bg-gradient-to-r from-blue-50 to-purple-50 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-2xl font-semibold text-white">
              {(auth.user?.name ?? '?').charAt(0)}
            </div>
            <div>
              <h3 className="text-xl font-semibold">{auth.user?.name ?? 'Vendor'}</h3>
              <div className="mt-1 flex items-center gap-3">
                {avgRating != null ? (
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`h-4 w-4 ${i < Math.round(avgRating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
                      />
                    ))}
                    <span className="ml-1 text-sm font-medium">{avgRating.toFixed(1)}</span>
                  </div>
                ) : (
                  <span className="text-sm text-gray-500">No ratings yet</span>
                )}
                <span className="text-sm text-gray-600">•</span>
                <span className="text-sm font-medium text-green-600">
                  {completionRate}% Completion Rate
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Job Filters */}
      <div className="flex gap-2 overflow-x-auto">
        {[
          { id: 'all' as const, label: 'All Jobs', count: jobs.length },
          {
            id: 'SCHEDULED' as const,
            label: 'Scheduled',
            count: jobs.filter((j) => j.status === 'SCHEDULED').length,
          },
          {
            id: 'IN_PROGRESS' as const,
            label: 'In Progress',
            count: jobs.filter((j) => j.status === 'IN_PROGRESS').length,
          },
          { id: 'COMPLETED' as const, label: 'Completed', count: completedJobs.length },
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
          const status =
            statusConfig[job.status as keyof typeof statusConfig] ?? statusConfig.SCHEDULED;
          const priority = priorityConfig[job.priority];
          const StatusIcon = status.icon;
          const invoice = jobInvoice(job.id);

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
                      Job #{job.id.slice(0, 8)} • {job.category?.name ?? 'Uncategorized'}
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
                    className={`flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium bg-${status.color}-100 text-${status.color}-700`}
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
                    <p className="text-sm font-medium">
                      {job.unit?.property?.name ?? '—'} · {job.unit?.unitNumber}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-xs text-gray-600">
                    {job.status === 'COMPLETED' ? 'Completed' : 'Scheduled'}
                  </p>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <p className="text-sm font-medium">
                      {job.status === 'COMPLETED'
                        ? job.completedAt
                          ? new Date(job.completedAt).toLocaleDateString()
                          : '—'
                        : job.scheduledFor
                          ? new Date(job.scheduledFor).toLocaleDateString()
                          : 'Not scheduled'}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-xs text-gray-600">Payment</p>
                  <div className="flex items-center gap-1">
                    <DollarSign className="h-4 w-4 text-green-600" />
                    <p className="text-sm font-semibold text-green-600">
                      {job.finalCost != null
                        ? `₦${job.finalCost.toLocaleString()}`
                        : job.costEstimate != null
                          ? `₦${job.costEstimate.toLocaleString()} est.`
                          : '—'}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-xs text-gray-600">Tenant</p>
                  <div className="flex items-center gap-1">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <p className="text-sm font-medium">{job.tenant?.name ?? '—'}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-gray-200 pt-4">
                <div>
                  {job.status === 'COMPLETED' && (
                    <span
                      className={`rounded px-3 py-1 text-xs font-medium ${invoice?.status === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}
                    >
                      Invoice:{' '}
                      {!invoice
                        ? 'Not yet created'
                        : invoice.status === 'PAID'
                          ? 'Paid'
                          : 'Pending'}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  {job.status === 'COMPLETED' && !invoice && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigate({ type: 'vendor-create-invoice', jobId: job.id });
                      }}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      Create Invoice
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigate({ type: 'vendor-job-detail', jobId: job.id });
                    }}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    View Details
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {filteredJobs.length === 0 && !loading && (
          <p className="py-8 text-center text-sm text-gray-400">No jobs in this filter.</p>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="mb-4 font-semibold">This Week</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Jobs Completed</span>
              <span className="font-semibold">{completedThisWeek.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Earnings</span>
              <span className="font-semibold text-green-600">
                ₦{earningsThisWeek.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="mb-4 font-semibold">Performance</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Jobs This Month</span>
              <span className="font-semibold">{completedThisMonth.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">On-Time Rate</span>
              <span className="font-semibold text-green-600">
                {onTimeRate != null ? `${onTimeRate}%` : 'N/A'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Customer Rating</span>
              <span className="font-semibold">
                {avgRating != null ? `${avgRating.toFixed(1)} ⭐` : 'No ratings yet'}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="mb-4 font-semibold">Payments</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Total Paid</span>
              <span className="font-semibold text-green-600">₦{totalPaid.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Pending</span>
              <span className="font-semibold text-yellow-600">
                ₦{pendingPayments.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
