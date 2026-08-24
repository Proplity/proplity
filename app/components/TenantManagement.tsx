import { useState } from 'react';
import { Search, Phone, Mail, MapPin, Calendar, DollarSign, AlertCircle, CheckCircle, FileText } from 'lucide-react';
import { useLeases } from '@/hooks/useLeases';
import { useInvoices } from '@/hooks/useInvoices';
import type { Invoice, Lease } from '@/lib/api/types';

interface TenantManagementProps {
  onNavigate: (page: any) => void;
}

const AVATAR_COLORS = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500', 'bg-teal-500'];

// No stored "rent status" field exists on Lease -- derived from its RENT
// invoices the same way TenantPaymentHistory derives payment status
// (Phase 9.2): the earliest still-unpaid invoice decides due/overdue/paid.
function rentInfo(leaseId: string, invoices: Invoice[]) {
  const unpaid = invoices
    .filter((i) => i.leaseId === leaseId && i.status !== 'PAID' && i.status !== 'CANCELLED')
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  if (unpaid.length === 0) return { status: 'paid' as const, nextDue: null as string | null };
  const overdue = new Date(unpaid[0].dueDate) < new Date();
  return { status: (overdue ? 'overdue' : 'due') as 'overdue' | 'due', nextDue: unpaid[0].dueDate };
}

export function TenantManagement({ onNavigate }: TenantManagementProps) {
  const { data: leases, loading, error } = useLeases();
  const { data: invoices } = useInvoices({ type: 'RENT' });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');

  const rows = leases.map((lease) => ({ lease, rent: rentInfo(lease.id, invoices) }));

  const statusFilters = [
    { id: 'all', label: 'All Tenants', count: rows.length },
    { id: 'paid', label: 'Paid', count: rows.filter((r) => r.rent.status === 'paid').length },
    { id: 'due', label: 'Due Soon', count: rows.filter((r) => r.rent.status === 'due').length },
    { id: 'overdue', label: 'Overdue', count: rows.filter((r) => r.rent.status === 'overdue').length },
  ];

  const filteredRows = rows.filter(({ lease, rent }) => {
    const matchesSearch =
      (lease.tenant?.name.toLowerCase() ?? '').includes(searchTerm.toLowerCase()) ||
      (lease.unit?.property?.name.toLowerCase() ?? '').includes(searchTerm.toLowerCase());
    const matchesStatus = selectedStatus === 'all' || rent.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="mb-1 text-2xl font-semibold">Tenant Management</h1>
          <p className="text-gray-600">Manage your tenants and track rent payments</p>
        </div>
        <button
          onClick={() => onNavigate({ type: 'add-tenant' })}
          className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
        >
          + Add Tenant
        </button>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 transform text-gray-400" />
          <input
            type="text"
            placeholder="Search tenants or properties..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2 pr-4 pl-10 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-2 overflow-x-auto">
        {statusFilters.map((filter) => (
          <button
            key={filter.id}
            onClick={() => setSelectedStatus(filter.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
              selectedStatus === filter.id
                ? 'bg-blue-600 text-white'
                : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {filter.label} <span className="ml-1 opacity-70">({filter.count})</span>
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-gray-500">Loading tenants…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Tenant List */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  Tenant
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  Property
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  Rent
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  Next Due
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  Risk
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredRows.map(({ lease, rent }, index) => (
                <tr
                  key={lease.id}
                  onClick={() => onNavigate({ type: 'tenant-detail', leaseId: lease.id })}
                  className="cursor-pointer transition-colors hover:bg-gray-50"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-10 w-10 ${AVATAR_COLORS[index % AVATAR_COLORS.length]} flex items-center justify-center rounded-full font-semibold text-white`}
                      >
                        {(lease.tenant?.name ?? '?').charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium">{lease.tenant?.name ?? 'Unknown tenant'}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Mail className="h-3 w-3" />
                          {lease.tenant?.email ?? '—'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <MapPin className="h-4 w-4" />
                      {lease.unit?.property?.name ?? '—'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-4 w-4 text-gray-400" />
                      <span className="font-semibold">₦{lease.rentAmount.toLocaleString()}</span>
                    </div>
                    <p className="text-xs text-gray-500">/{lease.paymentFrequency.toLowerCase()}</p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        rent.status === 'paid'
                          ? 'bg-green-100 text-green-700'
                          : rent.status === 'due'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {rent.status === 'paid' ? (
                        <CheckCircle className="mr-1 inline h-3 w-3" />
                      ) : (
                        <AlertCircle className="mr-1 inline h-3 w-3" />
                      )}
                      {rent.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1 text-sm">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      {rent.nextDue ? new Date(rent.nextDue).toLocaleDateString() : '—'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        lease.riskScore === 'LOW'
                          ? 'bg-green-100 text-green-700'
                          : lease.riskScore === 'MEDIUM'
                            ? 'bg-yellow-100 text-yellow-700'
                            : lease.riskScore === 'HIGH'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {lease.riskScore ?? 'UNSCORED'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2">
                      <a
                        href={lease.tenant?.phoneNumber ? `tel:${lease.tenant.phoneNumber}` : undefined}
                        onClick={(e) => {
                          if (!lease.tenant?.phoneNumber) {
                            e.preventDefault();
                            alert('No phone number on file for this tenant.');
                          }
                        }}
                        className="rounded p-1 hover:bg-gray-100"
                        title="Call tenant"
                      >
                        <Phone className="h-4 w-4 text-gray-600" />
                      </a>
                      <a
                        href={lease.tenant?.email ? `mailto:${lease.tenant.email}` : undefined}
                        className="rounded p-1 hover:bg-gray-100"
                        title="Email tenant"
                      >
                        <Mail className="h-4 w-4 text-gray-600" />
                      </a>
                      <button
                        onClick={() => onNavigate({ type: 'tenant-detail', leaseId: lease.id })}
                        className="rounded p-1 hover:bg-gray-100"
                        title="View details"
                      >
                        <FileText className="h-4 w-4 text-gray-600" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredRows.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-sm text-gray-400">
                    No tenants found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
