import { useState } from 'react';
import {
  ArrowLeft,
  Wrench,
  User,
  MapPin,
  Calendar,
  DollarSign,
  AlertCircle,
  CheckCircle,
  Clock,
  Image as ImageIcon,
  MessageSquare,
  Phone,
  Search,
  Star,
  X,
  UserCheck,
  ChevronRight,
  Zap,
} from 'lucide-react';
import { mockVendors as vendors, getMockMaintenanceDetailRequest } from '../store/maintenanceData';

interface MaintenanceDetailProps {
  requestId: number;
  onBack: () => void;
}

export function MaintenanceDetail({ requestId, onBack }: MaintenanceDetailProps) {
  const [assignedVendorId, setAssignedVendorId] = useState<number | null>(1);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [vendorSearch, setVendorSearch] = useState('');
  const [selectedVendorId, setSelectedVendorId] = useState<number | null>(null);
  const [assignStep, setAssignStep] = useState<'select' | 'confirm'>('select');
  const [assignSuccess, setAssignSuccess] = useState(false);

  const assignedVendor = vendors.find((v) => v.id === assignedVendorId);
  const selectedVendor = vendors.find((v) => v.id === selectedVendorId);

  const filteredVendors = vendors.filter(
    (v) =>
      v.name.toLowerCase().includes(vendorSearch.toLowerCase()) ||
      v.category.toLowerCase().includes(vendorSearch.toLowerCase()),
  );

  const handleOpenAssign = () => {
    setSelectedVendorId(assignedVendorId);
    setAssignStep('select');
    setVendorSearch('');
    setShowAssignModal(true);
  };

  const handleConfirmAssign = () => {
    setAssignedVendorId(selectedVendorId);
    setShowAssignModal(false);
    setAssignSuccess(true);
    setTimeout(() => setAssignSuccess(false), 3000);
  };

  const request = getMockMaintenanceDetailRequest(requestId, assignedVendor, assignedVendorId);

  const priorityConfig = {
    high: { color: 'red', label: 'High Priority' },
    medium: { color: 'yellow', label: 'Medium Priority' },
    low: { color: 'green', label: 'Low Priority' },
  };

  const statusConfig = {
    new: { color: 'orange', label: 'New', icon: AlertCircle },
    in_progress: { color: 'blue', label: 'In Progress', icon: Clock },
    completed: { color: 'green', label: 'Completed', icon: CheckCircle },
  };

  const currentStatus = statusConfig[request.status];
  const currentPriority = priorityConfig[request.priority];
  const StatusIcon = currentStatus.icon;

  return (
    <div className="p-6">
      <button
        onClick={onBack}
        className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-5 w-5" />
        Back to Maintenance
      </button>

      {/* Success Toast */}
      {assignSuccess && (
        <div className="fixed right-6 bottom-6 z-50 flex items-center gap-3 rounded-xl bg-gray-900 px-5 py-3 text-white shadow-xl">
          <CheckCircle className="h-5 w-5 shrink-0 text-green-400" />
          <span className="text-sm">Vendor assigned successfully!</span>
        </div>
      )}

      {/* Header */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-lg bg-${currentPriority.color}-50`}
            >
              <Wrench className={`h-6 w-6 text-${currentPriority.color}-600`} />
            </div>
            <div>
              <h1 className="mb-1 text-2xl font-semibold">{request.title}</h1>
              <p className="text-sm text-gray-600">
                Request #{request.id} • {request.category}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 text-sm font-medium bg-${currentPriority.color}-100 text-${currentPriority.color}-700`}
            >
              {currentPriority.label}
            </span>
            <span
              className={`rounded-full px-3 py-1 text-sm font-medium bg-${currentStatus.color}-100 text-${currentStatus.color}-700 flex items-center gap-1`}
            >
              <StatusIcon className="h-4 w-4" />
              {currentStatus.label}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="mb-1 text-gray-600">Submitted</p>
            <p className="font-medium">{request.submittedAt}</p>
          </div>
          <div>
            <p className="mb-1 text-gray-600">Last Updated</p>
            <p className="font-medium">{request.updatedAt}</p>
          </div>
          <div>
            <p className="mb-1 text-gray-600">Property</p>
            <div className="flex items-center gap-1">
              <MapPin className="h-4 w-4 text-gray-400" />
              <p className="font-medium">{request.property}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="space-y-6 lg:col-span-2">
          {/* AI Classification */}
          <div className="rounded-lg border border-blue-200 bg-gradient-to-br from-blue-50 to-purple-50 p-6">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
                <span className="text-xs font-bold text-white">AI</span>
              </div>
              <h2 className="font-semibold">AI Classification</h2>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="mb-1 text-gray-600">Category</p>
                <p className="font-semibold text-blue-700">{request.aiClassification.category}</p>
              </div>
              <div>
                <p className="mb-1 text-gray-600">Urgency</p>
                <p className="font-semibold text-red-600">{request.aiClassification.urgency}</p>
              </div>
              <div>
                <p className="mb-1 text-gray-600">Estimated Cost</p>
                <p className="font-semibold">{request.aiClassification.estimatedCost}</p>
              </div>
              <div>
                <p className="mb-1 text-gray-600">Estimated Time</p>
                <p className="font-semibold">{request.aiClassification.estimatedTime}</p>
              </div>
            </div>
            <div className="mt-3 border-t border-blue-200 pt-3">
              <p className="text-xs text-blue-800">
                AI Confidence: {request.aiClassification.confidence}% • Recommended: AquaFix
                Plumbers (98% match)
              </p>
            </div>
          </div>

          {/* Description */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-3 font-semibold">Description</h2>
            <p className="text-gray-700">{request.description}</p>
          </div>

          {/* Images */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-4 font-semibold">Photos & Evidence</h2>
            <div className="grid grid-cols-2 gap-4">
              {request.images.map((image) => (
                <div
                  key={image.id}
                  className="flex aspect-video items-center justify-center rounded-lg border border-gray-200 bg-gray-100"
                >
                  <div className="text-center">
                    <ImageIcon className="mx-auto mb-2 h-8 w-8 text-gray-400" />
                    <p className="text-xs text-gray-600">{image.url}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Timeline */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-4 font-semibold">Timeline</h2>
            <div className="space-y-4">
              {request.timeline.map((item, index) => (
                <div key={index} className="flex items-start gap-4">
                  <div className="flex flex-col items-center">
                    {item.status === 'completed' ? (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      </div>
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200">
                        <div className="h-3 w-3 rounded-full bg-gray-400"></div>
                      </div>
                    )}
                    {index < request.timeline.length - 1 && (
                      <div
                        className={`h-12 w-0.5 ${item.status === 'completed' ? 'bg-green-300' : 'bg-gray-300'}`}
                      ></div>
                    )}
                  </div>
                  <div className="flex-1 pb-4">
                    <p
                      className={`font-medium ${item.status === 'completed' ? 'text-gray-900' : 'text-gray-500'}`}
                    >
                      {item.event}
                    </p>
                    <p className="text-xs text-gray-500">{item.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Messages */}
          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-200 p-6">
              <h2 className="font-semibold">Communication</h2>
            </div>
            <div className="max-h-96 space-y-4 overflow-y-auto p-6">
              {request.messages.map((msg, index) => (
                <div key={index} className="flex gap-3">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-200 text-sm font-medium">
                    {msg.sender.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <p className="text-sm font-medium">{msg.sender}</p>
                      <span className="text-xs text-gray-500">{msg.time}</span>
                    </div>
                    <div className="rounded-lg bg-gray-100 p-3">
                      <p className="text-sm">{msg.message}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-200 p-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Type a message..."
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <button className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
                  <MessageSquare className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Tenant Info */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-4 font-semibold">Submitted By</h2>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500 font-semibold text-white">
                {request.submittedBy.name.charAt(0)}
              </div>
              <div>
                <p className="font-medium">{request.submittedBy.name}</p>
                <p className="text-xs text-gray-600">Tenant</p>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-gray-600">
                <Phone className="h-4 w-4" />
                {request.submittedBy.phone}
              </div>
              <div className="flex items-center gap-2 break-all text-gray-600">
                <User className="h-4 w-4" />
                {request.submittedBy.email}
              </div>
            </div>
            <button className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              Contact Tenant
            </button>
          </div>

          {/* Assigned Vendor Card */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold">Assigned Vendor</h2>
              {assignedVendor && (
                <span className="flex items-center gap-1 text-xs font-medium text-green-600">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500"></span>
                  Active
                </span>
              )}
            </div>

            {assignedVendor ? (
              <>
                <div className="mb-4 flex items-center gap-3">
                  <div
                    className={`h-12 w-12 ${assignedVendor.avatar} flex items-center justify-center rounded-full font-semibold text-white`}
                  >
                    {assignedVendor.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium">{assignedVendor.name}</p>
                    <p className="text-xs text-gray-500">{assignedVendor.category}</p>
                    <div className="mt-0.5 flex items-center gap-0.5">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`h-3 w-3 ${i < Math.floor(assignedVendor.rating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
                        />
                      ))}
                      <span className="ml-1 text-xs text-gray-600">{assignedVendor.rating}</span>
                    </div>
                  </div>
                </div>
                <div className="mb-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Completion Rate</span>
                    <span className="font-semibold text-green-600">
                      {assignedVendor.completionRate}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Response Time</span>
                    <span className="font-medium">{assignedVendor.responseTime}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Phone className="h-4 w-4" />
                    {assignedVendor.phone}
                  </div>
                </div>
                <div className="space-y-2">
                  <button className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                    Call Vendor
                  </button>
                  <button
                    onClick={handleOpenAssign}
                    className="w-full rounded-lg border border-blue-300 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50"
                  >
                    Reassign Vendor
                  </button>
                </div>
              </>
            ) : (
              <div className="py-4 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                  <UserCheck className="h-6 w-6 text-gray-400" />
                </div>
                <p className="mb-4 text-sm text-gray-500">No vendor assigned yet</p>
                <button
                  onClick={handleOpenAssign}
                  className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  + Assign Vendor
                </button>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-4 font-semibold">Actions</h2>
            <div className="space-y-2">
              <button className="w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">
                Mark as Completed
              </button>
              <button
                onClick={handleOpenAssign}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                {assignedVendor ? 'Reassign Vendor' : 'Assign Vendor'}
              </button>
              <button className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Update Priority
              </button>
              <button className="w-full rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50">
                Cancel Request
              </button>
            </div>
          </div>

          {/* Cost Tracking */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-4 font-semibold">Cost Tracking</h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Estimated Cost</span>
                <span className="font-semibold">{request.aiClassification.estimatedCost}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Actual Cost</span>
                <span className="font-semibold">Pending</span>
              </div>
              <div className="border-t border-gray-200 pt-3">
                <button className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                  Enter Final Cost
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Assign Vendor Modal */}
      {showAssignModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowAssignModal(false)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-200 p-6">
              <div>
                <h2 className="text-lg font-semibold">
                  {assignStep === 'select' ? 'Select a Vendor' : 'Confirm Assignment'}
                </h2>
                <p className="text-sm text-gray-500">
                  {assignStep === 'select'
                    ? `Assigning for: ${request.title} — ${request.property}`
                    : 'Review and confirm the vendor assignment'}
                </p>
              </div>
              <button
                onClick={() => setShowAssignModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {assignStep === 'select' && (
              <>
                {/* Search */}
                <div className="border-b border-gray-100 p-4">
                  <div className="relative">
                    <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      value={vendorSearch}
                      onChange={(e) => setVendorSearch(e.target.value)}
                      placeholder="Search by name or category..."
                      className="w-full rounded-lg border border-gray-300 py-2 pr-4 pl-9 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* AI Recommendation Banner */}
                <div className="mx-4 mt-4 flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-600">
                    <Zap className="h-4 w-4 text-white" />
                  </div>
                  <p className="text-sm text-blue-800">
                    <span className="font-semibold">AI recommends AquaFix Plumbers</span> — 98%
                    match for this plumbing job based on past performance and availability.
                  </p>
                </div>

                {/* Vendor List */}
                <div className="flex-1 space-y-3 overflow-y-auto p-4">
                  {filteredVendors.map((vendor) => (
                    <button
                      key={vendor.id}
                      onClick={() => setSelectedVendorId(vendor.id)}
                      className={`w-full rounded-xl border-2 p-4 text-left transition-all ${
                        selectedVendorId === vendor.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div
                            className={`h-11 w-11 ${vendor.avatar} flex shrink-0 items-center justify-center rounded-full font-semibold text-white`}
                          >
                            {vendor.name.charAt(0)}
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium text-gray-900">{vendor.name}</p>
                              {vendor.aiMatch >= 90 && (
                                <span className="flex items-center gap-0.5 rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700">
                                  <Zap className="h-3 w-3" /> AI Pick
                                </span>
                              )}
                              {!vendor.available && (
                                <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-600">
                                  Busy
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 text-xs text-gray-500">
                              {vendor.category} · {vendor.location}
                            </p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-3">
                              <span className="flex items-center gap-0.5">
                                {[...Array(5)].map((_, i) => (
                                  <Star
                                    key={i}
                                    className={`h-3 w-3 ${i < Math.floor(vendor.rating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
                                  />
                                ))}
                                <span className="ml-1 text-xs text-gray-600">{vendor.rating}</span>
                              </span>
                              <span className="text-xs text-gray-500">{vendor.jobsDone} jobs</span>
                              <span className="text-xs font-medium text-green-600">
                                {vendor.completionRate}% completion
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-xs font-medium text-gray-700">{vendor.priceRange}</p>
                          <p className="mt-0.5 text-xs text-gray-500">{vendor.responseTime}</p>
                          <p className="mt-1 text-xs font-medium text-blue-600">
                            {vendor.aiMatch}% match
                          </p>
                        </div>
                      </div>
                      {selectedVendorId === vendor.id && (
                        <div className="mt-2 flex items-center gap-1 text-xs font-medium text-blue-600">
                          <CheckCircle className="h-3.5 w-3.5" /> Selected
                        </div>
                      )}
                    </button>
                  ))}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between border-t border-gray-200 p-4">
                  <button
                    onClick={() => setShowAssignModal(false)}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={!selectedVendorId}
                    onClick={() => setAssignStep('confirm')}
                    className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Continue
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </>
            )}

            {assignStep === 'confirm' && selectedVendor && (
              <>
                <div className="flex-1 space-y-5 p-6">
                  {/* Vendor Summary */}
                  <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <div
                      className={`h-14 w-14 ${selectedVendor.avatar} flex shrink-0 items-center justify-center rounded-full text-lg font-semibold text-white`}
                    >
                      {selectedVendor.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{selectedVendor.name}</p>
                      <p className="text-sm text-gray-500">
                        {selectedVendor.category} · {selectedVendor.location}
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="flex items-center gap-0.5">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`h-3.5 w-3.5 ${i < Math.floor(selectedVendor.rating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
                            />
                          ))}
                          <span className="ml-1 text-sm text-gray-600">
                            {selectedVendor.rating}
                          </span>
                        </div>
                        <span className="text-xs font-medium text-green-600">
                          {selectedVendor.completionRate}% completion
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Job Summary */}
                  <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200">
                    <div className="bg-gray-50 px-4 py-2 text-xs font-semibold tracking-wide text-gray-500 uppercase">
                      Job Details
                    </div>
                    <div className="grid grid-cols-2 gap-y-2 px-4 py-3 text-sm">
                      <span className="text-gray-500">Request</span>
                      <span className="font-medium">{request.title}</span>
                      <span className="text-gray-500">Property</span>
                      <span className="font-medium">{request.property}</span>
                      <span className="text-gray-500">Priority</span>
                      <span className="font-medium text-red-600 capitalize">
                        {request.priority}
                      </span>
                      <span className="text-gray-500">Est. Cost</span>
                      <span className="font-medium">{request.aiClassification.estimatedCost}</span>
                      <span className="text-gray-500">Est. Time</span>
                      <span className="font-medium">{request.aiClassification.estimatedTime}</span>
                    </div>
                  </div>

                  <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-xs text-yellow-800">
                    A job notification will be sent to{' '}
                    <span className="font-semibold">{selectedVendor.name}</span> via SMS and the
                    Proplity vendor app. They must accept within 30 minutes.
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-gray-200 p-4">
                  <button
                    onClick={() => setAssignStep('select')}
                    className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
                  >
                    <ArrowLeft className="h-4 w-4" /> Back
                  </button>
                  <button
                    onClick={handleConfirmAssign}
                    className="flex items-center gap-2 rounded-lg bg-green-600 px-6 py-2 text-sm font-medium text-white hover:bg-green-700"
                  >
                    <UserCheck className="h-4 w-4" />
                    Confirm Assignment
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
