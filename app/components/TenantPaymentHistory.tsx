import { useState, useEffect } from 'react';
import {
  CheckCircle,
  Clock,
  AlertCircle,
  Download,
  Search,
  Filter,
  TrendingUp,
  DollarSign,
  Calendar,
  FileText,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { mockAllPaymentsDetailed as allPayments } from '../store/mockData';

const statusConfig = {
  completed: {
    label: 'Paid',
    color: 'bg-green-100 text-green-700',
    icon: CheckCircle,
  },
  late: {
    label: 'Paid Late',
    color: 'bg-yellow-100 text-yellow-700',
    icon: AlertCircle,
  },
  pending: {
    label: 'Pending',
    color: 'bg-orange-100 text-orange-700',
    icon: Clock,
  },
  upcoming: {
    label: 'Upcoming',
    color: 'bg-gray-100 text-gray-600',
    icon: Calendar,
  },
};

export function TenantPaymentHistory() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const totalPaid = allPayments.filter(
    (p) => p.status === 'completed' || p.status === 'late',
  ).length;
  const onTime = allPayments.filter((p) => p.status === 'completed').length;
  const late = allPayments.filter((p) => p.status === 'late').length;
  const onTimeRate = Math.round((onTime / totalPaid) * 100);

  const filtered = allPayments.filter((p) => {
    const matchSearch =
      p.id.toLowerCase().includes(search.toLowerCase()) ||
      p.period.toLowerCase().includes(search.toLowerCase()) ||
      p.ref.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    const matchYear = yearFilter === 'all' || p.date.includes(yearFilter);
    return matchSearch && matchStatus && matchYear;
  });

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, yearFilter, pageSize]);

  // Pagination calculations
  const totalPages = Math.ceil(filtered.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const currentData = filtered.slice(startIndex, endIndex);
  const displayStart = filtered.length === 0 ? 0 : startIndex + 1;
  const displayEnd = Math.min(endIndex, filtered.length);

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
  };

  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="mb-1 text-2xl font-semibold">Payment History</h1>
        <p className="text-sm text-gray-500">
          A full record of your rent payments for Lekki Phase 1, Apt 203
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
            </div>
            <span className="text-xs text-gray-500">Total Paid</span>
          </div>
          <p className="text-2xl font-semibold">{totalPaid}</p>
          <p className="mt-0.5 text-xs text-gray-400">payments made</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
              <TrendingUp className="h-4 w-4 text-blue-600" />
            </div>
            <span className="text-xs text-gray-500">On-Time Rate</span>
          </div>
          <p className="text-2xl font-semibold">{onTimeRate}%</p>
          <p className="mt-0.5 text-xs text-gray-400">
            {onTime} of {totalPaid} on time
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-50">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
            </div>
            <span className="text-xs text-gray-500">Late Payments</span>
          </div>
          <p className="text-2xl font-semibold">{late}</p>
          <p className="mt-0.5 text-xs text-gray-400">times paid late</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50">
              <DollarSign className="h-4 w-4 text-purple-600" />
            </div>
            <span className="text-xs text-gray-500">Total Amount</span>
          </div>
          <p className="text-2xl font-semibold">₦{(totalPaid * 850000).toLocaleString()}</p>
          <p className="mt-0.5 text-xs text-gray-400">total rent paid</p>
        </div>
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by ID, period, or reference..."
            className="w-full rounded-lg border border-gray-300 py-2 pr-4 pl-9 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
        >
          <option value="all">All Statuses</option>
          <option value="completed">Paid</option>
          <option value="late">Paid Late</option>
          <option value="pending">Pending</option>
          <option value="upcoming">Upcoming</option>
        </select>
        <select
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
        >
          <option value="all">All Years</option>
          <option value="2026">2026</option>
          <option value="2025">2025</option>
          <option value="2024">2024</option>
        </select>
        <button className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
          <Download className="h-4 w-4" />
          Export
        </button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase">
                  Payment ID
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase">
                  Period
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase">
                  Date Paid
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase">
                  Amount
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase">
                  Method
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase">
                  Reference
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase">
                  Receipt
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {currentData.map((payment) => {
                const cfg = statusConfig[payment.status as keyof typeof statusConfig];
                const Icon = cfg.icon;
                return (
                  <tr key={payment.id} className="transition-colors hover:bg-gray-50">
                    <td className="px-5 py-4 font-mono text-xs font-medium text-gray-700">
                      {payment.id}
                    </td>
                    <td className="px-5 py-4 font-medium text-gray-800">{payment.period}</td>
                    <td className="px-5 py-4 text-gray-600">{payment.date}</td>
                    <td className="px-5 py-4 font-semibold text-gray-900">{payment.amount}</td>
                    <td className="px-5 py-4 text-gray-600">{payment.method}</td>
                    <td className="px-5 py-4 font-mono text-xs text-gray-500">{payment.ref}</td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${cfg.color}`}
                      >
                        <Icon className="h-3 w-3" />
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {payment.receipt ? (
                        <button className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline">
                          <FileText className="h-3.5 w-3.5" />
                          Download
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {currentData.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-sm text-gray-400">
                    No payments found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="flex flex-col items-center justify-between gap-4 border-t border-gray-100 bg-gray-50 px-5 py-4 sm:flex-row">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600">Show:</span>
              <select
                value={pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="text-xs text-gray-600">per page</span>
            </div>
            <div className="text-xs text-gray-600">
              Showing {displayStart}-{displayEnd} of {filtered.length} records
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePreviousPage}
              disabled={currentPage === 1}
              className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                currentPage === 1
                  ? 'cursor-not-allowed bg-gray-100 text-gray-400'
                  : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </button>

            <div className="flex items-center gap-1 px-3 py-1.5">
              <span className="text-sm text-gray-600">
                Page <span className="font-semibold text-gray-900">{currentPage}</span> of{' '}
                <span className="font-semibold text-gray-900">{totalPages || 1}</span>
              </span>
            </div>

            <button
              onClick={handleNextPage}
              disabled={currentPage === totalPages || totalPages === 0}
              className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                currentPage === totalPages || totalPages === 0
                  ? 'cursor-not-allowed bg-gray-100 text-gray-400'
                  : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
