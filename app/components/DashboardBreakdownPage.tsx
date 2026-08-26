import { useState } from 'react';
import { ArrowLeft, Home, Users, DollarSign, AlertCircle, UserX, Search } from 'lucide-react';
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
import { useMyProperties } from '@/hooks/useProperties';
import { useLeases } from '@/hooks/useLeases';
import { useInvoices } from '@/hooks/useInvoices';
import { useMaintenanceRequests } from '@/hooks/useMaintenanceRequests';
import { fmtNaira } from '../../lib/utils';

export type BreakdownType = 'properties' | 'tenants' | 'rent' | 'maintenance' | 'renewals';

interface DashboardBreakdownPageProps {
  breakdownType: BreakdownType;
  onBack: () => void;
  onNavigate?: (page: any) => void;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const ICONS: Record<BreakdownType, any> = {
  properties: Home,
  tenants: Users,
  rent: DollarSign,
  maintenance: AlertCircle,
  renewals: Home,
};
const ICON_STYLES: Record<BreakdownType, { bg: string; color: string }> = {
  properties: { bg: 'bg-blue-50', color: 'text-blue-600' },
  tenants: { bg: 'bg-green-50', color: 'text-green-600' },
  rent: { bg: 'bg-emerald-50', color: 'text-emerald-600' },
  maintenance: { bg: 'bg-orange-50', color: 'text-orange-600' },
  renewals: { bg: 'bg-purple-50', color: 'text-purple-600' },
};

// Same derivation as TenantManagement (Phase 9.3a): no stored rent-status
// field, computed from the lease's RENT invoices.
function rentInfo(leaseId: string, invoices: ReturnType<typeof useInvoices>['data']) {
  const unpaid = invoices
    .filter((i) => i.leaseId === leaseId && i.status !== 'PAID' && i.status !== 'CANCELLED')
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  if (unpaid.length === 0) return 'paid' as const;
  return (new Date(unpaid[0].dueDate) < new Date() ? 'overdue' : 'due') as 'overdue' | 'due';
}

function monthKey(date: string) {
  const d = new Date(date);
  return `${d.getFullYear()}-${d.getMonth()}`;
}
function monthLabel(date: string) {
  return new Date(date).toLocaleDateString('en-US', { month: 'short' });
}

export function DashboardBreakdownPage({ breakdownType, onBack, onNavigate }: DashboardBreakdownPageProps) {
  const [tenantTab, setTenantTab] = useState<'active' | 'terminated'>('active');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: properties, loading: propertiesLoading } = useMyProperties();
  const { data: allLeases, loading: leasesLoading } = useLeases();
  const { data: invoices, loading: invoicesLoading } = useInvoices();
  const { data: maintenanceRequests, loading: maintenanceLoading } = useMaintenanceRequests();

  const loading = propertiesLoading || leasesLoading || invoicesLoading || maintenanceLoading;

  const Icon = ICONS[breakdownType];
  const iconStyle = ICON_STYLES[breakdownType];

  const activeLeases = allLeases.filter((l) => l.status === 'ACTIVE');
  const terminatedLeases = allLeases.filter((l) => l.status === 'TERMINATED' || l.status === 'EXPIRED');
  const openMaintenance = maintenanceRequests.filter((r) => r.status !== 'COMPLETED' && r.status !== 'CANCELLED');
  const allPayments = invoices.flatMap((invoice) => invoice.payments.map((payment) => ({ invoice, payment })));

  const now = new Date();
  const thisMonthPayments = allPayments.filter((p) => monthKey(p.payment.paidAt) === monthKey(now.toISOString()));
  const thisMonthCollected = thisMonthPayments.reduce((sum, p) => sum + p.payment.amount, 0);

  const collectedTotal = allPayments.reduce((sum, p) => sum + p.payment.amount, 0);
  const pendingTotal = invoices
    .filter((i) => i.status !== 'PAID' && i.status !== 'CANCELLED')
    .reduce((sum, i) => sum + Math.max(0, i.amount - i.payments.reduce((s, p) => s + p.amount, 0)), 0);
  const collectionRate = collectedTotal + pendingTotal > 0 ? Math.round((collectedTotal / (collectedTotal + pendingTotal)) * 100) : 0;

  const renewalsUpcoming = activeLeases
    .map((l) => ({ lease: l, daysLeft: Math.ceil((new Date(l.endDate).getTime() - now.getTime()) / MS_PER_DAY) }))
    .filter((r) => r.daysLeft >= 0 && r.daysLeft <= 180)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  const heroStat: Record<BreakdownType, { title: string; subtitle: string; stat: string; statLabel: string }> = {
    properties: {
      title: 'Total Properties',
      subtitle: 'All properties under your management portfolio',
      stat: String(properties.length),
      statLabel: 'Properties',
    },
    tenants: {
      title: 'Active Leases',
      subtitle: 'All current and past tenants across your portfolio',
      stat: String(activeLeases.length),
      statLabel: 'Active Leases',
    },
    rent: {
      title: 'Rent Collected — This Month',
      subtitle: 'All rent payments received this month, and what remains outstanding',
      stat: `₦${thisMonthCollected.toLocaleString()}`,
      statLabel: 'Collected',
    },
    maintenance: {
      title: 'Open Maintenance Requests',
      subtitle: 'Maintenance tickets not yet completed or cancelled',
      stat: String(openMaintenance.length),
      statLabel: 'Open Requests',
    },
    renewals: {
      title: 'Upcoming Lease Renewals',
      subtitle: 'Leases expiring in the next 6 months',
      stat: String(renewalsUpcoming.length),
      statLabel: 'Renewals Due',
    },
  };
  const hero = heroStat[breakdownType];

  const renderSummaryCards = () => {
    if (breakdownType === 'properties') {
      const fullyOccupied = properties.filter((p) => p.units.length > 0 && p.units.every((u) => u.status === 'OCCUPIED')).length;
      const partial = properties.filter((p) => p.units.some((u) => u.status === 'OCCUPIED') && p.units.some((u) => u.status !== 'OCCUPIED')).length;
      const vacant = properties.length - fullyOccupied - partial;
      return (
        <div className="mb-6 grid grid-cols-3 gap-4">
          {[
            { label: 'Fully Occupied', value: fullyOccupied, color: 'bg-green-50 border-green-200 text-green-700' },
            { label: 'Partially Occupied', value: partial, color: 'bg-yellow-50 border-yellow-200 text-yellow-700' },
            { label: 'Vacant / Unpublished', value: vacant, color: 'bg-gray-50 border-gray-200 text-gray-600' },
          ].map((card) => (
            <div key={card.label} className={`rounded-lg border p-4 ${card.color}`}>
              <p className="text-2xl font-bold">{loading ? '—' : card.value}</p>
              <p className="mt-0.5 text-sm">{card.label}</p>
            </div>
          ))}
        </div>
      );
    }
    if (breakdownType === 'tenants') {
      const paid = activeLeases.filter((l) => rentInfo(l.id, invoices) === 'paid').length;
      const due = activeLeases.filter((l) => rentInfo(l.id, invoices) === 'due').length;
      const overdue = activeLeases.filter((l) => rentInfo(l.id, invoices) === 'overdue').length;
      return (
        <div className="mb-6 grid grid-cols-3 gap-4">
          {[
            { label: 'Paid', value: paid, color: 'bg-green-50 border-green-200 text-green-700' },
            { label: 'Due Soon', value: due, color: 'bg-yellow-50 border-yellow-200 text-yellow-700' },
            { label: 'Overdue', value: overdue, color: 'bg-red-50 border-red-200 text-red-700' },
          ].map((card) => (
            <div key={card.label} className={`rounded-lg border p-4 ${card.color}`}>
              <p className="text-2xl font-bold">{loading ? '—' : card.value}</p>
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
            { label: 'Total Collected', value: `₦${collectedTotal.toLocaleString()}`, color: 'bg-green-50 border-green-200 text-green-700' },
            { label: 'Pending', value: `₦${pendingTotal.toLocaleString()}`, color: 'bg-yellow-50 border-yellow-200 text-yellow-700' },
            { label: 'Collection Rate', value: `${collectionRate}%`, color: 'bg-blue-50 border-blue-200 text-blue-700' },
          ].map((card) => (
            <div key={card.label} className={`rounded-lg border p-4 ${card.color}`}>
              <p className="text-2xl font-bold">{loading ? '—' : card.value}</p>
              <p className="mt-0.5 text-sm">{card.label}</p>
            </div>
          ))}
        </div>
      );
    }
    if (breakdownType === 'maintenance') {
      const high = openMaintenance.filter((r) => r.priority === 'HIGH' || r.priority === 'EMERGENCY').length;
      const medium = openMaintenance.filter((r) => r.priority === 'MEDIUM').length;
      const low = openMaintenance.filter((r) => r.priority === 'LOW').length;
      return (
        <div className="mb-6 grid grid-cols-3 gap-4">
          {[
            { label: 'High Priority', value: high, color: 'bg-red-50 border-red-200 text-red-700' },
            { label: 'Medium Priority', value: medium, color: 'bg-yellow-50 border-yellow-200 text-yellow-700' },
            { label: 'Low Priority', value: low, color: 'bg-gray-50 border-gray-200 text-gray-600' },
          ].map((card) => (
            <div key={card.label} className={`rounded-lg border p-4 ${card.color}`}>
              <p className="text-2xl font-bold">{loading ? '—' : card.value}</p>
              <p className="mt-0.5 text-sm">{card.label}</p>
            </div>
          ))}
        </div>
      );
    }
    if (breakdownType === 'renewals') {
      const urgent = renewalsUpcoming.filter((r) => r.daysLeft < 30).length;
      const soon = renewalsUpcoming.filter((r) => r.daysLeft >= 30 && r.daysLeft < 90).length;
      const later = renewalsUpcoming.filter((r) => r.daysLeft >= 90).length;
      return (
        <div className="mb-6 grid grid-cols-3 gap-4">
          {[
            { label: 'Urgent (< 30 days)', value: urgent, color: 'bg-red-50 border-red-200 text-red-700' },
            { label: '30–90 Days', value: soon, color: 'bg-yellow-50 border-yellow-200 text-yellow-700' },
            { label: '90–180 Days', value: later, color: 'bg-green-50 border-green-200 text-green-700' },
          ].map((card) => (
            <div key={card.label} className={`rounded-lg border p-4 ${card.color}`}>
              <p className="text-2xl font-bold">{loading ? '—' : card.value}</p>
              <p className="mt-0.5 text-sm">{card.label}</p>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const renderTable = () => {
    const th = (cols: string[]) => (
      <thead className="sticky top-0 z-10 bg-gray-50">
        <tr>
          {cols.map((col) => (
            <th key={col} className="border-b border-gray-200 px-4 py-3 text-left text-xs font-semibold tracking-wide whitespace-nowrap text-gray-500 uppercase">
              {col}
            </th>
          ))}
        </tr>
      </thead>
    );

    if (breakdownType === 'properties') {
      const rows = properties.filter(
        (p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.city.toLowerCase().includes(searchQuery.toLowerCase()),
      );
      return (
        <table className="w-full text-sm">
          {th(['Property', 'Location', 'Units', 'Occupancy', 'Status', 'Actions'])}
          <tbody className="divide-y divide-gray-100">
            {rows.map((property) => {
              const occupied = property.units.filter((u) => u.status === 'OCCUPIED').length;
              const status = !property.isPublished
                ? 'Pending Review'
                : occupied === property.units.length && property.units.length > 0
                  ? 'Fully Occupied'
                  : occupied > 0
                    ? 'Partially Occupied'
                    : 'Vacant';
              return (
                <tr key={property.id} className="transition-colors hover:bg-gray-50">
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50">
                        <Home className="h-4 w-4 text-blue-500" />
                      </div>
                      <p className="font-medium text-gray-800">{property.name}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap text-gray-600">{property.city}</td>
                  <td className="px-4 py-3.5 whitespace-nowrap text-gray-600">{property.units.length}</td>
                  <td className="px-4 py-3.5 whitespace-nowrap text-gray-600">
                    {occupied}/{property.units.length}
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        status === 'Fully Occupied'
                          ? 'bg-green-100 text-green-700'
                          : status === 'Partially Occupied'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <button
                      onClick={() => onNavigate?.({ type: 'property-detail', propertyId: property.id })}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium hover:bg-gray-50"
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      );
    }

    if (breakdownType === 'tenants') {
      if (tenantTab === 'active') {
        const rows = activeLeases.filter((l) => (l.tenant?.name ?? '').toLowerCase().includes(searchQuery.toLowerCase()));
        return (
          <table className="w-full text-sm">
            {th(['Tenant', 'Property', 'Unit', 'Lease Start', 'Lease End', 'Rent Status', 'Actions'])}
            <tbody className="divide-y divide-gray-100">
              {rows.map((lease) => {
                const status = rentInfo(lease.id, invoices);
                return (
                  <tr key={lease.id} className="transition-colors hover:bg-gray-50">
                    <td className="px-4 py-3.5 whitespace-nowrap text-gray-700">{lease.tenant?.name ?? 'Unknown'}</td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-gray-700">{lease.unit?.property?.name ?? '—'}</td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-gray-700">{lease.unit?.unitNumber}</td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-gray-700">{new Date(lease.startDate).toLocaleDateString()}</td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-gray-700">{new Date(lease.endDate).toLocaleDateString()}</td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${
                          status === 'paid' ? 'bg-green-100 text-green-700' : status === 'due' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <button
                        onClick={() => onNavigate?.({ type: 'tenant-detail', leaseId: lease.id })}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium hover:bg-gray-50"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        );
      }
      const rows = terminatedLeases.filter((l) => (l.tenant?.name ?? '').toLowerCase().includes(searchQuery.toLowerCase()));
      return (
        <table className="w-full text-sm">
          {th(['Tenant', 'Property', 'Unit', 'Lease End', 'Status'])}
          <tbody className="divide-y divide-gray-100">
            {rows.map((lease) => (
              <tr key={lease.id} className="transition-colors hover:bg-red-50/40">
                <td className="px-4 py-3.5 whitespace-nowrap text-gray-700">{lease.tenant?.name ?? 'Unknown'}</td>
                <td className="px-4 py-3.5 whitespace-nowrap text-gray-700">{lease.unit?.property?.name ?? '—'}</td>
                <td className="px-4 py-3.5 whitespace-nowrap text-gray-700">{lease.unit?.unitNumber}</td>
                <td className="px-4 py-3.5 whitespace-nowrap text-gray-700">{new Date(lease.endDate).toLocaleDateString()}</td>
                <td className="px-4 py-3.5 whitespace-nowrap text-gray-700">{lease.status}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  No terminated or expired leases.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      );
    }

    if (breakdownType === 'rent') {
      const rows = allPayments
        .filter((p) => (p.invoice.lease?.tenant.name ?? '').toLowerCase().includes(searchQuery.toLowerCase()))
        .sort((a, b) => new Date(b.payment.paidAt).getTime() - new Date(a.payment.paidAt).getTime());
      return (
        <table className="w-full text-sm">
          {th(['Tenant', 'Property', 'Amount', 'Payment Method', 'Date'])}
          <tbody className="divide-y divide-gray-100">
            {rows.map(({ invoice, payment }) => (
              <tr key={payment.id} className="transition-colors hover:bg-gray-50">
                <td className="px-4 py-3.5 whitespace-nowrap text-gray-700">{invoice.lease?.tenant.name ?? 'Unknown'}</td>
                <td className="px-4 py-3.5 whitespace-nowrap text-gray-700">{invoice.lease?.unit.property.name ?? '—'}</td>
                <td className="px-4 py-3.5 whitespace-nowrap font-semibold text-gray-800">₦{payment.amount.toLocaleString()}</td>
                <td className="px-4 py-3.5 whitespace-nowrap text-gray-700">{payment.paymentMethod.replace('_', ' ')}</td>
                <td className="px-4 py-3.5 whitespace-nowrap text-gray-700">{new Date(payment.paidAt).toLocaleDateString()}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  No payments recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      );
    }

    if (breakdownType === 'maintenance') {
      const rows = openMaintenance.filter(
        (r) => r.title.toLowerCase().includes(searchQuery.toLowerCase()) || (r.unit?.property?.name ?? '').toLowerCase().includes(searchQuery.toLowerCase()),
      );
      return (
        <table className="w-full text-sm">
          {th(['Property', 'Issue', 'Reported By', 'Priority', 'Days Open', 'Actions'])}
          <tbody className="divide-y divide-gray-100">
            {rows.map((r) => (
              <tr key={r.id} className="transition-colors hover:bg-gray-50">
                <td className="px-4 py-3.5 whitespace-nowrap text-gray-700">
                  {r.unit?.property?.name ?? '—'} · {r.unit?.unitNumber}
                </td>
                <td className="px-4 py-3.5 whitespace-nowrap text-gray-700">{r.title}</td>
                <td className="px-4 py-3.5 whitespace-nowrap text-gray-700">{r.tenant?.name ?? 'Unknown'}</td>
                <td className="px-4 py-3.5 whitespace-nowrap text-gray-700">{r.priority}</td>
                <td className="px-4 py-3.5 whitespace-nowrap text-gray-700">
                  {Math.floor((now.getTime() - new Date(r.createdAt).getTime()) / MS_PER_DAY)}d
                </td>
                <td className="px-4 py-3.5 whitespace-nowrap">
                  <button
                    onClick={() => onNavigate?.({ type: 'maintenance-detail', requestId: r.id })}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium hover:bg-gray-50"
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  No open maintenance requests.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      );
    }

    if (breakdownType === 'renewals') {
      const rows = renewalsUpcoming.filter((r) => (r.lease.tenant?.name ?? '').toLowerCase().includes(searchQuery.toLowerCase()));
      return (
        <table className="w-full text-sm">
          {th(['Tenant', 'Property', 'Unit', 'Current Rent', 'Lease End', 'Days Left', 'Actions'])}
          <tbody className="divide-y divide-gray-100">
            {rows.map(({ lease, daysLeft }) => (
              <tr key={lease.id} className="transition-colors hover:bg-gray-50">
                <td className="px-4 py-3.5 whitespace-nowrap text-gray-700">{lease.tenant?.name ?? 'Unknown'}</td>
                <td className="px-4 py-3.5 whitespace-nowrap text-gray-700">{lease.unit?.property?.name ?? '—'}</td>
                <td className="px-4 py-3.5 whitespace-nowrap text-gray-700">{lease.unit?.unitNumber}</td>
                <td className="px-4 py-3.5 whitespace-nowrap text-gray-700">₦{lease.rentAmount.toLocaleString()}</td>
                <td className="px-4 py-3.5 whitespace-nowrap text-gray-700">{new Date(lease.endDate).toLocaleDateString()}</td>
                <td className="px-4 py-3.5 whitespace-nowrap">
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${daysLeft < 30 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                    {daysLeft}d
                  </span>
                </td>
                <td className="px-4 py-3.5 whitespace-nowrap">
                  <button
                    onClick={() => onNavigate?.({ type: 'tenant-detail', leaseId: lease.id })}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium hover:bg-gray-50"
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  No renewals due in the next 6 months.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      );
    }

    return null;
  };

  // Rent charts -- all computed from real payments/invoices, last 6 months.
  const rentTrend = (() => {
    const months: { key: string; label: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString('en-US', { month: 'short' }) });
    }
    return months.map(({ key, label }) => ({
      month: label,
      expected: invoices.filter((i) => monthKey(i.dueDate) === key).reduce((sum, i) => sum + i.amount, 0),
      collected: allPayments.filter((p) => monthKey(p.payment.paidAt) === key).reduce((sum, p) => sum + p.payment.amount, 0),
    }));
  })();

  const rentByProperty = properties
    .map((property, i) => ({
      name: property.name,
      amount: allPayments.filter((p) => p.invoice.lease?.unit.property.id === property.id).reduce((sum, p) => sum + p.payment.amount, 0),
      fill: CHART_COLORS[i % CHART_COLORS.length],
    }))
    .filter((p) => p.amount > 0);

  const paymentMethods = Object.entries(
    allPayments.reduce<Record<string, number>>((acc, p) => {
      const method = p.payment.paymentMethod.replace('_', ' ');
      acc[method] = (acc[method] ?? 0) + 1;
      return acc;
    }, {}),
  ).map(([name, value], i) => ({ name, value, fill: CHART_COLORS[i % CHART_COLORS.length] }));

  const rentStatusChart = [
    { name: 'Collected', value: collectedTotal, fill: '#10b981' },
    { name: 'Pending', value: pendingTotal, fill: '#f59e0b' },
  ];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <button onClick={onBack} className="flex items-center gap-2 text-sm font-medium text-gray-500 transition-colors hover:text-gray-800">
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </button>
        {breakdownType === 'properties' && (
          <div className="flex gap-2">
            <a
              href="/api/v1/properties/export?format=csv"
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Export CSV
            </a>
            <a
              href="/api/v1/properties/export?format=xlsx"
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Export Excel
            </a>
          </div>
        )}
      </div>

      {loading && <p className="text-sm text-gray-500">Loading…</p>}

      {/* Hero Row */}
      <div className="flex items-center gap-6 rounded-xl border border-gray-200 bg-white p-6">
        <div className={`h-14 w-14 rounded-xl ${iconStyle.bg} flex flex-shrink-0 items-center justify-center`}>
          <Icon className={`h-7 w-7 ${iconStyle.color}`} />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-gray-900">{hero.title}</h1>
          <p className="mt-0.5 text-sm text-gray-500">{hero.subtitle}</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-gray-900">{loading ? '—' : hero.stat}</p>
          <p className="text-sm text-gray-500">{hero.statLabel}</p>
        </div>
      </div>

      {/* Summary cards */}
      {renderSummaryCards()}

      {/* Rent charts (only on rent breakdown) */}
      {breakdownType === 'rent' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h3 className="mb-1 font-semibold text-gray-900">Collection Trend</h3>
              <p className="mb-4 text-xs text-gray-500">Collected vs. billed · last 6 months</p>
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
                  <Area type="monotone" dataKey="expected" name="Billed" stroke="#818cf8" strokeWidth={2} strokeDasharray="5 3" fill="url(#gradExpected)" dot={false} />
                  <Area type="monotone" dataKey="collected" name="Collected" stroke="#10b981" strokeWidth={2.5} fill="url(#gradCollected)" dot={{ r: 4, fill: '#10b981' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h3 className="mb-1 font-semibold text-gray-900">Rent by Property</h3>
              <p className="mb-4 text-xs text-gray-500">All-time collected per property</p>
              {rentByProperty.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={rentByProperty} layout="vertical" margin={{ top: 0, right: 12, left: 4, bottom: 0 }} barSize={14}>
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
              ) : (
                <p className="py-8 text-center text-sm text-gray-400">No payments recorded yet.</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h3 className="mb-1 font-semibold text-gray-900">Payment Methods</h3>
              <p className="mb-4 text-xs text-gray-500">Distribution across all recorded payments</p>
              {paymentMethods.length > 0 ? (
                <div className="flex items-center gap-6">
                  <ResponsiveContainer width={160} height={160}>
                    <PieChart>
                      <Pie data={paymentMethods} cx="50%" cy="50%" innerRadius={45} outerRadius={72} dataKey="value" paddingAngle={3}>
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
                          <span className="h-3 w-3 flex-shrink-0 rounded-full" style={{ background: m.fill }} />
                          <span className="text-sm text-gray-700">{m.name}</span>
                        </div>
                        <span className="text-sm font-semibold text-gray-800">{m.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-gray-400">No payments recorded yet.</p>
              )}
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h3 className="mb-1 font-semibold text-gray-900">Collection Status</h3>
              <p className="mb-4 text-xs text-gray-500">Collected vs. still pending · all time</p>
              <div className="flex items-center gap-6">
                <div className="relative flex-shrink-0">
                  <ResponsiveContainer width={160} height={160}>
                    <PieChart>
                      <Pie data={rentStatusChart} cx="50%" cy="50%" innerRadius={45} outerRadius={72} dataKey="value" paddingAngle={3} startAngle={90} endAngle={-270}>
                        {rentStatusChart.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => fmtNaira(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-lg font-bold text-gray-900">{collectionRate}%</p>
                      <p className="text-xs text-gray-400">rate</p>
                    </div>
                  </div>
                </div>
                <div className="flex-1 space-y-3">
                  {rentStatusChart.map((s) => (
                    <div key={s.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 flex-shrink-0 rounded-full" style={{ background: s.fill }} />
                        <span className="text-sm text-gray-700">{s.name}</span>
                      </div>
                      <span className="text-sm font-semibold text-gray-800">{fmtNaira(s.value)}</span>
                    </div>
                  ))}
                  <div className="border-t border-gray-100 pt-2">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                      <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600" style={{ width: `${collectionRate}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      ₦{collectedTotal.toLocaleString()} of ₦{(collectedTotal + pendingTotal).toLocaleString()} billed
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Table card */}
      <div className="flex flex-col rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between gap-4 border-b border-gray-200 p-4">
          {breakdownType === 'tenants' ? (
            <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
              <button
                onClick={() => setTenantTab('active')}
                className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  tenantTab === 'active' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                Active
                <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-xs text-green-700">{activeLeases.length}</span>
              </button>
              <button
                onClick={() => setTenantTab('terminated')}
                className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  tenantTab === 'terminated' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <UserX className="h-3.5 w-3.5" />
                Terminated / Expired
                <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-xs text-red-700">{terminatedLeases.length}</span>
              </button>
            </div>
          ) : (
            <p className="text-sm font-medium text-gray-700">
              {breakdownType === 'properties'
                ? `${properties.length} properties`
                : breakdownType === 'rent'
                  ? `${allPayments.length} transactions`
                  : breakdownType === 'maintenance'
                    ? `${openMaintenance.length} open requests`
                    : `${renewalsUpcoming.length} upcoming renewals`}
            </p>
          )}

          <div className="flex items-center gap-2">
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
          </div>
        </div>

        <div className="overflow-x-auto">{renderTable()}</div>
      </div>
    </div>
  );
}
