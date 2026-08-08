import {
  DollarSign,
  Home,
  Wrench,
  Calendar,
  Download,
  CreditCard,
  MapPin,
  Phone,
  Mail,
  Key,
  FileText,
  MessageSquare,
  Calendar as CalendarIcon,
} from 'lucide-react';

interface TenantDashboardProps {
  onNavigate?: (page: any) => void;
}

export function TenantDashboard({ onNavigate }: TenantDashboardProps = {}) {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="mb-1 text-2xl font-semibold">My Rental Dashboard</h1>
        <p className="text-gray-600">Welcome back! Here's your rental information.</p>
      </div>

      {/* Quick Actions */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 font-semibold">Quick Actions</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <button
            onClick={() => onNavigate?.({ type: 'neighbourhood-report' })}
            className="group flex items-center gap-3 rounded-lg border border-gray-200 p-4 text-left transition-colors hover:border-blue-300 hover:bg-blue-50"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50 group-hover:bg-purple-100">
              <FileText className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium">Generate Report</p>
              <p className="text-xs text-gray-500">Neighbourhood insights</p>
            </div>
          </button>
          <button
            onClick={() => onNavigate?.({ type: 'messages' })}
            className="group flex items-center gap-3 rounded-lg border border-gray-200 p-4 text-left transition-colors hover:border-blue-300 hover:bg-blue-50"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 group-hover:bg-blue-100">
              <MessageSquare className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium">Message Manager</p>
              <p className="text-xs text-gray-500">Get in touch</p>
            </div>
          </button>
          <button
            onClick={() => onNavigate?.({ type: 'maintenance-request-form' })}
            className="group flex items-center gap-3 rounded-lg border border-gray-200 p-4 text-left transition-colors hover:border-blue-300 hover:bg-blue-50"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50 group-hover:bg-orange-100">
              <Wrench className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm font-medium">Request Repair</p>
              <p className="text-xs text-gray-500">Submit issue</p>
            </div>
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50">
              <Home className="h-6 w-6 text-blue-600" />
            </div>
            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
              Active
            </span>
          </div>
          <p className="mb-1 text-sm text-gray-600">Current Property</p>
          <p className="text-lg font-semibold">Lekki Phase 1, Apt 203</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-50">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
              Paid
            </span>
          </div>
          <p className="mb-1 text-sm text-gray-600">Rent Status</p>
          <p className="text-lg font-semibold">₦850,000/year</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-orange-50">
              <Calendar className="h-6 w-6 text-orange-600" />
            </div>
          </div>
          <p className="mb-1 text-sm text-gray-600">Next Payment Due</p>
          <p className="text-lg font-semibold">October 15, 2026</p>
        </div>
      </div>

      {/* Property Details */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 p-6">
          <h2 className="font-semibold">Property Information</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <p className="mb-1 text-sm text-gray-600">Address</p>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-gray-400" />
                <p className="font-medium">Block 15, Flat 203, Lekki Phase 1, Lagos</p>
              </div>
            </div>
            <div>
              <p className="mb-1 text-sm text-gray-600">Lease Period</p>
              <p className="font-medium">April 15, 2026 - April 14, 2027</p>
            </div>
            <div>
              <p className="mb-1 text-sm text-gray-600">Property Manager</p>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-gray-400" />
                <p className="font-medium">+234 803 456 7890</p>
              </div>
            </div>
            <div>
              <p className="mb-1 text-sm text-gray-600">Email</p>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-gray-400" />
                <p className="font-medium">manager@proplity.com</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Payment Section */}
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-200 p-6">
            <h2 className="font-semibold">Payment Information</h2>
          </div>
          <div className="space-y-4 p-6">
            <div className="flex items-center justify-between rounded-lg bg-green-50 p-4">
              <div>
                <p className="text-sm text-gray-600">Current Balance</p>
                <p className="text-2xl font-semibold text-green-600">₦0.00</p>
                <p className="mt-1 text-xs text-gray-500">All payments up to date</p>
              </div>
              <CreditCard className="h-12 w-12 text-green-600" />
            </div>

            <div className="space-y-2">
              <button
                onClick={() => alert('Opening payment portal...')}
                className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700"
              >
                Pay Rent Online
              </button>
              <button
                onClick={() => alert('Setting up auto-pay...')}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 font-medium text-gray-700 hover:bg-gray-50"
              >
                Setup Auto-Pay
              </button>
            </div>

            <div className="border-t border-gray-200 pt-4">
              <p className="mb-3 text-sm font-medium">Payment History</p>
              <div className="space-y-2">
                {[
                  { date: 'Apr 15, 2026', amount: '₦850,000', status: 'Paid' },
                  { date: 'Apr 15, 2025', amount: '₦750,000', status: 'Paid' },
                ].map((payment, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{payment.date}</span>
                    <span className="font-medium">{payment.amount}</span>
                    <span className="rounded bg-green-100 px-2 py-1 text-xs text-green-700">
                      {payment.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Maintenance Section */}
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-200 p-6">
            <h2 className="font-semibold">Maintenance Requests</h2>
            <button
              onClick={() => onNavigate?.({ type: 'tenant-maintenance' })}
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              View All →
            </button>
          </div>
          <div className="space-y-4 p-6">
            <button
              onClick={() => onNavigate?.({ type: 'maintenance-request-form' })}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-3 font-medium text-white hover:bg-orange-700"
            >
              <Wrench className="h-5 w-5" />
              Submit New Request
            </button>

            <div className="space-y-3">
              <p className="text-sm font-medium">Recent Requests</p>
              {[
                {
                  title: 'AC Maintenance',
                  status: 'Completed',
                  date: '3 days ago',
                  color: 'green',
                },
                {
                  title: 'Bathroom Faucet Leak',
                  status: 'In Progress',
                  date: '1 week ago',
                  color: 'blue',
                },
              ].map((request, index) => (
                <button
                  key={index}
                  onClick={() => onNavigate?.({ type: 'tenant-maintenance' })}
                  className="w-full cursor-pointer rounded-lg border border-gray-200 p-3 text-left transition-colors hover:border-blue-300 hover:bg-gray-50"
                >
                  <div className="mb-1 flex items-center justify-between">
                    <p className="text-sm font-medium">{request.title}</p>
                    <span
                      className={`px-2 py-1 bg-${request.color}-100 text-${request.color}-700 rounded text-xs font-medium`}
                    >
                      {request.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">{request.date}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Access Codes */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 p-6">
          <h2 className="font-semibold">Access Codes</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              { name: 'Main Gate', code: '#1234', expires: 'No expiry' },
              { name: 'Parking Garage', code: '#5678', expires: 'No expiry' },
              {
                name: 'Gym Access',
                code: '#9012',
                expires: 'Active until lease end',
              },
            ].map((access, index) => (
              <div key={index} className="rounded-lg border border-gray-200 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Key className="h-4 w-4 text-blue-600" />
                  <p className="text-sm font-medium">{access.name}</p>
                </div>
                <p className="mb-1 text-2xl font-bold text-blue-600">{access.code}</p>
                <p className="text-xs text-gray-500">{access.expires}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Documents */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 p-6">
          <h2 className="font-semibold">Documents</h2>
        </div>
        <div className="p-6">
          <div className="space-y-3">
            {[
              { name: 'Lease Agreement', date: 'Apr 15, 2026' },
              { name: 'Receipt - Apr 2026', date: 'Apr 15, 2026' },
              { name: 'Move-in Checklist', date: 'Apr 14, 2026' },
            ].map((doc, index) => (
              <div
                key={index}
                className="flex items-center justify-between rounded-lg border border-gray-200 p-3 hover:bg-gray-50"
              >
                <div>
                  <p className="text-sm font-medium">{doc.name}</p>
                  <p className="text-xs text-gray-500">{doc.date}</p>
                </div>
                <button
                  onClick={() => alert(`Downloading ${doc.name}...`)}
                  className="rounded p-2 hover:bg-gray-100"
                >
                  <Download className="h-4 w-4 text-gray-600" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
