import { useState } from 'react';
import {
  Search,
  Filter,
  Phone,
  Mail,
  MapPin,
  Calendar,
  DollarSign,
  AlertCircle,
  CheckCircle,
  TrendingUp,
  FileText,
} from 'lucide-react';
import { mockTenantManagementTenants as tenants } from '../store/mockData';

interface TenantManagementProps {
  onNavigate: (page: any) => void;
}

export function TenantManagement({ onNavigate }: TenantManagementProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');

  const statusFilters = [
    { id: 'all', label: 'All Tenants', count: tenants.length },
    {
      id: 'paid',
      label: 'Paid',
      count: tenants.filter((t) => t.rentStatus === 'paid').length,
    },
    {
      id: 'due',
      label: 'Due Soon',
      count: tenants.filter((t) => t.rentStatus === 'due').length,
    },
    {
      id: 'overdue',
      label: 'Overdue',
      count: tenants.filter((t) => t.rentStatus === 'overdue').length,
    },
  ];

  const filteredTenants = tenants.filter((tenant) => {
    const matchesSearch =
      tenant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tenant.property.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = selectedStatus === 'all' || tenant.rentStatus === selectedStatus;
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

      {/* Search and Filters */}
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
        <button
          onClick={() => alert('Opening filter options...')}
          className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 hover:bg-gray-50"
        >
          <Filter className="h-5 w-5" />
          Filter
        </button>
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

      {/* AI Insights */}
      <div className="rounded-lg border border-orange-200 bg-gradient-to-r from-orange-50 to-red-50 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-orange-500">
            <TrendingUp className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="mb-1 font-semibold">AI Payment Prediction</h3>
            <p className="text-sm text-gray-700">
              Based on historical data, Tunde Bakare and Ibrahim Musa are likely to pay late.
              Consider sending personalized reminders.
            </p>
          </div>
        </div>
      </div>

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
              {filteredTenants.map((tenant) => (
                <tr
                  key={tenant.id}
                  onClick={() => onNavigate({ type: 'tenant-detail', tenantId: tenant.id })}
                  className="cursor-pointer transition-colors hover:bg-gray-50"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-10 w-10 ${tenant.avatar} flex items-center justify-center rounded-full font-semibold text-white`}
                      >
                        {tenant.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium">{tenant.name}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Mail className="h-3 w-3" />
                          {tenant.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <MapPin className="h-4 w-4" />
                      {tenant.property}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-4 w-4 text-gray-400" />
                      <span className="font-semibold">{tenant.rentAmount}</span>
                    </div>
                    <p className="text-xs text-gray-500">/year</p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        tenant.rentStatus === 'paid'
                          ? 'bg-green-100 text-green-700'
                          : tenant.rentStatus === 'due'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {tenant.rentStatus === 'paid' ? (
                        <CheckCircle className="mr-1 inline h-3 w-3" />
                      ) : (
                        <AlertCircle className="mr-1 inline h-3 w-3" />
                      )}
                      {tenant.rentStatus.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1 text-sm">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      {tenant.nextDue}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        tenant.riskScore === 'low'
                          ? 'bg-green-100 text-green-700'
                          : tenant.riskScore === 'medium'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {tenant.riskScore.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => alert(`Calling ${tenant.name}...`)}
                        className="rounded p-1 hover:bg-gray-100"
                        title="Call tenant"
                      >
                        <Phone className="h-4 w-4 text-gray-600" />
                      </button>
                      <button
                        onClick={() => alert(`Emailing ${tenant.name}...`)}
                        className="rounded p-1 hover:bg-gray-100"
                        title="Email tenant"
                      >
                        <Mail className="h-4 w-4 text-gray-600" />
                      </button>
                      <button
                        onClick={() =>
                          onNavigate({
                            type: 'tenant-detail',
                            tenantId: tenant.id,
                          })
                        }
                        className="rounded p-1 hover:bg-gray-100"
                        title="View details"
                      >
                        <FileText className="h-4 w-4 text-gray-600" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
