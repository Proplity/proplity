import {
  Users,
  Building2,
  DollarSign,
  Activity,
  TrendingUp,
  AlertCircle,
  Shield,
  Database,
  Settings,
  BarChart3,
} from 'lucide-react';
import {
  mockAdminPlatformStats,
  mockAdminSystemHealth,
  mockAdminUserActivity,
  mockAdminAiPerformance,
  mockAdminRecentIssues,
} from '../store/adminDashboardData';

interface AdminDashboardProps {
  onNavigate?: (page: any) => void;
}

export function AdminDashboard({ onNavigate }: AdminDashboardProps = {}) {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="mb-1 text-2xl font-semibold">System Administration</h1>
        <p className="text-gray-600">Platform-wide overview and management</p>
      </div>

      {/* Platform Stats */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {mockAdminPlatformStats.map((stat) => {
          const Icon = stat.icon;
          return (
            <button
              key={stat.label}
              onClick={() =>
                onNavigate?.({
                  type: 'admin-breakdown',
                  breakdownType: stat.breakdown,
                })
              }
              className="group cursor-pointer rounded-lg border border-gray-200 bg-white p-6 text-left transition-all hover:border-blue-400 hover:shadow-md"
            >
              <div className="mb-4 flex items-center justify-between">
                <div
                  className={`h-12 w-12 ${stat.bg} flex items-center justify-center rounded-lg transition-opacity group-hover:opacity-80`}
                >
                  <Icon className={`h-6 w-6 ${stat.color}`} />
                </div>
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <p className="mb-1 text-2xl font-semibold">{stat.value}</p>
              <p className="text-sm text-gray-600">{stat.label}</p>
              <p className="mt-1 text-xs text-green-600">{stat.trend}</p>
              <p className="mt-2 text-xs text-blue-500 opacity-0 transition-opacity group-hover:opacity-100">
                Click to view breakdown →
              </p>
            </button>
          );
        })}
      </div>

      {/* System Health */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 p-6">
          <h2 className="font-semibold">System Health Monitoring</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {mockAdminSystemHealth.map((metric, index) => (
              <div key={index} className="rounded-lg bg-gray-50 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs text-gray-600">{metric.label}</span>
                  <div className={`h-2 w-2 rounded-full bg-${metric.color}-500`}></div>
                </div>
                <p className="text-2xl font-semibold">{metric.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* User Activity */}
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-200 p-6">
            <h2 className="font-semibold">User Activity</h2>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {mockAdminUserActivity.map((userType, index) => (
                <div key={index}>
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

        {/* AI Performance */}
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-200 p-6">
            <h2 className="font-semibold">AI System Performance</h2>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {mockAdminAiPerformance.map((ai, index) => (
                <div key={index} className="rounded-lg bg-gray-50 p-3">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm font-medium">{ai.feature}</span>
                    <span className={`text-sm font-semibold text-${ai.color}-600`}>
                      {ai.resolved || ai.accuracy}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">{ai.total} processed this month</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Issues */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-200 p-6">
          <h2 className="font-semibold">Recent System Issues</h2>
          <button
            onClick={() => alert('Opening system issues dashboard...')}
            className="text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            View All
          </button>
        </div>
        <div className="divide-y divide-gray-200">
          {mockAdminRecentIssues.map((issue, index) => (
            <div key={index} className="p-4 hover:bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertCircle
                    className={`h-5 w-5 ${
                      issue.severity === 'high'
                        ? 'text-red-600'
                        : issue.severity === 'medium'
                          ? 'text-yellow-600'
                          : 'text-blue-600'
                    }`}
                  />
                  <div>
                    <p className="text-sm font-medium">{issue.title}</p>
                    <p className="text-xs text-gray-500">{issue.time}</p>
                  </div>
                </div>
                <span
                  className={`rounded px-2 py-1 text-xs font-medium ${
                    issue.status === 'Resolved'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}
                >
                  {issue.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Admin Actions */}
      <div className="rounded-lg border border-red-200 bg-gradient-to-r from-red-50 to-orange-50 p-6">
        <h3 className="mb-4 font-semibold">Admin Controls</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <button
            onClick={() => alert('Opening user management...')}
            className="rounded-lg border border-gray-200 bg-white p-4 text-left transition-shadow hover:shadow-md"
          >
            <Users className="mb-2 h-5 w-5 text-blue-600" />
            <p className="text-sm font-medium">User Management</p>
            <p className="text-xs text-gray-600">Manage accounts</p>
          </button>
          <button
            onClick={() => alert('Opening security settings...')}
            className="rounded-lg border border-gray-200 bg-white p-4 text-left transition-shadow hover:shadow-md"
          >
            <Shield className="mb-2 h-5 w-5 text-green-600" />
            <p className="text-sm font-medium">Security</p>
            <p className="text-xs text-gray-600">Access control</p>
          </button>
          <button
            onClick={() => alert('Opening database management...')}
            className="rounded-lg border border-gray-200 bg-white p-4 text-left transition-shadow hover:shadow-md"
          >
            <Database className="mb-2 h-5 w-5 text-purple-600" />
            <p className="text-sm font-medium">Database</p>
            <p className="text-xs text-gray-600">Backups & logs</p>
          </button>
          <button
            onClick={() => alert('Opening system settings...')}
            className="rounded-lg border border-gray-200 bg-white p-4 text-left transition-shadow hover:shadow-md"
          >
            <Settings className="mb-2 h-5 w-5 text-orange-600" />
            <p className="text-sm font-medium">Settings</p>
            <p className="text-xs text-gray-600">System config</p>
          </button>
        </div>
      </div>

      {/* Platform Analytics */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 p-6">
          <h2 className="font-semibold">Platform Growth Analytics</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="rounded-lg bg-blue-50 p-4 text-center">
              <BarChart3 className="mx-auto mb-2 h-8 w-8 text-blue-600" />
              <p className="mb-1 text-2xl font-semibold">847</p>
              <p className="text-sm text-gray-600">New Properties (This Week)</p>
            </div>
            <div className="rounded-lg bg-green-50 p-4 text-center">
              <TrendingUp className="mx-auto mb-2 h-8 w-8 text-green-600" />
              <p className="mb-1 text-2xl font-semibold">2,341</p>
              <p className="text-sm text-gray-600">Active Transactions</p>
            </div>
            <div className="rounded-lg bg-purple-50 p-4 text-center">
              <Users className="mx-auto mb-2 h-8 w-8 text-purple-600" />
              <p className="mb-1 text-2xl font-semibold">1,284</p>
              <p className="text-sm text-gray-600">New Users (This Week)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
