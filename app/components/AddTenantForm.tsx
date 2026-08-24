import { useEffect, useState } from 'react';
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
  AlertCircle,
} from 'lucide-react';
import { useProperties, useUnits } from '@/hooks/useProperties';
import { useCreateLease } from '@/hooks/useLeases';

const STEPS = ['Tenant Info', 'Link Property', 'Lease Details', 'Review'];

const RENT_FREQUENCY_MAP: Record<string, string> = {
  monthly: 'MONTHLY',
  quarterly: 'QUARTERLY',
  biannually: 'BI_ANNUAL',
  yearly: 'ANNUAL',
};

interface AddTenantFormProps {
  onBack: () => void;
  onComplete: () => void;
}

export function AddTenantForm({ onBack, onComplete }: AddTenantFormProps) {
  const { data: properties } = useProperties();
  const { submit: createLease, submitting, error } = useCreateLease();

  const [step, setStep] = useState(0);
  const [propertySearch, setPropertySearch] = useState('');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: vacantUnits } = useUnits(selectedPropertyId, 'VACANT');

  // Auto-select the only vacant unit -- most properties in the seeded data
  // have exactly one, and forcing a second click there would be friction
  // for no reason.
  useEffect(() => {
    if (vacantUnits.length === 1) {
      setSelectedUnitId(vacantUnits[0].id);
      setLeaseDetails((s) => ({ ...s, rentAmount: String(vacantUnits[0].rentAmount) }));
    }
  }, [vacantUnits]);

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

  const selectedProperty = properties.find((p) => p.id === selectedPropertyId);
  const selectedUnit = vacantUnits.find((u) => u.id === selectedUnitId);

  const filteredProperties = properties.filter(
    (p) =>
      p.name.toLowerCase().includes(propertySearch.toLowerCase()) ||
      p.address.toLowerCase().includes(propertySearch.toLowerCase()),
  );

  const selectProperty = (propertyId: string) => {
    setSelectedPropertyId(propertyId);
    setSelectedUnitId(null);
  };

  const canProceed = () => {
    if (step === 0)
      return tenantInfo.firstName && tenantInfo.lastName && tenantInfo.email && tenantInfo.phone;
    if (step === 1) return selectedUnitId !== null;
    if (step === 2)
      return leaseDetails.startDate && leaseDetails.endDate && leaseDetails.rentAmount;
    return true;
  };

  const handleSubmit = async () => {
    setFormError(null);
    if (!selectedUnitId) {
      setFormError('Please select a unit before creating the tenancy.');
      return;
    }

    try {
      const lease = await createLease({
        unitId: selectedUnitId,
        tenantEmail: tenantInfo.email,
        tenantName: `${tenantInfo.firstName} ${tenantInfo.lastName}`.trim(),
        tenantPhone: tenantInfo.phone || undefined,
        startDate: leaseDetails.startDate,
        endDate: leaseDetails.endDate,
        rentAmount: parseFloat(leaseDetails.rentAmount) || 0,
        deposit: parseFloat(leaseDetails.securityDeposit) || 0,
        paymentFrequency: RENT_FREQUENCY_MAP[leaseDetails.rentFrequency] ?? 'ANNUAL',
      });

      alert(
        lease.tenantInvited
          ? `Tenancy created! An invitation has been sent to ${tenantInfo.email} to set up their account.`
          : `Tenancy created and linked to the existing account for ${tenantInfo.email}.`,
      );
      onComplete();
    } catch {
      // error state is already surfaced via the hook's `error`
    }
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
                    type="button"
                    onClick={() => alert('Document upload is not available yet.')}
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
                  onClick={() => selectProperty(prop.id)}
                  className={`w-full rounded-xl border-2 p-4 text-left transition-all ${
                    selectedPropertyId === prop.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100">
                      <Home className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{prop.name}</p>
                      <div className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
                        <MapPin className="h-3 w-3" />
                        {prop.address}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
              {filteredProperties.length === 0 && (
                <div className="py-8 text-center text-sm text-gray-400">No properties found.</div>
              )}
            </div>

            {selectedPropertyId && (
              <div className="rounded-xl border border-gray-200 p-4">
                <p className="mb-3 text-sm font-medium text-gray-700">Select a vacant unit</p>
                {vacantUnits.length === 0 ? (
                  <p className="text-sm text-gray-400">No vacant units on this property.</p>
                ) : (
                  <div className="space-y-2">
                    {vacantUnits.map((unit) => (
                      <button
                        key={unit.id}
                        onClick={() => {
                          setSelectedUnitId(unit.id);
                          setLeaseDetails((s) => ({ ...s, rentAmount: String(unit.rentAmount) }));
                        }}
                        className={`w-full rounded-lg border-2 p-3 text-left transition-all ${
                          selectedUnitId === unit.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-blue-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-900">Unit {unit.unitNumber}</p>
                            <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <Bed className="h-3 w-3" />
                                {unit.bedrooms} bed
                              </span>
                              <span className="flex items-center gap-1">
                                <Bath className="h-3 w-3" />
                                {unit.bathrooms} bath
                              </span>
                            </div>
                          </div>
                          <p className="text-sm font-semibold text-blue-600">
                            ₦{unit.rentAmount.toLocaleString()}/{unit.listedPaymentFrequency.toLowerCase()}
                          </p>
                        </div>
                        {selectedUnitId === unit.id && (
                          <div className="mt-2 flex items-center gap-1 text-xs font-medium text-blue-600">
                            <CheckCircle className="h-3.5 w-3.5" /> Selected
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* STEP 2 — Lease Details */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="mb-2 flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              <h2 className="font-semibold text-gray-800">Lease Details</h2>
            </div>

            {selectedProperty && selectedUnit && (
              <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
                <Home className="h-5 w-5 shrink-0 text-blue-500" />
                <div>
                  <p className="text-sm font-medium text-blue-800">
                    {selectedProperty.name} — Unit {selectedUnit.unitNumber}
                  </p>
                  <p className="text-xs text-blue-600">{selectedProperty.address}</p>
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
                <span className="font-medium">{selectedProperty?.name}</span>
                <span className="text-gray-500">Unit</span>
                <span className="font-medium">{selectedUnit?.unitNumber}</span>
                <span className="text-gray-500">Location</span>
                <span className="font-medium">{selectedProperty?.address}</span>
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

      {(formError || error) && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          {formError || error}
        </div>
      )}

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
            disabled={submitting}
            className="flex items-center gap-2 rounded-lg bg-green-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CheckCircle className="h-4 w-4" />
            {submitting ? 'Creating…' : 'Create Tenancy'}
          </button>
        )}
      </div>
    </div>
  );
}
