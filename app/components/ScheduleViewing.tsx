import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Calendar, Clock, MapPin, User, CheckCircle, AlertCircle } from 'lucide-react';
import {
  VIEWING_TIMES,
  fromLocalDateKey,
  isSunday,
  viewingDateRange,
  viewingInstant,
} from '@/lib/viewingSlots';
import { useCreateViewing } from '@/hooks/useProperties';
import { useAuth } from '@/context/AuthContext';

interface ScheduleViewingProps {
  propertyId: string;
  propertyTitle: string;
  propertyAddress: string;
}

export function ScheduleViewing({
  propertyId,
  propertyTitle,
  propertyAddress,
}: ScheduleViewingProps) {
  const backHref = `/dashboard/properties/${propertyId}`;
  const { submit, submitting, error } = useCreateViewing(propertyId);
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    date: '',
    timeSlot: '',
    // Viewing requests are for signed-in users, so start from their own details.
    fullName: user?.name ?? '',
    email: user?.email ?? '',
    phone: user?.phoneNumber ?? '',
    numberOfPeople: '1',
    specialRequirements: '',
    agreeToTerms: false,
  });
  const [formError, setFormError] = useState<string | null>(null);

  const [range] = useState(() => viewingDateRange());
  const timeLabel = VIEWING_TIMES.find((t) => t.value === formData.timeSlot)?.label ?? '';
  const dayLabel = formData.date
    ? fromLocalDateKey(formData.date).toLocaleDateString('en-US', { weekday: 'long' })
    : '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!formData.agreeToTerms) {
      setFormError('Please agree to the terms and conditions');
      return;
    }

    const peopleLabel =
      formData.numberOfPeople === '4' ? '4 or more people' : `${formData.numberOfPeople} people`;
    const scheduledAt = viewingInstant(formData.date, formData.timeSlot);

    try {
      await submit({
        scheduledAt: scheduledAt.toISOString(),
        notes:
          [
            formData.numberOfPeople !== '1' ? `${peopleLabel} attending.` : '',
            formData.specialRequirements,
          ]
            .filter(Boolean)
            .join(' ') || undefined,
      });
      setStep(3);
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
            <h2 className="mb-2 text-2xl font-bold">Viewing Requested!</h2>
            <p className="mb-6 text-gray-600">
              Your viewing request has been sent for{' '}
              <strong>
                {dayLabel}, {formData.date}
              </strong>{' '}
              at <strong>{timeLabel}</strong> (Lagos time)
            </p>
            <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 text-left">
              <p className="mb-2 text-sm font-medium text-blue-900">What&apos;s Next?</p>
              <ul className="space-y-1 text-sm text-blue-800">
                <li>• The property team will confirm or suggest another time</li>
                <li>• You will get an email and a notification either way</li>
                <li>• Bring valid ID for verification</li>
                <li>• Feel free to ask questions during the tour</li>
              </ul>
            </div>
            <Link
              href={backHref}
              className="block w-full rounded-lg bg-blue-600 py-3 text-center font-semibold text-white hover:bg-blue-700"
            >
              Back to Property
            </Link>
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
          <Link
            href={backHref}
            className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-5 w-5" />
            Back to Property
          </Link>
          <h1 className="mb-2 text-2xl font-bold">Schedule a Viewing</h1>
          <div className="flex items-start gap-2 text-gray-600">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0" />
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
              <div className="rounded-lg border border-gray-200 bg-white p-6">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                  <Calendar className="h-5 w-5" />
                  Select a Date
                </h2>
                <label
                  htmlFor="viewing-date"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Viewing date
                </label>
                <input
                  id="viewing-date"
                  type="date"
                  min={range.min}
                  max={range.max}
                  value={formData.date}
                  onChange={(e) => {
                    const date = e.target.value;
                    if (date && isSunday(date)) {
                      setFormError('Viewings are held Monday to Saturday. Choose another day.');
                      setFormData({ ...formData, date: '' });
                      return;
                    }
                    setFormError(null);
                    setFormData({ ...formData, date });
                  }}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <p className="mt-2 text-xs text-gray-500">
                  Monday to Saturday, from tomorrow up to 60 days ahead.
                </p>
              </div>

              <div className="rounded-lg border border-gray-200 bg-white p-6">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                  <Clock className="h-5 w-5" />
                  Select a Time
                </h2>
                <label
                  htmlFor="viewing-time"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Start time
                </label>
                <select
                  id="viewing-time"
                  value={formData.timeSlot}
                  onChange={(e) => setFormData({ ...formData, timeSlot: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="">Choose a time</option>
                  {VIEWING_TIMES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-gray-500">
                  9:00 AM to 5:00 PM, Lagos time. The property team confirms or suggests another
                  time.
                </p>
              </div>

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
                    {dayLabel},{' '}
                    {fromLocalDateKey(formData.date).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </strong>{' '}
                  at <strong>{timeLabel}</strong> (Lagos time)
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
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
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
            <Link
              href={backHref}
              className="flex items-center justify-center rounded-lg border border-gray-300 px-6 py-3 font-medium hover:bg-gray-50"
            >
              Cancel
            </Link>
            {step === 1 ? (
              <button
                type="button"
                onClick={() => {
                  if (!formData.date || !formData.timeSlot) {
                    setFormError('Please select both a date and time');
                    return;
                  }
                  if (formData.date < range.min || formData.date > range.max) {
                    setFormError('Choose a date from tomorrow up to 60 days ahead.');
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
