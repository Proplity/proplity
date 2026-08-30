import {
  Users,
  Building2,
  DollarSign,
  AlertCircle,
  TrendingUp,
  Shield,
  Database,
  Settings,
  BarChart3,
  Wrench,
  XCircle,
} from 'lucide-react';
import { useAdminUsers } from '@/hooks/useAdminUsers';
import { useMyProperties } from '@/hooks/useProperties';
import { useInvoices } from '@/hooks/useInvoices';
import { useMaintenanceRequests } from '@/hooks/useMaintenanceRequests';

interface AdminDashboardProps {
  onNavigate?: (page: any) => void;
}

const ROLE_COLOR: Record<string, string> = {
  MANAGER: 'blue',
  LANDLORD: 'purple',
  TENANT: 'green',
  VENDOR: 'orange',
  ADMIN: 'gray',
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function isWithinDays(iso: string, days: number) {
  return Date.now() - new Date(iso).getTime() <= days * MS_PER_DAY;
}

export function AdminDashboard({ onNavigate }: AdminDashboardProps = {}) {
  const { data: users, loading: usersLoading } = useAdminUsers();
  const { data: properties, loading: propertiesLoading } = useMyProperties();
  const { data: invoices, loading: invoicesLoading } = useInvoices();
  const { data: maintenanceRequests, loading: maintenanceLoading } = useMaintenanceRequests();

  const loading = usersLoading || propertiesLoading || invoicesLoading || maintenanceLoading;

  const totalCollected = invoices.flatMap((i) => i.payments).reduce((sum, p) => sum + p.amount, 0);
  const openMaintenance = maintenanceRequests.filter(
    (r) => r.status !== 'COMPLETED' && r.status !== 'CANCELLED',
  );

  const stats = [
    {
      icon: Users,
      bg: 'bg-blue-50',
      color: 'text-blue-600',
      value: loading ? '—' : String(users.length),
      label: 'Total Users',
      breakdown: 'users' as const,
    },
    {
      icon: Building2,
      bg: 'bg-purple-50',
      color: 'text-purple-600',
      value: loading ? '—' : String(properties.length),
      label: 'Properties Listed',
      breakdown: 'properties' as const,
    },
    {
      icon: DollarSign,
      bg: 'bg-green-50',
      color: 'text-green-600',
      value: loading ? '—' : `₦${totalCollected.toLocaleString()}`,
      label: 'Total Transactions',
      breakdown: 'transactions' as const,
    },
    {
      icon: AlertCircle,
      bg: 'bg-orange-50',
      color: 'text-orange-600',
      value: loading ? '—' : String(openMaintenance.length),
      label: 'Open Maintenance',
      breakdown: 'maintenance' as const,
    },
  ];

  const usersByRole = ['MANAGER', 'LANDLORD', 'TENANT', 'VENDOR'].map((role) => ({
    type: role.charAt(0) + role.slice(1).toLowerCase(),
    count: users.filter((u) => u.role === role).length,
    percentage:
      users.length > 0
        ? Math.round((users.filter((u) => u.role === role).length / users.length) * 100)
        : 0,
    color: ROLE_COLOR[role],
  }));

  // "Items Needing Attention" -- a real feed (overdue invoices + cancelled
  // maintenance requests), replacing the mock's fabricated "System Issues"
  // (no error/incident-tracking model exists anywhere in the schema).
  const attentionItems = [
    ...invoices
      .filter((i) => i.status === 'OVERDUE')
      .map((i) => ({
        title: `Invoice ${i.invoiceNumber} overdue`,
        time: i.dueDate,
        severity: 'high' as const,
      })),
    ...maintenanceRequests
      .filter((r) => r.status === 'CANCELLED')
      .map((r) => ({
        title: `Maintenance request cancelled: ${r.title}`,
        time: r.updatedAt,
        severity: 'medium' as const,
      })),
  ]
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, 5);

  const newPropertiesThisWeek = properties.filter((p) => isWithinDays(p.createdAt, 7)).length;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="mb-1 text-2xl font-semibold">System Administration</h1>
        <p className="text-gray-600">Platform-wide overview and management</p>
      </div>

      {loading && <p className="text-sm text-gray-500">Loading platform data…</p>}

      {/* Platform Stats */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <button
              key={stat.label}
              onClick={() =>
                onNavigate?.({ type: 'admin-breakdown', breakdownType: stat.breakdown })
              }
              className="group cursor-pointer rounded-lg border border-gray-200 bg-white p-6 text-left transition-all hover:border-blue-400 hover:shadow-md"
            >
              <div className="mb-4 flex items-center justify-between">
                <div
                  className={`h-12 w-12 ${stat.bg} flex items-center justify-center rounded-lg transition-opacity group-hover:opacity-80`}
                >
                  <Icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
              <p className="mb-1 text-2xl font-semibold">{stat.value}</p>
              <p className="text-sm text-gray-600">{stat.label}</p>
              <p className="mt-2 text-xs text-blue-500 opacity-0 transition-opacity group-hover:opacity-100">
                Click to view breakdown →
              </p>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* User Activity */}
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-200 p-6">
            <h2 className="font-semibold">User Activity by Role</h2>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {usersByRole.map((userType) => (
                <div key={userType.type}>
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`h-3 w-3 rounded-full bg-${userType.color}-500`}></div>
                      <span className="text-sm font-medium">{userType.type}</span>
                    </div>
                    <span className="text-sm font-semibold">{userType.count}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                    <div
                      className={`h-full bg-${userType.color}-500 rounded-full`}
                      style={{ width: `${userType.percentage}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Items Needing Attention */}
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-200 p-6">
            <h2 className="font-semibold">Items Needing Attention</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {attentionItems.map((issue, index) => (
              <div key={index} className="p-4 hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  {issue.severity === 'high' ? (
                    <AlertCircle className="h-5 w-5 text-red-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-yellow-600" />
                  )}
                  <div>
                    <p className="text-sm font-medium">{issue.title}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(issue.time).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            {attentionItems.length === 0 && !loading && (
              <p className="p-4 text-sm text-gray-400">Nothing needs attention right now.</p>
            )}
          </div>
        </div>
      </div>

      {/* Admin Actions */}
      <div className="rounded-lg border border-red-200 bg-gradient-to-r from-red-50 to-orange-50 p-6">
        <h3 className="mb-4 font-semibold">Admin Controls</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <button
            onClick={() => onNavigate?.({ type: 'admin-breakdown', breakdownType: 'users' })}
            className="rounded-lg border border-gray-200 bg-white p-4 text-left transition-shadow hover:shadow-md"
          >
            <Users className="mb-2 h-5 w-5 text-blue-600" />
            <p className="text-sm font-medium">User Management</p>
            <p className="text-xs text-gray-600">View all accounts</p>
          </button>
          <button
            onClick={() => alert('Security settings are not built in this phase.')}
            className="rounded-lg border border-gray-200 bg-white p-4 text-left transition-shadow hover:shadow-md"
          >
            <Shield className="mb-2 h-5 w-5 text-green-600" />
            <p className="text-sm font-medium">Security</p>
            <p className="text-xs text-gray-600">Access control</p>
          </button>
          <button
            onClick={() => alert('Database management is not built in this phase.')}
            className="rounded-lg border border-gray-200 bg-white p-4 text-left transition-shadow hover:shadow-md"
          >
            <Database className="mb-2 h-5 w-5 text-purple-600" />
            <p className="text-sm font-medium">Database</p>
            <p className="text-xs text-gray-600">Backups & logs</p>
          </button>
          <button
            onClick={() => alert('System settings are not built in this phase.')}
            className="rounded-lg border border-gray-200 bg-white p-4 text-left transition-shadow hover:shadow-md"
          >
            <Settings className="mb-2 h-5 w-5 text-orange-600" />
            <p className="text-sm font-medium">Settings</p>
            <p className="text-xs text-gray-600">System config</p>
          </button>
        </div>
      </div>

      {/* Platform Growth */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 p-6">
          <h2 className="font-semibold">Platform Growth (Last 7 Days)</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="rounded-lg bg-blue-50 p-4 text-center">
              <BarChart3 className="mx-auto mb-2 h-8 w-8 text-blue-600" />
              <p className="mb-1 text-2xl font-semibold">{loading ? '—' : newPropertiesThisWeek}</p>
              <p className="text-sm text-gray-600">New Properties</p>
            </div>
            <div className="rounded-lg bg-green-50 p-4 text-center">
              <Wrench className="mx-auto mb-2 h-8 w-8 text-green-600" />
              <p className="mb-1 text-2xl font-semibold">
                {loading ? '—' : openMaintenance.length}
              </p>
              <p className="text-sm text-gray-600">Open Maintenance Requests</p>
            </div>
            <div className="rounded-lg bg-purple-50 p-4 text-center">
              <Users className="mx-auto mb-2 h-8 w-8 text-purple-600" />
              <p className="mb-1 text-2xl font-semibold">
                {loading ? '—' : users.filter((u) => isWithinDays(u.createdAt, 7)).length}
              </p>
              <p className="text-sm text-gray-600">New Users</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
