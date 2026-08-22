import { useState } from 'react';
import { ArrowLeft, Users, Building2, DollarSign, AlertCircle, Search, Clock } from 'lucide-react';
import { useAdminUsers } from '@/hooks/useAdminUsers';
import { useMyProperties } from '@/hooks/useProperties';
import { useInvoices } from '@/hooks/useInvoices';
import { useMaintenanceRequests } from '@/hooks/useMaintenanceRequests';

export type AdminBreakdownType = 'users' | 'properties' | 'transactions' | 'maintenance';

interface AdminBreakdownPageProps {
  breakdownType: AdminBreakdownType;
  onBack: () => void;
}

const ICONS: Record<AdminBreakdownType, any> = { users: Users, properties: Building2, transactions: DollarSign, maintenance: AlertCircle };
const ICON_STYLES: Record<AdminBreakdownType, { bg: string; color: string }> = {
  users: { bg: 'bg-blue-50', color: 'text-blue-600' },
  properties: { bg: 'bg-purple-50', color: 'text-purple-600' },
  transactions: { bg: 'bg-green-50', color: 'text-green-600' },
  maintenance: { bg: 'bg-orange-50', color: 'text-orange-600' },
};

export function AdminBreakdownPage({ breakdownType, onBack }: AdminBreakdownPageProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const { data: users, loading: usersLoading } = useAdminUsers();
  const { data: properties, loading: propertiesLoading } = useMyProperties();
  const { data: invoices, loading: invoicesLoading } = useInvoices();
  const { data: maintenanceRequests, loading: maintenanceLoading } = useMaintenanceRequests();

  const loading = usersLoading || propertiesLoading || invoicesLoading || maintenanceLoading;
  const Icon = ICONS[breakdownType];
  const iconStyle = ICON_STYLES[breakdownType];

  const allPayments = invoices.flatMap((invoice) => invoice.payments.map((payment) => ({ invoice, payment })));
  const collectedTotal = allPayments.reduce((sum, p) => sum + p.payment.amount, 0);
  const openMaintenance = maintenanceRequests.filter((r) => r.status !== 'COMPLETED' && r.status !== 'CANCELLED');

  const heroConfig: Record<AdminBreakdownType, { title: string; subtitle: string; stat: string; statLabel: string }> = {
    users: {
      title: 'Total Users',
      subtitle: 'All registered users across the platform by role and status',
      stat: String(users.length),
      statLabel: 'Registered Users',
    },
    properties: {
      title: 'Properties Listed',
      subtitle: 'All property listings on the platform with moderation status',
      stat: String(properties.length),
      statLabel: 'Properties',
    },
    transactions: {
      title: 'Total Transactions',
      subtitle: 'Platform-wide payment activity and transaction ledger',
      stat: `₦${collectedTotal.toLocaleString()}`,
      statLabel: 'Total Volume',
    },
    maintenance: {
      title: 'Open Maintenance Requests',
      subtitle: 'Maintenance tickets not yet completed or cancelled, across all properties',
      stat: String(openMaintenance.length),
      statLabel: 'Open Requests',
    },
  };
  const hero = heroConfig[breakdownType];

  const renderSummaryCards = () => {
    if (breakdownType === 'users') {
      const byRole = ['MANAGER', 'LANDLORD', 'TENANT', 'VENDOR'].map((role) => ({
        label: role.charAt(0) + role.slice(1).toLowerCase() + 's',
        value: users.filter((u) => u.role === role).length,
      }));
      const colors = ['bg-blue-50 border-blue-200 text-blue-700', 'bg-purple-50 border-purple-200 text-purple-700', 'bg-green-50 border-green-200 text-green-700', 'bg-orange-50 border-orange-200 text-orange-700'];
      return (
        <div className="mb-6 grid grid-cols-4 gap-4">
          {byRole.map((c, i) => (
            <div key={c.label} className={`rounded-lg border p-4 ${colors[i]}`}>
              <p className="text-2xl font-bold">{c.value}</p>
              <p className="mt-0.5 text-sm">{c.label}</p>
            </div>
          ))}
        </div>
      );
    }
    if (breakdownType === 'properties') {
      const approved = properties.filter((p) => p.moderationStatus === 'APPROVED').length;
      const pending = properties.filter((p) => p.moderationStatus === 'PENDING_REVIEW').length;
      const flagged = properties.filter((p) => p.moderationStatus === 'FLAGGED' || p.moderationStatus === 'REJECTED').length;
      return (
        <div className="mb-6 grid grid-cols-3 gap-4">
          {[
            { label: 'Approved', value: approved, color: 'bg-green-50 border-green-200 text-green-700' },
            { label: 'Pending Review', value: pending, color: 'bg-yellow-50 border-yellow-200 text-yellow-700' },
            { label: 'Flagged / Rejected', value: flagged, color: 'bg-red-50 border-red-200 text-red-700' },
          ].map((c) => (
            <div key={c.label} className={`rounded-lg border p-4 ${c.color}`}>
              <p className="text-2xl font-bold">{c.value}</p>
              <p className="mt-0.5 text-sm">{c.label}</p>
            </div>
          ))}
        </div>
      );
    }
    if (breakdownType === 'transactions') {
      const pendingTotal = invoices
        .filter((i) => i.status !== 'PAID' && i.status !== 'CANCELLED')
        .reduce((sum, i) => sum + Math.max(0, i.amount - i.payments.reduce((s, p) => s + p.amount, 0)), 0);
      const cancelledTotal = invoices.filter((i) => i.status === 'CANCELLED').reduce((sum, i) => sum + i.amount, 0);
      return (
        <div className="mb-6 grid grid-cols-3 gap-4">
          {[
            { label: 'Completed', value: `₦${collectedTotal.toLocaleString()}`, color: 'bg-green-50 border-green-200 text-green-700' },
            { label: 'Pending', value: `₦${pendingTotal.toLocaleString()}`, color: 'bg-yellow-50 border-yellow-200 text-yellow-700' },
            { label: 'Cancelled', value: `₦${cancelledTotal.toLocaleString()}`, color: 'bg-red-50 border-red-200 text-red-700' },
          ].map((c) => (
            <div key={c.label} className={`rounded-lg border p-4 ${c.color}`}>
              <p className="text-2xl font-bold">{c.value}</p>
              <p className="mt-0.5 text-sm">{c.label}</p>
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
          ].map((c) => (
            <div key={c.label} className={`rounded-lg border p-4 ${c.color}`}>
              <p className="text-2xl font-bold">{c.value}</p>
              <p className="mt-0.5 text-sm">{c.label}</p>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

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

  const renderTable = () => {
    if (breakdownType === 'users') {
      const filtered = users.filter(
        (u) => u.name.toLowerCase().includes(searchQuery.toLowerCase()) || u.email.toLowerCase().includes(searchQuery.toLowerCase()) || u.role.toLowerCase().includes(searchQuery.toLowerCase()),
      );
      return (
        <table className="w-full text-sm">
          {th(['User', 'Role', 'Properties', 'Joined', 'Status'])}
          <tbody className="divide-y divide-gray-100">
            {filtered.map((u) => (
              <tr key={u.id} className="transition-colors hover:bg-gray-50">
                <td className="px-4 py-3.5 whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-100">
                      <span className="text-xs font-semibold text-blue-700">{u.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">{u.name}</p>
                      <p className="text-xs text-gray-500">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3.5 whitespace-nowrap">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      u.role === 'MANAGER' ? 'bg-blue-100 text-blue-700' : u.role === 'LANDLORD' ? 'bg-purple-100 text-purple-700' : u.role === 'TENANT' ? 'bg-green-100 text-green-700' : u.role === 'VENDOR' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3.5 whitespace-nowrap text-gray-600">{u.propertiesCount}</td>
                <td className="px-4 py-3.5 whitespace-nowrap text-gray-600">{new Date(u.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3.5 whitespace-nowrap">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${u.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : u.status === 'SUSPENDED' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                    {u.status}
                  </span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">No users found.</td>
              </tr>
            )}
          </tbody>
        </table>
      );
    }

    if (breakdownType === 'properties') {
      const filtered = properties.filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.city.toLowerCase().includes(searchQuery.toLowerCase()));
      return (
        <table className="w-full text-sm">
          {th(['Property', 'Location', 'Type', 'Units', 'Listed', 'Status'])}
          <tbody className="divide-y divide-gray-100">
            {filtered.map((p) => (
              <tr key={p.id} className="transition-colors hover:bg-gray-50">
                <td className="px-4 py-3.5 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-purple-50">
                      <Building2 className="h-4 w-4 text-purple-500" />
                    </div>
                    <p className="font-medium text-gray-800">{p.name}</p>
                  </div>
                </td>
                <td className="px-4 py-3.5 whitespace-nowrap text-gray-600">{p.city}</td>
                <td className="px-4 py-3.5 whitespace-nowrap text-gray-600">{p.type}</td>
                <td className="px-4 py-3.5 whitespace-nowrap text-gray-600">{p.units.length}</td>
                <td className="px-4 py-3.5 whitespace-nowrap text-gray-600">{new Date(p.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3.5 whitespace-nowrap">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      p.moderationStatus === 'APPROVED' ? 'bg-green-100 text-green-700' : p.moderationStatus === 'PENDING_REVIEW' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {p.moderationStatus.replace('_', ' ')}
                  </span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">No properties found.</td>
              </tr>
            )}
          </tbody>
        </table>
      );
    }

    if (breakdownType === 'transactions') {
      const filtered = allPayments
        .filter((p) => (p.invoice.lease?.tenant.name ?? '').toLowerCase().includes(searchQuery.toLowerCase()))
        .sort((a, b) => new Date(b.payment.paidAt).getTime() - new Date(a.payment.paidAt).getTime());
      return (
        <table className="w-full text-sm">
          {th(['Reference', 'User', 'Property', 'Amount', 'Type', 'Method', 'Date'])}
          <tbody className="divide-y divide-gray-100">
            {filtered.map(({ invoice, payment }) => (
              <tr key={payment.id} className="transition-colors hover:bg-gray-50">
                <td className="px-4 py-3.5 font-mono text-xs whitespace-nowrap text-gray-500">{payment.transactionRef ?? '—'}</td>
                <td className="px-4 py-3.5 font-medium whitespace-nowrap text-gray-800">{invoice.lease?.tenant.name ?? 'Unknown'}</td>
                <td className="px-4 py-3.5 whitespace-nowrap text-gray-600">{invoice.lease?.unit.property.name ?? '—'}</td>
                <td className="px-4 py-3.5 font-semibold whitespace-nowrap text-gray-900">₦{payment.amount.toLocaleString()}</td>
                <td className="px-4 py-3.5 whitespace-nowrap">
                  <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">{invoice.type}</span>
                </td>
                <td className="px-4 py-3.5 whitespace-nowrap text-gray-600">{payment.paymentMethod.replace('_', ' ')}</td>
                <td className="px-4 py-3.5 whitespace-nowrap text-gray-600">{new Date(payment.paidAt).toLocaleDateString()}</td>
              </tr>
            ))}
            {filtered.length === 0 && !loading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">No transactions found.</td>
              </tr>
            )}
          </tbody>
        </table>
      );
    }

    if (breakdownType === 'maintenance') {
      const filtered = openMaintenance.filter(
        (r) => r.title.toLowerCase().includes(searchQuery.toLowerCase()) || (r.unit?.property?.name ?? '').toLowerCase().includes(searchQuery.toLowerCase()),
      );
      return (
        <table className="w-full text-sm">
          {th(['Property', 'Issue', 'Priority', 'Status', 'Vendor', 'Days Open'])}
          <tbody className="divide-y divide-gray-100">
            {filtered.map((r) => (
              <tr key={r.id} className="transition-colors hover:bg-gray-50">
                <td className="px-4 py-3.5 whitespace-nowrap text-gray-700">
                  {r.unit?.property?.name ?? '—'} · {r.unit?.unitNumber}
                </td>
                <td className="px-4 py-3.5 whitespace-nowrap text-gray-700">{r.title}</td>
                <td className="px-4 py-3.5 whitespace-nowrap text-gray-700">{r.priority}</td>
                <td className="px-4 py-3.5 whitespace-nowrap">
                  <span className={`flex items-center gap-1.5 text-xs font-medium ${r.status === 'IN_PROGRESS' ? 'text-blue-700' : 'text-orange-700'}`}>
                    {r.status === 'IN_PROGRESS' ? <Clock className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                    {r.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-4 py-3.5 whitespace-nowrap text-gray-600">{r.vendor?.name ?? 'Unassigned'}</td>
                <td className="px-4 py-3.5 whitespace-nowrap text-gray-600">{Math.floor((Date.now() - new Date(r.createdAt).getTime()) / (24 * 60 * 60 * 1000))}d</td>
              </tr>
            ))}
            {filtered.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">No open maintenance requests.</td>
              </tr>
            )}
          </tbody>
        </table>
      );
    }

    return null;
  };

  const rowCount = { users: users.length, properties: properties.length, transactions: allPayments.length, maintenance: openMaintenance.length }[breakdownType];
  const rowLabel = { users: 'users shown', properties: 'listings shown', transactions: 'transactions shown', maintenance: 'requests shown' }[breakdownType];

  return (
    <div className="space-y-6 p-6">
      <button onClick={onBack} className="flex items-center gap-2 text-sm font-medium text-gray-500 transition-colors hover:text-gray-800">
        <ArrowLeft className="h-4 w-4" />
        Back to Admin Dashboard
      </button>

      {loading && <p className="text-sm text-gray-500">Loading…</p>}

      <div className="flex items-center gap-6 rounded-xl border border-gray-200 bg-white p-6">
        <div className={`h-14 w-14 rounded-xl ${iconStyle.bg} flex flex-shrink-0 items-center justify-center`}>
          <Icon className={`h-7 w-7 ${iconStyle.color}`} />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-gray-900">{hero.title}</h1>
          <p className="mt-0.5 text-sm text-gray-500">{hero.subtitle}</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-gray-900">{hero.stat}</p>
          <p className="text-sm text-gray-500">{hero.statLabel}</p>
        </div>
      </div>

      {renderSummaryCards()}

      <div className="flex flex-col rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between gap-4 border-b border-gray-200 p-4">
          <p className="text-sm font-medium text-gray-700">
            {rowCount} {rowLabel}
          </p>
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
        <div className="overflow-x-auto">{renderTable()}</div>
      </div>
    </div>
  );
}
