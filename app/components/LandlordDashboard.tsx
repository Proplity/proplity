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
import { useMyProperties } from '@/hooks/useProperties';
import { useLeases } from '@/hooks/useLeases';
import { useInvoices } from '@/hooks/useInvoices';
import { useMaintenanceRequests } from '@/hooks/useMaintenanceRequests';

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

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function LandlordDashboard({ onNavigate }: LandlordDashboardProps = {}) {
  const { data: properties, loading: propertiesLoading } = useMyProperties();
  const { data: leases, loading: leasesLoading } = useLeases({ status: 'ACTIVE' });
  const { data: invoices, loading: invoicesLoading } = useInvoices();
  const { data: maintenanceRequests, loading: maintenanceLoading } = useMaintenanceRequests();
  const loading = propertiesLoading || leasesLoading || invoicesLoading || maintenanceLoading;

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
    const part1 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const part2 = Array.from({ length: 2 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const newCode: ManagerCode = {
      id: Date.now().toString(),
      code: `LLD-${part1}-${part2}`,
      createdAt: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
      status: 'Active',
      linkedManager: null,
      linkedAt: null,
    };
    setManagerCodes((prev) => [newCode, ...prev]);
  };

  const toggleCode = (id: string) => {
    setManagerCodes((prev) => prev.map((c) => (c.id === id ? { ...c, status: c.status === 'Active' ? 'Deactivated' : 'Active' } : c)));
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  // Portfolio stats -- all real, derived from the landlord's own
  // properties/units (GET /leases, /invoices, /maintenance/requests are
  // already server-scoped to properties this landlord owns).
  const units = properties.flatMap((p) => p.units);
  const occupiedUnits = units.filter((u) => u.status === 'OCCUPIED').length;
  const occupancyRate = units.length > 0 ? Math.round((occupiedUnits / units.length) * 100) : 0;
  const totalListedRent = units.reduce((sum, u) => sum + u.rentAmount, 0);

  const collected = invoices.flatMap((i) => i.payments).reduce((sum, p) => sum + p.amount, 0);
  const pending = invoices
    .filter((i) => i.status !== 'PAID' && i.status !== 'CANCELLED')
    .reduce((sum, i) => sum + Math.max(0, i.amount - i.payments.reduce((s, p) => s + p.amount, 0)), 0);
  const maintenanceCosts = maintenanceRequests
    .filter((r) => r.status === 'COMPLETED')
    .reduce((sum, r) => sum + (r.finalCost ?? 0), 0);
  const collectionRate = collected + pending > 0 ? Math.round((collected / (collected + pending)) * 100) : 0;
  const netRevenue = collected - maintenanceCosts;
  const cashTotal = collected + pending + maintenanceCosts;

  // Per-property occupancy, used as the "Performance" bar -- the mock's
  // arbitrary 0-100 performance score has no real analogue, so this is
  // relabeled to what it actually measures.
  const propertyRows = properties.map((property) => {
    const propertyUnits = property.units;
    const occupied = propertyUnits.filter((u) => u.status === 'OCCUPIED').length;
    const revenue = propertyUnits.reduce((sum, u) => sum + u.rentAmount, 0);
    return {
      property,
      unitCount: propertyUnits.length,
      occupied,
      revenue,
      occupancy: propertyUnits.length > 0 ? Math.round((occupied / propertyUnits.length) * 100) : 0,
    };
  });

  // Recent Activity: a real feed merged from payments, completed
  // maintenance, and newly-active leases -- replacing the mock's 4
  // hardcoded fabricated events.
  const activity = [
    ...invoices.flatMap((invoice) =>
      invoice.payments.map((payment) => ({
        event: 'Rent payment received',
        tenant: invoice.lease?.tenant.name,
        property: invoice.lease?.unit.property.name,
        amount: `₦${payment.amount.toLocaleString()}`,
        time: payment.paidAt,
      })),
    ),
    ...maintenanceRequests
      .filter((r) => r.status === 'COMPLETED' && r.completedAt)
      .map((r) => ({
        event: 'Maintenance completed',
        tenant: undefined,
        property: r.unit?.property?.name,
        amount: r.finalCost != null ? `₦${r.finalCost.toLocaleString()}` : undefined,
        time: r.completedAt!,
      })),
    ...leases.map((l) => ({
      event: 'Lease active',
      tenant: l.tenant?.name,
      property: l.unit?.property?.name,
      amount: undefined,
      time: l.startDate,
    })),
  ]
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="mb-1 text-2xl font-semibold">Landlord Portfolio</h1>
        <p className="text-gray-600">Overview of your property investments</p>
      </div>

      {loading && <p className="text-sm text-gray-500">Loading your portfolio…</p>}

      {/* Portfolio Stats */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50">
              <Building2 className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <p className="mb-1 text-2xl font-semibold">{loading ? '—' : units.length}</p>
          <p className="text-sm text-gray-600">Total Units</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-50">
              <Users className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <p className="mb-1 text-2xl font-semibold">{loading ? '—' : occupiedUnits}</p>
          <p className="text-sm text-gray-600">Occupied Units</p>
          <p className="mt-1 text-xs text-green-600">{loading ? '—' : `${occupancyRate}% Occupancy`}</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-50">
              <DollarSign className="h-6 w-6 text-purple-600" />
            </div>
          </div>
          <p className="mb-1 text-2xl font-semibold">{loading ? '—' : `₦${totalListedRent.toLocaleString()}`}</p>
          <p className="text-sm text-gray-600">Total Listed Rent</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-orange-50">
              <TrendingUp className="h-6 w-6 text-orange-600" />
            </div>
          </div>
          <p className="mb-1 text-2xl font-semibold">{loading ? '—' : `${collectionRate}%`}</p>
          <p className="text-sm text-gray-600">Collection Rate</p>
        </div>
      </div>

      {/* Property Performance */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-200 p-6">
          <h2 className="font-semibold">Property Performance</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {propertyRows.map(({ property, unitCount, occupied, revenue, occupancy }) => (
            <div key={property.id} className="p-6 hover:bg-gray-50">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-lg font-semibold">{property.name}</p>
                  <p className="text-sm text-gray-600">
                    {unitCount} unit{unitCount === 1 ? '' : 's'} • {occupied} occupied
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-semibold text-green-600">₦{revenue.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">Total Listed Rent</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs text-gray-600">Occupancy</span>
                    <span className="text-xs font-medium">{occupancy}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                    <div className="h-full rounded-full bg-green-500" style={{ width: `${occupancy}%` }}></div>
                  </div>
                </div>
                <button
                  onClick={() => onNavigate?.({ type: 'property-detail', propertyId: property.id })}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
                >
                  View Details
                </button>
              </div>
            </div>
          ))}
          {propertyRows.length === 0 && !loading && (
            <p className="p-6 text-sm text-gray-400">No properties yet.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Revenue Breakdown */}
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-200 p-6">
            <h2 className="font-semibold">Revenue Breakdown</h2>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {[
                { label: 'Rent Collected', amount: collected, pct: cashTotal > 0 ? (collected / cashTotal) * 100 : 0, color: 'green' },
                { label: 'Pending Payments', amount: pending, pct: cashTotal > 0 ? (pending / cashTotal) * 100 : 0, color: 'yellow' },
                { label: 'Maintenance Costs', amount: maintenanceCosts, pct: cashTotal > 0 ? (maintenanceCosts / cashTotal) * 100 : 0, color: 'red' },
                { label: 'Net Revenue', amount: netRevenue, pct: collected > 0 ? Math.max(0, (netRevenue / collected) * 100) : 0, color: 'blue' },
              ].map((item) => (
                <div key={item.label}>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm text-gray-600">{item.label}</span>
                    <span className="text-sm font-semibold">₦{item.amount.toLocaleString()}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                    <div className={`h-full bg-${item.color}-500 rounded-full`} style={{ width: `${Math.min(100, item.pct)}%` }}></div>
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
            {activity.map((item, index) => (
              <div key={index} className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium">{item.event}</p>
                    <p className="mt-1 text-xs text-gray-600">
                      {item.tenant && `${item.tenant} • `}
                      {item.property}
                    </p>
                    {item.amount && <p className="mt-1 text-xs font-medium text-green-600">{item.amount}</p>}
                  </div>
                  <span className="text-xs text-gray-500">{timeAgo(item.time)}</span>
                </div>
              </div>
            ))}
            {activity.length === 0 && !loading && <p className="p-4 text-sm text-gray-400">No recent activity yet.</p>}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="rounded-lg border border-purple-200 bg-gradient-to-r from-purple-50 to-blue-50 p-6">
        <h3 className="mb-4 font-semibold">Owner Actions</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <button
            onClick={() => alert('Report export is not available yet.')}
            className="rounded-lg border border-gray-200 bg-white p-4 text-left transition-shadow hover:shadow-md"
          >
            <Download className="mb-2 h-5 w-5 text-blue-600" />
            <p className="text-sm font-medium">Download Report</p>
            <p className="text-xs text-gray-600">Financial summary</p>
          </button>
          <button
            onClick={() => alert('Manager review scheduling is not available yet.')}
            className="rounded-lg border border-gray-200 bg-white p-4 text-left transition-shadow hover:shadow-md"
          >
            <Calendar className="mb-2 h-5 w-5 text-green-600" />
            <p className="text-sm font-medium">Schedule Review</p>
            <p className="text-xs text-gray-600">With manager</p>
          </button>
          <button
            onClick={() => onNavigate?.({ type: 'breakdown', breakdownType: 'rent' })}
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

      {/* Manager Access — Code Management. No AccessCode-style model exists
          for landlord-manager linking anywhere in the schema (this is a
          different concept from the gate AccessCode model) -- stays local
          demo state, same as it was pre-hydration. */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
              <KeyRound className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Manager Access Codes</h2>
              <p className="mt-0.5 text-xs text-gray-500">
                Share a code with your Property Manager during their registration to link them to your portfolio.
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
            <span className="font-semibold">How it works:</span> Generate a code and share it with the person you
            want to appoint as your Property Manager. They'll enter it during registration. You can deactivate a
            code at any time to immediately revoke access — even after they've registered.
          </p>
        </div>

        <div className="divide-y divide-gray-100">
          {managerCodes.map((item) => (
            <div key={item.id} className={`flex items-center gap-4 p-4 ${item.status === 'Deactivated' ? 'opacity-60' : ''}`}>
              <div
                className={`flex-shrink-0 rounded-lg border px-3 py-2 font-mono text-sm font-bold tracking-widest ${
                  item.status === 'Active' ? 'border-blue-200 bg-blue-50 text-blue-800' : 'border-gray-200 bg-gray-100 text-gray-500 line-through'
                }`}
              >
                {item.code}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      item.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {item.status}
                  </span>
                  {item.linkedManager ? (
                    <span className="flex items-center gap-1 text-xs text-gray-600">
                      <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                      Linked to <span className="font-medium">{item.linkedManager}</span> · since {item.linkedAt}
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
                    item.status === 'Active' ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-green-200 text-green-700 hover:bg-green-50'
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
              <p className="text-sm">No codes generated yet. Click "Generate New Code" to get started.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
