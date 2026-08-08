import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  DollarSign,
  FileText,
  CheckCircle,
  AlertCircle,
  Download,
  MessageSquare,
} from 'lucide-react';

interface TenantDetailProps {
  tenantId: number;
  onBack: () => void;
}

export function TenantDetail({ tenantId, onBack }: TenantDetailProps) {
  const tenant = {
    id: tenantId,
    name: 'Adewale Johnson',
    email: 'adewale.j@email.com',
    phone: '+234 803 456 7890',
    property: 'Lekki Phase 1, Apt 203',
    rentAmount: 850000,
    rentStatus: 'paid',
    nextDue: 'Oct 15, 2026',
    leaseStart: 'Apr 15, 2026',
    leaseEnd: 'Apr 14, 2027',
    paymentHistory: 'Excellent',
    riskScore: 'low',
    emergencyContact: {
      name: 'Funmi Johnson',
      relationship: 'Spouse',
      phone: '+234 805 123 4567',
    },
    paymentRecords: [
      {
        date: 'Apr 15, 2026',
        amount: 850000,
        status: 'Paid',
        method: 'Bank Transfer',
      },
      {
        date: 'Apr 15, 2025',
        amount: 750000,
        status: 'Paid',
        method: 'Online Payment',
      },
      {
        date: 'Apr 15, 2024',
        amount: 700000,
        status: 'Paid',
        method: 'Bank Transfer',
      },
    ],
    maintenanceRequests: [
      {
        date: '2 weeks ago',
        issue: 'AC Servicing',
        status: 'Completed',
        priority: 'Medium',
      },
      {
        date: '1 month ago',
        issue: 'Leaking Faucet',
        status: 'Completed',
        priority: 'Low',
      },
      {
        date: '3 months ago',
        issue: 'Door Lock',
        status: 'Completed',
        priority: 'High',
      },
    ],
    documents: [
      { name: 'Lease Agreement 2026', date: 'Apr 15, 2026', type: 'PDF' },
      { name: 'ID Verification', date: 'Apr 10, 2026', type: 'PDF' },
      { name: 'Proof of Employment', date: 'Apr 10, 2026', type: 'PDF' },
    ],
    notes: [
      { date: 'Apr 20, 2026', note: 'Always pays on time, excellent tenant' },
      { date: 'Jun 15, 2025', note: 'Requested early lease renewal' },
    ],
  };

  return (
    <div className="p-6">
      <button
        onClick={onBack}
        className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-5 w-5" />
        Back to Tenants
      </button>

      {/* Header */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-500 text-3xl font-semibold text-white">
              {tenant.name.charAt(0)}
            </div>
            <div>
              <h1 className="mb-2 text-2xl font-semibold">{tenant.name}</h1>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <Mail className="h-4 w-4" />
                  {tenant.email}
                </div>
                <div className="flex items-center gap-1">
                  <Phone className="h-4 w-4" />
                  {tenant.phone}
                </div>
              </div>
              <div className="mt-2 flex items-center gap-1 text-sm text-gray-600">
                <MapPin className="h-4 w-4" />
                {tenant.property}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`rounded-full px-3 py-1 text-sm font-medium ${
                tenant.rentStatus === 'paid'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700'
              }`}
            >
              {tenant.rentStatus === 'paid' ? 'Rent Paid' : 'Overdue'}
            </span>
            <span
              className={`rounded-full px-3 py-1 text-sm font-medium ${
                tenant.riskScore === 'low'
                  ? 'bg-green-100 text-green-700'
                  : tenant.riskScore === 'medium'
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-red-100 text-red-700'
              }`}
            >
              {tenant.riskScore.toUpperCase()} Risk
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="space-y-6 lg:col-span-2">
          {/* Lease Information */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-4 font-semibold">Lease Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="mb-1 text-sm text-gray-600">Lease Start</p>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <p className="font-medium">{tenant.leaseStart}</p>
                </div>
              </div>
              <div>
                <p className="mb-1 text-sm text-gray-600">Lease End</p>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <p className="font-medium">{tenant.leaseEnd}</p>
                </div>
              </div>
              <div>
                <p className="mb-1 text-sm text-gray-600">Monthly Rent</p>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  <p className="font-semibold text-green-600">
                    ₦{tenant.rentAmount.toLocaleString()}
                  </p>
                </div>
              </div>
              <div>
                <p className="mb-1 text-sm text-gray-600">Next Due</p>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-orange-600" />
                  <p className="font-medium">{tenant.nextDue}</p>
                </div>
              </div>
            </div>

            <div className="mt-4 flex gap-2 border-t border-gray-200 pt-4">
              <button className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                Renew Lease
              </button>
              <button className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Send Notice
              </button>
            </div>
          </div>

          {/* Payment History */}
          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-200 p-6">
              <h2 className="font-semibold">Payment History</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Method
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Receipt
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {tenant.paymentRecords.map((payment, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm">{payment.date}</td>
                      <td className="px-6 py-4 text-sm font-semibold">
                        ₦{payment.amount.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-sm">{payment.method}</td>
                      <td className="px-6 py-4">
                        <span className="rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                          <CheckCircle className="mr-1 inline h-3 w-3" />
                          {payment.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700">
                          <Download className="h-4 w-4" />
                          Download
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Maintenance Requests */}
          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-200 p-6">
              <h2 className="font-semibold">Maintenance Requests</h2>
            </div>
            <div className="divide-y divide-gray-200">
              {tenant.maintenanceRequests.map((request, index) => (
                <div key={index} className="p-4 hover:bg-gray-50">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="font-medium">{request.issue}</p>
                    <span
                      className={`rounded px-2 py-1 text-xs font-medium ${
                        request.status === 'Completed'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {request.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <span>{request.date}</span>
                    <span
                      className={`rounded px-2 py-1 text-xs ${
                        request.priority === 'High'
                          ? 'bg-red-100 text-red-700'
                          : request.priority === 'Medium'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {request.priority} Priority
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-4 font-semibold">Manager Notes</h2>
            <div className="space-y-3">
              {tenant.notes.map((note, index) => (
                <div key={index} className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
                  <p className="text-sm text-gray-800">{note.note}</p>
                  <p className="mt-1 text-xs text-gray-500">{note.date}</p>
                </div>
              ))}
              <button className="w-full rounded-lg border-2 border-dashed border-gray-300 p-3 text-sm text-gray-600 hover:bg-gray-50">
                + Add Note
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-4 font-semibold">Quick Actions</h2>
            <div className="space-y-2">
              <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                <Phone className="h-4 w-4" />
                Call Tenant
              </button>
              <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                <Mail className="h-4 w-4" />
                Send Email
              </button>
              <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                <MessageSquare className="h-4 w-4" />
                WhatsApp
              </button>
              <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                <FileText className="h-4 w-4" />
                Send Invoice
              </button>
            </div>
          </div>

          {/* Emergency Contact */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-4 font-semibold">Emergency Contact</h2>
            <div className="space-y-2">
              <div>
                <p className="text-sm text-gray-600">Name</p>
                <p className="font-medium">{tenant.emergencyContact.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Relationship</p>
                <p className="font-medium">{tenant.emergencyContact.relationship}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Phone</p>
                <p className="font-medium">{tenant.emergencyContact.phone}</p>
              </div>
            </div>
          </div>

          {/* Documents */}
          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-200 p-6">
              <h2 className="font-semibold">Documents</h2>
            </div>
            <div className="divide-y divide-gray-200">
              {tenant.documents.map((doc, index) => (
                <div key={index} className="flex items-center justify-between p-4 hover:bg-gray-50">
                  <div>
                    <p className="text-sm font-medium">{doc.name}</p>
                    <p className="text-xs text-gray-500">{doc.date}</p>
                  </div>
                  <button className="rounded p-2 hover:bg-gray-100">
                    <Download className="h-4 w-4 text-gray-600" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* AI Insights */}
          <div className="rounded-lg border border-purple-200 bg-gradient-to-br from-purple-50 to-blue-50 p-6">
            <h2 className="mb-3 font-semibold">AI Insights</h2>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                <span>Consistent payment history - Low risk tenant</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                <span>Lease expires in 6 months - Consider renewal reminder</span>
              </li>
              <li className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />
                <span>Minimal maintenance requests - Well-maintained unit</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
