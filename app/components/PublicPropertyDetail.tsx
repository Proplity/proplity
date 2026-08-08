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

interface PublicPropertyDetailProps {
  propertyId: number;
  onGoHome: () => void;
  onGetStarted: () => void; // triggers login
  onViewPricing: () => void;
  onViewContact: () => void;
  onViewAbout: () => void;
  onViewLandlordPage: () => void;
  onViewTenantPage: () => void;
  onViewVendorPage: () => void;
}

/* ── Shared property data (keyed by id) ── */
const PROPERTIES: Record<number, any> = {
  1: {
    title: '3 Bedroom Luxury Apartment',
    location: 'Block 15, Lekki Phase 1, Lagos State',
    price: '₦1,200,000',
    freq: 'year',
    beds: 3,
    baths: 2,
    sqft: '1,200 sq ft',
    trustScore: 95,
    verified: true,
    rating: 4.8,
    reviews: 14,
    badge: 'Available',
    images: [
      'bg-gradient-to-br from-slate-300 to-slate-500',
      'bg-gradient-to-br from-stone-300 to-stone-500',
      'bg-gradient-to-br from-zinc-300 to-zinc-500',
      'bg-gradient-to-br from-neutral-300 to-neutral-500',
    ],
    description:
      'Beautiful 3-bedroom apartment in the heart of Lekki Phase 1. Features modern finishes, spacious rooms, and excellent security. Close to schools, shopping centres, and major roads. The apartment boasts floor-to-ceiling windows, Italian tiles, and a fully fitted kitchen.',
    amenities: [
      { icon: Zap, label: '360° Virtual Tours' },
      { icon: Droplets, label: 'Swimming Pool' },
      { icon: Lock, label: 'Security/CCTV' },
      { icon: Car, label: 'Parking Space' },
      { icon: Wind, label: 'Air Conditioning' },
      { icon: Wifi, label: 'High-Speed WiFi' },
    ],
  },
  2: {
    title: '2 Bedroom Modern Flat',
    location: 'Plot 43, Maitama District, Abuja',
    price: '₦900,000',
    freq: 'year',
    beds: 2,
    baths: 2,
    sqft: '950 sq ft',
    trustScore: 92,
    verified: true,
    rating: 4.5,
    reviews: 9,
    badge: 'Available',
    images: [
      'bg-gradient-to-br from-green-300 to-green-600',
      'bg-gradient-to-br from-emerald-300 to-emerald-500',
      'bg-gradient-to-br from-teal-300 to-teal-500',
      'bg-gradient-to-br from-cyan-300 to-cyan-500',
    ],
    description:
      'Modern 2-bedroom flat in the prestigious Maitama district. Features a well-fitted kitchen, spacious living area, and a serene environment perfect for professionals.',
    amenities: [
      { icon: Zap, label: 'Generator' },
      { icon: Droplets, label: 'Water Tank' },
      { icon: Lock, label: 'Gated Estate' },
      { icon: Car, label: 'Parking Space' },
      { icon: Wifi, label: 'High-Speed WiFi' },
      { icon: Maximize2, label: 'Spacious Rooms' },
    ],
  },
  3: {
    title: '4 Bedroom Duplex',
    location: 'Ikeja GRA, Lagos',
    price: '₦1,800,000',
    freq: 'year',
    beds: 4,
    baths: 3,
    sqft: '1,800 sq ft',
    trustScore: 97,
    verified: true,
    rating: 4.9,
    reviews: 22,
    badge: 'Available',
    images: [
      'bg-gradient-to-br from-purple-300 to-purple-600',
      'bg-gradient-to-br from-violet-300 to-violet-500',
      'bg-gradient-to-br from-fuchsia-300 to-fuchsia-500',
      'bg-gradient-to-br from-pink-300 to-pink-500',
    ],
    description:
      'Stunning 4-bedroom duplex in the quiet and secure Ikeja GRA neighbourhood. Features a private swimming pool, landscaped garden, and top-of-the-range finishes throughout.',
    amenities: [
      { icon: Droplets, label: 'Swimming Pool' },
      { icon: Zap, label: '24/7 Power Supply' },
      { icon: Home, label: 'Garden' },
      { icon: Lock, label: 'Security/CCTV' },
      { icon: Car, label: 'Parking Space' },
      { icon: Wind, label: 'Air Conditioning' },
    ],
  },
};

const SIMILAR = [
  {
    id: 2,
    title: '2 Bedroom Luxury Apartment',
    price: '₦1,200,000/year',
    beds: 2,
    baths: 2,
    sqft: '950 sq ft',
    bg: 'from-green-500 to-green-700',
  },
  {
    id: 3,
    title: '3 Bedroom Modern Flat',
    price: '₦900,000/year',
    beds: 3,
    baths: 2,
    sqft: '1,200 sq ft',
    bg: 'from-blue-500 to-blue-700',
  },
  {
    id: 1,
    title: '4 Bedroom Duplex',
    price: '₦1,500,000/year',
    beds: 4,
    baths: 3,
    sqft: '1,800 sq ft',
    bg: 'from-purple-500 to-purple-700',
  },
];

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
  const property = PROPERTIES[propertyId] ?? PROPERTIES[1];
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

  /* monthly price for the booking widget */
  const monthlyRaw = parseInt(property.price.replace(/[₦,]/g, ''), 10) / 12;
  const monthly = `₦${Math.round(monthlyRaw).toLocaleString()}`;

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
            className={`col-span-2 row-span-2 ${property.images[0]} relative flex items-end p-4`}
          >
            <span className="flex items-center gap-1 rounded-full bg-green-500 px-3 py-1 text-xs font-bold text-white">
              <Shield className="h-3 w-3" /> AI Verified
            </span>
          </div>
          {/* 3 smaller */}
          {property.images.slice(1, 3).map((img: string, i: number) => (
            <div key={i} className={`${img} relative`} />
          ))}
          {/* 4th with 360 badge */}
          <div
            className={`${property.images[3] ?? property.images[0]} relative flex items-center justify-center`}
          >
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
                {property.verified && (
                  <span className="flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700">
                    <CheckCircle className="h-3.5 w-3.5" /> Verified Listing
                  </span>
                )}
                <span className="flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">
                  <Maximize2 className="h-3.5 w-3.5" /> Virtual Tour
                </span>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-700">
                  ID #{propertyId}00{propertyId}
                </span>
              </div>

              <h1 className="mb-2 text-2xl font-bold text-gray-900">{property.title}</h1>

              <div className="mb-3 flex flex-wrap items-center gap-4 text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4 text-gray-400" />
                  {property.location}
                </span>
                <span className="flex items-center gap-1">
                  <Bed className="h-4 w-4 text-gray-400" />
                  {property.beds} Bedrooms
                </span>
                <span className="flex items-center gap-1">
                  <Bath className="h-4 w-4 text-gray-400" />
                  {property.baths} Bathrooms
                </span>
                <span className="flex items-center gap-1">
                  <Square className="h-4 w-4 text-gray-400" />
                  {property.sqft}
                </span>
              </div>

              {/* Stars */}
              <div className="flex items-center gap-2">
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-4 w-4 ${i < Math.round(property.rating) ? 'fill-yellow-400 text-yellow-400' : 'fill-gray-200 text-gray-200'}`}
                    />
                  ))}
                </div>
                <span className="text-sm text-gray-600">
                  {property.rating} ({property.reviews} reviews)
                </span>
              </div>
            </div>

            {/* Description */}
            <div>
              <h2 className="mb-3 text-lg font-bold text-gray-900">Description</h2>
              <p className="text-sm leading-relaxed text-gray-600">{property.description}</p>
            </div>

            {/* Amenities */}
            <div>
              <h2 className="mb-4 text-lg font-bold text-gray-900">Amenities & Features</h2>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {property.amenities.map((a: any) => {
                  const Icon = a.icon;
                  return (
                    <div key={a.label} className="flex items-center gap-2.5 text-sm text-gray-700">
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50">
                        <Icon className="h-4 w-4 text-blue-600" />
                      </div>
                      {a.label}
                    </div>
                  );
                })}
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
                  {property.price}/{property.freq}
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
                    Estimated: {property.price}/{property.freq}
                  </span>
                ) : (
                  'Select dates to calculate total'
                )}
              </div>

              {/* Transaction info */}
              <div className="mb-5 space-y-2 text-xs text-gray-500">
                <div className="flex justify-between">
                  <span>Base rent</span>
                  <span className="font-medium text-gray-800">{property.price}</span>
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
                    ₦{(parseInt(property.price.replace(/[₦,]/g, '')) + 90000).toLocaleString()}
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
          {SIMILAR.filter((s) => s.id !== propertyId)
            .slice(0, 3)
            .map((p) => (
              <div
                key={p.id}
                className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-lg"
              >
                <div className={`h-36 bg-gradient-to-br ${p.bg} relative flex items-start p-3`}>
                  <span className="flex items-center gap-1 rounded-full bg-green-500 px-2 py-0.5 text-xs font-bold text-white">
                    <Shield className="h-3 w-3" /> 360° View Available
                  </span>
                </div>
                <div className="p-4">
                  <h3 className="mb-1 text-sm font-bold text-gray-900">{p.title}</h3>
                  <div className="mb-3 flex items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Bed className="h-3 w-3" />
                      {p.beds} Bed
                    </span>
                    <span className="flex items-center gap-1">
                      <Bath className="h-3 w-3" />
                      {p.baths} Bath
                    </span>
                    <span>{p.sqft}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-blue-600">{p.price}</span>
                    <button
                      onClick={onGetStarted}
                      className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
                    >
                      View Details <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
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
