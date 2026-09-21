'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Bath,
  Bed,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Shield,
  Square,
  X,
} from 'lucide-react';
import type { Property } from '@/lib/api/types';

export const FEATURED_GRADIENTS = [
  'bg-linear-to-br from-blue-400 to-blue-600',
  'bg-linear-to-br from-green-400 to-green-600',
  'bg-linear-to-br from-purple-400 to-purple-600',
  'bg-linear-to-br from-orange-400 to-orange-600',
  'bg-linear-to-br from-pink-400 to-pink-600',
  'bg-linear-to-br from-teal-400 to-teal-600',
];

// A property can have several units at different prices -- the card and the
// popup both show the cheapest one, same convention as PropertyDiscovery.
export function featuredFields(property: Property) {
  const cheapestUnit = [...property.units].sort((a, b) => a.rentAmount - b.rentAmount)[0];
  const freq = cheapestUnit?.listedPaymentFrequency.toLowerCase() ?? 'year';
  return {
    price: cheapestUnit
      ? `₦${cheapestUnit.rentAmount.toLocaleString()}/${freq === 'annual' ? 'year' : freq}`
      : 'Price on request',
    bedrooms: cheapestUnit?.bedrooms ?? 0,
    bathrooms: cheapestUnit?.bathrooms ?? 0,
    sqft: cheapestUnit?.sqft ? `${cheapestUnit.sqft.toLocaleString()} sq ft` : null,
    amenities: cheapestUnit?.amenities ?? [],
    verified: property.moderationStatus === 'APPROVED',
  };
}

const scoreRows = (p: Property) =>
  [
    ['Security', p.securityRating],
    ['Power', p.powerReliabilityScore],
    ['Roads', p.roadConditionScore],
  ] as const;

export function FeaturedPropertyModal({
  properties,
  index,
  onIndexChange,
  onClose,
}: {
  properties: Property[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const count = properties.length;
  const property = properties[index];
  const step = (delta: number) => onIndexChange((index + delta + count) % count);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onIndexChange((index - 1 + count) % count);
      if (e.key === 'ArrowRight') onIndexChange((index + 1) % count);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [index, count, onIndexChange, onClose]);

  if (!property) return null;
  const card = featuredFields(property);
  const gradient = FEATURED_GRADIENTS[index % FEATURED_GRADIENTS.length];

  const arrowClass =
    'absolute top-24 z-10 flex h-11 w-11 -translate-y-1/2 sm:top-1/2 items-center justify-center rounded-full bg-white text-gray-800 shadow-lg transition-colors hover:bg-blue-50 focus:ring-2 focus:ring-blue-500 focus:outline-none';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={property.name}
    >
      <div className="relative w-full max-w-xl" onClick={(e) => e.stopPropagation()}>
        {count > 1 && (
          <>
            <button
              onClick={() => step(-1)}
              aria-label="Previous property"
              className={`${arrowClass} left-2 sm:-left-14`}
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              onClick={() => step(1)}
              aria-label="Next property"
              className={`${arrowClass} right-2 sm:-right-14`}
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}

        <div className="max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
          <div className={`relative h-48 ${gradient} flex items-center justify-center`}>
            {card.verified && (
              <div className="absolute top-3 left-3 flex items-center gap-1 rounded-full bg-green-500 px-3 py-1 text-xs font-semibold text-white">
                <Shield className="h-3 w-3" />
                AI Verified
              </div>
            )}
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute top-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-gray-700 hover:bg-white"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="rounded-lg bg-black/30 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm">
              360° View Available
            </div>
            <span className="absolute bottom-3 left-3 rounded-full bg-black/40 px-3 py-1 text-xs font-medium text-white">
              {index + 1} / {count}
            </span>
          </div>

          <div className="p-6">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900">{property.name}</h3>
                <p className="mt-1 flex items-center gap-1 text-sm text-gray-600">
                  <MapPin className="h-4 w-4 shrink-0" />
                  {property.address}, {property.city}
                </p>
              </div>
              {property.trustScore != null && (
                <div className="flex shrink-0 flex-col items-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-sm font-bold text-green-600">
                    {property.trustScore}
                  </div>
                  <span className="mt-1 text-xs text-gray-500">Trust</span>
                </div>
              )}
            </div>

            {property.description && (
              <p className="mb-4 text-sm leading-relaxed text-gray-600">{property.description}</p>
            )}

            <div className="mb-4 flex gap-5 border-b border-gray-200 pb-4 text-sm text-gray-600">
              <span className="flex items-center gap-1">
                <Bed className="h-4 w-4" />
                {card.bedrooms} Bed
              </span>
              <span className="flex items-center gap-1">
                <Bath className="h-4 w-4" />
                {card.bathrooms} Bath
              </span>
              {card.sqft && (
                <span className="flex items-center gap-1">
                  <Square className="h-4 w-4" />
                  {card.sqft}
                </span>
              )}
            </div>

            {card.amenities.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-2">
                {card.amenities.map((a) => (
                  <span
                    key={a}
                    className="rounded-full bg-blue-50 px-2.5 py-1 text-xs text-blue-700"
                  >
                    {a}
                  </span>
                ))}
              </div>
            )}

            <div className="mb-5 grid grid-cols-3 gap-3 rounded-lg bg-gray-50 p-3">
              {scoreRows(property).map(([label, value]) => (
                <div key={label} className="text-center">
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {value != null ? `${Math.round(value / 10)}/10` : '—'}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-2xl font-bold text-blue-600">{card.price}</p>
              <Link
                href={`/properties/${property.id}`}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 font-medium whitespace-nowrap text-white transition-colors hover:bg-blue-700"
              >
                View Details
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
