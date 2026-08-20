import {
  ArrowLeft,
  Wrench,
  MapPin,
  Calendar,
  DollarSign,
  User,
  Phone,
  CheckCircle,
  Clock,
  Upload,
  Camera,
  MessageSquare,
} from 'lucide-react';
import { mockVendorJobs } from '../store/vendorJobDetailData';

interface VendorJobDetailProps {
  jobId: number;
  onBack: () => void;
  onNavigate: (page: any) => void;
}

export function VendorJobDetail({ jobId, onBack, onNavigate }: VendorJobDetailProps) {
  const job = mockVendorJobs[jobId] || mockVendorJobs[1];

  return (
    <div className="p-6">
      <button
        onClick={onBack}
        className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-5 w-5" />
        Back to Jobs
      </button>

      {/* Header */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-50">
              <Wrench className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <h1 className="mb-1 text-2xl font-semibold">{job.title}</h1>
              <p className="text-sm text-gray-600">
                Job #{job.id} • {job.category}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-700">
              High Priority
            </span>
            <span className="flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700">
              <Clock className="h-4 w-4" />
              In Progress
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="mb-1 text-gray-600">Assigned</p>
            <p className="font-medium">{job.assignedDate}</p>
          </div>
          <div>
            <p className="mb-1 text-gray-600">Scheduled</p>
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4 text-gray-400" />
              <p className="font-medium">{job.scheduledDate}</p>
            </div>
          </div>
          <div>
            <p className="mb-1 text-gray-600">Estimated Payment</p>
            <div className="flex items-center gap-1">
              <DollarSign className="h-4 w-4 text-green-600" />
              <p className="font-semibold text-green-600">{job.estimatedPay}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="space-y-6 lg:col-span-2">
          {/* Description */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-3 font-semibold">Job Description</h2>
            <p className="text-gray-700">{job.description}</p>
          </div>

          {/* Property Info */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-4 font-semibold">Property Information</h2>
            <div className="space-y-3">
              <div>
                <p className="mb-1 text-sm text-gray-600">Address</p>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-gray-400" />
                  <p className="font-medium">{job.fullAddress}</p>
                </div>
              </div>
              <div>
                <p className="mb-1 text-sm text-gray-600">Access Instructions</p>
                <p className="text-sm">Gate code: #1234 • Contact tenant upon arrival</p>
              </div>
            </div>
          </div>

          {/* Status Update */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-4 font-semibold">Update Job Status</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <button className="rounded-lg border-2 border-blue-600 bg-blue-50 p-4 text-sm font-medium text-blue-700">
                  <Clock className="mx-auto mb-1 h-5 w-5" />
                  In Progress
                </button>
                <button className="rounded-lg border-2 border-gray-300 p-4 text-sm font-medium hover:bg-gray-50">
                  <Clock className="mx-auto mb-1 h-5 w-5" />
                  On Hold
                </button>
                <button className="rounded-lg border-2 border-gray-300 p-4 text-sm font-medium hover:bg-gray-50">
                  <CheckCircle className="mx-auto mb-1 h-5 w-5" />
                  Completed
                </button>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Progress Notes
                </label>
                <textarea
                  placeholder="Add notes about the work progress..."
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <button className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700">
                Update Status
              </button>
            </div>
          </div>

          {/* Upload Photos */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-4 font-semibold">Work Documentation</h2>
            <div className="space-y-4">
              <div className="cursor-pointer rounded-lg border-2 border-dashed border-gray-300 p-8 text-center transition-colors hover:border-blue-500">
                <Camera className="mx-auto mb-2 h-8 w-8 text-gray-400" />
                <p className="mb-1 text-sm font-medium">Upload Photos</p>
                <p className="text-xs text-gray-500">Before and after photos of the work</p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="flex aspect-square items-center justify-center rounded-lg border border-gray-200 bg-gray-100">
                  <p className="text-xs text-gray-500">Photo 1</p>
                </div>
                <div className="flex aspect-square items-center justify-center rounded-lg border border-gray-200 bg-gray-100">
                  <p className="text-xs text-gray-500">Photo 2</p>
                </div>
                <div className="flex aspect-square items-center justify-center rounded-lg border border-gray-200 bg-gray-100">
                  <p className="text-xs text-gray-500">Photo 3</p>
                </div>
              </div>
            </div>
          </div>

          {/* Materials & Costs */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-4 font-semibold">Materials Used</h2>
            <div className="mb-4 space-y-3">
              {job.materials.map((material: any, index: number) => (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-lg bg-gray-50 p-3"
                >
                  <span className="text-sm">{material.item}</span>
                  <span className="text-sm font-semibold">₦{material.cost.toLocaleString()}</span>
                </div>
              ))}
              <button className="w-full rounded-lg border-2 border-dashed border-gray-300 p-3 text-sm text-gray-600 hover:bg-gray-50">
                + Add Material
              </button>
            </div>
            <div className="border-t border-gray-200 pt-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold">Total Materials Cost</span>
                <span className="font-semibold text-green-600">
                  ₦{job.materials.reduce((sum: number, m: any) => sum + m.cost, 0).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Contact Info */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-4 font-semibold">Property Manager</h2>
            <div className="mb-4">
              <p className="font-medium">{job.propertyManager.name}</p>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <Phone className="h-4 w-4" />
                  {job.propertyManager.phone}
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <User className="h-4 w-4" />
                  {job.propertyManager.email}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <button className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                <Phone className="mr-2 inline h-4 w-4" />
                Call Manager
              </button>
              <button className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                <MessageSquare className="mr-2 inline h-4 w-4" />
                Send Message
              </button>
            </div>
          </div>

          {/* Tenant Info */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-4 font-semibold">Tenant</h2>
            <div className="mb-4">
              <p className="font-medium">{job.tenant.name}</p>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <Phone className="h-4 w-4" />
                  {job.tenant.phone}
                </div>
              </div>
            </div>
            <button className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              <Phone className="mr-2 inline h-4 w-4" />
              Call Tenant
            </button>
          </div>

          {/* Timeline */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-4 font-semibold">Job Timeline</h2>
            <div className="space-y-4">
              {job.timeline.map((item: any, index: number) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    {item.status === 'completed' ? (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      </div>
                    ) : item.status === 'current' ? (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100">
                        <Clock className="h-4 w-4 text-blue-600" />
                      </div>
                    ) : (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200">
                        <div className="h-2 w-2 rounded-full bg-gray-400"></div>
                      </div>
                    )}
                    {index < job.timeline.length - 1 && (
                      <div
                        className={`h-8 w-0.5 ${item.status === 'completed' ? 'bg-green-300' : 'bg-gray-300'}`}
                      ></div>
                    )}
                  </div>
                  <div className="flex-1">
                    <p
                      className={`text-sm font-medium ${
                        item.status === 'pending' ? 'text-gray-500' : 'text-gray-900'
                      }`}
                    >
                      {item.event}
                    </p>
                    <p className="text-xs text-gray-500">{item.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Complete Job */}
          <div className="rounded-lg border border-green-200 bg-green-50 p-6">
            <h3 className="mb-2 font-semibold text-green-900">Ready to Complete?</h3>
            <p className="mb-4 text-sm text-green-800">
              Mark this job as completed to generate your invoice and receive payment.
            </p>
            <button
              onClick={() => onNavigate({ type: 'vendor-create-invoice', jobId: job.id })}
              className="w-full rounded-lg bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-700"
            >
              Mark Complete & Create Invoice
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
