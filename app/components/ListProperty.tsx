import { useState } from 'react';
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
} from 'lucide-react';

interface ListPropertyProps {
  onBack: () => void;
  userRole: 'manager' | 'landlord';
}

export function ListProperty({ onBack, userRole }: ListPropertyProps) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    propertyType: '',
    address: '',
    city: '',
    state: '',
    bedrooms: '',
    bathrooms: '',
    sqft: '',
    rentAmount: '',
    rentFrequency: 'yearly',
    description: '',
    amenities: [] as string[],
    utilities: [] as string[],
  });

  const [uploadedMedia, setUploadedMedia] = useState({
    photos: [] as string[],
    video360: false,
    exteriorPhotos: false,
  });

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

  const handleSubmit = () => {
    alert('Property listing submitted for AI verification! You will be notified once approved.');
    onBack();
  };

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
        <button
          onClick={onBack}
          className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Dashboard
        </button>
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

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  <Bed className="mr-1 inline h-4 w-4" />
                  Bedrooms *
                </label>
                <input
                  type="number"
                  value={formData.bedrooms}
                  onChange={(e) => setFormData({ ...formData, bedrooms: e.target.value })}
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
                  value={formData.bathrooms}
                  onChange={(e) => setFormData({ ...formData, bathrooms: e.target.value })}
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
                  value={formData.sqft}
                  onChange={(e) => setFormData({ ...formData, sqft: e.target.value })}
                  placeholder="e.g., 1200"
                  min="0"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  <DollarSign className="mr-1 inline h-4 w-4" />
                  Rent Amount (₦) *
                </label>
                <input
                  type="number"
                  value={formData.rentAmount}
                  onChange={(e) => setFormData({ ...formData, rentAmount: e.target.value })}
                  placeholder="e.g., 850000"
                  min="0"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Rent Frequency *
                </label>
                <select
                  value={formData.rentFrequency}
                  onChange={(e) => setFormData({ ...formData, rentFrequency: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="yearly">Yearly</option>
                  <option value="monthly">Monthly (Coming Soon)</option>
                </select>
              </div>
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

        {/* Step 3: Media Upload (AI Verification) */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <h3 className="mb-2 font-semibold text-blue-900">🤖 AI Verification Required</h3>
              <p className="text-sm text-blue-800">
                All properties must pass AI verification to ensure trust and eliminate fraud. Upload
                the required media below.
              </p>
            </div>

            <h2 className="text-xl font-semibold">Media Upload</h2>

            {/* 360° Video */}
            <div className="cursor-pointer rounded-lg border-2 border-dashed border-gray-300 p-8 text-center transition-colors hover:border-blue-500">
              <Video className="mx-auto mb-3 h-12 w-12 text-gray-400" />
              <h3 className="mb-1 font-semibold">360° Walkthrough Video *</h3>
              <p className="mb-4 text-sm text-gray-600">Required for AI verification</p>
              <button className="rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700">
                Upload Video
              </button>
              {uploadedMedia.video360 && (
                <div className="mt-3 flex items-center justify-center gap-2 text-green-600">
                  <CheckCircle className="h-5 w-5" />
                  <span className="text-sm font-medium">Video uploaded successfully</span>
                </div>
              )}
            </div>

            {/* Room Photos */}
            <div className="cursor-pointer rounded-lg border-2 border-dashed border-gray-300 p-8 text-center transition-colors hover:border-blue-500">
              <Camera className="mx-auto mb-3 h-12 w-12 text-gray-400" />
              <h3 className="mb-1 font-semibold">Photos of Every Room *</h3>
              <p className="mb-4 text-sm text-gray-600">
                Living room, bedrooms, kitchen, bathrooms, etc.
              </p>
              <button className="rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700">
                Upload Photos
              </button>
              <p className="mt-2 text-xs text-gray-500">
                {uploadedMedia.photos.length} photos uploaded
              </p>
            </div>

            {/* Exterior Photos */}
            <div className="cursor-pointer rounded-lg border-2 border-dashed border-gray-300 p-8 text-center transition-colors hover:border-blue-500">
              <Home className="mx-auto mb-3 h-12 w-12 text-gray-400" />
              <h3 className="mb-1 font-semibold">Exterior Building View *</h3>
              <p className="mb-4 text-sm text-gray-600">Front view, compound, parking area</p>
              <button className="rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700">
                Upload Photos
              </button>
              {uploadedMedia.exteriorPhotos && (
                <div className="mt-3 flex items-center justify-center gap-2 text-green-600">
                  <CheckCircle className="h-5 w-5" />
                  <span className="text-sm font-medium">Photos uploaded successfully</span>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
              <p className="text-sm text-yellow-800">
                <strong>Note:</strong> Our AI will validate media authenticity, detect duplicates,
                and check for stock images. Listings failing verification will be rejected.
              </p>
            </div>

            {/* Mock upload for demo */}
            <button
              onClick={() => {
                setUploadedMedia({
                  photos: ['1', '2', '3'],
                  video360: true,
                  exteriorPhotos: true,
                });
              }}
              className="w-full rounded-lg bg-gray-100 py-2 text-sm text-gray-700 hover:bg-gray-200"
            >
              (Demo: Simulate Upload Complete)
            </button>
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
                  <p className="text-sm text-gray-600">Bedrooms</p>
                  <p className="font-semibold">{formData.bedrooms || 'Not specified'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Bathrooms</p>
                  <p className="font-semibold">{formData.bathrooms || 'Not specified'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Size</p>
                  <p className="font-semibold">
                    {formData.sqft ? `${formData.sqft} sq ft` : 'Not specified'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Rent</p>
                  <p className="font-semibold text-green-600">
                    {formData.rentAmount
                      ? `₦${parseInt(formData.rentAmount).toLocaleString()}/${formData.rentFrequency}`
                      : 'Not specified'}
                  </p>
                </div>
              </div>

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
                  <CheckCircle className="mt-0.5 h-6 w-6 flex-shrink-0 text-green-600" />
                  <div>
                    <h3 className="mb-1 font-semibold text-green-900">Media Verification Status</h3>
                    <ul className="space-y-1 text-sm text-green-800">
                      <li>✓ 360° walkthrough video uploaded</li>
                      <li>✓ {uploadedMedia.photos.length} room photos uploaded</li>
                      <li>✓ Exterior photos uploaded</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <h3 className="mb-2 font-semibold text-blue-900">What Happens Next?</h3>
                <ol className="list-inside list-decimal space-y-1 text-sm text-blue-800">
                  <li>AI validates media authenticity and property details</li>
                  <li>System checks for duplicate listings</li>
                  <li>Neighborhood intelligence data is generated</li>
                  <li>You'll be notified once listing is approved (usually within 24 hours)</li>
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
              className="flex items-center gap-2 rounded-lg bg-green-600 px-6 py-2 font-medium text-white hover:bg-green-700"
            >
              <Upload className="h-5 w-5" />
              Submit for Verification
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
