import { useState } from 'react';
import {
  ArrowLeft,
  Home,
  Users,
  DollarSign,
  AlertCircle,
  UserX,
  MoreVertical,
  Power,
  PowerOff,
  Edit,
  Trash2,
  TrendingUp,
  TrendingDown,
  Download,
  Search,
  Filter,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  propertyData,
  activeTenants,
  evictedTenants,
  rentRows,
  rentTrend,
  rentByProperty,
  paymentMethods,
  rentStatus,
  maintenanceRows,
  renewalsRows,
} from '../store/dashboardBreakdownData';
import { fmtNaira } from '../../lib/utils';

export type BreakdownType = 'properties' | 'tenants' | 'rent' | 'maintenance' | 'renewals';

interface DashboardBreakdownPageProps {
  breakdownType: BreakdownType;
  onBack: () => void;
}

interface PropertyStatus {
  [key: string]: 'Active' | 'Inactive' | 'Partial';
}

const PAGE_CONFIG: Record<
  BreakdownType,
  {
    title: string;
    subtitle: string;
    icon: React.ElementType;
    iconBg: string;
    iconColor: string;
    stat: string;
    statLabel: string;
    trend: string;
    trendUp: boolean;
    accentColor: string;
  }
> = {
  properties: {
    title: 'Total Properties',
    subtitle: 'All properties under your management portfolio',
    icon: Home,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    stat: '8',
    statLabel: 'Properties',
    trend: '+3 this quarter',
    trendUp: true,
    accentColor: 'blue',
  },
  tenants: {
    title: 'Active Tenants',
    subtitle: 'All current and past tenants across your portfolio',
    icon: Users,
    iconBg: 'bg-green-50',
    iconColor: 'text-green-600',
    stat: '187',
    statLabel: 'Active Tenants',
    trend: '+12 this month',
    trendUp: true,
    accentColor: 'green',
  },
  rent: {
    title: 'Rent Collected — This Month',
    subtitle: 'All rent payments received and pending for the current month',
    icon: DollarSign,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    stat: '₦12.4M',
    statLabel: 'Collected',
    trend: '+8% vs last month',
    trendUp: true,
    accentColor: 'emerald',
  },
  maintenance: {
    title: 'Pending Maintenance Requests',
    subtitle: 'Open maintenance tickets requiring attention',
    icon: AlertCircle,
    iconBg: 'bg-orange-50',
    iconColor: 'text-orange-600',
    stat: '7',
    statLabel: 'Open Requests',
    trend: '-3 since last week',
    trendUp: false,
    accentColor: 'orange',
  },
  renewals: {
    title: 'Upcoming Lease Renewals',
    subtitle: 'Leases expiring in the next 6 months requiring follow-up',
    icon: Home,
    iconBg: 'bg-purple-50',
    iconColor: 'text-purple-600',
    stat: '9',
    statLabel: 'Renewals Due',
    trend: '2 urgent',
    trendUp: false,
    accentColor: 'purple',
  },
};

export function DashboardBreakdownPage({ breakdownType, onBack }: DashboardBreakdownPageProps) {
  const [tenantTab, setTenantTab] = useState<'active' | 'evicted'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [propertyStatuses, setPropertyStatuses] = useState<PropertyStatus>(() => {
    const initial: PropertyStatus = {};
    propertyData.forEach((p) => {
      initial[p.id] = p.defaultStatus;
    });
    return initial;
  });
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const config = PAGE_CONFIG[breakdownType];
  const Icon = config.icon;

  const handleTogglePropertyStatus = (propertyId: string) => {
    setPropertyStatuses((prev) => ({
      ...prev,
      [propertyId]: prev[propertyId] === 'Active' ? 'Inactive' : 'Active',
    }));
    setOpenDropdown(null);
    const property = propertyData.find((p) => p.id === propertyId);
    const newStatus = propertyStatuses[propertyId] === 'Active' ? 'Inactive' : 'Active';
    alert(
      `Property "${property?.name}" has been ${newStatus === 'Active' ? 'activated' : 'deactivated'}.`,
    );
  };

  const handleEditProperty = (propertyId: string) => {
    const property = propertyData.find((p) => p.id === propertyId);
    setOpenDropdown(null);
    alert(`Edit property: ${property?.name}\n\nThis would open a property editor form.`);
  };

  const handleDeleteProperty = (propertyId: string) => {
    const property = propertyData.find((p) => p.id === propertyId);
    setOpenDropdown(null);
    if (
      confirm(
        `Are you sure you want to delete "${property?.name}"?\n\nThis action cannot be undone.`,
      )
    ) {
      alert(`Property "${property?.name}" deleted successfully.`);
    }
  };

  const renderSummaryCards = () => {
    if (breakdownType === 'properties') {
      const active = Object.values(propertyStatuses).filter((s) => s === 'Active').length;
      const partial = Object.values(propertyStatuses).filter((s) => s === 'Partial').length;
      const inactive = Object.values(propertyStatuses).filter((s) => s === 'Inactive').length;
      return (
        <div className="mb-6 grid grid-cols-3 gap-4">
          {[
            {
              label: 'Active',
              value: active,
              color: 'bg-green-50 border-green-200 text-green-700',
            },
            {
              label: 'Partially Occupied',
              value: partial,
              color: 'bg-yellow-50 border-yellow-200 text-yellow-700',
            },
            {
              label: 'Inactive',
              value: inactive,
              color: 'bg-gray-50 border-gray-200 text-gray-600',
            },
          ].map((card) => (
            <div key={card.label} className={`rounded-lg border p-4 ${card.color}`}>
              <p className="text-2xl font-bold">{card.value}</p>
              <p className="mt-0.5 text-sm">{card.label}</p>
            </div>
          ))}
        </div>
      );
    }
    if (breakdownType === 'tenants') {
      return (
        <div className="mb-6 grid grid-cols-3 gap-4">
          {[
            {
              label: 'Paid This Month',
              value: '9',
              color: 'bg-green-50 border-green-200 text-green-700',
            },
            {
              label: 'Pending Payment',
              value: '2',
              color: 'bg-yellow-50 border-yellow-200 text-yellow-700',
            },
            {
              label: 'Overdue',
              value: '1',
              color: 'bg-red-50 border-red-200 text-red-700',
            },
          ].map((card) => (
            <div key={card.label} className={`rounded-lg border p-4 ${card.color}`}>
              <p className="text-2xl font-bold">{card.value}</p>
              <p className="mt-0.5 text-sm">{card.label}</p>
            </div>
          ))}
        </div>
      );
    }
    if (breakdownType === 'rent') {
      return (
        <div className="mb-6 grid grid-cols-3 gap-4">
          {[
            {
              label: 'Total Collected',
              value: '₦8.55M',
              color: 'bg-green-50 border-green-200 text-green-700',
            },
            {
              label: 'Pending',
              value: '₦650K',
              color: 'bg-yellow-50 border-yellow-200 text-yellow-700',
            },
            {
              label: 'Receipts Issued',
              value: '7/8',
              color: 'bg-blue-50 border-blue-200 text-blue-700',
            },
          ].map((card) => (
            <div key={card.label} className={`rounded-lg border p-4 ${card.color}`}>
              <p className="text-2xl font-bold">{card.value}</p>
              <p className="mt-0.5 text-sm">{card.label}</p>
            </div>
          ))}
        </div>
      );
    }
    if (breakdownType === 'maintenance') {
      return (
        <div className="mb-6 grid grid-cols-3 gap-4">
          {[
            {
              label: 'High Priority',
              value: '3',
              color: 'bg-red-50 border-red-200 text-red-700',
            },
            {
              label: 'Medium Priority',
              value: '3',
              color: 'bg-yellow-50 border-yellow-200 text-yellow-700',
            },
            {
              label: 'Low Priority',
              value: '1',
              color: 'bg-gray-50 border-gray-200 text-gray-600',
            },
          ].map((card) => (
            <div key={card.label} className={`rounded-lg border p-4 ${card.color}`}>
              <p className="text-2xl font-bold">{card.value}</p>
              <p className="mt-0.5 text-sm">{card.label}</p>
            </div>
          ))}
        </div>
      );
    }
    if (breakdownType === 'renewals') {
      return (
        <div className="mb-6 grid grid-cols-3 gap-4">
          {[
            {
              label: 'Urgent (< 30 days)',
              value: '2',
              color: 'bg-red-50 border-red-200 text-red-700',
            },
            {
              label: 'Contacted',
              value: '1',
              color: 'bg-blue-50 border-blue-200 text-blue-700',
            },
            {
              label: 'Already Renewed',
              value: '1',
              color: 'bg-green-50 border-green-200 text-green-700',
            },
          ].map((card) => (
            <div key={card.label} className={`rounded-lg border p-4 ${card.color}`}>
              <p className="text-2xl font-bold">{card.value}</p>
              <p className="mt-0.5 text-sm">{card.label}</p>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const renderTable = () => {
    if (breakdownType === 'properties') {
      return (
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-gray-50">
            <tr>
              {['Property', 'Location', 'Type', 'Units', 'Occupancy', 'Status', 'Actions'].map(
                (col) => (
                  <th
                    key={col}
                    className="border-b border-gray-200 px-4 py-3 text-left text-xs font-semibold tracking-wide whitespace-nowrap text-gray-500 uppercase"
                  >
                    {col}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {propertyData
              .filter(
                (p) =>
                  p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  p.location.toLowerCase().includes(searchQuery.toLowerCase()),
              )
              .map((property) => {
                const status = propertyStatuses[property.id];
                const isInactive = status === 'Inactive';
                return (
                  <tr
                    key={property.id}
                    className={`transition-colors hover:bg-gray-50 ${isInactive ? 'opacity-60' : ''}`}
                  >
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50">
                          <Home className="h-4 w-4 text-blue-500" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">{property.name}</p>
                          {isInactive && (
                            <p className="text-xs text-gray-400 italic">Deactivated</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-gray-600">
                      {property.location}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-gray-600">{property.type}</td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-gray-600">
                      {property.units}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-gray-600">
                      {property.occupancy}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          status === 'Active'
                            ? 'bg-green-100 text-green-700'
                            : status === 'Inactive'
                              ? 'bg-gray-100 text-gray-600'
                              : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenDropdown(openDropdown === property.id ? null : property.id);
                          }}
                          className="rounded-lg p-1.5 transition-colors hover:bg-gray-200"
                        >
                          <MoreVertical className="h-4 w-4 text-gray-500" />
                        </button>
                        {openDropdown === property.id && (
                          <>
                            <div
                              className="fixed inset-0 z-10"
                              onClick={() => setOpenDropdown(null)}
                            />
                            <div className="absolute top-9 right-0 z-20 min-w-[190px] rounded-xl border border-gray-200 bg-white py-1.5 shadow-lg">
                              <button
                                onClick={() => handleTogglePropertyStatus(property.id)}
                                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-gray-50"
                              >
                                {status === 'Active' ? (
                                  <>
                                    <PowerOff className="h-4 w-4 text-orange-500" />
                                    <span>Deactivate Property</span>
                                  </>
                                ) : (
                                  <>
                                    <Power className="h-4 w-4 text-green-600" />
                                    <span>Activate Property</span>
                                  </>
                                )}
                              </button>
                              <button
                                onClick={() => handleEditProperty(property.id)}
                                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-gray-50"
                              >
                                <Edit className="h-4 w-4 text-blue-500" />
                                <span>Edit Property</span>
                              </button>
                              <div className="my-1 border-t border-gray-100" />
                              <button
                                onClick={() => handleDeleteProperty(property.id)}
                                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-red-600 transition-colors hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                                <span>Delete Property</span>
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      );
    }

    if (breakdownType === 'tenants') {
      const rows = tenantTab === 'active' ? activeTenants : evictedTenants;
      const columns =
        tenantTab === 'active'
          ? ['Tenant', 'Property', 'Unit', 'Lease Start', 'Lease End', 'Rent Status']
          : ['Tenant', 'Property', 'Unit', 'Eviction Date', 'Reason', 'Arrears Owed', 'Status'];

      return (
        <table className="w-full text-sm">
          <thead
            className={`sticky top-0 z-10 ${tenantTab === 'evicted' ? 'bg-red-50' : 'bg-gray-50'}`}
          >
            <tr>
              {columns.map((col) => (
                <th
                  key={col}
                  className={`border-b px-4 py-3 text-left text-xs font-semibold tracking-wide whitespace-nowrap uppercase ${
                    tenantTab === 'evicted'
                      ? 'border-red-100 text-red-500'
                      : 'border-gray-200 text-gray-500'
                  }`}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows
              .filter((row) => (row[0] as string).toLowerCase().includes(searchQuery.toLowerCase()))
              .map((row, i) => (
                <tr
                  key={i}
                  className={`transition-colors ${tenantTab === 'evicted' ? 'hover:bg-red-50/40' : 'hover:bg-gray-50'}`}
                >
                  {row.map((cell, j) => (
                    <td key={j} className="px-4 py-3.5 whitespace-nowrap text-gray-700">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      );
    }

    if (breakdownType === 'rent') {
      const columns = ['Tenant', 'Property', 'Amount', 'Payment Method', 'Date', 'Receipt'];
      return (
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-gray-50">
            <tr>
              {columns.map((col) => (
                <th
                  key={col}
                  className="border-b border-gray-200 px-4 py-3 text-left text-xs font-semibold tracking-wide whitespace-nowrap text-gray-500 uppercase"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rentRows
              .filter((row) => (row[0] as string).toLowerCase().includes(searchQuery.toLowerCase()))
              .map((row, i) => (
                <tr key={i} className="transition-colors hover:bg-gray-50">
                  {row.map((cell, j) => (
                    <td key={j} className="px-4 py-3.5 whitespace-nowrap text-gray-700">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      );
    }

    if (breakdownType === 'maintenance') {
      const columns = ['Request ID', 'Property', 'Issue', 'Reported By', 'Priority', 'Days Open'];
      return (
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-gray-50">
            <tr>
              {columns.map((col) => (
                <th
                  key={col}
                  className="border-b border-gray-200 px-4 py-3 text-left text-xs font-semibold tracking-wide whitespace-nowrap text-gray-500 uppercase"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {maintenanceRows
              .filter(
                (row) =>
                  (row[2] as string).toLowerCase().includes(searchQuery.toLowerCase()) ||
                  (row[1] as string).toLowerCase().includes(searchQuery.toLowerCase()),
              )
              .map((row, i) => (
                <tr key={i} className="transition-colors hover:bg-gray-50">
                  {row.map((cell, j) => (
                    <td key={j} className="px-4 py-3.5 whitespace-nowrap text-gray-700">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      );
    }

    if (breakdownType === 'renewals') {
      const columns = [
        'Tenant',
        'Property',
        'Unit',
        'Current Rent',
        'Lease End',
        'Days Left',
        'Contact Status',
        'Action',
      ];
      return (
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-gray-50">
            <tr>
              {columns.map((col) => (
                <th
                  key={col}
                  className="border-b border-gray-200 px-4 py-3 text-left text-xs font-semibold tracking-wide whitespace-nowrap text-gray-500 uppercase"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {renewalsRows
              .filter((row) => (row[0] as string).toLowerCase().includes(searchQuery.toLowerCase()))
              .map((row, i) => (
                <tr key={i} className="transition-colors hover:bg-gray-50">
                  {row.map((cell, j) => (
                    <td key={j} className="px-4 py-3.5 whitespace-nowrap text-gray-700">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      );
    }

    return null;
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm font-medium text-gray-500 transition-colors hover:text-gray-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </button>
      </div>

      {/* Hero Row */}
      <div className="flex items-center gap-6 rounded-xl border border-gray-200 bg-white p-6">
        <div
          className={`h-14 w-14 rounded-xl ${config.iconBg} flex flex-shrink-0 items-center justify-center`}
        >
          <Icon className={`h-7 w-7 ${config.iconColor}`} />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-gray-900">{config.title}</h1>
          <p className="mt-0.5 text-sm text-gray-500">{config.subtitle}</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-gray-900">{config.stat}</p>
          <p className="text-sm text-gray-500">{config.statLabel}</p>
          <div
            className={`mt-1 flex items-center justify-end gap-1 text-sm font-medium ${config.trendUp ? 'text-green-600' : 'text-red-500'}`}
          >
            {config.trendUp ? (
              <TrendingUp className="h-3.5 w-3.5" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5" />
            )}
            {config.trend}
          </div>
        </div>
      </div>

      {/* Summary cards */}
      {renderSummaryCards()}

      {/* ── Rent charts (only on rent breakdown) ── */}
      {breakdownType === 'rent' && (
        <div className="space-y-6">
          {/* Row 1 — collection trend + per-property bar */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Area chart: collected vs expected */}
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="mb-1 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Collection Trend</h3>
                <span className="flex items-center gap-1 text-xs font-medium text-green-600">
                  <TrendingUp className="h-3.5 w-3.5" /> +8% vs last month
                </span>
              </div>
              <p className="mb-4 text-xs text-gray-500">Collected vs. expected · Jan–Jun 2026</p>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={rentTrend} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradExpected" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#e0e7ff" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#e0e7ff" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradCollected" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={fmtNaira} tick={{ fontSize: 11 }} width={52} />
                  <Tooltip formatter={(v: number) => fmtNaira(v)} />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="expected"
                    name="Expected"
                    stroke="#818cf8"
                    strokeWidth={2}
                    strokeDasharray="5 3"
                    fill="url(#gradExpected)"
                    dot={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="collected"
                    name="Collected"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fill="url(#gradCollected)"
                    dot={{ r: 4, fill: '#10b981' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Horizontal bar: rent per property */}
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h3 className="mb-1 font-semibold text-gray-900">Rent by Property</h3>
              <p className="mb-4 text-xs text-gray-500">This month's payments per property</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={rentByProperty}
                  layout="vertical"
                  margin={{ top: 0, right: 12, left: 4, bottom: 0 }}
                  barSize={14}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" tickFormatter={fmtNaira} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={110} />
                  <Tooltip formatter={(v: number) => fmtNaira(v)} />
                  <Bar dataKey="amount" name="Amount" radius={[0, 4, 4, 0]}>
                    {rentByProperty.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Row 2 — payment method donut + collection status donut */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Donut: payment methods */}
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h3 className="mb-1 font-semibold text-gray-900">Payment Methods</h3>
              <p className="mb-4 text-xs text-gray-500">
                Distribution for this month's transactions
              </p>
              <div className="flex items-center gap-6">
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie
                      data={paymentMethods}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={72}
                      dataKey="value"
                      paddingAngle={3}
                    >
                      {paymentMethods.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => `${v} payment${v !== 1 ? 's' : ''}`} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-3">
                  {paymentMethods.map((m) => (
                    <div key={m.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 flex-shrink-0 rounded-full"
                          style={{ background: m.fill }}
                        />
                        <span className="text-sm text-gray-700">{m.name}</span>
                      </div>
                      <span className="text-sm font-semibold text-gray-800">{m.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Donut: collection status */}
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h3 className="mb-1 font-semibold text-gray-900">Collection Status</h3>
              <p className="mb-4 text-xs text-gray-500">Collected vs. still pending · this month</p>
              <div className="flex items-center gap-6">
                <div className="relative flex-shrink-0">
                  <ResponsiveContainer width={160} height={160}>
                    <PieChart>
                      <Pie
                        data={rentStatus}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={72}
                        dataKey="value"
                        paddingAngle={3}
                        startAngle={90}
                        endAngle={-270}
                      >
                        {rentStatus.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => fmtNaira(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-lg font-bold text-gray-900">93%</p>
                      <p className="text-xs text-gray-400">rate</p>
                    </div>
                  </div>
                </div>
                <div className="flex-1 space-y-3">
                  {rentStatus.map((s) => (
                    <div key={s.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 flex-shrink-0 rounded-full"
                          style={{ background: s.fill }}
                        />
                        <span className="text-sm text-gray-700">{s.name}</span>
                      </div>
                      <span className="text-sm font-semibold text-gray-800">
                        {fmtNaira(s.value)}
                      </span>
                    </div>
                  ))}
                  <div className="border-t border-gray-100 pt-2">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600"
                        style={{ width: '93%' }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-gray-500">₦8.55M of ₦9.2M expected</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Table card */}
      <div className="flex flex-col rounded-xl border border-gray-200 bg-white">
        {/* Table toolbar */}
        <div className="flex items-center justify-between gap-4 border-b border-gray-200 p-4">
          {/* Tenant tabs (only for tenants page) */}
          {breakdownType === 'tenants' ? (
            <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
              <button
                onClick={() => setTenantTab('active')}
                className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  tenantTab === 'active'
                    ? 'bg-white text-gray-800 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                Active
                <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-xs text-green-700">
                  12
                </span>
              </button>
              <button
                onClick={() => setTenantTab('evicted')}
                className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  tenantTab === 'evicted'
                    ? 'bg-white text-gray-800 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <UserX className="h-3.5 w-3.5" />
                Evicted
                <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-xs text-red-700">
                  5
                </span>
              </button>
            </div>
          ) : (
            <p className="text-sm font-medium text-gray-700">
              {breakdownType === 'properties'
                ? `${propertyData.length} properties`
                : breakdownType === 'rent'
                  ? `${rentRows.length} transactions`
                  : breakdownType === 'maintenance'
                    ? `${maintenanceRows.length} open requests`
                    : `${renewalsRows.length} upcoming renewals`}
            </p>
          )}

          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-52 rounded-lg border border-gray-200 py-2 pr-4 pl-9 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <button className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50">
              <Filter className="h-3.5 w-3.5" />
              Filter
            </button>
            <button className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50">
              <Download className="h-3.5 w-3.5" />
              Export
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">{renderTable()}</div>
      </div>
    </div>
  );
}
