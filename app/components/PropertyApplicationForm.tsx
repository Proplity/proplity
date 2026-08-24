import { useState } from 'react';
import {
  ArrowLeft,
  Upload,
  User,
  Briefcase,
  DollarSign,
  Users,
  FileText,
  Home,
  CheckCircle,
} from 'lucide-react';

interface PropertyApplicationFormProps {
  propertyId: string;
  propertyTitle: string;
  propertyPrice: string;
  onBack: () => void;
  onSubmit: () => void;
}

export function PropertyApplicationForm({
  propertyId,
  propertyTitle,
  propertyPrice,
  onBack,
  onSubmit,
}: PropertyApplicationFormProps) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    // Personal Information
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    nationality: '',

    // Employment Information
    employmentStatus: '',
    employer: '',
    jobTitle: '',
    monthlyIncome: '',
    employmentDuration: '',

    // Rental Information
    moveInDate: '',
    leaseDuration: '',
    numberOfOccupants: '1',
    hasPets: 'no',
    petDetails: '',

    // References
    previousLandlordName: '',
    previousLandlordPhone: '',
    previousLandlordEmail: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelationship: '',

    // Documents
    idDocument: null as File | null,
    proofOfIncome: null as File | null,
    employmentLetter: null as File | null,
    bankStatement: null as File | null,

    // Additional
    reasonForMoving: '',
    additionalInfo: '',
    agreeToTerms: false,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.agreeToTerms) {
      alert('Please agree to the terms and conditions');
      return;
    }
    // Simulate submission
    setTimeout(() => {
      onSubmit();
    }, 1000);
  };

  const handleFileUpload = (field: string, file: File | null) => {
    setFormData({ ...formData, [field]: file });
  };

  const nextStep = () => {
    if (step < 4) setStep(step + 1);
  };

  const prevStep = () => {
    if (step > 1) setStep(step - 1);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={onBack}
            className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-5 w-5" />
            Back to Property
          </button>
          <h1 className="mb-2 text-2xl font-bold">Apply to Rent</h1>
          <p className="text-gray-600">
            {propertyTitle} • {propertyPrice}
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between">
            {[
              { num: 1, label: 'Personal Info' },
              { num: 2, label: 'Employment' },
              { num: 3, label: 'References' },
              { num: 4, label: 'Documents' },
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
                {idx < 3 && (
                  <div
                    className={`mx-2 h-1 w-20 ${step > s.num ? 'bg-blue-600' : 'bg-gray-200'}`}
                  ></div>
                )}
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Step 1: Personal Information */}
          {step === 1 && (
            <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-6">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                <User className="h-5 w-5" />
                Personal Information
              </h2>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    First Name *
                  </label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    required
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    required
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Date of Birth *
                  </label>
                  <input
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                    required
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Nationality *
                  </label>
                  <input
                    type="text"
                    value={formData.nationality}
                    onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                    required
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
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
                    Lease Duration *
                  </label>
                  <select
                    value={formData.leaseDuration}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        leaseDuration: e.target.value,
                      })
                    }
                    required
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="">Select duration</option>
                    <option value="6months">6 Months</option>
                    <option value="1year">1 Year</option>
                    <option value="2years">2 Years</option>
                    <option value="3years">3 Years</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Number of Occupants *
                  </label>
                  <select
                    value={formData.numberOfOccupants}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        numberOfOccupants: e.target.value,
                      })
                    }
                    required
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="1">1 Person</option>
                    <option value="2">2 People</option>
                    <option value="3">3 People</option>
                    <option value="4">4 People</option>
                    <option value="5+">5+ People</option>
                  </select>
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

          {/* Step 3: References */}
          {step === 3 && (
            <div className="space-y-6 rounded-lg border border-gray-200 bg-white p-6">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                <Users className="h-5 w-5" />
                References
              </h2>

              <div>
                <h3 className="mb-3 font-medium">Previous Landlord (Optional)</h3>
                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Name</label>
                    <input
                      type="text"
                      value={formData.previousLandlordName}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          previousLandlordName: e.target.value,
                        })
                      }
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">Phone</label>
                      <input
                        type="tel"
                        value={formData.previousLandlordPhone}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            previousLandlordPhone: e.target.value,
                          })
                        }
                        className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">Email</label>
                      <input
                        type="email"
                        value={formData.previousLandlordEmail}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            previousLandlordEmail: e.target.value,
                          })
                        }
                        className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <h3 className="mb-3 font-medium">Emergency Contact *</h3>
                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      value={formData.emergencyContactName}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          emergencyContactName: e.target.value,
                        })
                      }
                      required
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        Phone *
                      </label>
                      <input
                        type="tel"
                        value={formData.emergencyContactPhone}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            emergencyContactPhone: e.target.value,
                          })
                        }
                        required
                        className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        Relationship *
                      </label>
                      <input
                        type="text"
                        value={formData.emergencyContactRelationship}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            emergencyContactRelationship: e.target.value,
                          })
                        }
                        placeholder="e.g., Parent, Sibling"
                        required
                        className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <h3 className="mb-3 font-medium">Additional Information</h3>
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
              </div>
            </div>
          )}

          {/* Step 4: Documents */}
          {step === 4 && (
            <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-6">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                <FileText className="h-5 w-5" />
                Required Documents
              </h2>

              {[
                {
                  id: 'idDocument',
                  label: "Valid ID (Driver's License, Passport, or National ID)",
                  required: true,
                },
                {
                  id: 'proofOfIncome',
                  label: 'Proof of Income (Recent Payslips or Bank Statements)',
                  required: true,
                },
                {
                  id: 'employmentLetter',
                  label: 'Employment Letter',
                  required: false,
                },
                {
                  id: 'bankStatement',
                  label: 'Bank Statement (Last 3 months)',
                  required: true,
                },
              ].map((doc) => (
                <div key={doc.id} className="rounded-lg border border-gray-200 p-4">
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    {doc.label} {doc.required && <span className="text-red-500">*</span>}
                  </label>
                  <div className="flex items-center gap-4">
                    <label className="flex-1 cursor-pointer">
                      <div className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 hover:bg-gray-50">
                        <Upload className="h-5 w-5 text-gray-400" />
                        <span className="text-sm text-gray-600">
                          {formData[doc.id as keyof typeof formData]
                            ? (formData[doc.id as keyof typeof formData] as File).name
                            : 'Choose file'}
                        </span>
                      </div>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => handleFileUpload(doc.id, e.target.files?.[0] || null)}
                        className="hidden"
                        required={doc.required}
                      />
                    </label>
                    {formData[doc.id as keyof typeof formData] && (
                      <button
                        type="button"
                        onClick={() => handleFileUpload(doc.id, null)}
                        className="text-sm text-red-600 hover:text-red-700"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              ))}

              <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> All documents should be clear and legible. Accepted
                  formats: PDF, JPG, PNG (max 5MB each)
                </p>
              </div>

              <label className="mt-6 flex items-start">
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
            <button
              type="button"
              onClick={onBack}
              className="rounded-lg border border-gray-300 px-6 py-3 font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            {step < 4 ? (
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
                className="flex-1 rounded-lg bg-green-600 py-3 font-semibold text-white hover:bg-green-700"
              >
                Submit Application
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
