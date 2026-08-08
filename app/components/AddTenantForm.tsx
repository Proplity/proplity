import { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  User,
  Mail,
  Phone,
  Home,
  Calendar,
  DollarSign,
  CheckCircle,
  Search,
  MapPin,
  Bed,
  Bath,
  Link2,
  FileText,
  Upload,
} from 'lucide-react';

interface AddTenantFormProps {
  onBack: () => void;
  onComplete: () => void;
}

const availableProperties = [
  {
    id: 1,
    title: '3 Bedroom Flat',
    location: 'Lekki Phase 1, Lagos',
    unit: 'Apt 203',
    rent: '₦850,000/yr',
    status: 'vacant',
    bedrooms: 3,
    bathrooms: 2,
  },
  {
    id: 2,
    title: '2 Bedroom Apartment',
    location: 'Maitama, Abuja',
    unit: 'Unit 5B',
    rent: '₦1,200,000/yr',
    status: 'vacant',
    bedrooms: 2,
    bathrooms: 2,
  },
  {
    id: 3,
    title: '4 Bedroom Duplex',
    location: 'Ikeja GRA, Lagos',
    unit: 'Flat 8',
    rent: '₦900,000/yr',
    status: 'vacant',
    bedrooms: 4,
    bathrooms: 3,
  },
  {
    id: 4,
    title: '1 Bedroom Studio',
    location: 'Surulere, Lagos',
    unit: 'Unit 3',
    rent: '₦550,000/yr',
    status: 'vacant',
    bedrooms: 1,
    bathrooms: 1,
  },
  {
    id: 5,
    title: '3 Bedroom Terrace',
    location: 'Gwarinpa, Abuja',
    unit: 'House 12',
    rent: '₦750,000/yr',
    status: 'vacant',
    bedrooms: 3,
    bathrooms: 2,
  },
];

const STEPS = ['Tenant Info', 'Link Property', 'Lease Details', 'Review'];

export function AddTenantForm({ onBack, onComplete }: AddTenantFormProps) {
  const [step, setStep] = useState(0);
  const [propertySearch, setPropertySearch] = useState('');
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | null>(null);

  const [tenantInfo, setTenantInfo] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    nin: '',
    occupation: '',
    employer: '',
  });

  const [leaseDetails, setLeaseDetails] = useState({
    startDate: '',
    endDate: '',
    rentAmount: '',
    rentFrequency: 'yearly',
    securityDeposit: '',
    agencyFee: '',
    paymentDueDay: '1',
  });

  const selectedProperty = availableProperties.find((p) => p.id === selectedPropertyId);

  const filteredProperties = availableProperties.filter(
    (p) =>
      p.title.toLowerCase().includes(propertySearch.toLowerCase()) ||
      p.location.toLowerCase().includes(propertySearch.toLowerCase()),
  );

  const canProceed = () => {
    if (step === 0)
      return tenantInfo.firstName && tenantInfo.lastName && tenantInfo.email && tenantInfo.phone;
    if (step === 1) return selectedPropertyId !== null;
    if (step === 2)
      return leaseDetails.startDate && leaseDetails.endDate && leaseDetails.rentAmount;
    return true;
  };

  const handleSubmit = () => {
    onComplete();
  };

  return (
    <div className="mx-auto max-w-3xl p-6">
      {/* Header */}
      <div className="mb-8 flex items-center gap-4">
        <button
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-semibold">Add New Tenant</h1>
          <p className="text-sm text-gray-500">Fill in tenant details and link to a property</p>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="mb-8 flex items-center gap-0">
        {STEPS.map((label, i) => (
          <div key={label} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                  i < step
                    ? 'bg-green-500 text-white'
                    : i === step
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-400'
                }`}
              >
                {i < step ? <CheckCircle className="h-5 w-5" /> : i + 1}
              </div>
              <span
                className={`mt-1 text-xs font-medium whitespace-nowrap ${i === step ? 'text-blue-600' : 'text-gray-400'}`}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`mx-2 mb-4 h-0.5 flex-1 transition-colors ${i < step ? 'bg-green-400' : 'bg-gray-200'}`}
              />
            )}
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        {/* STEP 0 — Tenant Info */}
        {step === 0 && (
          <div className="space-y-5">
            <div className="mb-2 flex items-center gap-2">
              <User className="h-5 w-5 text-blue-600" />
              <h2 className="font-semibold text-gray-800">Tenant Information</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  value={tenantInfo.firstName}
                  onChange={(e) => setTenantInfo((s) => ({ ...s, firstName: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="e.g. Adewale"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input
                  value={tenantInfo.lastName}
                  onChange={(e) => setTenantInfo((s) => ({ ...s, lastName: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="e.g. Johnson"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    value={tenantInfo.email}
                    onChange={(e) => setTenantInfo((s) => ({ ...s, email: e.target.value }))}
                    type="email"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 pl-9 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="adewale@email.com"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    value={tenantInfo.phone}
                    onChange={(e) => setTenantInfo((s) => ({ ...s, phone: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 pl-9 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="+234 803 000 0000"
                  />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  NIN (National ID)
                </label>
                <input
                  value={tenantInfo.nin}
                  onChange={(e) => setTenantInfo((s) => ({ ...s, nin: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="12345678901"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Occupation</label>
                <input
                  value={tenantInfo.occupation}
                  onChange={(e) => setTenantInfo((s) => ({ ...s, occupation: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="e.g. Software Engineer"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Employer / Company
              </label>
              <input
                value={tenantInfo.employer}
                onChange={(e) => setTenantInfo((s) => ({ ...s, employer: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder="e.g. Dangote Group"
              />
            </div>
            <div className="border-t border-gray-100 pt-4">
              <p className="mb-3 text-xs font-medium text-gray-500">Documents (optional)</p>
              <div className="flex gap-3">
                {['Government ID', 'Proof of Income', 'Reference Letter'].map((doc) => (
                  <button
                    key={doc}
                    className="flex items-center gap-2 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-xs text-gray-500 transition-colors hover:border-blue-400 hover:text-blue-500"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {doc}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 1 — Link Property */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="mb-2 flex items-center gap-2">
              <Link2 className="h-5 w-5 text-blue-600" />
              <h2 className="font-semibold text-gray-800">Link to a Property</h2>
            </div>
            <p className="text-sm text-gray-500">
              Select the vacant unit you want to assign to{' '}
              <span className="font-medium text-gray-700">
                {tenantInfo.firstName} {tenantInfo.lastName}
              </span>
              .
            </p>

            <div className="relative">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={propertySearch}
                onChange={(e) => setPropertySearch(e.target.value)}
                placeholder="Search properties..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 pl-9 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
              {filteredProperties.map((prop) => (
                <button
                  key={prop.id}
                  onClick={() => {
                    setSelectedPropertyId(prop.id);
                    setLeaseDetails((s) => ({
                      ...s,
                      rentAmount: prop.rent.replace('/yr', '').replace('₦', '').replace(',', ''),
                    }));
                  }}
                  className={`w-full rounded-xl border-2 p-4 text-left transition-all ${
                    selectedPropertyId === prop.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100">
                        <Home className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{prop.title}</p>
                        <div className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
                          <MapPin className="h-3 w-3" />
                          {prop.location} · {prop.unit}
                        </div>
                        <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Bed className="h-3 w-3" />
                            {prop.bedrooms} bed
                          </span>
                          <span className="flex items-center gap-1">
                            <Bath className="h-3 w-3" />
                            {prop.bathrooms} bath
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="ml-4 shrink-0 text-right">
                      <p className="text-sm font-semibold text-blue-600">{prop.rent}</p>
                      <span className="mt-1 inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                        Vacant
                      </span>
                    </div>
                  </div>
                  {selectedPropertyId === prop.id && (
                    <div className="mt-3 flex items-center gap-1 text-xs font-medium text-blue-600">
                      <CheckCircle className="h-3.5 w-3.5" /> Selected
                    </div>
                  )}
                </button>
              ))}
              {filteredProperties.length === 0 && (
                <div className="py-8 text-center text-sm text-gray-400">
                  No vacant properties found.
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 2 — Lease Details */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="mb-2 flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              <h2 className="font-semibold text-gray-800">Lease Details</h2>
            </div>

            {selectedProperty && (
              <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
                <Home className="h-5 w-5 shrink-0 text-blue-500" />
                <div>
                  <p className="text-sm font-medium text-blue-800">
                    {selectedProperty.title} — {selectedProperty.unit}
                  </p>
                  <p className="text-xs text-blue-600">{selectedProperty.location}</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Lease Start Date <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Calendar className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="date"
                    value={leaseDetails.startDate}
                    onChange={(e) =>
                      setLeaseDetails((s) => ({
                        ...s,
                        startDate: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 pl-9 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Lease End Date <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Calendar className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="date"
                    value={leaseDetails.endDate}
                    onChange={(e) =>
                      setLeaseDetails((s) => ({
                        ...s,
                        endDate: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 pl-9 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Rent Amount <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <DollarSign className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    value={leaseDetails.rentAmount}
                    onChange={(e) =>
                      setLeaseDetails((s) => ({
                        ...s,
                        rentAmount: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 pl-9 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="e.g. 850000"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Rent Frequency
                </label>
                <select
                  value={leaseDetails.rentFrequency}
                  onChange={(e) =>
                    setLeaseDetails((s) => ({
                      ...s,
                      rentFrequency: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="biannually">Bi-Annually</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Security Deposit (₦)
                </label>
                <input
                  value={leaseDetails.securityDeposit}
                  onChange={(e) =>
                    setLeaseDetails((s) => ({
                      ...s,
                      securityDeposit: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="e.g. 850000"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Agency Fee (₦)
                </label>
                <input
                  value={leaseDetails.agencyFee}
                  onChange={(e) =>
                    setLeaseDetails((s) => ({
                      ...s,
                      agencyFee: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="e.g. 85000"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Payment Due Day of Month
              </label>
              <select
                value={leaseDetails.paymentDueDay}
                onChange={(e) =>
                  setLeaseDetails((s) => ({
                    ...s,
                    paymentDueDay: e.target.value,
                  }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={String(d)}>
                    {d}
                    {d === 1 ? 'st' : d === 2 ? 'nd' : d === 3 ? 'rd' : 'th'} of every month
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* STEP 3 — Review */}
        {step === 3 && (
          <div className="space-y-5">
            <div className="mb-2 flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-blue-600" />
              <h2 className="font-semibold text-gray-800">Review & Confirm</h2>
            </div>
            <p className="text-sm text-gray-500">
              Please review the details below before creating the tenancy.
            </p>

            <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200">
              <div className="bg-gray-50 px-4 py-2 text-xs font-semibold tracking-wide text-gray-500 uppercase">
                Tenant
              </div>
              <div className="grid grid-cols-2 gap-y-2 px-4 py-3 text-sm">
                <span className="text-gray-500">Full Name</span>
                <span className="font-medium">
                  {tenantInfo.firstName} {tenantInfo.lastName}
                </span>
                <span className="text-gray-500">Email</span>
                <span className="font-medium">{tenantInfo.email}</span>
                <span className="text-gray-500">Phone</span>
                <span className="font-medium">{tenantInfo.phone}</span>
                {tenantInfo.occupation && (
                  <>
                    <span className="text-gray-500">Occupation</span>
                    <span className="font-medium">{tenantInfo.occupation}</span>
                  </>
                )}
              </div>

              <div className="bg-gray-50 px-4 py-2 text-xs font-semibold tracking-wide text-gray-500 uppercase">
                Property
              </div>
              <div className="grid grid-cols-2 gap-y-2 px-4 py-3 text-sm">
                <span className="text-gray-500">Property</span>
                <span className="font-medium">{selectedProperty?.title}</span>
                <span className="text-gray-500">Unit</span>
                <span className="font-medium">{selectedProperty?.unit}</span>
                <span className="text-gray-500">Location</span>
                <span className="font-medium">{selectedProperty?.location}</span>
              </div>

              <div className="bg-gray-50 px-4 py-2 text-xs font-semibold tracking-wide text-gray-500 uppercase">
                Lease
              </div>
              <div className="grid grid-cols-2 gap-y-2 px-4 py-3 text-sm">
                <span className="text-gray-500">Start Date</span>
                <span className="font-medium">{leaseDetails.startDate}</span>
                <span className="text-gray-500">End Date</span>
                <span className="font-medium">{leaseDetails.endDate}</span>
                <span className="text-gray-500">Rent</span>
                <span className="font-medium">
                  ₦{leaseDetails.rentAmount} / {leaseDetails.rentFrequency}
                </span>
                {leaseDetails.securityDeposit && (
                  <>
                    <span className="text-gray-500">Security Deposit</span>
                    <span className="font-medium">₦{leaseDetails.securityDeposit}</span>
                  </>
                )}
                <span className="text-gray-500">Due Day</span>
                <span className="font-medium">
                  {leaseDetails.paymentDueDay}
                  {Number(leaseDetails.paymentDueDay) === 1
                    ? 'st'
                    : Number(leaseDetails.paymentDueDay) === 2
                      ? 'nd'
                      : Number(leaseDetails.paymentDueDay) === 3
                        ? 'rd'
                        : 'th'}{' '}
                  of month
                </span>
              </div>
            </div>

            <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-700">
              An invitation email will be sent to{' '}
              <span className="font-semibold">{tenantInfo.email}</span> to set up their tenant
              portal account.
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="mt-6 flex items-center justify-between">
        <button
          onClick={() => (step === 0 ? onBack() : setStep((s) => s - 1))}
          className="flex items-center gap-2 rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium transition-colors hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
          {step === 0 ? 'Cancel' : 'Back'}
        </button>

        {step < STEPS.length - 1 ? (
          <button
            onClick={() => setStep((s) => s + 1)}
            disabled={!canProceed()}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Continue
            <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            className="flex items-center gap-2 rounded-lg bg-green-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-700"
          >
            <CheckCircle className="h-4 w-4" />
            Create Tenancy
          </button>
        )}
      </div>
    </div>
  );
}
