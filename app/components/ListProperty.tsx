import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Upload,
  MapPin,
  Home,
  DollarSign,
  Bed,
  Bath,
  Square,
  CheckCircle,
  Loader,
  Camera,
  Video,
  AlertCircle,
  Plus,
  Trash2,
} from 'lucide-react';
import { useCreateProperty } from '@/hooks/useProperties';
import { api } from '@/lib/apiClient';
import { uploadFile, uploadsEnabled, type UploadedFile } from '@/lib/uploadClient';

interface ListPropertyProps {
  userRole: 'manager' | 'landlord';
}

type UnitFormData = {
  unitNumber: string;
  bedrooms: string;
  bathrooms: string;
  sqft: string;
  rentAmount: string;
  serviceCharge: string;
  rentFrequency: string;
};

function makeUnit(unitNumber: string): UnitFormData {
  return {
    unitNumber,
    bedrooms: '',
    bathrooms: '',
    sqft: '',
    rentAmount: '',
    serviceCharge: '',
    rentFrequency: 'yearly',
  };
}

// Per-unit creation status, so a partial failure (property created, but not
// every unit) is recoverable -- the manager can retry just the failed units
// instead of the whole submission, and the property is never rolled back.
type UnitSubmitStatus = 'pending' | 'creating' | 'created' | 'failed';

export function ListProperty({ userRole }: ListPropertyProps) {
  const router = useRouter();
  const {
    submit: createProperty,
    submitting: creatingProperty,
    error: propertyError,
  } = useCreateProperty();
  const [submittingUnit, setSubmittingUnit] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submitting = creatingProperty || submittingUnit;
  const [createdPropertyId, setCreatedPropertyId] = useState<string | null>(null);
  const [unitStatuses, setUnitStatuses] = useState<UnitSubmitStatus[]>([]);

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    propertyType: '',
    address: '',
    city: '',
    state: '',
    description: '',
    amenities: [] as string[],
    utilities: [] as string[],
  });
  const [units, setUnits] = useState<UnitFormData[]>([makeUnit('1')]);

  const addUnit = () => setUnits((u) => [...u, makeUnit(String(u.length + 1))]);
  const removeUnit = (index: number) => setUnits((u) => u.filter((_, i) => i !== index));
  const updateUnit = (index: number, patch: Partial<UnitFormData>) =>
    setUnits((u) => u.map((unit, i) => (i === index ? { ...unit, ...patch } : unit)));

  const [uploadedMedia, setUploadedMedia] = useState({
    photos: [] as UploadedFile[],
    video360: null as UploadedFile | null,
    exteriorPhotos: [] as UploadedFile[],
  });
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [uploadingExterior, setUploadingExterior] = useState(false);
  const [mediaUploadError, setMediaUploadError] = useState<string | null>(null);

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !uploadsEnabled()) return;
    setMediaUploadError(null);
    setUploadingVideo(true);
    try {
      const uploaded = await uploadFile(file, 'properties');
      setUploadedMedia((s) => ({ ...s, video360: uploaded }));
    } catch {
      setMediaUploadError('The video failed to upload. Please try again.');
    } finally {
      setUploadingVideo(false);
    }
  };

  const handlePhotosUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const filesArray = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    if (filesArray.length === 0 || !uploadsEnabled()) return;
    setMediaUploadError(null);
    setUploadingPhotos(true);
    try {
      const uploaded = await Promise.all(filesArray.map((f) => uploadFile(f, 'properties')));
      setUploadedMedia((s) => ({ ...s, photos: [...s.photos, ...uploaded] }));
    } catch {
      setMediaUploadError('One or more photos failed to upload. Please try again.');
    } finally {
      setUploadingPhotos(false);
    }
  };

  const handleExteriorUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const filesArray = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    if (filesArray.length === 0 || !uploadsEnabled()) return;
    setMediaUploadError(null);
    setUploadingExterior(true);
    try {
      const uploaded = await Promise.all(filesArray.map((f) => uploadFile(f, 'properties')));
      setUploadedMedia((s) => ({ ...s, exteriorPhotos: [...s.exteriorPhotos, ...uploaded] }));
    } catch {
      setMediaUploadError('One or more exterior photos failed to upload. Please try again.');
    } finally {
      setUploadingExterior(false);
    }
  };

  const totalSteps = 4;

  const propertyTypes = [
    'Apartment/Flat',
    'Duplex',
    'Detached House',
    'Semi-Detached House',
    'Bungalow',
    'Penthouse',
    'Studio',
    'Room & Parlour',
  ];

  const amenitiesList = [
    '24/7 Power Supply',
    'Generator/Inverter',
    'Borehole/Water Supply',
    'Security/CCTV',
    'Parking Space',
    'Swimming Pool',
    'Gym',
    'Elevator',
    'Balcony',
    'Garden',
  ];

  const utilitiesList = [
    'Water Included',
    'Electricity Included',
    'Gas Included',
    'Internet Included',
    'Waste Management Included',
  ];

  const nigerianStates = [
    'Lagos',
    'Abuja (FCT)',
    'Kano',
    'Rivers',
    'Kaduna',
    'Oyo',
    'Delta',
    'Edo',
    'Ogun',
    'Katsina',
    'Plateau',
    'Anambra',
    'Enugu',
    'Abia',
    'Imo',
    'Kwara',
  ];

  const handleNext = () => {
    if (step < totalSteps) setStep(step + 1);
  };

  const handlePrevious = () => {
    if (step > 1) setStep(step - 1);
  };

  const unitPayload = (unit: UnitFormData) => ({
    unitNumber: unit.unitNumber,
    bedrooms: parseInt(unit.bedrooms, 10) || 0,
    bathrooms: parseFloat(unit.bathrooms) || 0,
    rentAmount: parseFloat(unit.rentAmount) || 0,
    serviceCharge: parseFloat(unit.serviceCharge) || 0,
    listedPaymentFrequency:
      unit.rentFrequency === 'monthly' ? ('MONTHLY' as const) : ('ANNUAL' as const),
    sqft: unit.sqft ? parseInt(unit.sqft, 10) : undefined,
    amenities: formData.amenities.length > 0 ? formData.amenities : undefined,
  });

  // Creating N units is N separate API calls (no bulk-create endpoint) --
  // not atomic. Runs sequentially so a manager can see exactly which unit
  // failed rather than all-or-nothing; the property itself is never rolled
  // back on a partial failure, since units 1..k already exist by then.
  // Returns whether every unit in `indexes` succeeded, computed from local
  // results rather than re-reading (possibly stale) React state.
  const createUnitsSequentially = async (propertyId: string, indexes: number[]) => {
    let allSucceeded = true;
    for (const index of indexes) {
      setUnitStatuses((s) => s.map((st, i) => (i === index ? 'creating' : st)));
      try {
        await api.properties.createUnit(propertyId, unitPayload(units[index]));
        setUnitStatuses((s) => s.map((st, i) => (i === index ? 'created' : st)));
      } catch {
        setUnitStatuses((s) => s.map((st, i) => (i === index ? 'failed' : st)));
        allSucceeded = false;
      }
    }
    return allSucceeded;
  };

  const handleSubmit = async () => {
    setSubmitError(null);
    try {
      // Property has no subtype field beyond the 4-value PropertyType enum
      // -- the mock form's granular types (Duplex, Bungalow, ...) have no
      // schema home; folded into a descriptive name instead of a lost field.
      // Utilities likewise has no dedicated column anywhere on Property/Unit
      // -- folded into the description text rather than silently dropped.
      const utilitiesNote =
        formData.utilities.length > 0
          ? `\n\nUtilities included: ${formData.utilities.join(', ')}`
          : '';

      let propertyId = createdPropertyId;
      if (!propertyId) {
        const property = await createProperty({
          name: `${formData.propertyType || 'Property'} at ${formData.address}`,
          address: formData.address,
          city: formData.city,
          state: formData.state,
          type: 'RESIDENTIAL',
          description:
            formData.description || utilitiesNote
              ? `${formData.description}${utilitiesNote}`
              : undefined,
          imageUrl: uploadedMedia.photos[0]?.url,
          video360Url: uploadedMedia.video360?.url,
          exteriorPhotoUrl: uploadedMedia.exteriorPhotos[0]?.url,
        });
        propertyId = property.id;
        setCreatedPropertyId(propertyId);
        setUnitStatuses(units.map(() => 'pending'));
      }

      setSubmittingUnit(true);
      let allSucceeded = false;
      try {
        allSucceeded = await createUnitsSequentially(
          propertyId,
          units.map((_, i) => i),
        );
      } finally {
        setSubmittingUnit(false);
      }

      if (allSucceeded) {
        alert(
          'Property listing submitted for review! You will be notified by email once it is approved.',
        );
        router.push('/dashboard');
      } else {
        setSubmitError(
          'The property was created, but one or more units failed. Retry the failed units below.',
        );
      }
    } catch {
      setSubmitError(propertyError ?? 'Failed to create the property listing.');
    }
  };

  const handleRetryFailedUnits = async () => {
    if (!createdPropertyId) return;
    const failedIndexes = unitStatuses
      .map((s, i) => (s === 'failed' ? i : -1))
      .filter((i) => i >= 0);
    if (failedIndexes.length === 0) return;
    setSubmittingUnit(true);
    let allSucceeded = false;
    try {
      allSucceeded = await createUnitsSequentially(createdPropertyId, failedIndexes);
    } finally {
      setSubmittingUnit(false);
    }
    // Only the previously-failed indexes were retried; every other unit was
    // already 'created', so allSucceeded here means the whole set is done.
    if (allSucceeded) {
      setSubmitError(null);
      alert(
        'Property listing submitted for review! You will be notified by email once it is approved.',
      );
      router.push('/dashboard');
    }
  };

  const allUnitsCreated =
    createdPropertyId !== null &&
    unitStatuses.length > 0 &&
    unitStatuses.every((s) => s === 'created');
  const anyUnitFailed = unitStatuses.some((s) => s === 'failed');

  const toggleArrayItem = (array: string[], item: string, setter: (val: any) => void) => {
    if (array.includes(item)) {
      setter({
        ...formData,
        [array === formData.amenities ? 'amenities' : 'utilities']: array.filter((i) => i !== item),
      });
    } else {
      setter({
        ...formData,
        [array === formData.amenities ? 'amenities' : 'utilities']: [...array, item],
      });
    }
  };

  return (
    <div className="mx-auto max-w-4xl p-6">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Dashboard
        </Link>
        <h1 className="mb-2 text-2xl font-semibold">List a New Property</h1>
        <p className="text-gray-600">
          {userRole === 'landlord'
            ? 'Add your property to the platform and find quality tenants'
            : 'Add a property you manage to the platform'}
        </p>
      </div>

      {/* Progress Bar */}
      <div className="mb-8">
        <div className="mb-2 flex items-center justify-between">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex flex-1 items-center">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full font-semibold ${
                  step >= s ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                }`}
              >
                {step > s ? <CheckCircle className="h-6 w-6" /> : s}
              </div>
              {s < 4 && (
                <div
                  className={`mx-2 h-1 flex-1 ${step > s ? 'bg-blue-600' : 'bg-gray-200'}`}
                ></div>
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-gray-600">
          <span>Property Info</span>
          <span>Details</span>
          <span>Media Upload</span>
          <span>Review</span>
        </div>
      </div>

      {/* Step Content */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        {/* Step 1: Property Information */}
        {step === 1 && (
          <div className="space-y-6">
            <h2 className="mb-4 text-xl font-semibold">Property Information</h2>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Property Type *
              </label>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {propertyTypes.map((type) => (
                  <button
                    key={type}
                    onClick={() => setFormData({ ...formData, propertyType: type })}
                    className={`rounded-lg border p-3 text-sm font-medium transition-colors ${
                      formData.propertyType === type
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Address/Street *
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="e.g., Block 15, Flat 203, Lekki Phase 1"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">City *</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="e.g., Lagos"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">State *</label>
              <select
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">Select State</option>
                {nigerianStates.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Step 2: Property Details */}
        {step === 2 && (
          <div className="space-y-6">
            <h2 className="mb-4 text-xl font-semibold">Property Details</h2>

            <div className="space-y-4">
              {units.map((unit, index) => (
                <div key={index} className="rounded-lg border border-gray-200 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-700">Unit {index + 1}</h3>
                    {units.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeUnit(index)}
                        className="flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="mb-4">
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Unit Number/Label *
                    </label>
                    <input
                      type="text"
                      value={unit.unitNumber}
                      onChange={(e) => updateUnit(index, { unitNumber: e.target.value })}
                      placeholder="e.g., 3B"
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        <Bed className="mr-1 inline h-4 w-4" />
                        Bedrooms *
                      </label>
                      <input
                        type="number"
                        value={unit.bedrooms}
                        onChange={(e) => updateUnit(index, { bedrooms: e.target.value })}
                        placeholder="e.g., 3"
                        min="0"
                        className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        <Bath className="mr-1 inline h-4 w-4" />
                        Bathrooms *
                      </label>
                      <input
                        type="number"
                        value={unit.bathrooms}
                        onChange={(e) => updateUnit(index, { bathrooms: e.target.value })}
                        placeholder="e.g., 2"
                        min="0"
                        className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        <Square className="mr-1 inline h-4 w-4" />
                        Size (sq ft) *
                      </label>
                      <input
                        type="number"
                        value={unit.sqft}
                        onChange={(e) => updateUnit(index, { sqft: e.target.value })}
                        placeholder="e.g., 1200"
                        min="0"
                        className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        <DollarSign className="mr-1 inline h-4 w-4" />
                        Rent Amount (₦) *
                      </label>
                      <input
                        type="number"
                        value={unit.rentAmount}
                        onChange={(e) => updateUnit(index, { rentAmount: e.target.value })}
                        placeholder="e.g., 850000"
                        min="0"
                        className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        <DollarSign className="mr-1 inline h-4 w-4" />
                        Service Charge (₦)
                      </label>
                      <input
                        type="number"
                        value={unit.serviceCharge}
                        onChange={(e) => updateUnit(index, { serviceCharge: e.target.value })}
                        placeholder="e.g., 50000"
                        min="0"
                        className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        Rent Frequency *
                      </label>
                      <select
                        value={unit.rentFrequency}
                        onChange={(e) => updateUnit(index, { rentFrequency: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      >
                        <option value="yearly">Yearly</option>
                        <option value="monthly">Monthly (Coming Soon)</option>
                      </select>
                    </div>
                  </div>

                  {(parseFloat(unit.rentAmount) || 0) + (parseFloat(unit.serviceCharge) || 0) >
                    0 && (
                    <p className="mt-3 text-sm text-gray-600">
                      Total per cycle: ₦
                      {(
                        (parseFloat(unit.rentAmount) || 0) + (parseFloat(unit.serviceCharge) || 0)
                      ).toLocaleString()}
                    </p>
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={addUnit}
                className="flex items-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-600 hover:border-blue-400 hover:text-blue-600"
              >
                <Plus className="h-4 w-4" />
                Add Another Unit
              </button>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe the property, neighborhood, and any special features..."
                rows={4}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Amenities</label>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {amenitiesList.map((amenity) => (
                  <button
                    key={amenity}
                    onClick={() => toggleArrayItem(formData.amenities, amenity, setFormData)}
                    className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                      formData.amenities.includes(amenity)
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <CheckCircle
                      className={`mr-2 inline h-4 w-4 ${
                        formData.amenities.includes(amenity) ? 'text-blue-600' : 'text-gray-400'
                      }`}
                    />
                    {amenity}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Utilities Included
              </label>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {utilitiesList.map((utility) => (
                  <button
                    key={utility}
                    onClick={() => toggleArrayItem(formData.utilities, utility, setFormData)}
                    className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                      formData.utilities.includes(utility)
                        ? 'border-green-600 bg-green-50 text-green-700'
                        : 'border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <CheckCircle
                      className={`mr-2 inline h-4 w-4 ${
                        formData.utilities.includes(utility) ? 'text-green-600' : 'text-gray-400'
                      }`}
                    />
                    {utility}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Media Upload (Manual Review) */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <h3 className="mb-2 font-semibold text-blue-900">Admin Review Required</h3>
              <p className="text-sm text-blue-800">
                Every new listing is reviewed by our team before it can go live, to keep the
                platform trustworthy. Upload the required media below.
              </p>
            </div>

            <h2 className="text-xl font-semibold">Media Upload</h2>

            {!uploadsEnabled() && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  File upload isn&apos;t available in this environment yet. You can continue without
                  media and add it later.
                </span>
              </div>
            )}

            {mediaUploadError && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{mediaUploadError}</span>
              </div>
            )}

            {/* 360° Video */}
            <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center transition-colors hover:border-blue-500">
              <Video className="mx-auto mb-3 h-12 w-12 text-gray-400" />
              <h3 className="mb-1 font-semibold">360° Walkthrough Video *</h3>
              <p className="mb-4 text-sm text-gray-600">Required for review</p>
              <label className="inline-block cursor-pointer rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700 disabled:opacity-50">
                {uploadingVideo ? 'Uploading…' : 'Upload Video'}
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleVideoUpload}
                  disabled={uploadingVideo}
                  className="hidden"
                />
              </label>
              {uploadedMedia.video360 && (
                <div className="mt-3 flex items-center justify-center gap-2 text-green-600">
                  <CheckCircle className="h-5 w-5" />
                  <span className="text-sm font-medium">
                    {uploadedMedia.video360.name} uploaded successfully
                  </span>
                </div>
              )}
            </div>

            {/* Room Photos */}
            <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center transition-colors hover:border-blue-500">
              <Camera className="mx-auto mb-3 h-12 w-12 text-gray-400" />
              <h3 className="mb-1 font-semibold">Photos of Every Room *</h3>
              <p className="mb-4 text-sm text-gray-600">
                Living room, bedrooms, kitchen, bathrooms, etc.
              </p>
              <label className="inline-block cursor-pointer rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700 disabled:opacity-50">
                {uploadingPhotos ? 'Uploading…' : 'Upload Photos'}
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handlePhotosUpload}
                  disabled={uploadingPhotos}
                  className="hidden"
                />
              </label>
              <p className="mt-2 text-xs text-gray-500">
                {uploadedMedia.photos.length} photos uploaded
              </p>
            </div>

            {/* Exterior Photos */}
            <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center transition-colors hover:border-blue-500">
              <Home className="mx-auto mb-3 h-12 w-12 text-gray-400" />
              <h3 className="mb-1 font-semibold">Exterior Building View *</h3>
              <p className="mb-4 text-sm text-gray-600">Front view, compound, parking area</p>
              <label className="inline-block cursor-pointer rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700 disabled:opacity-50">
                {uploadingExterior ? 'Uploading…' : 'Upload Photos'}
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleExteriorUpload}
                  disabled={uploadingExterior}
                  className="hidden"
                />
              </label>
              {uploadedMedia.exteriorPhotos.length > 0 && (
                <div className="mt-3 flex items-center justify-center gap-2 text-green-600">
                  <CheckCircle className="h-5 w-5" />
                  <span className="text-sm font-medium">
                    {uploadedMedia.exteriorPhotos.length} photo(s) uploaded successfully
                  </span>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
              <p className="text-sm text-yellow-800">
                <strong>Note:</strong> Our team reviews every submission for authenticity before it
                can be published. Listings that don't pass review will be rejected.
              </p>
            </div>
          </div>
        )}

        {/* Step 4: Review & Submit */}
        {step === 4 && (
          <div className="space-y-6">
            <h2 className="mb-4 text-xl font-semibold">Review Your Listing</h2>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Property Type</p>
                  <p className="font-semibold">{formData.propertyType || 'Not specified'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Location</p>
                  <p className="font-semibold">
                    {formData.city && formData.state
                      ? `${formData.city}, ${formData.state}`
                      : 'Not specified'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Units</p>
                  <p className="font-semibold">{units.length}</p>
                </div>
              </div>

              <div className="space-y-2">
                {units.map((unit, index) => {
                  const status = unitStatuses[index];
                  return (
                    <div
                      key={index}
                      className="flex items-center justify-between rounded-lg border border-gray-200 p-3 text-sm"
                    >
                      <div>
                        <p className="font-medium">
                          Unit {unit.unitNumber || index + 1} — {unit.bedrooms || '?'} bed,{' '}
                          {unit.bathrooms || '?'} bath
                        </p>
                        <p className="text-gray-600">
                          ₦
                          {(
                            (parseFloat(unit.rentAmount) || 0) +
                            (parseFloat(unit.serviceCharge) || 0)
                          ).toLocaleString()}
                          /{unit.rentFrequency}
                          {(parseFloat(unit.serviceCharge) || 0) > 0
                            ? ` (incl. ₦${parseFloat(unit.serviceCharge).toLocaleString()} service charge)`
                            : ''}
                        </p>
                      </div>
                      {status && (
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            status === 'created'
                              ? 'bg-green-100 text-green-700'
                              : status === 'failed'
                                ? 'bg-red-100 text-red-700'
                                : status === 'creating'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {status}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {anyUnitFailed && (
                <button
                  type="button"
                  onClick={handleRetryFailedUnits}
                  disabled={submitting}
                  className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  {submitting ? 'Retrying…' : 'Retry Failed Units'}
                </button>
              )}

              {formData.amenities.length > 0 && (
                <div>
                  <p className="mb-2 text-sm text-gray-600">Amenities</p>
                  <div className="flex flex-wrap gap-2">
                    {formData.amenities.map((amenity) => (
                      <span
                        key={amenity}
                        className="rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-700"
                      >
                        {amenity}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="mt-0.5 h-6 w-6 shrink-0 text-green-600" />
                  <div>
                    <h3 className="mb-1 font-semibold text-green-900">Media Status</h3>
                    <ul className="space-y-1 text-sm text-green-800">
                      <li>
                        {uploadedMedia.video360 ? '✓' : '○'} 360° walkthrough video
                        {uploadedMedia.video360 ? ' uploaded' : ' not uploaded'}
                      </li>
                      <li>
                        {uploadedMedia.photos.length > 0 ? '✓' : '○'} {uploadedMedia.photos.length}{' '}
                        room photo(s) uploaded
                      </li>
                      <li>
                        {uploadedMedia.exteriorPhotos.length > 0 ? '✓' : '○'}{' '}
                        {uploadedMedia.exteriorPhotos.length} exterior photo(s) uploaded
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <h3 className="mb-2 font-semibold text-blue-900">What Happens Next?</h3>
                <ol className="list-inside list-decimal space-y-1 text-sm text-blue-800">
                  <li>Our team reviews the listing details and media</li>
                  <li>You'll get an email once it's approved or if changes are needed</li>
                  <li>Once approved, you can publish it from the property's page</li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="mt-8 flex items-center justify-between border-t border-gray-200 pt-6">
          <button
            onClick={handlePrevious}
            disabled={step === 1}
            className="rounded-lg border border-gray-300 px-6 py-2 font-medium hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>

          {step < totalSteps ? (
            <button
              onClick={handleNext}
              className="rounded-lg bg-blue-600 px-6 py-2 font-medium text-white hover:bg-blue-700"
            >
              Next Step
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting || allUnitsCreated}
              className="flex items-center gap-2 rounded-lg bg-green-600 px-6 py-2 font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Upload className="h-5 w-5" />
              {submitting ? 'Submitting…' : 'Submit for Verification'}
            </button>
          )}
        </div>

        {submitError && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {submitError}
          </div>
        )}
      </div>
    </div>
  );
}
