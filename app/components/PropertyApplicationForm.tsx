import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, User, Briefcase, CheckCircle, AlertCircle } from 'lucide-react';
import { useCreateApplication } from '@/hooks/useApplications';
import { useAuth } from '@/context/AuthContext';

interface PropertyApplicationFormProps {
  propertyId: string;
  unitId: string;
  propertyTitle: string;
  propertyPrice: string;
}

const TOTAL_STEPS = 3;

// Identity (name/email/phone) and vetting data (year of birth, emergency
// contact, previous landlord, ID) all now live on the tenant's profile --
// filled once via CompleteProfileForm, gated before this page is even
// reachable (see app/dashboard/properties/[id]/apply/page.tsx) -- so this
// form only asks for what's genuinely specific to THIS application:
// employment/income and move-in details.
export function PropertyApplicationForm({
  propertyId,
  unitId,
  propertyTitle,
  propertyPrice,
}: PropertyApplicationFormProps) {
  const router = useRouter();
  const auth = useAuth();
  const backHref = `/dashboard/properties/${propertyId}`;
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    // Employment Information
    employmentStatus: '',
    employer: '',
    jobTitle: '',
    monthlyIncome: '',
    employmentDuration: '',

    // Rental Information
    moveInDate: '',
    hasPets: 'no',
    petDetails: '',

    // Additional
    reasonForMoving: '',
    additionalInfo: '',
    agreeToTerms: false,
  });

  const { submit: createApplication, submitting, error } = useCreateApplication();
  const [formError, setFormError] = useState<string | null>(null);

  // Prefilled display only, from the already-complete profile -- nothing
  // here is editable, so there's no state for it and no submission field
  // beyond what the profile itself already stores.
  const applicant = {
    name: auth.user?.name ?? '',
    email: auth.user?.email ?? '',
    phone: auth.user?.phoneNumber ?? '',
    yearOfBirth: auth.user?.yearOfBirth ?? null,
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!formData.agreeToTerms) {
      setFormError('Please agree to the terms and conditions');
      return;
    }

    const details = { ...formData, ...applicant };

    try {
      await createApplication({ unitId, details });
      alert(
        'Application submitted successfully! The property manager will review your application and contact you within 24-48 hours.',
      );
      router.push('/dashboard');
    } catch {
      // error state is already surfaced via the hook's `error`
    }
  };

  const nextStep = () => {
    if (step < TOTAL_STEPS) setStep(step + 1);
  };

  const prevStep = () => {
    if (step > 1) setStep(step - 1);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-6">
          <Link
            href={backHref}
            className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-5 w-5" />
            Back to Property
          </Link>
          <h1 className="mb-2 text-2xl font-bold">Apply to Rent</h1>
          <p className="text-gray-600">
            {propertyTitle} • {propertyPrice}
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between">
            {[
              { num: 1, label: 'Applicant' },
              { num: 2, label: 'Employment & Move-in' },
              { num: 3, label: 'Review & Submit' },
            ].map((s, idx) => (
              <div key={s.num} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full font-semibold ${
                      step >= s.num ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {step > s.num ? <CheckCircle className="h-6 w-6" /> : s.num}
                  </div>
                  <span className="mt-2 text-xs font-medium">{s.label}</span>
                </div>
                {idx < TOTAL_STEPS - 1 && (
                  <div
                    className={`mx-2 h-1 w-20 ${step > s.num ? 'bg-blue-600' : 'bg-gray-200'}`}
                  ></div>
                )}
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Step 1: Applicant -- read-only, pulled from the tenant's
              already-complete profile instead of re-asked here. */}
          {step === 1 && (
            <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-6">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                <User className="h-5 w-5" />
                Applicant
              </h2>
              <p className="text-sm text-gray-500">
                From your profile.{' '}
                <Link
                  href={`/dashboard/profile/complete?next=${encodeURIComponent(`/dashboard/properties/${propertyId}/apply`)}`}
                  className="text-blue-600 hover:text-blue-700"
                >
                  Edit
                </Link>
              </p>

              <div className="grid grid-cols-2 gap-y-3 rounded-lg bg-gray-50 p-4 text-sm">
                <span className="text-gray-500">Name</span>
                <span className="font-medium">{applicant.name}</span>
                <span className="text-gray-500">Email</span>
                <span className="font-medium">{applicant.email}</span>
                <span className="text-gray-500">Phone</span>
                <span className="font-medium">{applicant.phone}</span>
                <span className="text-gray-500">Year of Birth</span>
                <span className="font-medium">{applicant.yearOfBirth}</span>
              </div>
            </div>
          )}

          {/* Step 2: Employment Information */}
          {step === 2 && (
            <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-6">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                <Briefcase className="h-5 w-5" />
                Employment Information
              </h2>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Employment Status *
                </label>
                <select
                  value={formData.employmentStatus}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      employmentStatus: e.target.value,
                    })
                  }
                  required
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="">Select status</option>
                  <option value="employed">Employed Full-time</option>
                  <option value="self-employed">Self-employed</option>
                  <option value="contract">Contract/Freelance</option>
                  <option value="student">Student</option>
                  <option value="retired">Retired</option>
                </select>
              </div>

              {(formData.employmentStatus === 'employed' ||
                formData.employmentStatus === 'self-employed' ||
                formData.employmentStatus === 'contract') && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        Employer/Company Name *
                      </label>
                      <input
                        type="text"
                        value={formData.employer}
                        onChange={(e) => setFormData({ ...formData, employer: e.target.value })}
                        required
                        className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        Job Title *
                      </label>
                      <input
                        type="text"
                        value={formData.jobTitle}
                        onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                        required
                        className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        Monthly Income (₦) *
                      </label>
                      <input
                        type="number"
                        value={formData.monthlyIncome}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            monthlyIncome: e.target.value,
                          })
                        }
                        required
                        className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        Employment Duration *
                      </label>
                      <input
                        type="text"
                        value={formData.employmentDuration}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            employmentDuration: e.target.value,
                          })
                        }
                        placeholder="e.g., 2 years"
                        required
                        className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Preferred Move-in Date *
                  </label>
                  <input
                    type="date"
                    value={formData.moveInDate}
                    onChange={(e) => setFormData({ ...formData, moveInDate: e.target.value })}
                    required
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Do you have pets? *
                  </label>
                  <select
                    value={formData.hasPets}
                    onChange={(e) => setFormData({ ...formData, hasPets: e.target.value })}
                    required
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </div>
              </div>

              {formData.hasPets === 'yes' && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Pet Details
                  </label>
                  <textarea
                    value={formData.petDetails}
                    onChange={(e) => setFormData({ ...formData, petDetails: e.target.value })}
                    placeholder="Type, breed, size, etc."
                    rows={2}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              )}
            </div>
          )}

          {/* Step 3: Review & Submit -- references, emergency contact and
              ID document all now live on the tenant profile (collected once,
              gated before this form is reachable), so this step is just the
              application-specific notes plus the terms checkbox. */}
          {step === 3 && (
            <div className="space-y-6 rounded-lg border border-gray-200 bg-white p-6">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                <CheckCircle className="h-5 w-5" />
                Review & Submit
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Reason for Moving
                  </label>
                  <textarea
                    value={formData.reasonForMoving}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        reasonForMoving: e.target.value,
                      })
                    }
                    rows={3}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Anything else we should know?
                  </label>
                  <textarea
                    value={formData.additionalInfo}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        additionalInfo: e.target.value,
                      })
                    }
                    rows={3}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <label className="flex items-start border-t border-gray-200 pt-4">
                <input
                  type="checkbox"
                  checked={formData.agreeToTerms}
                  onChange={(e) => setFormData({ ...formData, agreeToTerms: e.target.checked })}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  required
                />
                <span className="ml-2 text-sm text-gray-700">
                  I confirm that all information provided is accurate and I agree to the{' '}
                  <a href="#" className="text-blue-600 hover:text-blue-700">
                    Terms and Conditions
                  </a>
                  ,{' '}
                  <a href="#" className="text-blue-600 hover:text-blue-700">
                    Privacy Policy
                  </a>
                  , and authorize a background and credit check.
                </span>
              </label>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="mt-6 flex gap-4">
            {step > 1 && (
              <button
                type="button"
                onClick={prevStep}
                className="rounded-lg border border-gray-300 px-6 py-3 font-medium hover:bg-gray-50"
              >
                Previous
              </button>
            )}
            <Link
              href={backHref}
              className="flex items-center justify-center rounded-lg border border-gray-300 px-6 py-3 font-medium hover:bg-gray-50"
            >
              Cancel
            </Link>
            {step < TOTAL_STEPS ? (
              <button
                type="button"
                onClick={nextStep}
                className="flex-1 rounded-lg bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700"
              >
                Next Step
              </button>
            ) : (
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 rounded-lg bg-green-600 py-3 font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? 'Submitting…' : 'Submit Application'}
              </button>
            )}
          </div>

          {(formError || error) && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {formError || error}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
