import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Home,
  Users,
  AlertCircle,
  CheckCircle,
  Clock,
} from 'lucide-react';
import { mockRecentPayments, mockUpcomingRenewals } from '../store/mockData';

interface DashboardProps {
  onNavigate: (page: any) => void;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const stats = [
    {
      label: 'Total Properties',
      value: '8',
      change: '+3',
      trend: 'up',
      icon: Home,
      breakdown: 'properties' as const,
    },
    {
      label: 'Active Tenants',
      value: '187',
      change: '+12',
      trend: 'up',
      icon: Users,
      breakdown: 'tenants' as const,
    },
    {
      label: 'Rent Collected (This Month)',
      value: '₦12.4M',
      change: '+8%',
      trend: 'up',
      icon: DollarSign,
      breakdown: 'rent' as const,
    },
    {
      label: 'Pending Maintenance',
      value: '7',
      change: '-3',
      trend: 'down',
      icon: AlertCircle,
      breakdown: 'maintenance' as const,
    },
  ];

  const recentPayments = mockRecentPayments;

  const upcomingRenewals = mockUpcomingRenewals;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="mb-1 text-2xl font-semibold">Dashboard</h1>
        <p className="text-gray-600">Welcome back! Here's what's happening with your properties.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <button
              key={stat.label}
              onClick={() => onNavigate({ type: 'breakdown', breakdownType: stat.breakdown })}
              className="group cursor-pointer rounded-lg border border-gray-200 bg-white p-6 text-left transition-all hover:border-blue-400 hover:shadow-md"
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 transition-colors group-hover:bg-blue-100">
                  <Icon className="h-6 w-6 text-blue-600" />
                </div>
                <div
                  className={`flex items-center gap-1 text-sm font-medium ${
                    stat.trend === 'up' ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {stat.trend === 'up' ? (
                    <TrendingUp className="h-4 w-4" />
                  ) : (
                    <TrendingDown className="h-4 w-4" />
                  )}
                  {stat.change}
                </div>
              </div>
              <div>
                <p className="mb-1 text-2xl font-semibold">{stat.value}</p>
                <p className="text-sm text-gray-600">{stat.label}</p>
              </div>
              <p className="mt-3 text-xs text-blue-500 opacity-0 transition-opacity group-hover:opacity-100">
                Click to view breakdown →
              </p>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Payments */}
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-200 p-6">
            <h2 className="font-semibold">Recent Payments</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {recentPayments.map((payment, index) => (
              <div
                key={index}
                onClick={() => onNavigate({ type: 'tenant-detail', tenantId: index + 1 })}
                className="cursor-pointer p-4 transition-colors hover:bg-gray-50"
              >
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-medium">{payment.tenant}</p>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      payment.status === 'completed'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}
                  >
                    {payment.status === 'completed' ? (
                      <CheckCircle className="mr-1 inline h-3 w-3" />
                    ) : (
                      <Clock className="mr-1 inline h-3 w-3" />
                    )}
                    {payment.status}
                  </span>
                </div>
                <p className="mb-1 text-sm text-gray-600">{payment.property}</p>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-blue-600">{payment.amount}</p>
                  <p className="text-xs text-gray-500">{payment.date}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming Renewals */}
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-200 p-6">
            <h2 className="font-semibold">Upcoming Renewals</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {upcomingRenewals.map((renewal, index) => (
              <div
                key={index}
                onClick={() => onNavigate({ type: 'tenant-detail', tenantId: index + 5 })}
                className="cursor-pointer p-4 transition-colors hover:bg-gray-50"
              >
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-medium">{renewal.tenant}</p>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      renewal.status === 'contacted'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {renewal.status}
                  </span>
                </div>
                <p className="mb-1 text-sm text-gray-600">{renewal.property}</p>
                <p className="text-sm font-medium text-orange-600">Due: {renewal.expiryDate}</p>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-200 p-4">
            <button
              onClick={() => onNavigate({ type: 'breakdown', breakdownType: 'renewals' })}
              className="w-full text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              View All Renewals →
            </button>
          </div>
        </div>
      </div>

      {/* AI Insights */}
      <div className="rounded-lg bg-gradient-to-r from-blue-600 to-green-500 p-6 text-white">
        <h2 className="mb-2 font-semibold">AI Insights</h2>
        <p className="mb-4 text-blue-50">
          Based on your rental patterns, here are some recommendations:
        </p>
        <ul className="space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-white"></span>
            <span>3 tenants have historically paid late. Consider sending early reminders.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-white"></span>
            <span>Property occupancy is at 94% - highest in 6 months!</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-white"></span>
            <span>Rent collection rate improved by 12% since using AI reminders.</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
