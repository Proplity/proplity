import { useState } from 'react';
import { Logo } from './Logo';
import { CheckCircle, Minus, Star, ChevronDown } from 'lucide-react';

interface PricingPageProps {
  onGetStarted: () => void;
  onSelectPlan: (plan: any) => void;
  onGoHome: () => void;
  onViewContact?: () => void;
  onViewAbout?: () => void;
  onViewLandlordPage: () => void;
  onViewTenantPage: () => void;
  onViewVendorPage: () => void;
}

export const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    tag: 'Best for solo landlords',
    monthlyPrice: null,
    annualPrice: null,
    priceLabel: 'NO',
    priceSub: '/month',
    popular: false,
    cta: 'Get Started',
    ctaStyle: 'outline',
    features: [
      'Up to 2 units',
      '5 Tenants max',
      'Manual Rent Collection',
      'Basic Maintenance',
      'Email Support',
    ],
    units: '2',
  },
  {
    id: 'professional',
    name: 'Professional',
    tag: 'Most popular for growing portfolios',
    monthlyPrice: 29999,
    annualPrice: 23999,
    priceLabel: null,
    priceSub: '/month',
    popular: true,
    cta: 'Get Started',
    ctaStyle: 'solid',
    features: [
      'Up to 50 units',
      'AI WhatsApp Assistant',
      'Automated Rent Collection',
      'Advanced Analytics',
      'Priority Support',
    ],
    units: '50',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    tag: 'Built for estate managers',
    monthlyPrice: null,
    annualPrice: null,
    priceLabel: 'Custom',
    priceSub: '',
    popular: false,
    cta: 'Get Started',
    ctaStyle: 'outline',
    features: [
      'Unlimited units',
      'Custom AI Workflows',
      'Vendor Management',
      'Multi-user roles',
      'Dedicated Account Manager',
    ],
    units: 'Unlimited',
  },
];

const COMPARISON = [
  {
    feature: 'Property Units',
    starter: '2',
    pro: '50',
    enterprise: 'Unlimited',
  },
  { feature: 'Tenant Management', starter: true, pro: true, enterprise: true },
  {
    feature: 'AI Verified Listings',
    starter: false,
    pro: true,
    enterprise: true,
  },
  {
    feature: 'WhatsApp Assistant',
    starter: false,
    pro: true,
    enterprise: true,
  },
  {
    feature: 'Payment Predictions',
    starter: false,
    pro: true,
    enterprise: true,
  },
  {
    feature: '360° Virtual Tours',
    starter: false,
    pro: true,
    enterprise: true,
  },
  { feature: 'Custom Reports', starter: false, pro: false, enterprise: true },
  { feature: 'API Access', starter: false, pro: false, enterprise: true },
  {
    feature: 'Support Response',
    starter: '48 hours',
    pro: '2 hours',
    enterprise: 'Instant',
  },
];

const TESTIMONIALS = [
  {
    stars: 5,
    text: '"Proplity reduced our rent collection time from weeks to days. The AI assistant handles 70% of tenant queries automatically!"',
    name: 'Adewale Johnson',
    role: 'Landlord · Lagos, Nigeria',
    initials: 'AJ',
    color: 'bg-blue-600',
  },
  {
    stars: 5,
    text: '"Finally, a platform built for Nigeria! The fraud verification and fraud detection saved me from 3 fake agents already."',
    name: 'Chioma Okafar',
    role: 'Property Manager · Abuja',
    initials: 'CO',
    color: 'bg-green-600',
  },
  {
    stars: 5,
    text: '"Managing 500+ units used to be overwhelming. Now everything is automated. Truly a game changer for our team."',
    name: 'Ibrahim Musa',
    role: 'Estate Manager · Abuja, Nigeria',
    initials: 'IM',
    color: 'bg-purple-600',
  },
];

function CellValue({ val }: { val: string | boolean }) {
  if (val === true) return <CheckCircle className="mx-auto h-5 w-5 text-blue-500" />;
  if (val === false) return <Minus className="mx-auto h-4 w-4 text-gray-300" />;
  return <span className="text-sm font-medium text-gray-700">{val}</span>;
}

function Stars({ n }: { n: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: n }).map((_, i) => (
        <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
      ))}
    </div>
  );
}

export function PricingPage({
  onGetStarted,
  onSelectPlan,
  onGoHome,
  onViewContact,
  onViewAbout,
  onViewLandlordPage,
  onViewTenantPage,
  onViewVendorPage,
}: PricingPageProps) {
  const [annual, setAnnual] = useState(false);
  const [featuresOpen, setFeaturesOpen] = useState(false);

  const getPrice = (plan: (typeof PLANS)[0]) => {
    if (plan.priceLabel) return plan.priceLabel;
    const price = annual ? plan.annualPrice! : plan.monthlyPrice!;
    return `₦${price.toLocaleString()}`;
  };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 border-b border-gray-100 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <button onClick={onGoHome} className="focus:outline-none">
            <Logo />
          </button>

          <div className="hidden items-center gap-8 md:flex">
            <div className="group relative">
              <button
                onClick={() => setFeaturesOpen((v) => !v)}
                className="flex items-center gap-1 py-1 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                Features
                <svg
                  className="h-4 w-4 text-gray-400 transition-transform group-hover:rotate-180 group-hover:text-gray-600"
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
            <span className="border-b-2 border-blue-600 pb-0.5 text-sm font-semibold text-blue-600">
              Pricing
            </span>
          </div>

          <button
            onClick={onGetStarted}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            Get Started
          </button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-gray-900 pt-16 pb-20 text-white">
        {/* subtle decorative circles */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-blue-600/10" />
          <div className="absolute -right-24 -bottom-24 h-80 w-80 rounded-full bg-blue-500/10" />
        </div>
        <div className="relative mx-auto max-w-3xl px-6 text-center">
          <span className="mb-5 inline-block rounded-full border border-white/10 bg-white/10 px-4 py-1.5 text-xs font-semibold tracking-wide text-blue-300">
            Pricing Plans
          </span>
          <h1 className="mb-4 text-4xl leading-tight font-bold md:text-5xl">
            Simple, Transparent Pricing
          </h1>
          <p className="mx-auto max-w-xl text-base text-gray-400">
            From individual landlords to enterprise estate managers, choose the plan that perfectly
            scales with your property portfolio.
          </p>
        </div>
      </section>

      {/* ── Billing toggle ── */}
      <div className="mt-10 mb-8 flex justify-center">
        <div className="inline-flex items-center gap-3 rounded-full bg-gray-100 px-5 py-2">
          <span className={`text-sm font-medium ${!annual ? 'text-gray-900' : 'text-gray-500'}`}>
            Monthly
          </span>
          <button
            onClick={() => setAnnual((v) => !v)}
            className={`relative h-6 w-11 rounded-full transition-colors ${annual ? 'bg-blue-600' : 'bg-gray-400'}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${annual ? 'translate-x-5' : 'translate-x-0'}`}
            />
          </button>
          <span className={`text-sm font-medium ${annual ? 'text-gray-900' : 'text-gray-500'}`}>
            Annual
          </span>
          <span className="ml-0.5 rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700">
            Save 20%
          </span>
        </div>
      </div>

      {/* ── Pricing cards ── */}
      <section className="mx-auto max-w-5xl px-6 pb-16">
        <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-2xl border p-7 ${
                plan.popular
                  ? 'border-blue-500 bg-white shadow-xl ring-2 shadow-blue-100 ring-blue-500'
                  : 'border-gray-200 bg-white'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-blue-600 px-4 py-1.5 text-xs font-bold tracking-wide text-white shadow">
                    MOST POPULAR
                  </span>
                </div>
              )}

              <p className="mt-2 mb-1 text-xs text-gray-400">{plan.tag}</p>
              <h3 className="mb-4 text-xl font-bold text-gray-900">{plan.name}</h3>

              <div className="mb-6">
                <span className="text-4xl font-extrabold text-gray-900">{getPrice(plan)}</span>
                {plan.priceSub && (
                  <span className="ml-1 text-sm text-gray-500">{plan.priceSub}</span>
                )}
                {annual && plan.monthlyPrice && (
                  <p className="mt-1 text-xs font-medium text-green-600">
                    Save ₦{((plan.monthlyPrice - plan.annualPrice!) * 12).toLocaleString()} per year
                  </p>
                )}
              </div>

              <ul className="mb-8 flex-1 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-gray-700">
                    <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-500" />
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => {
                  if (plan.id === 'enterprise') {
                    onGetStarted();
                    return;
                  }
                  onSelectPlan({
                    name: plan.name,
                    price: getPrice(plan),
                    units: plan.units,
                    features: plan.features,
                  });
                }}
                className={`w-full rounded-xl py-2.5 text-sm font-semibold transition-colors ${
                  plan.popular
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'border-2 border-gray-300 text-gray-700 hover:border-blue-400 hover:text-blue-600'
                }`}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ── Feature comparison ── */}
      <section className="bg-gray-50 px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-10 text-center text-2xl font-bold text-gray-900">
            Detailed Feature Comparison
          </h2>

          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            {/* Header */}
            <div className="grid grid-cols-4 border-b border-gray-200 bg-white">
              <div className="p-4 text-sm font-semibold text-gray-600">Features</div>
              {['Starter', 'Professional', 'Enterprise'].map((h, i) => (
                <div
                  key={h}
                  className={`p-4 text-center text-sm font-semibold ${i === 1 ? 'text-blue-600' : 'text-gray-700'}`}
                >
                  {h}
                </div>
              ))}
            </div>

            {COMPARISON.map((row, i) => (
              <div
                key={row.feature}
                className={`grid grid-cols-4 border-b border-gray-100 last:border-0 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
              >
                <div className="p-4 text-sm font-medium text-gray-700">{row.feature}</div>
                <div className="p-4 text-center">
                  <CellValue val={row.starter} />
                </div>
                <div className="p-4 text-center">
                  <CellValue val={row.pro} />
                </div>
                <div className="p-4 text-center">
                  <CellValue val={row.enterprise} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="bg-white px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-2 text-center text-2xl font-bold text-gray-900">
            Trusted by Property Professionals
          </h2>
          <p className="mb-10 text-center text-sm text-gray-500">
            Join thousands of landlords automating their rental operations
          </p>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <div
                key={t.name}
                className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
              >
                <Stars n={t.stars} />
                <p className="mt-3 text-sm leading-relaxed text-gray-600">{t.text}</p>
                <div className="mt-4 flex items-center gap-3">
                  <div
                    className={`h-9 w-9 rounded-full ${t.color} flex flex-shrink-0 items-center justify-center`}
                  >
                    <span className="text-xs font-bold text-white">{t.initials}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                    <p className="text-xs text-gray-500">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="bg-blue-700 px-6 py-16 text-center text-white">
        <h2 className="mb-3 text-3xl font-bold">Ready to scale your property portfolio?</h2>
        <p className="mb-8 text-sm text-blue-200">
          Start your 14-day free trial today. No credit card required.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <button
            onClick={onGetStarted}
            className="rounded-xl border-2 border-white px-7 py-3 text-sm font-semibold text-white transition-colors hover:bg-white hover:text-blue-700"
          >
            Start Free Trial
          </button>
          <button
            onClick={onGetStarted}
            className="rounded-xl border border-white/30 bg-white/10 px-7 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/20"
          >
            Schedule Demo
          </button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-gray-900 px-6 py-12 text-gray-400">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-10 md:grid-cols-4">
          <div>
            <div className="mb-3">
              <Logo className="opacity-90 brightness-0 invert" />
            </div>
            <p className="mt-3 text-xs leading-relaxed text-gray-500">
              Nigeria's first AI-native property management platform. Built for the realities of the
              modern rental market.
            </p>
          </div>
          {[
            {
              heading: 'Product',
              links: ['Features', 'Pricing', 'Blog', 'Demo'],
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
    </div>
  );
}
