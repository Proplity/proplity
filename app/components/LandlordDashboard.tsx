import { useState } from 'react';
import {
  Home,
  DollarSign,
  Users,
  TrendingUp,
  Building2,
  PieChart,
  Calendar,
  Download,
  KeyRound,
  Copy,
  Power,
  PowerOff,
  Plus,
  CheckCircle,
  Clock,
  Shield,
} from 'lucide-react';

interface ManagerCode {
  id: string;
  code: string;
  createdAt: string;
  status: 'Active' | 'Deactivated';
  linkedManager: string | null;
  linkedAt: string | null;
}

interface LandlordDashboardProps {
  onNavigate?: (page: any) => void;
}

export function LandlordDashboard({ onNavigate }: LandlordDashboardProps = {}) {
  const [managerCodes, setManagerCodes] = useState<ManagerCode[]>([
    {
      id: '1',
      code: 'LLD-2847-XK',
      createdAt: 'Jun 1, 2026',
      status: 'Active',
      linkedManager: 'Tunde Bakare',
      linkedAt: 'Jun 3, 2026',
    },
    {
      id: '2',
      code: 'LLD-1193-QR',
      createdAt: 'May 15, 2026',
      status: 'Deactivated',
      linkedManager: 'Kola Adeyemi',
      linkedAt: 'May 16, 2026',
    },
    {
      id: '3',
      code: 'LLD-5521-BT',
      createdAt: 'Jun 20, 2026',
      status: 'Active',
      linkedManager: null,
      linkedAt: null,
    },
  ]);
  const [copied, setCopied] = useState<string | null>(null);

  const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const part1 = Array.from(
      { length: 4 },
      () => chars[Math.floor(Math.random() * chars.length)],
    ).join('');
    const part2 = Array.from(
      { length: 2 },
      () => chars[Math.floor(Math.random() * chars.length)],
    ).join('');
    const newCode: ManagerCode = {
      id: Date.now().toString(),
      code: `LLD-${part1}-${part2}`,
      createdAt: new Date().toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
      status: 'Active',
      linkedManager: null,
      linkedAt: null,
    };
    setManagerCodes((prev) => [newCode, ...prev]);
  };

  const toggleCode = (id: string) => {
    setManagerCodes((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, status: c.status === 'Active' ? 'Deactivated' : 'Active' } : c,
      ),
    );
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  const properties = [
    {
      id: 1,
      name: 'Lekki Phase 1 Complex',
      units: 8,
      occupied: 7,
      revenue: '₦6.8M',
      performance: 95,
    },
    {
      id: 2,
      name: 'Maitama Apartments',
      units: 4,
      occupied: 4,
      revenue: '₦4.8M',
      performance: 100,
    },
    {
      id: 3,
      name: 'Ikeja GRA Estate',
      units: 6,
      occupied: 5,
      revenue: '₦5.4M',
      performance: 88,
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="mb-1 text-2xl font-semibold">Landlord Portfolio</h1>
        <p className="text-gray-600">Overview of your property investments</p>
      </div>

      {/* Portfolio Stats */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50">
              <Building2 className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <p className="mb-1 text-2xl font-semibold">18</p>
          <p className="text-sm text-gray-600">Total Units</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-50">
              <Users className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <p className="mb-1 text-2xl font-semibold">16</p>
          <p className="text-sm text-gray-600">Occupied Units</p>
          <p className="mt-1 text-xs text-green-600">89% Occupancy</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-50">
              <DollarSign className="h-6 w-6 text-purple-600" />
            </div>
          </div>
          <p className="mb-1 text-2xl font-semibold">₦17M</p>
          <p className="text-sm text-gray-600">Annual Revenue</p>
          <p className="mt-1 text-xs text-green-600">+12% vs last year</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-orange-50">
              <TrendingUp className="h-6 w-6 text-orange-600" />
            </div>
          </div>
          <p className="mb-1 text-2xl font-semibold">94%</p>
          <p className="text-sm text-gray-600">Collection Rate</p>
          <p className="mt-1 text-xs text-green-600">+8% improvement</p>
        </div>
      </div>

      {/* Property Performance */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-200 p-6">
          <h2 className="font-semibold">Property Performance</h2>
          <button
            onClick={() => onNavigate?.({ type: 'dashboard' })}
            className="text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            View All
          </button>
        </div>
        <div className="divide-y divide-gray-200">
          {properties.map((property) => (
            <div key={property.id} className="p-6 hover:bg-gray-50">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-lg font-semibold">{property.name}</p>
                  <p className="text-sm text-gray-600">
                    {property.units} units • {property.occupied} occupied
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-semibold text-green-600">{property.revenue}</p>
                  <p className="text-xs text-gray-500">Annual Revenue</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs text-gray-600">Performance</span>
                    <span className="text-xs font-medium">{property.performance}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                    <div
                      className="h-full rounded-full bg-green-500"
                      style={{ width: `${property.performance}%` }}
                    ></div>
                  </div>
                </div>
                <button
                  onClick={() =>
                    onNavigate?.({
                      type: 'property-detail',
                      propertyId: property.id,
                    })
                  }
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
                >
                  View Details
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Revenue Breakdown */}
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-200 p-6">
            <h2 className="font-semibold">Revenue Breakdown (2026)</h2>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {[
                {
                  label: 'Rent Collected',
                  amount: '₦15.8M',
                  percentage: 93,
                  color: 'green',
                },
                {
                  label: 'Pending Payments',
                  amount: '₦1.2M',
                  percentage: 7,
                  color: 'yellow',
                },
                {
                  label: 'Maintenance Costs',
                  amount: '₦945K',
                  percentage: 5.5,
                  color: 'red',
                },
                {
                  label: 'Net Revenue',
                  amount: '₦14.9M',
                  percentage: 87.5,
                  color: 'blue',
                },
              ].map((item, index) => (
                <div key={index}>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm text-gray-600">{item.label}</span>
                    <span className="text-sm font-semibold">{item.amount}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                    <div
                      className={`h-full bg-${item.color}-500 rounded-full`}
                      style={{ width: `${item.percentage}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-200 p-6">
            <h2 className="font-semibold">Recent Activity</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {[
              {
                event: 'Rent payment received',
                tenant: 'Adewale Johnson',
                amount: '₦850K',
                time: '2h ago',
              },
              {
                event: 'Maintenance completed',
                property: 'Lekki Phase 1, Apt 203',
                amount: '₦15K',
                time: '5h ago',
              },
              {
                event: 'New tenant onboarded',
                tenant: 'Chidinma Okafor',
                property: 'Maitama, Unit 5B',
                time: '1d ago',
              },
              {
                event: 'Lease renewal signed',
                tenant: 'Ibrahim Musa',
                property: 'Wuse 2, Apt 14',
                time: '2d ago',
              },
            ].map((activity, index) => (
              <div key={index} className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium">{activity.event}</p>
                    <p className="mt-1 text-xs text-gray-600">
                      {activity.tenant && `${activity.tenant} • `}
                      {activity.property}
                    </p>
                    {activity.amount && (
                      <p className="mt-1 text-xs font-medium text-green-600">{activity.amount}</p>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">{activity.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="rounded-lg border border-purple-200 bg-gradient-to-r from-purple-50 to-blue-50 p-6">
        <h3 className="mb-4 font-semibold">Owner Actions</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <button
            onClick={() => alert('Generating financial report...')}
            className="rounded-lg border border-gray-200 bg-white p-4 text-left transition-shadow hover:shadow-md"
          >
            <Download className="mb-2 h-5 w-5 text-blue-600" />
            <p className="text-sm font-medium">Download Report</p>
            <p className="text-xs text-gray-600">Financial summary</p>
          </button>
          <button
            onClick={() => alert('Opening calendar...')}
            className="rounded-lg border border-gray-200 bg-white p-4 text-left transition-shadow hover:shadow-md"
          >
            <Calendar className="mb-2 h-5 w-5 text-green-600" />
            <p className="text-sm font-medium">Schedule Review</p>
            <p className="text-xs text-gray-600">With manager</p>
          </button>
          <button
            onClick={() => alert('Opening detailed analytics...')}
            className="rounded-lg border border-gray-200 bg-white p-4 text-left transition-shadow hover:shadow-md"
          >
            <PieChart className="mb-2 h-5 w-5 text-purple-600" />
            <p className="text-sm font-medium">Analytics</p>
            <p className="text-xs text-gray-600">Deep insights</p>
          </button>
          <button
            onClick={() => onNavigate?.({ type: 'list-property' })}
            className="rounded-lg border border-gray-200 bg-white p-4 text-left transition-shadow hover:shadow-md"
          >
            <Home className="mb-2 h-5 w-5 text-orange-600" />
            <p className="text-sm font-medium">Add Property</p>
            <p className="text-xs text-gray-600">Expand portfolio</p>
          </button>
        </div>
      </div>

      {/* Manager Access — Code Management */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
              <KeyRound className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Manager Access Codes</h2>
              <p className="mt-0.5 text-xs text-gray-500">
                Share a code with your Property Manager during their registration to link them to
                your portfolio.
              </p>
            </div>
          </div>
          <button
            onClick={generateCode}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Generate New Code
          </button>
        </div>

        <div className="flex items-start gap-3 border-b border-amber-100 bg-amber-50 p-4">
          <Shield className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
          <p className="text-xs text-amber-800">
            <span className="font-semibold">How it works:</span> Generate a code and share it with
            the person you want to appoint as your Property Manager. They'll enter it during
            registration. You can deactivate a code at any time to immediately revoke access — even
            after they've registered.
          </p>
        </div>

        <div className="divide-y divide-gray-100">
          {managerCodes.map((item) => (
            <div
              key={item.id}
              className={`flex items-center gap-4 p-4 ${item.status === 'Deactivated' ? 'opacity-60' : ''}`}
            >
              {/* Code pill */}
              <div
                className={`flex-shrink-0 rounded-lg border px-3 py-2 font-mono text-sm font-bold tracking-widest ${
                  item.status === 'Active'
                    ? 'border-blue-200 bg-blue-50 text-blue-800'
                    : 'border-gray-200 bg-gray-100 text-gray-500 line-through'
                }`}
              >
                {item.code}
              </div>

              {/* Details */}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      item.status === 'Active'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {item.status}
                  </span>
                  {item.linkedManager ? (
                    <span className="flex items-center gap-1 text-xs text-gray-600">
                      <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                      Linked to <span className="font-medium">{item.linkedManager}</span> · since{' '}
                      {item.linkedAt}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <Clock className="h-3.5 w-3.5" />
                      Not yet used
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-400">Created {item.createdAt}</p>
              </div>

              {/* Actions */}
              <div className="flex flex-shrink-0 items-center gap-2">
                {item.status === 'Active' && (
                  <button
                    onClick={() => copyCode(item.code)}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 transition-colors hover:bg-gray-50"
                  >
                    {copied === item.code ? (
                      <>
                        <CheckCircle className="h-3.5 w-3.5 text-green-500" /> Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" /> Copy
                      </>
                    )}
                  </button>
                )}
                <button
                  onClick={() => toggleCode(item.id)}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    item.status === 'Active'
                      ? 'border-red-200 text-red-600 hover:bg-red-50'
                      : 'border-green-200 text-green-700 hover:bg-green-50'
                  }`}
                >
                  {item.status === 'Active' ? (
                    <>
                      <PowerOff className="h-3.5 w-3.5" /> Deactivate
                    </>
                  ) : (
                    <>
                      <Power className="h-3.5 w-3.5" /> Reactivate
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}

          {managerCodes.length === 0 && (
            <div className="p-8 text-center text-gray-400">
              <KeyRound className="mx-auto mb-2 h-10 w-10 opacity-40" />
              <p className="text-sm">
                No codes generated yet. Click "Generate New Code" to get started.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Investment Summary */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 p-6">
          <h2 className="font-semibold">Investment Summary</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div>
              <p className="mb-1 text-sm text-gray-600">Total Investment Value</p>
              <p className="text-2xl font-semibold">₦450M</p>
            </div>
            <div>
              <p className="mb-1 text-sm text-gray-600">Average ROI</p>
              <p className="text-2xl font-semibold text-green-600">8.5%</p>
            </div>
            <div>
              <p className="mb-1 text-sm text-gray-600">Properties Managed</p>
              <p className="text-2xl font-semibold">3</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
