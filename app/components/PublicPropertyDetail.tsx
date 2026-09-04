import { useState } from 'react';
import { Logo } from './Logo';
import {
  MapPin,
  Bed,
  Bath,
  Square,
  Star,
  Shield,
  Zap,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  X,
  ArrowRight,
  Calendar,
  Home,
  Wifi,
  Car,
  Droplets,
  Lock,
  Wind,
  Maximize2,
  BarChart3,
} from 'lucide-react';
import { useProperty, useProperties } from '@/hooks/useProperties';

interface PublicPropertyDetailProps {
  propertyId: string;
  onGoHome: () => void;
  onGetStarted: () => void; // triggers login
  onViewPricing: () => void;
  onViewContact: () => void;
  onViewAbout: () => void;
  onViewLandlordPage: () => void;
  onViewTenantPage: () => void;
  onViewVendorPage: () => void;
}

/* ── Premium upgrade modal ── */
function NeighbourhoodModal({
  onClose,
  onUpgrade,
}: {
  onClose: () => void;
  onUpgrade: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl bg-white p-7 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X className="h-5 w-5" />
        </button>

        <h3 className="mb-5 text-lg font-bold text-gray-900">Premium Features Include:</h3>

        <ul className="mb-7 space-y-3">
          {[
            'Unlimited neighbourhood reports',
            'PDF download capability',
            'Monthly updated data',
            'Historical trend analysis',
            'Priority customer support',
          ].map((f) => (
            <li key={f} className="flex items-center gap-3 text-sm text-gray-700">
              <CheckCircle className="h-5 w-5 flex-shrink-0 text-green-500" />
              {f}
            </li>
          ))}
        </ul>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border-2 border-gray-200 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
          >
            Maybe Later
          </button>
          <button
            onClick={onUpgrade}
            className="flex-1 rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-violet-700"
          >
            Upgrade Now
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Login-required modal ── */
function LoginRequiredModal({
  onClose,
  onLogin,
  message,
}: {
  onClose: () => void;
  onLogin: () => void;
  message: string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-7 text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50">
          <Lock className="h-7 w-7 text-blue-600" />
        </div>
        <h3 className="mb-2 text-lg font-bold text-gray-900">Login Required</h3>
        <p className="mb-6 text-sm text-gray-500">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border-2 border-gray-200 py-3 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onLogin}
            className="flex-1 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
          >
            Sign In
          </button>
        </div>
      </div>
    </div>
  );
}

export function PublicPropertyDetail({
  propertyId,
  onGoHome,
  onGetStarted,
  onViewPricing,
  onViewContact,
  onViewAbout,
  onViewLandlordPage,
  onViewTenantPage,
  onViewVendorPage,
}: PublicPropertyDetailProps) {
  const { data: property, loading } = useProperty(propertyId);
  const { data: allProperties } = useProperties();
  const [activeImg, setActiveImg] = useState(0);
  const [showNeighModal, setShowNeighModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginModalMsg, setLoginModalMsg] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');

  const requireLogin = (msg: string) => {
    setLoginModalMsg(msg);
    setShowLoginModal(true);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-500">Loading…</div>
    );
  }
  if (!property) {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-500">
        Property not found.
      </div>
    );
  }

  // A property can have multiple units at different prices -- the booking
  // widget uses the cheapest one, same convention as PropertyDiscovery's card.
  const cheapestUnit = [...property.units].sort((a, b) => a.rentAmount - b.rentAmount)[0];
  const yearlyAmount = cheapestUnit?.rentAmount ?? 0;
  const freq = cheapestUnit?.listedPaymentFrequency ?? 'ANNUAL';
  const priceLabel = `₦${yearlyAmount.toLocaleString()}`;
  const monthly = `₦${Math.round(yearlyAmount / 12).toLocaleString()}`;
  const verified = property.moderationStatus === 'APPROVED';
  const similar = allProperties.filter((p) => p.id !== propertyId).slice(0, 3);

  // No multi-image gallery exists in the schema beyond imageUrl/video360Url/
  // exteriorPhotoUrl -- gradient placeholders fill in for the 3 remaining
  // gallery slots the original mock design used.
  const galleryPlaceholders = [
    'bg-linear-to-br from-blue-100 to-blue-200',
    'bg-linear-to-br from-green-100 to-green-200',
    'bg-linear-to-br from-purple-100 to-purple-200',
    'bg-linear-to-br from-orange-100 to-orange-200',
  ];

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* ── Nav ── */}
      <nav className="sticky top-0 z-40 border-b border-gray-100 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <button onClick={onGoHome} className="focus:outline-none">
            <Logo />
          </button>
          <div className="hidden items-center gap-8 md:flex">
            <div className="group relative">
              <button className="flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-gray-900">
                Features
                <svg
                  className="h-4 w-4 text-gray-400 transition-transform group-hover:rotate-180"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div className="absolute top-full left-0 hidden pt-2 group-hover:block">
                <div className="w-52 rounded-xl border border-gray-100 bg-white py-2 shadow-lg">
                  {[
                    { label: 'For Landlords', action: onViewLandlordPage },
                    { label: 'For Tenants', action: onViewTenantPage },
                    {
                      label: 'For Service Providers',
                      action: onViewVendorPage,
                    },
                  ].map((item) => (
                    <button
                      key={item.label}
                      onClick={item.action}
                      className="w-full px-4 py-2.5 text-left text-sm text-gray-700 transition-colors hover:bg-blue-50 hover:text-blue-600"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <button
              onClick={onGoHome}
              className="text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              How it Works
            </button>
            <button
              onClick={onViewContact}
              className="text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              Contact Us
            </button>
            <button
              onClick={onViewAbout}
              className="text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              About Us
            </button>
            <button
              onClick={onViewPricing}
              className="text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              Pricing
            </button>
          </div>
          <button
            onClick={onGetStarted}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
          >
            Get Started
          </button>
        </div>
      </nav>

      {/* ── Photo gallery ── */}
      <section className="mx-auto w-full max-w-7xl px-6 pt-8 pb-4">
        <div className="grid h-[380px] grid-cols-4 grid-rows-2 gap-2 overflow-hidden rounded-2xl">
          {/* main large */}
          <div
            className={`col-span-2 row-span-2 ${galleryPlaceholders[0]} relative flex items-end p-4`}
          >
            {verified && (
              <span className="flex items-center gap-1 rounded-full bg-green-500 px-3 py-1 text-xs font-bold text-white">
                <Shield className="h-3 w-3" /> Verified
              </span>
            )}
          </div>
          {/* 3 smaller */}
          {galleryPlaceholders.slice(1, 3).map((img: string, i: number) => (
            <div key={i} className={`${img} relative`} />
          ))}
          {/* 4th with 360 badge */}
          <div className={`${galleryPlaceholders[3]} relative flex items-center justify-center`}>
            <div className="flex items-center gap-2 rounded-xl bg-black/50 px-3 py-2 backdrop-blur-sm">
              <Maximize2 className="h-4 w-4 text-white" />
              <span className="text-xs font-semibold text-white">360° View</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Main content ── */}
      <section className="mx-auto w-full max-w-7xl px-6 py-8">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
          {/* Left — property info */}
          <div className="space-y-8 lg:col-span-2">
            {/* Title + badges */}
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {verified && (
                  <span className="flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700">
                    <CheckCircle className="h-3.5 w-3.5" /> Verified Listing
                  </span>
                )}
                <span className="flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">
                  <Maximize2 className="h-3.5 w-3.5" /> Virtual Tour
                </span>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-700">
                  ID #{propertyId.slice(0, 8).toUpperCase()}
                </span>
              </div>

              <h1 className="mb-2 text-2xl font-bold text-gray-900">{property.name}</h1>

              <div className="mb-3 flex flex-wrap items-center gap-4 text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4 text-gray-400" />
                  {property.address}, {property.city}
                </span>
                <span className="flex items-center gap-1">
                  <Bed className="h-4 w-4 text-gray-400" />
                  {cheapestUnit?.bedrooms ?? 0} Bedrooms
                </span>
                <span className="flex items-center gap-1">
                  <Bath className="h-4 w-4 text-gray-400" />
                  {cheapestUnit?.bathrooms ?? 0} Bathrooms
                </span>
                <span className="flex items-center gap-1">
                  <Square className="h-4 w-4 text-gray-400" />
                  {cheapestUnit?.sqft ? `${cheapestUnit.sqft.toLocaleString()} sq ft` : 'N/A'}
                </span>
              </div>

              {/* Stars */}
              <div className="flex items-center gap-2">
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-4 w-4 ${i < Math.round(property.reviewStats.averageRating ?? 0) ? 'fill-yellow-400 text-yellow-400' : 'fill-gray-200 text-gray-200'}`}
                    />
                  ))}
                </div>
                <span className="text-sm text-gray-600">
                  {property.reviewStats.averageRating?.toFixed(1) ?? 'No rating yet'} (
                  {property.reviewStats.count} reviews)
                </span>
              </div>
            </div>

            {/* Description */}
            <div>
              <h2 className="mb-3 text-lg font-bold text-gray-900">Description</h2>
              <p className="text-sm leading-relaxed text-gray-600">
                {property.description || 'No description provided yet.'}
              </p>
            </div>

            {/* Amenities */}
            <div>
              <h2 className="mb-4 text-lg font-bold text-gray-900">Amenities & Features</h2>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {(cheapestUnit?.amenities ?? []).map((label) => {
                  const Icon = CheckCircle;
                  return (
                    <div key={label} className="flex items-center gap-2.5 text-sm text-gray-700">
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50">
                        <Icon className="h-4 w-4 text-blue-600" />
                      </div>
                      {label}
                    </div>
                  );
                })}
                {(cheapestUnit?.amenities ?? []).length === 0 && (
                  <p className="text-sm text-gray-400">No amenities listed yet.</p>
                )}
              </div>
            </div>
          </div>

          {/* Right — booking sidebar */}
          <div className="space-y-4">
            <div className="sticky top-24 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-5">
                <span className="text-2xl font-extrabold text-gray-900">{monthly}</span>
                <span className="text-sm text-gray-500"> /month</span>
                <p className="mt-0.5 text-xs text-gray-400">
                  {priceLabel}/{freq.toLowerCase()}
                </p>
              </div>

              {/* Date pickers */}
              <div className="mb-4 space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">From</label>
                  <div className="relative">
                    <Calendar className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="date"
                      value={checkIn}
                      onChange={(e) => setCheckIn(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 py-2.5 pr-3 pl-9 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">To</label>
                  <div className="relative">
                    <Calendar className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="date"
                      value={checkOut}
                      onChange={(e) => setCheckOut(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 py-2.5 pr-3 pl-9 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Total estimate */}
              <div className="mb-4 rounded-xl bg-gray-50 p-3 text-center text-xs text-gray-500">
                {checkIn && checkOut ? (
                  <span className="font-semibold text-gray-800">
                    Estimated: {priceLabel}/{freq.toLowerCase()}
                  </span>
                ) : (
                  'Select dates to calculate total'
                )}
              </div>

              {/* Transaction info */}
              <div className="mb-5 space-y-2 text-xs text-gray-500">
                <div className="flex justify-between">
                  <span>Base rent</span>
                  <span className="font-medium text-gray-800">{priceLabel}</span>
                </div>
                <div className="flex justify-between">
                  <span>Agency fee (5%)</span>
                  <span className="font-medium text-gray-800">₦60,000</span>
                </div>
                <div className="flex justify-between">
                  <span>Legal fee</span>
                  <span className="font-medium text-gray-800">₦30,000</span>
                </div>
                <div className="mt-2 flex justify-between border-t border-gray-200 pt-2">
                  <span className="font-semibold text-gray-700">Total</span>
                  <span className="font-bold text-gray-900">
                    ₦{(yearlyAmount + 90000).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* CTA buttons */}
              <button
                onClick={() => requireLogin('Please sign in to schedule a property inspection.')}
                className="mb-2.5 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
              >
                <Calendar className="h-4 w-4" />
                Schedule Inspection
              </button>

              <button
                onClick={() => requireLogin('Please sign in to apply for this property.')}
                className="w-full rounded-xl border-2 border-blue-600 py-3 text-sm font-semibold text-blue-600 transition-colors hover:bg-blue-50"
              >
                Apply for this Property
              </button>

              {/* Neighbourhood report */}
              <div className="mt-4 border-t border-gray-100 pt-4">
                <button
                  onClick={() => setShowNeighModal(true)}
                  className="group flex w-full items-center justify-between rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 transition-colors hover:bg-violet-100"
                >
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-violet-600" />
                    <span className="text-sm font-semibold text-violet-700">
                      Neighbourhood Report
                    </span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-violet-500 transition-transform group-hover:translate-x-0.5" />
                </button>
                <p className="mt-1.5 text-center text-xs text-gray-400">
                  Security, roads, flooding & amenities
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Similar Properties ── */}
      <section className="mx-auto w-full max-w-7xl px-6 py-12">
        <h2 className="mb-6 text-xl font-bold text-gray-900">Similar Properties</h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {similar.map((p) => {
            const unit = [...p.units].sort((a, b) => a.rentAmount - b.rentAmount)[0];
            return (
              <div
                key={p.id}
                className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-lg"
              >
                <div className="relative flex h-36 items-start bg-linear-to-br from-blue-100 to-blue-200 p-3">
                  <span className="flex items-center gap-1 rounded-full bg-green-500 px-2 py-0.5 text-xs font-bold text-white">
                    <Shield className="h-3 w-3" /> 360° View Available
                  </span>
                </div>
                <div className="p-4">
                  <h3 className="mb-1 text-sm font-bold text-gray-900">{p.name}</h3>
                  <div className="mb-3 flex items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Bed className="h-3 w-3" />
                      {unit?.bedrooms ?? 0} Bed
                    </span>
                    <span className="flex items-center gap-1">
                      <Bath className="h-3 w-3" />
                      {unit?.bathrooms ?? 0} Bath
                    </span>
                    <span>{unit?.sqft ? `${unit.sqft.toLocaleString()} sq ft` : 'N/A'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-blue-600">
                      {unit ? `₦${unit.rentAmount.toLocaleString()}` : 'Price on request'}
                    </span>
                    <button
                      onClick={onGetStarted}
                      className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
                    >
                      View Details <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="bg-blue-700 px-6 py-14 text-center text-white">
        <h2 className="mb-2 text-2xl font-bold">Ready to Transform Your Property Management?</h2>
        <p className="mb-6 text-sm text-blue-200">
          Join thousands of property managers already using Proplity.
        </p>
        <button
          onClick={onGetStarted}
          className="rounded-xl bg-white px-7 py-3 text-sm font-bold text-blue-700 transition-colors hover:bg-blue-50"
        >
          Start Free Trial →
        </button>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-gray-900 px-6 py-12 text-gray-400">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-10 md:grid-cols-4">
          <div>
            <Logo className="opacity-90 brightness-0 invert" />
            <p className="mt-3 text-xs leading-relaxed text-gray-500">
              Nigeria's first AI-native property management platform.
            </p>
          </div>
          {[
            {
              heading: 'Product',
              links: ['Features', 'Pricing', 'Blog', 'Integrations'],
            },
            { heading: 'Company', links: ['About Us', 'Careers', 'Contact'] },
            { heading: 'Legal', links: ['Privacy Policy', 'Terms of Service'] },
          ].map((col) => (
            <div key={col.heading}>
              <p className="mb-3 text-sm font-semibold text-white">{col.heading}</p>
              <ul className="space-y-2">
                {col.links.map((l) => (
                  <li key={l}>
                    <a href="#" className="text-xs transition-colors hover:text-white">
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mx-auto mt-10 max-w-5xl border-t border-gray-800 pt-6 text-center text-xs text-gray-600">
          © 2026 Proplity. All rights reserved.
        </div>
      </footer>

      {/* ── Modals ── */}
      {showNeighModal && (
        <NeighbourhoodModal
          onClose={() => setShowNeighModal(false)}
          onUpgrade={() => {
            setShowNeighModal(false);
            onViewPricing();
          }}
        />
      )}
      {showLoginModal && (
        <LoginRequiredModal
          onClose={() => setShowLoginModal(false)}
          onLogin={() => {
            setShowLoginModal(false);
            onGetStarted();
          }}
          message={loginModalMsg}
        />
      )}
    </div>
  );
}
