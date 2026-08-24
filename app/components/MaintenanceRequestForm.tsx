import { useState } from 'react';
import { ArrowLeft, Wrench, Upload, AlertCircle, Droplet, Zap, Wind, Home } from 'lucide-react';
import { useMaintenanceCategories, useCreateMaintenanceRequest } from '@/hooks/useMaintenanceRequests';
import { useActiveLease } from '@/hooks/useLeases';

interface MaintenanceRequestFormProps {
  onBack: () => void;
  onSubmit: () => void;
}

// Maps the form's fixed category buttons to a real MaintenanceCategory by
// name -- MaintenanceCategory is a DB table (admin-editable), not an enum,
// so the buttons stay fixed but resolve to whatever category id currently
// matches that name among the 7 seeded defaults.
const CATEGORY_BUTTONS = [
  { name: 'Plumbing', label: 'Plumbing', icon: Droplet, color: 'blue' },
  { name: 'Electrical', label: 'Electrical', icon: Zap, color: 'yellow' },
  { name: 'HVAC', label: 'HVAC/AC', icon: Wind, color: 'purple' },
  { name: 'Structural', label: 'Structural', icon: Home, color: 'orange' },
  { name: 'Other', label: 'Other', icon: Wrench, color: 'gray' },
];

const PRIORITY_MAP: Record<string, 'LOW' | 'MEDIUM' | 'HIGH'> = { low: 'LOW', medium: 'MEDIUM', high: 'HIGH' };

export function MaintenanceRequestForm({ onBack, onSubmit }: MaintenanceRequestFormProps) {
  const { data: categories } = useMaintenanceCategories();
  const { data: activeLease } = useActiveLease();
  const { submit, submitting, error } = useCreateMaintenanceRequest();

  const [formData, setFormData] = useState({
    category: '',
    priority: 'medium',
    title: '',
    description: '',
    location: '',
    preferredDate: '',
    preferredTime: '',
    images: [] as File[],
  });
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.category || !formData.title || !formData.description) {
      setFormError('Please fill in all required fields');
      return;
    }
    if (!activeLease) {
      setFormError('No active lease found on your account -- unable to submit a request.');
      return;
    }

    const category = categories.find((c) => c.name === formData.category);
    const description = formData.location
      ? `${formData.description}\n\nLocation: ${formData.location}`
      : formData.description;

    try {
      await submit({
        unitId: activeLease.unitId,
        title: formData.title,
        description,
        categoryId: category?.id,
        priority: PRIORITY_MAP[formData.priority],
        // No file-storage endpoint exists in any phase yet -- images stay a
        // local display list only, not actually uploaded.
        mediaUrls: [],
      });
      onSubmit();
    } catch {
      // error state is already surfaced via the hook's `error`
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setFormData({ ...formData, images: [...formData.images, ...filesArray] });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={onBack}
            className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-5 w-5" />
            Back to Dashboard
          </button>
          <h1 className="mb-2 text-2xl font-bold">Submit Maintenance Request</h1>
          <p className="text-gray-600">
            Let us know what needs to be fixed and we'll get it resolved quickly
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Property Information */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold">Property Information</h2>
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm font-medium">Your Unit</p>
              <p className="text-sm text-gray-600">
                {activeLease ? `Unit ${activeLease.unitId.slice(0, 8)}` : 'Loading your active lease…'}
              </p>
            </div>
          </div>

          {/* Issue Category */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold">What type of issue is this? *</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {CATEGORY_BUTTONS.map((category) => {
                const Icon = category.icon;
                return (
                  <button
                    key={category.name}
                    type="button"
                    onClick={() => setFormData({ ...formData, category: category.name })}
                    className={`rounded-lg border-2 p-4 transition-all ${
                      formData.category === category.name
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Icon className={`mx-auto mb-2 h-8 w-8 text-${category.color}-600`} />
                    <p className="text-sm font-medium">{category.label}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Priority Level */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold">How urgent is this? *</h2>
            <div className="grid grid-cols-3 gap-4">
              {[
                {
                  id: 'low',
                  label: 'Low',
                  desc: 'Can wait a few days',
                  color: 'green',
                },
                {
                  id: 'medium',
                  label: 'Medium',
                  desc: 'Needs attention soon',
                  color: 'yellow',
                },
                {
                  id: 'high',
                  label: 'High',
                  desc: 'Urgent - needs immediate attention',
                  color: 'red',
                },
              ].map((priority) => (
                <button
                  key={priority.id}
                  type="button"
                  onClick={() => setFormData({ ...formData, priority: priority.id })}
                  className={`rounded-lg border-2 p-4 text-left transition-all ${
                    formData.priority === priority.id
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="mb-1 flex items-center gap-2">
                    <div className={`h-3 w-3 rounded-full bg-${priority.color}-500`}></div>
                    <p className="text-sm font-medium">{priority.label}</p>
                  </div>
                  <p className="text-xs text-gray-600">{priority.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Issue Details */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold">Issue Details</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Brief Summary *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Kitchen faucet is leaking"
                  required
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Detailed Description *
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Please describe the issue in detail. When did it start? Is it getting worse? Any other relevant information..."
                  required
                  rows={5}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Specific Location in Unit
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="e.g., Master bedroom bathroom, Kitchen sink, Living room"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Scheduling Preference */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold">When can we access your unit?</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Preferred Date
                </label>
                <input
                  type="date"
                  value={formData.preferredDate}
                  onChange={(e) => setFormData({ ...formData, preferredDate: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Preferred Time
                </label>
                <select
                  value={formData.preferredTime}
                  onChange={(e) => setFormData({ ...formData, preferredTime: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="">Select a time</option>
                  <option value="morning">Morning (8AM - 12PM)</option>
                  <option value="afternoon">Afternoon (12PM - 4PM)</option>
                  <option value="evening">Evening (4PM - 7PM)</option>
                  <option value="anytime">Anytime</option>
                </select>
              </div>
            </div>
          </div>

          {/* Photo Upload */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-2 text-lg font-semibold">Upload Photos (Optional)</h2>
            <p className="mb-4 text-sm text-gray-600">
              Photos help us understand the issue better and respond faster
            </p>

            <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
              <Upload className="mx-auto mb-4 h-12 w-12 text-gray-400" />
              <label className="cursor-pointer">
                <span className="font-medium text-blue-600 hover:text-blue-700">
                  Click to upload
                </span>
                <span className="text-gray-600"> or drag and drop</span>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
              <p className="mt-2 text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
            </div>

            {formData.images.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-sm font-medium">
                  {formData.images.length} file(s) selected
                </p>
                <div className="space-y-2">
                  {formData.images.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between rounded bg-gray-50 p-2"
                    >
                      <span className="text-sm text-gray-600">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const newImages = formData.images.filter((_, i) => i !== index);
                          setFormData({ ...formData, images: newImages });
                        }}
                        className="text-sm text-red-600 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* What happens next */}
          <div className="rounded-lg border border-blue-200 bg-gradient-to-r from-blue-50 to-green-50 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-blue-900">What happens next</p>
                <p className="mt-1 text-xs text-blue-800">
                  Your property manager will review this request, estimate the cost, and assign a
                  vendor for the job.
                </p>
              </div>
            </div>
          </div>

          {(formError || error) && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              {formError || error}
            </div>
          )}

          {/* Submit Buttons */}
          <div className="flex gap-4">
            <button
              type="button"
              onClick={onBack}
              className="rounded-lg border border-gray-300 px-6 py-3 font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-lg bg-orange-600 py-3 font-semibold text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Submitting…' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
