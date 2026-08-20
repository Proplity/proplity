import { useState } from 'react';
import { ArrowLeft, Wrench, Upload, AlertCircle, Droplet, Zap, Wind, Home } from 'lucide-react';
import { mockUserPropertyAddress } from '../store/mockData';

interface MaintenanceRequestFormProps {
  onBack: () => void;
  onSubmit: () => void;
}

export function MaintenanceRequestForm({ onBack, onSubmit }: MaintenanceRequestFormProps) {
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

  const categories = [
    { id: 'plumbing', label: 'Plumbing', icon: Droplet, color: 'blue' },
    { id: 'electrical', label: 'Electrical', icon: Zap, color: 'yellow' },
    { id: 'hvac', label: 'HVAC/AC', icon: Wind, color: 'purple' },
    { id: 'structural', label: 'Structural', icon: Home, color: 'orange' },
    { id: 'other', label: 'Other', icon: Wrench, color: 'gray' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.category || !formData.title || !formData.description) {
      alert('Please fill in all required fields');
      return;
    }
    // Simulate submission
    setTimeout(() => {
      onSubmit();
    }, 1000);
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
              <p className="text-sm font-medium">Your Property</p>
              <p className="text-sm text-gray-600">{mockUserPropertyAddress}</p>
            </div>
          </div>

          {/* Issue Category */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold">What type of issue is this? *</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {categories.map((category) => {
                const Icon = category.icon;
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, category: category.id })}
                    className={`rounded-lg border-2 p-4 transition-all ${
                      formData.category === category.id
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

          {/* AI Assistance Notice */}
          <div className="rounded-lg border border-blue-200 bg-gradient-to-r from-blue-50 to-green-50 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-blue-900">AI-Powered Assistance</p>
                <p className="mt-1 text-xs text-blue-800">
                  Our AI will automatically categorize your request, estimate the cost, and assign
                  the best vendor for the job.
                </p>
              </div>
            </div>
          </div>

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
              className="flex-1 rounded-lg bg-orange-600 py-3 font-semibold text-white transition-colors hover:bg-orange-700"
            >
              Submit Request
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
