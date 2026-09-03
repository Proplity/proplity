import { useState } from 'react';
import { useProperties } from '@/hooks/useProperties';
import { useAdCampaign, useCreateAdCampaign, useCancelAdCampaign } from '@/hooks/useAdCampaigns';
import type { Property } from '@/lib/api/types';
import {
  Search,
  MapPin,
  Bed,
  Bath,
  Square,
  Shield,
  Zap,
  Droplet,
  TrendingUp,
  CheckCircle,
  Star,
  Megaphone,
  X,
  AlertTriangle,
  Calendar,
} from 'lucide-react';

interface PropertyDiscoveryProps {
  onNavigate: (page: any) => void;
}

// Real ad status + the Create/Cancel button for one property card. A
// separate component so useAdCampaign (scoped to one propertyId) can be
// called once per card rather than needing a bulk endpoint just for this
// listing page. `refreshKey` in the parent's key= prop forces a refetch
// after the shared modal above completes an action for this property.
function AdStatusAndButton({
  property,
  onOpenModal,
}: {
  property: Property;
  onOpenModal: (type: 'create' | 'cancel', adId?: string) => void;
}) {
  const { data: activeAd } = useAdCampaign(property.id);

  return (
    <>
      {activeAd && (
        <div className="mb-3 flex items-center justify-between rounded-lg border border-orange-200 bg-orange-50 px-3 py-2">
          <div className="flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-orange-500" />
            <div>
              <p className="text-xs font-semibold text-orange-700">Ad Running</p>
              <p className="text-xs text-orange-600">
                {activeAd.impressions} impressions · {activeAd.clicks} clicks ·{' '}
                {activeAd.durationDays} days
              </p>
            </div>
          </div>
          <span className="flex items-center gap-1 text-xs font-medium text-orange-600">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-orange-500"></span>
            Live
          </span>
        </div>
      )}
      {activeAd ? (
        <button
          onClick={() => onOpenModal('cancel', activeAd.id)}
          className="flex items-center gap-1 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
        >
          <X className="h-3.5 w-3.5" />
          Cancel Ad
        </button>
      ) : (
        <button
          onClick={() => onOpenModal('create')}
          className="flex items-center gap-1 rounded-lg border border-orange-300 px-4 py-2 text-sm font-medium text-orange-600 hover:bg-orange-50"
        >
          <Megaphone className="h-3.5 w-3.5" />
          Create Ad
        </button>
      )}
    </>
  );
}

// Real Property/Unit fields mapped into what the card actually displays --
// a property can have multiple units at different price points, so the
// card shows the cheapest one. No scalar 0-10 water rating exists on
// Property (only a waterSupplyType enum), so that bar is replaced with a
// text label rather than an invented number.
function cardFields(property: Property) {
  const cheapestUnit = [...property.units].sort((a, b) => a.rentAmount - b.rentAmount)[0];
  const anyVacant = property.units.some((u) => u.status === 'VACANT');
  const freq = cheapestUnit?.listedPaymentFrequency.toLowerCase() ?? 'year';

  return {
    price: cheapestUnit
      ? `₦${cheapestUnit.rentAmount.toLocaleString()}/${freq}`
      : 'Price on request',
    bedrooms: cheapestUnit?.bedrooms ?? 0,
    bathrooms: cheapestUnit?.bathrooms ?? 0,
    sqft: cheapestUnit?.sqft ? `${cheapestUnit.sqft.toLocaleString()} sq ft` : 'N/A',
    status: anyVacant ? 'available' : 'occupied',
    verified: property.moderationStatus === 'APPROVED',
    features: cheapestUnit?.amenities ?? [],
    imageClass: 'bg-linear-to-br from-blue-100 to-blue-200',
    neighborhood: {
      safety: property.securityRating ? Math.round(property.securityRating / 10) : null,
      accessibility: property.roadConditionScore
        ? Math.round(property.roadConditionScore / 10)
        : null,
      powerReliability: property.powerReliabilityScore
        ? Math.round(property.powerReliabilityScore / 10)
        : null,
    },
  };
}

export function PropertyDiscovery({ onNavigate }: PropertyDiscoveryProps) {
  const { data: properties, loading, error } = useProperties();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [adModal, setAdModal] = useState<{
    type: 'create' | 'cancel';
    propertyId: string;
    propertyTitle: string;
    adId?: string;
  } | null>(null);
  const [adForm, setAdForm] = useState({ budget: 50_000, durationDays: 30 });
  const [adSuccess, setAdSuccess] = useState<string | null>(null);
  // Bumped after a successful create/cancel to remount each card's
  // AdStatusAndButton (see its key= below), forcing a real refetch instead
  // of the shared modal trying to reach into a specific card's own hook state.
  const [adRefreshKey, setAdRefreshKey] = useState(0);

  const createAd = useCreateAdCampaign(adModal?.propertyId ?? '');
  const cancelAd = useCancelAdCampaign(adModal?.propertyId ?? '');

  const handleCreateAd = async () => {
    if (!adModal) return;
    try {
      await createAd.submit(adForm);
      setAdSuccess(`Ad created successfully for ${adModal.propertyTitle}!`);
      setAdModal(null);
      setAdRefreshKey((k) => k + 1);
      setTimeout(() => setAdSuccess(null), 3000);
    } catch {
      // error state is already surfaced via createAd.error, shown in the modal
    }
  };

  const handleCancelAd = async () => {
    if (!adModal?.adId) return;
    try {
      await cancelAd.submit(adModal.adId);
      setAdSuccess(`Ad cancelled for ${adModal.propertyTitle}.`);
      setAdModal(null);
      setAdRefreshKey((k) => k + 1);
      setTimeout(() => setAdSuccess(null), 3000);
    } catch {
      // error state is already surfaced via cancelAd.error, shown in the modal
    }
  };

  const filters = [
    { id: 'all', label: 'All Properties' },
    { id: 'verified', label: 'Verified Only' },
    { id: 'high-trust', label: 'High Trust Score' },
    { id: 'new', label: 'New Listings' },
  ];

  const NEW_LISTING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
  const filteredProperties = properties.filter((property) => {
    if (selectedFilter === 'verified') return property.moderationStatus === 'APPROVED';
    if (selectedFilter === 'high-trust') return (property.trustScore ?? 0) >= 80;
    if (selectedFilter === 'new')
      return Date.now() - new Date(property.createdAt).getTime() < NEW_LISTING_WINDOW_MS;
    return true;
  });

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="mb-1 text-2xl font-semibold">Discover Properties</h1>
        <p className="text-gray-600">AI-powered property search with verified listings</p>
      </div>

      {/* AI Search Bar */}
      <div className="rounded-lg bg-gradient-to-r from-blue-50 to-green-50 p-6">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
            <Star className="h-4 w-4 text-white" />
          </div>
          <h3 className="font-semibold">AI-Powered Search</h3>
        </div>
        <div className="relative">
          <Search className="absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 transform text-gray-400" />
          <input
            type="text"
            placeholder='Try: "3-bedroom flat in Lekki, max ₦800k/year, ground floor, good security, near a school"'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-gray-300 py-3 pr-4 pl-12 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
        <p className="mt-2 text-xs text-gray-600">
          Our AI understands natural language and finds the best matches for you
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto">
        {filters.map((filter) => (
          <button
            key={filter.id}
            onClick={() => setSelectedFilter(filter.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
              selectedFilter === filter.id
                ? 'bg-blue-600 text-white'
                : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Property Listings */}
      {loading && <p className="text-sm text-gray-500">Loading properties…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {filteredProperties.map((property) => {
          const card = cardFields(property);
          return (
            <div
              key={property.id}
              className="overflow-hidden rounded-lg border border-gray-200 bg-white transition-shadow hover:shadow-lg"
            >
              {/* Property Image Placeholder */}
              <div className={`h-48 ${card.imageClass} relative flex items-center justify-center`}>
                {card.verified && (
                  <div className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-green-500 px-3 py-1 text-xs font-medium text-white">
                    <Shield className="h-3 w-3" />
                    Verified
                  </div>
                )}
                <div className="text-sm text-gray-400">360° View Available</div>
              </div>

              <div className="p-5">
                {/* Trust Score */}
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-50">
                      <span className="text-sm font-semibold text-green-600">
                        {property.trustScore ?? '—'}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Trust Score</p>
                      <p className="text-xs font-medium text-green-600">Excellent</p>
                    </div>
                  </div>
                  <span className="text-xl font-semibold text-blue-600">{card.price}</span>
                </div>

                <h3 className="mb-1 text-lg font-semibold">{property.name}</h3>
                <div className="mb-4 flex items-center gap-1 text-gray-600">
                  <MapPin className="h-4 w-4" />
                  <span className="text-sm">
                    {property.address}, {property.city}
                  </span>
                </div>

                {/* Property Details */}
                <div className="mb-4 flex gap-4 border-b border-gray-200 pb-4">
                  <div className="flex items-center gap-1 text-sm text-gray-600">
                    <Bed className="h-4 w-4" />
                    <span>{card.bedrooms} Beds</span>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-gray-600">
                    <Bath className="h-4 w-4" />
                    <span>{card.bathrooms} Baths</span>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-gray-600">
                    <Square className="h-4 w-4" />
                    <span>{card.sqft}</span>
                  </div>
                </div>

                {/* Features */}
                {card.features.length > 0 && (
                  <div className="mb-4 flex flex-wrap gap-2">
                    {card.features.map((feature, index) => (
                      <span
                        key={index}
                        className="rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700"
                      >
                        {feature}
                      </span>
                    ))}
                  </div>
                )}

                {/* Neighborhood Intelligence */}
                <div className="mb-4 rounded-lg bg-gray-50 p-3">
                  <p className="mb-2 text-xs font-medium text-gray-700">
                    Neighborhood Intelligence
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        ['Safety', card.neighborhood.safety, 'bg-green-500'],
                        ['Access', card.neighborhood.accessibility, 'bg-blue-500'],
                        ['Power', card.neighborhood.powerReliability, 'bg-yellow-500'],
                      ] as const
                    ).map(([label, value, color]) => (
                      <div key={label} className="flex items-center justify-between">
                        <span className="text-xs text-gray-600">{label}</span>
                        <div className="flex items-center gap-1">
                          <div className="h-1.5 w-12 overflow-hidden rounded-full bg-gray-200">
                            <div
                              className={`h-full ${color}`}
                              style={{ width: `${(value ?? 0) * 10}%` }}
                            ></div>
                          </div>
                          <span className="text-xs font-medium">{value ?? '—'}/10</span>
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">Water</span>
                      <span className="text-xs font-medium">
                        {property.waterSupplyType.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                </div>

                <AdStatusAndButton
                  key={`${property.id}-${adRefreshKey}`}
                  property={property}
                  onOpenModal={(type, adId) =>
                    setAdModal({
                      type,
                      propertyId: property.id,
                      propertyTitle: property.name,
                      adId,
                    })
                  }
                />

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() =>
                      onNavigate({ type: 'schedule-viewing', propertyId: property.id })
                    }
                    className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Schedule Tour
                  </button>
                  <button
                    onClick={() =>
                      onNavigate({
                        type: 'property-detail',
                        propertyId: property.id,
                      })
                    }
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
                  >
                    Details
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {filteredProperties.length === 0 && !loading && (
          <p className="col-span-full py-8 text-center text-sm text-gray-400">
            No properties match this filter.
          </p>
        )}
      </div>

      {/* Success Toast */}
      {adSuccess && (
        <div className="fixed right-6 bottom-6 z-50 flex items-center gap-3 rounded-xl bg-gray-900 px-5 py-3 text-white shadow-xl">
          <CheckCircle className="h-5 w-5 shrink-0 text-green-400" />
          <span className="text-sm">{adSuccess}</span>
        </div>
      )}

      {/* Create Ad Modal */}
      {adModal?.type === 'create' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setAdModal(null)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100">
                  <Megaphone className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <h2 className="font-semibold">Create Rental Ad</h2>
                  <p className="text-xs text-gray-500">{adModal.propertyTitle}</p>
                </div>
              </div>
              <button
                onClick={() => setAdModal(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <div className="space-y-4 p-6">
              <p className="text-sm text-gray-600">
                Your ad will be shown to prospective tenants browsing properties on Proplity. Set
                your budget and duration below.
              </p>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Ad Budget</label>
                <select
                  value={adForm.budget}
                  onChange={(e) => setAdForm((f) => ({ ...f, budget: Number(e.target.value) }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
                >
                  <option value={25_000}>₦25,000</option>
                  <option value={50_000}>₦50,000</option>
                  <option value={100_000}>₦100,000</option>
                  <option value={200_000}>₦200,000</option>
                  <option value={500_000}>₦500,000</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Ad Duration</label>
                <select
                  value={adForm.durationDays}
                  onChange={(e) =>
                    setAdForm((f) => ({ ...f, durationDays: Number(e.target.value) }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
                >
                  <option value={7}>7 days</option>
                  <option value={14}>14 days</option>
                  <option value={30}>30 days</option>
                  <option value={60}>60 days</option>
                  <option value={90}>90 days</option>
                </select>
              </div>
              <div className="flex items-start gap-2 rounded-lg border border-orange-100 bg-orange-50 p-3">
                <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
                <p className="text-xs text-orange-700">
                  Your ad will go live immediately and appear in search results and the featured
                  listings on the landing page.
                </p>
              </div>
              {createAd.error && <p className="text-sm text-red-600">{createAd.error}</p>}
            </div>
            <div className="flex gap-3 border-t border-gray-200 p-6">
              <button
                onClick={() => setAdModal(null)}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateAd}
                disabled={createAd.submitting}
                className="flex-1 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {createAd.submitting ? 'Launching…' : 'Launch Ad'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Ad Modal */}
      {adModal?.type === 'cancel' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setAdModal(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle className="h-6 w-6 text-red-500" />
              </div>
              <h2 className="mb-2 font-semibold">Cancel Ad?</h2>
              <p className="mb-1 text-sm text-gray-600">
                You are about to cancel the running ad for:
              </p>
              <p className="mb-4 text-sm font-medium text-gray-800">{adModal.propertyTitle}</p>
              <p className="mb-6 text-xs text-gray-500">
                The ad will stop immediately and will no longer appear to prospective tenants.
                Unused budget will not be refunded.
              </p>
              {cancelAd.error && <p className="mb-4 text-sm text-red-600">{cancelAd.error}</p>}
              <div className="flex gap-3">
                <button
                  onClick={() => setAdModal(null)}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
                >
                  Keep Ad
                </button>
                <button
                  onClick={handleCancelAd}
                  disabled={cancelAd.submitting}
                  className="flex-1 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {cancelAd.submitting ? 'Cancelling…' : 'Yes, Cancel'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
