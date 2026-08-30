import { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Building2,
  Wrench,
  Calendar,
  ChevronDown,
  BarChart3,
  RefreshCw,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPie,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { useAdminUsers } from '@/hooks/useAdminUsers';
import { useMyProperties } from '@/hooks/useProperties';
import { useLeases } from '@/hooks/useLeases';
import { useInvoices } from '@/hooks/useInvoices';
import { useMaintenanceRequests } from '@/hooks/useMaintenanceRequests';

type ReportTab = 'overview' | 'financial' | 'users' | 'properties' | 'maintenance';

const TABS: { id: ReportTab; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'financial', label: 'Financial', icon: DollarSign },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'properties', label: 'Properties', icon: Building2 },
  { id: 'maintenance', label: 'Maintenance', icon: Wrench },
];

const ROLE_COLORS: Record<string, string> = {
  ADMIN: '#6b7280',
  MANAGER: '#3b82f6',
  LANDLORD: '#8b5cf6',
  TENANT: '#10b981',
  VENDOR: '#f59e0b',
};
const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function fmt(n: number) {
  if (n >= 1_000_000_000) return `₦${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`;
  return `₦${n.toLocaleString()}`;
}

function monthKey(date: string) {
  const d = new Date(date);
  return `${d.getFullYear()}-${d.getMonth()}`;
}

function monthsForPeriod(period: string) {
  const now = new Date();
  if (period === 'Last Year') {
    const months: { key: string; label: string }[] = [];
    for (let m = 0; m < 12; m++) {
      const d = new Date(now.getFullYear() - 1, m, 1);
      months.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: d.toLocaleDateString('en-US', { month: 'short' }),
      });
    }
    return months;
  }
  const count =
    period === 'Last 30 Days'
      ? 1
      : period === 'Last 3 Months'
        ? 3
        : period === 'This Year'
          ? now.getMonth() + 1
          : 6;
  const months: { key: string; label: string }[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: d.toLocaleDateString('en-US', { month: 'short' }),
    });
  }
  return months;
}

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  iconBg,
  iconColor,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className={`h-10 w-10 rounded-lg ${iconBg} flex items-center justify-center`}>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
        {sub && (
          <span className="flex items-center gap-1 text-xs font-medium text-gray-500">
            <TrendingUp className="h-3.5 w-3.5" />
            {sub}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="mt-0.5 text-sm text-gray-500">{label}</p>
    </div>
  );
}

export function AdminReports() {
  const [activeTab, setActiveTab] = useState<ReportTab>('overview');
  const [period, setPeriod] = useState('Last 6 Months');
  const [showPeriodMenu, setShowPeriodMenu] = useState(false);

  const { data: users, loading: usersLoading, refetch: refetchUsers } = useAdminUsers();
  const {
    data: properties,
    loading: propertiesLoading,
    refetch: refetchProperties,
  } = useMyProperties();
  const { data: leases } = useLeases();
  const { data: invoices, loading: invoicesLoading, refetch: refetchInvoices } = useInvoices();
  const {
    data: maintenanceRequests,
    loading: maintenanceLoading,
    refetch: refetchMaintenance,
  } = useMaintenanceRequests();

  const loading = usersLoading || propertiesLoading || invoicesLoading || maintenanceLoading;
  const handleRefresh = () => {
    refetchUsers();
    refetchProperties();
    refetchInvoices();
    refetchMaintenance();
  };
  const periods = ['Last 30 Days', 'Last 3 Months', 'Last 6 Months', 'This Year', 'Last Year'];

  // ---- Shared real computations (platform-wide -- ADMIN sees everything) ----
  const allPayments = invoices.flatMap((invoice) =>
    invoice.payments.map((payment) => ({ invoice, payment })),
  );
  const collectedTotal = allPayments.reduce((sum, p) => sum + p.payment.amount, 0);
  const pendingTotal = invoices
    .filter((i) => i.status !== 'PAID' && i.status !== 'CANCELLED')
    .reduce(
      (sum, i) => sum + Math.max(0, i.amount - i.payments.reduce((s, p) => s + p.amount, 0)),
      0,
    );
  const cancelledInvoices = invoices.filter((i) => i.status === 'CANCELLED');
  const cancelledRate =
    invoices.length > 0 ? (cancelledInvoices.length / invoices.length) * 100 : 0;
  const avgTransactionValue = allPayments.length > 0 ? collectedTotal / allPayments.length : 0;

  const completedMaintenance = maintenanceRequests.filter((r) => r.status === 'COMPLETED');
  const resolutionDays = completedMaintenance
    .filter((r) => r.completedAt)
    .map(
      (r) => (new Date(r.completedAt!).getTime() - new Date(r.createdAt).getTime()) / MS_PER_DAY,
    );
  const avgResolutionDays =
    resolutionDays.length > 0
      ? resolutionDays.reduce((s, d) => s + d, 0) / resolutionDays.length
      : 0;
  const openMaintenance = maintenanceRequests.filter(
    (r) => r.status !== 'COMPLETED' && r.status !== 'CANCELLED',
  );
  const highPriorityOpen = openMaintenance.filter(
    (r) => r.priority === 'HIGH' || r.priority === 'EMERGENCY',
  ).length;

  const months = monthsForPeriod(period);
  const revenueTrend = months.map(({ key, label }) => ({
    month: label,
    billed: invoices
      .filter((i) => monthKey(i.dueDate) === key)
      .reduce((sum, i) => sum + i.amount, 0),
    collected: allPayments
      .filter((p) => monthKey(p.payment.paidAt) === key)
      .reduce((sum, p) => sum + p.payment.amount, 0),
  }));
  const newUsersByMonth = months.map(({ key, label }) => {
    const row: Record<string, number | string> = { month: label };
    for (const role of ['MANAGER', 'LANDLORD', 'TENANT', 'VENDOR']) {
      row[role.toLowerCase()] = users.filter(
        (u) => u.role === role && monthKey(u.createdAt) === key,
      ).length;
    }
    return row;
  });
  const maintenanceByMonth = months.map(({ key, label }) => ({
    month: label,
    created: maintenanceRequests.filter((r) => monthKey(r.createdAt) === key).length,
    resolved: maintenanceRequests.filter((r) => r.completedAt && monthKey(r.completedAt) === key)
      .length,
  }));

  const revenueByType = Object.entries(
    allPayments.reduce<Record<string, number>>((acc, p) => {
      acc[p.invoice.type] = (acc[p.invoice.type] ?? 0) + p.payment.amount;
      return acc;
    }, {}),
  ).map(([type, amount], i) => ({ type, amount, fill: CHART_COLORS[i % CHART_COLORS.length] }));

  const usersByRole = ['ADMIN', 'MANAGER', 'LANDLORD', 'TENANT', 'VENDOR'].map((role) => ({
    name: role,
    value: users.filter((u) => u.role === role).length,
    fill: ROLE_COLORS[role],
  }));

  const units = properties.flatMap((p) => p.units);
  const occupiedUnits = units.filter((u) => u.status === 'OCCUPIED').length;
  const avgOccupancy = units.length > 0 ? (occupiedUnits / units.length) * 100 : 0;
  const avgRent =
    units.length > 0 ? units.reduce((sum, u) => sum + u.rentAmount, 0) / units.length : 0;
  const propertiesByState = Object.entries(
    properties.reduce<Record<string, number>>((acc, p) => {
      const state = p.state ?? 'Unknown';
      acc[state] = (acc[state] ?? 0) + 1;
      return acc;
    }, {}),
  ).map(([name, value], i) => ({ name, value, fill: CHART_COLORS[i % CHART_COLORS.length] }));
  const stateDetail = Object.entries(
    properties.reduce<
      Record<string, { total: number; approved: number; pending: number; units: typeof units }>
    >((acc, p) => {
      const state = p.state ?? 'Unknown';
      acc[state] ??= { total: 0, approved: 0, pending: 0, units: [] };
      acc[state].total += 1;
      if (p.moderationStatus === 'APPROVED') acc[state].approved += 1;
      if (p.moderationStatus === 'PENDING_REVIEW') acc[state].pending += 1;
      acc[state].units.push(...p.units);
      return acc;
    }, {}),
  ).map(([state, s]) => ({
    state,
    ...s,
    avgRent:
      s.units.length > 0 ? s.units.reduce((sum, u) => sum + u.rentAmount, 0) / s.units.length : 0,
    occupancy:
      s.units.length > 0
        ? (s.units.filter((u) => u.status === 'OCCUPIED').length / s.units.length) * 100
        : 0,
  }));

  const statusByRole = ['ADMIN', 'MANAGER', 'LANDLORD', 'TENANT', 'VENDOR'].map((role) => {
    const roleUsers = users.filter((u) => u.role === role);
    return {
      role,
      active: roleUsers.filter((u) => u.status === 'ACTIVE').length,
      pending: roleUsers.filter((u) => u.status === 'PENDING_VERIFICATION').length,
      other: roleUsers.filter((u) => u.status !== 'ACTIVE' && u.status !== 'PENDING_VERIFICATION')
        .length,
    };
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Reports & Analytics</h1>
          <p className="mt-0.5 text-sm text-gray-500">Platform-wide performance data and trends</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setShowPeriodMenu((v) => !v)}
              className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50"
            >
              <Calendar className="h-4 w-4 text-gray-400" />
              {period}
              <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
            </button>
            {showPeriodMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowPeriodMenu(false)} />
                <div className="absolute top-10 right-0 z-20 min-w-[170px] rounded-xl border border-gray-200 bg-white py-1.5 shadow-lg">
                  {periods.map((p) => (
                    <button
                      key={p}
                      onClick={() => {
                        setPeriod(p);
                        setShowPeriodMenu(false);
                      }}
                      className={`w-full px-4 py-2 text-left text-sm transition-colors hover:bg-gray-50 ${p === period ? 'font-medium text-blue-600' : 'text-gray-700'}`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="flex w-fit gap-1 rounded-xl bg-gray-100 p-1">
        {TABS.map((tab) => {
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <TabIcon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {loading && <p className="text-sm text-gray-500">Loading platform data…</p>}

      {/* OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard
              label="Total Revenue (All-Time)"
              value={loading ? '—' : fmt(collectedTotal)}
              icon={DollarSign}
              iconBg="bg-green-50"
              iconColor="text-green-600"
            />
            <KpiCard
              label="Total Users"
              value={loading ? '—' : String(users.length)}
              icon={Users}
              iconBg="bg-blue-50"
              iconColor="text-blue-600"
            />
            <KpiCard
              label="Properties Listed"
              value={loading ? '—' : String(properties.length)}
              icon={Building2}
              iconBg="bg-purple-50"
              iconColor="text-purple-600"
            />
            <KpiCard
              label="Maintenance Resolved"
              value={loading ? '—' : String(completedMaintenance.length)}
              icon={Wrench}
              iconBg="bg-orange-50"
              iconColor="text-orange-600"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h3 className="mb-1 font-semibold text-gray-900">Revenue Trend</h3>
              <p className="mb-4 text-xs text-gray-500">Billed vs. collected · {period}</p>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={revenueTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => fmt(v)} tick={{ fontSize: 11 }} width={52} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Line
                    type="monotone"
                    dataKey="billed"
                    stroke="#818cf8"
                    strokeWidth={2}
                    strokeDasharray="4 3"
                    dot={false}
                    name="Billed"
                  />
                  <Line
                    type="monotone"
                    dataKey="collected"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    dot={false}
                    name="Collected"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h3 className="mb-1 font-semibold text-gray-900">New Users by Role</h3>
              <p className="mb-4 text-xs text-gray-500">{period}</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={newUsersByMonth} barSize={10}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={30} allowDecimals={false} />
                  <Tooltip />
                  <Bar
                    dataKey="tenant"
                    fill={ROLE_COLORS.TENANT}
                    name="Tenants"
                    radius={[2, 2, 0, 0]}
                  />
                  <Bar
                    dataKey="manager"
                    fill={ROLE_COLORS.MANAGER}
                    name="Managers"
                    radius={[2, 2, 0, 0]}
                  />
                  <Bar
                    dataKey="landlord"
                    fill={ROLE_COLORS.LANDLORD}
                    name="Landlords"
                    radius={[2, 2, 0, 0]}
                  />
                  <Bar
                    dataKey="vendor"
                    fill={ROLE_COLORS.VENDOR}
                    name="Vendors"
                    radius={[2, 2, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white">
            <div className="border-b border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900">Monthly Summary</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Month', 'Revenue Collected', 'New Users', 'Maintenance Resolved'].map(
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
                  {revenueTrend.map((row, i) => (
                    <tr key={i} className="transition-colors hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{row.month}</td>
                      <td className="px-4 py-3 text-gray-700">{fmt(row.collected)}</td>
                      <td className="px-4 py-3 text-gray-700">
                        {(newUsersByMonth[i].manager as number) +
                          (newUsersByMonth[i].landlord as number) +
                          (newUsersByMonth[i].tenant as number) +
                          (newUsersByMonth[i].vendor as number)}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{maintenanceByMonth[i].resolved}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* FINANCIAL */}
      {activeTab === 'financial' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard
              label="Total Revenue (All-Time)"
              value={loading ? '—' : fmt(collectedTotal)}
              icon={DollarSign}
              iconBg="bg-green-50"
              iconColor="text-green-600"
            />
            <KpiCard
              label="Pending Amount"
              value={loading ? '—' : fmt(pendingTotal)}
              icon={TrendingUp}
              iconBg="bg-yellow-50"
              iconColor="text-yellow-600"
            />
            <KpiCard
              label="Avg. Transaction Value"
              value={loading ? '—' : fmt(avgTransactionValue)}
              icon={BarChart3}
              iconBg="bg-purple-50"
              iconColor="text-purple-600"
            />
            <KpiCard
              label="Cancelled Rate"
              value={loading ? '—' : `${cancelledRate.toFixed(1)}%`}
              icon={TrendingDown}
              iconBg="bg-red-50"
              iconColor="text-red-500"
            />
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="mb-1 font-semibold text-gray-900">Revenue by Invoice Type</h3>
            <p className="mb-4 text-xs text-gray-500">All-time collected, by real invoice type</p>
            {revenueByType.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={revenueByType} barCategoryGap="35%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="type" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => fmt(v)} tick={{ fontSize: 11 }} width={58} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Bar dataKey="amount" radius={[3, 3, 0, 0]}>
                    {revenueByType.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-8 text-center text-sm text-gray-400">No payments recorded yet.</p>
            )}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white">
            <div className="flex items-center justify-between border-b border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900">Revenue Ledger</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Tenant', 'Property', 'Amount', 'Type', 'Date'].map((col) => (
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
                  {allPayments
                    .sort(
                      (a, b) =>
                        new Date(b.payment.paidAt).getTime() - new Date(a.payment.paidAt).getTime(),
                    )
                    .map(({ invoice, payment }) => (
                      <tr key={payment.id} className="transition-colors hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-800">
                          {invoice.lease?.tenant.name ?? 'Unknown'}
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {invoice.lease?.unit.property.name ?? '—'}
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-900">
                          {fmt(payment.amount)}
                        </td>
                        <td className="px-4 py-3 text-gray-700">{invoice.type}</td>
                        <td className="px-4 py-3 text-gray-700">
                          {new Date(payment.paidAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  {allPayments.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                        No payments recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* USERS */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard
              label="Property Managers"
              value={loading ? '—' : String(users.filter((u) => u.role === 'MANAGER').length)}
              icon={Users}
              iconBg="bg-blue-50"
              iconColor="text-blue-600"
            />
            <KpiCard
              label="Landlords"
              value={loading ? '—' : String(users.filter((u) => u.role === 'LANDLORD').length)}
              icon={Users}
              iconBg="bg-purple-50"
              iconColor="text-purple-600"
            />
            <KpiCard
              label="Tenants"
              value={loading ? '—' : String(users.filter((u) => u.role === 'TENANT').length)}
              icon={Users}
              iconBg="bg-green-50"
              iconColor="text-green-600"
            />
            <KpiCard
              label="Service Providers"
              value={loading ? '—' : String(users.filter((u) => u.role === 'VENDOR').length)}
              icon={Users}
              iconBg="bg-orange-50"
              iconColor="text-orange-600"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h3 className="mb-1 font-semibold text-gray-900">New Users by Role</h3>
              <p className="mb-4 text-xs text-gray-500">{period}</p>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={newUsersByMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={30} allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="manager"
                    stroke={ROLE_COLORS.MANAGER}
                    strokeWidth={2}
                    dot={false}
                    name="Managers"
                  />
                  <Line
                    type="monotone"
                    dataKey="landlord"
                    stroke={ROLE_COLORS.LANDLORD}
                    strokeWidth={2}
                    dot={false}
                    name="Landlords"
                  />
                  <Line
                    type="monotone"
                    dataKey="vendor"
                    stroke={ROLE_COLORS.VENDOR}
                    strokeWidth={2}
                    dot={false}
                    name="Vendors"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h3 className="mb-1 font-semibold text-gray-900">Distribution by Role</h3>
              <p className="mb-4 text-xs text-gray-500">Current registered users</p>
              <ResponsiveContainer width="100%" height={240}>
                <RechartsPie>
                  <Pie
                    data={usersByRole}
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    dataKey="value"
                    label={({ name, value }) => (value > 0 ? `${name} (${value})` : '')}
                    labelLine={false}
                  >
                    {usersByRole.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                </RechartsPie>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white">
            <div className="border-b border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900">Users by Role & Status</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Role', 'Active', 'Pending Verification', 'Other'].map((col) => (
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
                  {statusByRole.map((row) => (
                    <tr key={row.role} className="transition-colors hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{row.role}</td>
                      <td className="px-4 py-3 font-medium text-green-700">{row.active}</td>
                      <td className="px-4 py-3 text-yellow-600">{row.pending}</td>
                      <td className="px-4 py-3 text-gray-600">{row.other}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* PROPERTIES */}
      {activeTab === 'properties' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard
              label="Total Listed"
              value={loading ? '—' : String(properties.length)}
              icon={Building2}
              iconBg="bg-purple-50"
              iconColor="text-purple-600"
            />
            <KpiCard
              label="Approved"
              value={
                loading
                  ? '—'
                  : String(properties.filter((p) => p.moderationStatus === 'APPROVED').length)
              }
              icon={Building2}
              iconBg="bg-green-50"
              iconColor="text-green-600"
            />
            <KpiCard
              label="Avg. Occupancy Rate"
              value={loading ? '—' : `${avgOccupancy.toFixed(1)}%`}
              icon={BarChart3}
              iconBg="bg-blue-50"
              iconColor="text-blue-600"
            />
            <KpiCard
              label="Avg. Unit Rent"
              value={loading ? '—' : fmt(avgRent)}
              icon={DollarSign}
              iconBg="bg-orange-50"
              iconColor="text-orange-600"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h3 className="mb-1 font-semibold text-gray-900">Properties by State</h3>
              <p className="mb-4 text-xs text-gray-500">Distribution of all listings</p>
              {propertiesByState.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <RechartsPie>
                    <Pie
                      data={propertiesByState}
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      dataKey="value"
                      label={({ name, value }) => `${name} (${value})`}
                      labelLine={false}
                    >
                      {propertiesByState.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </RechartsPie>
                </ResponsiveContainer>
              ) : (
                <p className="py-8 text-center text-sm text-gray-400">No properties yet.</p>
              )}
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h3 className="mb-1 font-semibold text-gray-900">Properties by Type</h3>
              <p className="mb-4 text-xs text-gray-500">Current listings</p>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart
                  data={['RESIDENTIAL', 'COMMERCIAL', 'INDUSTRIAL', 'MIXED_USE'].map((type) => ({
                    type,
                    count: properties.filter((p) => p.type === type).length,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="type" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} width={30} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[3, 3, 0, 0]} name="Properties" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white">
            <div className="border-b border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900">Properties by State — Detail</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {[
                      'State',
                      'Total Listings',
                      'Approved',
                      'Pending',
                      'Avg. Rent',
                      'Avg. Occupancy',
                    ].map((col) => (
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
                  {stateDetail.map((row) => (
                    <tr key={row.state} className="transition-colors hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{row.state}</td>
                      <td className="px-4 py-3 text-gray-700">{row.total}</td>
                      <td className="px-4 py-3 font-medium text-green-700">{row.approved}</td>
                      <td className="px-4 py-3 text-yellow-600">{row.pending}</td>
                      <td className="px-4 py-3 text-gray-700">{fmt(row.avgRent)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-gray-200">
                            <div
                              className="h-full rounded-full bg-blue-500"
                              style={{ width: `${row.occupancy}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-700">{row.occupancy.toFixed(0)}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {stateDetail.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                        No properties yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MAINTENANCE */}
      {activeTab === 'maintenance' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard
              label="Total Requests (All-Time)"
              value={loading ? '—' : String(maintenanceRequests.length)}
              icon={Wrench}
              iconBg="bg-orange-50"
              iconColor="text-orange-600"
            />
            <KpiCard
              label="Resolved This Month"
              value={
                loading
                  ? '—'
                  : String(maintenanceByMonth[maintenanceByMonth.length - 1]?.resolved ?? 0)
              }
              icon={Wrench}
              iconBg="bg-green-50"
              iconColor="text-green-600"
            />
            <KpiCard
              label="Avg. Resolution Time"
              value={
                loading
                  ? '—'
                  : resolutionDays.length > 0
                    ? `${avgResolutionDays.toFixed(1)} days`
                    : 'N/A'
              }
              icon={TrendingDown}
              iconBg="bg-blue-50"
              iconColor="text-blue-600"
            />
            <KpiCard
              label="High Priority Open"
              value={loading ? '—' : String(highPriorityOpen)}
              icon={Wrench}
              iconBg="bg-red-50"
              iconColor="text-red-500"
            />
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="mb-1 font-semibold text-gray-900">
              Maintenance Requests — Created vs. Resolved
            </h3>
            <p className="mb-4 text-xs text-gray-500">{period}</p>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={maintenanceByMonth} barCategoryGap="35%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} width={30} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="created" fill="#f97316" name="Created" radius={[3, 3, 0, 0]} />
                <Bar dataKey="resolved" fill="#10b981" name="Resolved" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white">
            <div className="border-b border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900">Monthly Maintenance Summary</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Month', 'Created', 'Resolved', 'Resolution Rate'].map((col) => (
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
                  {maintenanceByMonth.map((row, i) => {
                    const rate = row.created > 0 ? (row.resolved / row.created) * 100 : 0;
                    return (
                      <tr key={i} className="transition-colors hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-800">{row.month}</td>
                        <td className="px-4 py-3 font-medium text-orange-600">{row.created}</td>
                        <td className="px-4 py-3 font-medium text-green-600">{row.resolved}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-200">
                              <div
                                className="h-full rounded-full bg-green-500"
                                style={{ width: `${rate}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-700">{rate.toFixed(0)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
