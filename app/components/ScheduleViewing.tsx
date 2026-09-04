import { useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  User,
  Phone,
  Mail,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { mockViewingAvailableDates as availableDates } from '../store/mockData';
import { useCreateViewing } from '@/hooks/useProperties';

interface ScheduleViewingProps {
  propertyId: string;
  propertyTitle: string;
  propertyAddress: string;
  onBack: () => void;
  onSubmit: () => void;
}

// Parses a "10:00 AM" / "2:00 PM" slot label into a 24h hour -- the API
// takes one scheduledAt timestamp, not a separate date + label.
function slotToHour(slot: string): number {
  const match = slot.match(/^(\d{1,2}):00\s*(AM|PM)$/i);
  if (!match) return 9;
  let hour = parseInt(match[1], 10);
  const meridiem = match[2].toUpperCase();
  if (meridiem === 'PM' && hour !== 12) hour += 12;
  if (meridiem === 'AM' && hour === 12) hour = 0;
  return hour;
}

export function ScheduleViewing({
  propertyId,
  propertyTitle,
  propertyAddress,
  onBack,
  onSubmit,
}: ScheduleViewingProps) {
  const { submit, submitting, error } = useCreateViewing(propertyId);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    date: '',
    timeSlot: '',
    fullName: '',
    email: '',
    phone: '',
    numberOfPeople: '1',
    specialRequirements: '',
    agreeToTerms: false,
  });
  const [formError, setFormError] = useState<string | null>(null);

  const selectedDate = availableDates.find((d) => d.date === formData.date);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!formData.agreeToTerms) {
      setFormError('Please agree to the terms and conditions');
      return;
    }

    const hour = slotToHour(formData.timeSlot);
    const scheduledAt = new Date(formData.date);
    scheduledAt.setHours(hour, 0, 0, 0);

    try {
      await submit({
        scheduledAt: scheduledAt.toISOString(),
        notes: formData.specialRequirements || undefined,
      });
      // Matches the pre-existing behavior: the step===3 confirmation JSX
      // below was already unreachable dead code (nothing ever set step to
      // 3) -- preserved as-is rather than newly wiring it up, since that
      // would change this form's navigation contract beyond this phase's
      // scope of "make the submission real."
      onSubmit();
    } catch {
      // error state is already surfaced via the hook's `error`
    }
  };

  if (step === 3) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-blue-50 via-white to-green-50 p-6">
        <div className="w-full max-w-md">
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-lg">
            <div className="mx-auto mb-4 flex h-16 w-16 animate-bounce items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="mb-2 text-2xl font-bold">Viewing Scheduled!</h2>
            <p className="mb-6 text-gray-600">
              Your property viewing has been confirmed for{' '}
              <strong>
                {selectedDate?.day}, {formData.date}
              </strong>{' '}
              at <strong>{formData.timeSlot}</strong>
            </p>
            <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 text-left">
              <p className="mb-2 text-sm font-medium text-blue-900">What's Next?</p>
              <ul className="space-y-1 text-sm text-blue-800">
                <li>• Check your email for confirmation details</li>
                <li>• Property manager will contact you 24 hours before</li>
                <li>• Bring valid ID for verification</li>
                <li>• Feel free to ask questions during the tour</li>
              </ul>
            </div>
            <button
              onClick={onBack}
              className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700"
            >
              Back to Property
            </button>
          </div>
        </div>
      </div>
    );
  }

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
            Back to Property
          </button>
          <h1 className="mb-2 text-2xl font-bold">Schedule a Viewing</h1>
          <div className="flex items-start gap-2 text-gray-600">
            <MapPin className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <div>
              <p className="font-medium">{propertyTitle}</p>
              <p className="text-sm">{propertyAddress}</p>
            </div>
          </div>
        </div>

        {/* Progress Indicator */}
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex flex-1 flex-col items-center">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full font-semibold ${
                  step >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                }`}
              >
                1
              </div>
              <span className="mt-2 text-xs font-medium">Select Date & Time</span>
            </div>
            <div className={`h-1 flex-1 ${step >= 2 ? 'bg-blue-600' : 'bg-gray-200'}`}></div>
            <div className="flex flex-1 flex-col items-center">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full font-semibold ${
                  step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                }`}
              >
                2
              </div>
              <span className="mt-2 text-xs font-medium">Your Details</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Step 1: Date & Time Selection */}
          {step === 1 && (
            <div className="space-y-6">
              {/* Date Selection */}
              <div className="rounded-lg border border-gray-200 bg-white p-6">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                  <Calendar className="h-5 w-5" />
                  Select a Date
                </h2>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {availableDates.map((dateOption) => (
                    <button
                      key={dateOption.date}
                      type="button"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          date: dateOption.date,
                          timeSlot: '',
                        })
                      }
                      className={`rounded-lg border-2 p-4 text-left transition-all ${
                        formData.date === dateOption.date
                          ? 'border-blue-600 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <p className="font-semibold">{dateOption.day}</p>
                      <p className="text-sm text-gray-600">
                        {new Date(dateOption.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {dateOption.slots.length} slots available
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Time Slot Selection */}
              {formData.date && selectedDate && (
                <div className="rounded-lg border border-gray-200 bg-white p-6">
                  <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                    <Clock className="h-5 w-5" />
                    Select a Time
                  </h2>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {selectedDate.slots.map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setFormData({ ...formData, timeSlot: slot })}
                        className={`rounded-lg border-2 p-3 text-center transition-all ${
                          formData.timeSlot === slot
                            ? 'border-blue-600 bg-blue-50 font-semibold'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Important Information */}
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <p className="mb-2 text-sm font-medium text-blue-900">Before Your Visit</p>
                <ul className="space-y-1 text-sm text-blue-800">
                  <li>• Viewings typically last 30-45 minutes</li>
                  <li>• Please arrive 5 minutes early</li>
                  <li>• Bring a valid ID for verification</li>
                  <li>• Feel free to take photos and ask questions</li>
                </ul>
              </div>
            </div>
          )}

          {/* Step 2: Contact Details */}
          {step === 2 && (
            <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-6">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                <User className="h-5 w-5" />
                Your Contact Information
              </h2>

              {/* Selected Date & Time Summary */}
              <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                <p className="mb-1 text-sm font-medium text-green-900">Selected Viewing</p>
                <p className="text-sm text-green-800">
                  <strong>
                    {selectedDate?.day},{' '}
                    {new Date(formData.date).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </strong>{' '}
                  at <strong>{formData.timeSlot}</strong>
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Full Name *</label>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  required
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    required
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Number of People Attending
                </label>
                <select
                  value={formData.numberOfPeople}
                  onChange={(e) => setFormData({ ...formData, numberOfPeople: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="1">Just me</option>
                  <option value="2">2 people</option>
                  <option value="3">3 people</option>
                  <option value="4">4+ people</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Special Requirements or Questions (Optional)
                </label>
                <textarea
                  value={formData.specialRequirements}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      specialRequirements: e.target.value,
                    })
                  }
                  rows={3}
                  placeholder="Any specific areas you'd like to focus on during the viewing?"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <label className="flex items-start">
                <input
                  type="checkbox"
                  checked={formData.agreeToTerms}
                  onChange={(e) => setFormData({ ...formData, agreeToTerms: e.target.checked })}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  required
                />
                <span className="ml-2 text-sm text-gray-700">
                  I agree to the viewing terms and understand that I may be asked to provide ID upon
                  arrival. I will notify the property manager if I need to cancel or reschedule.
                </span>
              </label>
            </div>
          )}

          {(formError || error) && (
            <div className="mt-6 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              {formError || error}
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="mt-6 flex gap-4">
            {step === 2 && (
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-lg border border-gray-300 px-6 py-3 font-medium hover:bg-gray-50"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={onBack}
              className="rounded-lg border border-gray-300 px-6 py-3 font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            {step === 1 ? (
              <button
                type="button"
                onClick={() => {
                  if (!formData.date || !formData.timeSlot) {
                    setFormError('Please select both a date and time');
                    return;
                  }
                  setFormError(null);
                  setStep(2);
                }}
                className="flex-1 rounded-lg bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700"
              >
                Continue
              </button>
            ) : (
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 rounded-lg bg-green-600 py-3 font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? 'Confirming…' : 'Confirm Viewing'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
