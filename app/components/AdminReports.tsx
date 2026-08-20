import { useState } from 'react';
import {
  FileText,
  Download,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Building2,
  Wrench,
  Calendar,
  ChevronDown,
  BarChart3,
  PieChart,
  ArrowUpRight,
  Filter,
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
import {
  mockMonthlyRevenueAdmin as monthlyRevenue,
  mockUserGrowthAdmin as userGrowth,
  mockPropertyByStateAdmin as propertyByState,
  mockMaintenanceStatsAdmin as maintenanceStats,
} from '../store/mockData';

type ReportTab = 'overview' | 'financial' | 'users' | 'properties' | 'maintenance';

const TABS: { id: ReportTab; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'financial', label: 'Financial', icon: DollarSign },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'properties', label: 'Properties', icon: Building2 },
  { id: 'maintenance', label: 'Maintenance', icon: Wrench },
];

function fmt(n: number) {
  if (n >= 1_000_000_000) return `₦${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(0)}M`;
  return `₦${n.toLocaleString()}`;
}

function KpiCard({
  label,
  value,
  sub,
  up,
  icon: Icon,
  iconBg,
  iconColor,
}: {
  label: string;
  value: string;
  sub: string;
  up: boolean;
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
        <span
          className={`flex items-center gap-1 text-xs font-medium ${up ? 'text-green-600' : 'text-red-500'}`}
        >
          {up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
          {sub}
        </span>
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

  const periods = ['Last 30 Days', 'Last 3 Months', 'Last 6 Months', 'This Year', 'Last Year'];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Reports & Analytics</h1>
          <p className="mt-0.5 text-sm text-gray-500">Platform-wide performance data and trends</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Period selector */}
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
          <button className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700">
            <Download className="h-4 w-4" />
            Export Report
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex w-fit gap-1 rounded-xl bg-gray-100 p-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── OVERVIEW ── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard
              label="Total Revenue (YTD)"
              value="₦1.32B"
              sub="+24% vs last year"
              up
              icon={DollarSign}
              iconBg="bg-green-50"
              iconColor="text-green-600"
            />
            <KpiCard
              label="Active Users"
              value="12,847"
              sub="+18% this month"
              up
              icon={Users}
              iconBg="bg-blue-50"
              iconColor="text-blue-600"
            />
            <KpiCard
              label="Properties Listed"
              value="5,421"
              sub="+12% this month"
              up
              icon={Building2}
              iconBg="bg-purple-50"
              iconColor="text-purple-600"
            />
            <KpiCard
              label="Maintenance Resolved"
              value="754"
              sub="-8% avg resolution days"
              up
              icon={Wrench}
              iconBg="bg-orange-50"
              iconColor="text-orange-600"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Revenue chart */}
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">Revenue Trend</h3>
                  <p className="mt-0.5 text-xs text-gray-500">Rent + subscriptions · {period}</p>
                </div>
                <span className="flex items-center gap-1 text-xs font-medium text-green-600">
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  +24% YoY
                </span>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={monthlyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis
                    tickFormatter={(v) => `₦${v / 1_000_000}M`}
                    tick={{ fontSize: 11 }}
                    width={52}
                  />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#3b82f6"
                    strokeWidth={2.5}
                    dot={false}
                    name="Rent Revenue"
                  />
                  <Line
                    type="monotone"
                    dataKey="subscriptions"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={false}
                    strokeDasharray="4 3"
                    name="Subscriptions"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* User growth */}
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">User Growth</h3>
                  <p className="mt-0.5 text-xs text-gray-500">By role · {period}</p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={userGrowth} barSize={10}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={42} />
                  <Tooltip />
                  <Bar dataKey="tenants" fill="#10b981" name="Tenants" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="managers" fill="#3b82f6" name="Managers" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="landlords" fill="#8b5cf6" name="Landlords" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="vendors" fill="#f59e0b" name="Vendors" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Summary table */}
          <div className="rounded-xl border border-gray-200 bg-white">
            <div className="border-b border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900">Monthly Summary</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {[
                      'Month',
                      'Revenue',
                      'Subscriptions',
                      'New Users',
                      'New Properties',
                      'Maintenance Resolved',
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
                  {monthlyRevenue.map((row, i) => (
                    <tr key={i} className="transition-colors hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{row.month} 2026</td>
                      <td className="px-4 py-3 text-gray-700">{fmt(row.revenue)}</td>
                      <td className="px-4 py-3 text-gray-700">{fmt(row.subscriptions)}</td>
                      <td className="px-4 py-3 text-gray-700">
                        {[1284, 1102, 987, 1241, 1388, 1521][i].toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {[621, 548, 712, 803, 891, 847][i]}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{maintenanceStats[i].resolved}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── FINANCIAL ── */}
      {activeTab === 'financial' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard
              label="Total Revenue (YTD)"
              value="₦1.32B"
              sub="+24% vs last year"
              up
              icon={DollarSign}
              iconBg="bg-green-50"
              iconColor="text-green-600"
            />
            <KpiCard
              label="Subscription Revenue"
              value="₦91.1M"
              sub="+31% vs last year"
              up
              icon={TrendingUp}
              iconBg="bg-blue-50"
              iconColor="text-blue-600"
            />
            <KpiCard
              label="Avg. Transaction Value"
              value="₦924K"
              sub="+6% vs last month"
              up
              icon={BarChart3}
              iconBg="bg-purple-50"
              iconColor="text-purple-600"
            />
            <KpiCard
              label="Failed Transactions"
              value="1.2%"
              sub="-0.3% vs last month"
              up
              icon={TrendingDown}
              iconBg="bg-red-50"
              iconColor="text-red-500"
            />
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="mb-1 font-semibold text-gray-900">Monthly Revenue Breakdown</h3>
            <p className="mb-4 text-xs text-gray-500">
              Rent facilitated vs. platform subscription fees · {period}
            </p>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthlyRevenue} barCategoryGap="35%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis
                  tickFormatter={(v) => `₦${v / 1_000_000}M`}
                  tick={{ fontSize: 12 }}
                  width={58}
                />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Legend />
                <Bar dataKey="revenue" fill="#3b82f6" name="Rent Revenue" radius={[3, 3, 0, 0]} />
                <Bar
                  dataKey="subscriptions"
                  fill="#10b981"
                  name="Subscriptions"
                  radius={[3, 3, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white">
            <div className="flex items-center justify-between border-b border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900">Revenue Ledger</h3>
              <button className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700">
                <Download className="h-4 w-4" /> Download CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {[
                      'Month',
                      'Rent Revenue',
                      'Subscription Revenue',
                      'Total',
                      'MoM Growth',
                      'Transactions',
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
                  {monthlyRevenue.map((row, i) => {
                    const total = row.revenue + row.subscriptions;
                    const prev =
                      i === 0
                        ? null
                        : monthlyRevenue[i - 1].revenue + monthlyRevenue[i - 1].subscriptions;
                    const growth = prev ? (((total - prev) / prev) * 100).toFixed(1) : null;
                    return (
                      <tr key={i} className="transition-colors hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-800">{row.month} 2026</td>
                        <td className="px-4 py-3 text-gray-700">{fmt(row.revenue)}</td>
                        <td className="px-4 py-3 text-gray-700">{fmt(row.subscriptions)}</td>
                        <td className="px-4 py-3 font-semibold text-gray-900">{fmt(total)}</td>
                        <td className="px-4 py-3">
                          {growth ? (
                            <span
                              className={`flex items-center gap-1 text-xs font-medium ${parseFloat(growth) >= 0 ? 'text-green-600' : 'text-red-500'}`}
                            >
                              {parseFloat(growth) >= 0 ? (
                                <TrendingUp className="h-3 w-3" />
                              ) : (
                                <TrendingDown className="h-3 w-3" />
                              )}
                              {growth}%
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {[2341, 2518, 2401, 2789, 2934, 3102][i].toLocaleString()}
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

      {/* ── USERS ── */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard
              label="Property Managers"
              value="1,247"
              sub="+9% this month"
              up
              icon={Users}
              iconBg="bg-blue-50"
              iconColor="text-blue-600"
            />
            <KpiCard
              label="Landlords"
              value="892"
              sub="+7% this month"
              up
              icon={Users}
              iconBg="bg-purple-50"
              iconColor="text-purple-600"
            />
            <KpiCard
              label="Tenants"
              value="8,421"
              sub="+21% this month"
              up
              icon={Users}
              iconBg="bg-green-50"
              iconColor="text-green-600"
            />
            <KpiCard
              label="Service Providers"
              value="2,287"
              sub="+14% this month"
              up
              icon={Users}
              iconBg="bg-orange-50"
              iconColor="text-orange-600"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h3 className="mb-1 font-semibold text-gray-900">User Growth by Role</h3>
              <p className="mb-4 text-xs text-gray-500">{period}</p>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={userGrowth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={42} />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="managers"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                    name="Managers"
                  />
                  <Line
                    type="monotone"
                    dataKey="landlords"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    dot={false}
                    name="Landlords"
                  />
                  <Line
                    type="monotone"
                    dataKey="vendors"
                    stroke="#f59e0b"
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
                    data={[
                      { name: 'Tenants', value: 8421 },
                      { name: 'Managers', value: 1247 },
                      { name: 'Landlords', value: 892 },
                      { name: 'Vendors', value: 2287 },
                    ]}
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b'].map((color, i) => (
                      <Cell key={i} fill={color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </RechartsPie>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white">
            <div className="border-b border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900">Monthly User Registration</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {[
                      'Month',
                      'Managers',
                      'Landlords',
                      'Tenants',
                      'Vendors',
                      'Total New',
                      'Churn',
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
                  {userGrowth.map((row, i) => {
                    const prev =
                      i === 0
                        ? {
                            managers: 920,
                            landlords: 680,
                            tenants: 6400,
                            vendors: 195,
                          }
                        : userGrowth[i - 1];
                    const newM = row.managers - prev.managers;
                    const newL = row.landlords - prev.landlords;
                    const newT = row.tenants - prev.tenants;
                    const newV = row.vendors - prev.vendors;
                    return (
                      <tr key={i} className="transition-colors hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-800">{row.month} 2026</td>
                        <td className="px-4 py-3 text-gray-700">+{newM}</td>
                        <td className="px-4 py-3 text-gray-700">+{newL}</td>
                        <td className="px-4 py-3 text-gray-700">+{newT}</td>
                        <td className="px-4 py-3 text-gray-700">+{newV}</td>
                        <td className="px-4 py-3 font-semibold text-gray-900">
                          +{newM + newL + newT + newV}
                        </td>
                        <td className="px-4 py-3 text-red-500">{[24, 18, 31, 22, 19, 27][i]}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── PROPERTIES ── */}
      {activeTab === 'properties' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard
              label="Total Listed"
              value="5,421"
              sub="+12% this month"
              up
              icon={Building2}
              iconBg="bg-purple-50"
              iconColor="text-purple-600"
            />
            <KpiCard
              label="Verified"
              value="4,891"
              sub="90.2% of listings"
              up
              icon={Building2}
              iconBg="bg-green-50"
              iconColor="text-green-600"
            />
            <KpiCard
              label="Avg. Occupancy Rate"
              value="88.4%"
              sub="+2.1% vs last month"
              up
              icon={BarChart3}
              iconBg="bg-blue-50"
              iconColor="text-blue-600"
            />
            <KpiCard
              label="Avg. List Price"
              value="₦1.14M/yr"
              sub="+4.8% vs last year"
              up
              icon={DollarSign}
              iconBg="bg-orange-50"
              iconColor="text-orange-600"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h3 className="mb-1 font-semibold text-gray-900">Properties by State</h3>
              <p className="mb-4 text-xs text-gray-500">Distribution of all listings</p>
              <ResponsiveContainer width="100%" height={240}>
                <RechartsPie>
                  <Pie
                    data={propertyByState}
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {propertyByState.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </RechartsPie>
              </ResponsiveContainer>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h3 className="mb-1 font-semibold text-gray-900">New Listings per Month</h3>
              <p className="mb-4 text-xs text-gray-500">{period}</p>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart
                  data={[
                    { month: 'Jan', listings: 621 },
                    { month: 'Feb', listings: 548 },
                    { month: 'Mar', listings: 712 },
                    { month: 'Apr', listings: 803 },
                    { month: 'May', listings: 891 },
                    { month: 'Jun', listings: 847 },
                  ]}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={42} />
                  <Tooltip />
                  <Bar
                    dataKey="listings"
                    fill="#8b5cf6"
                    radius={[3, 3, 0, 0]}
                    name="New Listings"
                  />
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
                      'Verified',
                      'Pending',
                      'Avg. Rent/yr',
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
                  {[
                    {
                      state: 'Lagos',
                      total: 3241,
                      verified: 2980,
                      pending: 201,
                      avgRent: '₦1,420,000',
                      occupancy: '91%',
                    },
                    {
                      state: 'Abuja (FCT)',
                      total: 1182,
                      verified: 1091,
                      pending: 74,
                      avgRent: '₦1,100,000',
                      occupancy: '88%',
                    },
                    {
                      state: 'Rivers',
                      total: 421,
                      verified: 380,
                      pending: 32,
                      avgRent: '₦850,000',
                      occupancy: '84%',
                    },
                    {
                      state: 'Oyo',
                      total: 312,
                      verified: 278,
                      pending: 28,
                      avgRent: '₦620,000',
                      occupancy: '80%',
                    },
                    {
                      state: 'Kano',
                      total: 142,
                      verified: 120,
                      pending: 18,
                      avgRent: '₦480,000',
                      occupancy: '76%',
                    },
                    {
                      state: 'Others',
                      total: 123,
                      verified: 42,
                      pending: 59,
                      avgRent: '₦540,000',
                      occupancy: '72%',
                    },
                  ].map((row, i) => (
                    <tr key={i} className="transition-colors hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{row.state}</td>
                      <td className="px-4 py-3 text-gray-700">{row.total.toLocaleString()}</td>
                      <td className="px-4 py-3 font-medium text-green-700">
                        {row.verified.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-yellow-600">{row.pending}</td>
                      <td className="px-4 py-3 text-gray-700">{row.avgRent}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-gray-200">
                            <div
                              className="h-full rounded-full bg-blue-500"
                              style={{ width: row.occupancy }}
                            />
                          </div>
                          <span className="text-xs text-gray-700">{row.occupancy}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── MAINTENANCE ── */}
      {activeTab === 'maintenance' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard
              label="Total Requests (YTD)"
              value="4,284"
              sub="-11% vs last year"
              up={false}
              icon={Wrench}
              iconBg="bg-orange-50"
              iconColor="text-orange-600"
            />
            <KpiCard
              label="Resolved This Month"
              value="119"
              sub="82% resolution rate"
              up
              icon={Wrench}
              iconBg="bg-green-50"
              iconColor="text-green-600"
            />
            <KpiCard
              label="Avg. Resolution Time"
              value="3.1 days"
              sub="-26% vs 6 months ago"
              up
              icon={TrendingDown}
              iconBg="bg-blue-50"
              iconColor="text-blue-600"
            />
            <KpiCard
              label="High Priority Open"
              value="18"
              sub="-3 since last week"
              up
              icon={Wrench}
              iconBg="bg-red-50"
              iconColor="text-red-500"
            />
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="mb-1 font-semibold text-gray-900">
              Maintenance Requests — Open vs. Resolved
            </h3>
            <p className="mb-4 text-xs text-gray-500">{period}</p>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={maintenanceStats} barCategoryGap="35%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} width={42} />
                <Tooltip />
                <Legend />
                <Bar dataKey="open" fill="#f97316" name="Open" radius={[3, 3, 0, 0]} />
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
                    {[
                      'Month',
                      'Open Requests',
                      'Resolved',
                      'Resolution Rate',
                      'Avg. Days to Close',
                      'High Priority',
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
                  {maintenanceStats.map((row, i) => {
                    const rate = ((row.resolved / (row.open + row.resolved)) * 100).toFixed(0);
                    return (
                      <tr key={i} className="transition-colors hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-800">{row.month} 2026</td>
                        <td className="px-4 py-3 font-medium text-orange-600">{row.open}</td>
                        <td className="px-4 py-3 font-medium text-green-600">{row.resolved}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-200">
                              <div
                                className="h-full rounded-full bg-green-500"
                                style={{ width: `${rate}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-700">{rate}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-700">{row.avgDays}d</td>
                        <td className="px-4 py-3 font-medium text-red-600">
                          {[28, 24, 32, 21, 19, 18][i]}
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
