import {
  Home,
  Search,
  FileText,
  Shield,
  MessageSquare,
  CheckCircle,
  ArrowRight,
  Bell,
  Star,
  DollarSign,
  Wrench,
} from 'lucide-react';
import { Logo } from './Logo';
import { mockTenantFeaturePaymentHistory as paymentHistory } from '../store/mockData';

interface TenantFeaturePageProps {
  onGetStarted: () => void;
  onGoHome?: () => void;
  onViewPricing?: () => void;
  onViewContact?: () => void;
  onViewAbout?: () => void;
  onViewLandlordPage?: () => void;
  onViewTenantPage?: () => void;
  onViewVendorPage?: () => void;
}

export function TenantFeaturePage({
  onGetStarted,
  onGoHome,
  onViewPricing,
  onViewContact,
  onViewAbout,
  onViewLandlordPage,
  onViewTenantPage,
  onViewVendorPage,
}: TenantFeaturePageProps) {
  const features = [
    {
      icon: Search,
      title: 'AI Property Search',
      description:
        'Our AI learns your preferences and surfaces verified listings that match your budget, location, and lifestyle needs.',
    },
    {
      icon: DollarSign,
      title: 'Online Rent Payments',
      description:
        'Pay rent from your phone via bank transfer, card, or USSD. Get instant receipts and automatic payment history.',
    },
    {
      icon: Wrench,
      title: 'Maintenance Tracker',
      description:
        'Submit maintenance requests with photos, track repair progress in real time, and rate service providers after completion.',
    },
    {
      icon: FileText,
      title: 'Lease Management',
      description:
        'Access your lease agreement anytime, get notified before renewal, and sign digitally without visiting an office.',
    },
    {
      icon: Star,
      title: 'Neighborhood Scores',
      description:
        'Browse verified power, water, security, and transport ratings for every neighborhood — no more surprises after move-in.',
    },
    {
      icon: MessageSquare,
      title: 'Direct Messaging',
      description:
        'Communicate directly with your property manager or landlord through a secure in-app messaging portal.',
    },
  ];

  const steps = [
    {
      step: '1',
      title: 'Browse & Discover',
      desc: 'Search verified properties by location, price, and features. View trust scores, 360° walkthroughs, and neighborhood ratings.',
    },
    {
      step: '2',
      title: 'Apply & Move In',
      desc: 'Submit your application online, upload documents, and sign your lease digitally. Get responses within 24-48 hours.',
    },
    {
      step: '3',
      title: 'Manage Your Tenancy',
      desc: 'Pay rent, track maintenance, communicate with your manager, and build a strong payment history — all from one dashboard.',
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-gray-100 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <button onClick={onGoHome ?? onGetStarted} className="focus:outline-none">
            <Logo />
          </button>
          <div className="hidden items-center gap-8 md:flex">
            <div className="group relative">
              <button className="flex items-center gap-1 py-1 text-sm font-medium text-gray-700 hover:text-gray-900">
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
                  <button
                    onClick={onViewLandlordPage}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 transition-colors hover:bg-blue-50 hover:text-blue-600"
                  >
                    For Landlords
                  </button>
                  <button
                    onClick={onViewTenantPage}
                    className="w-full px-4 py-2.5 text-left text-sm font-semibold text-gray-700 transition-colors hover:bg-blue-50 hover:text-blue-600"
                  >
                    For Tenants
                  </button>
                  <button
                    onClick={onViewVendorPage}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 transition-colors hover:bg-blue-50 hover:text-blue-600"
                  >
                    For Service Providers
                  </button>
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
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            Get Started
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-gradient-to-br from-green-50 via-white to-blue-50 pt-20 pb-24">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-green-100 px-4 py-2 text-sm font-medium text-green-700">
            <Home className="h-4 w-4" />
            Built for Nigerian Tenants
          </div>
          <h1 className="mb-6 text-5xl leading-tight font-bold text-gray-900 md:text-6xl">
            Find & Rent Your Perfect Home <span className="text-green-600">with Confidence</span>
          </h1>
          <p className="mx-auto mb-10 max-w-3xl text-xl leading-relaxed text-gray-600">
            Browse verified listings, apply online, pay rent digitally, and manage your entire
            tenancy from one place. No agents, no hidden fees, no stress.
          </p>
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={onGetStarted}
              className="flex items-center gap-2 rounded-lg bg-green-600 px-8 py-4 text-lg font-semibold text-white hover:bg-green-700"
            >
              Register as a Tenant
              <ArrowRight className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Free forever
            </div>
          </div>
        </div>
      </section>

      {/* Dashboard Preview */}
      <section className="bg-gray-50 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-4xl font-bold text-gray-900">Your Tenant Dashboard</h2>
            <p className="text-xl text-gray-600">Everything about your tenancy in one clean view</p>
          </div>

          {/* Browser Chrome Mockup */}
          <div className="mx-auto max-w-5xl overflow-hidden rounded-2xl bg-gray-800 shadow-2xl">
            <div className="flex items-center gap-3 bg-gray-700 px-4 py-3">
              <div className="flex gap-2">
                <div className="h-3 w-3 rounded-full bg-red-400"></div>
                <div className="h-3 w-3 rounded-full bg-yellow-400"></div>
                <div className="h-3 w-3 rounded-full bg-green-400"></div>
              </div>
              <div className="flex-1 rounded-md bg-gray-600 px-3 py-1 text-center text-xs text-gray-300">
                app.proplity.ng/tenant/dashboard
              </div>
              <Bell className="h-4 w-4 text-gray-400" />
            </div>

            <div className="bg-gray-50 p-6">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Welcome back, Blessing</h3>
                  <p className="text-sm text-gray-500">
                    Flat 3B, Lekki Phase 1 Complex · Lease active until Dec 2026
                  </p>
                </div>
                <div className="flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700">
                  <Shield className="h-4 w-4" />
                  Verified Tenant
                </div>
              </div>

              {/* Stat Cards */}
              <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500">Current Rent</span>
                    <Home className="h-4 w-4 text-green-500" />
                  </div>
                  <p className="text-2xl font-bold text-gray-900">₦850,000</p>
                  <p className="mt-1 text-xs text-gray-500">per year</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500">Next Due Date</span>
                    <Bell className="h-4 w-4 text-orange-500" />
                  </div>
                  <p className="text-2xl font-bold text-gray-900">Jun 1</p>
                  <p className="mt-1 text-xs text-orange-600">2026 · 29 days away</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500">Payment Streak</span>
                    <Star className="h-4 w-4 text-yellow-500" />
                  </div>
                  <p className="text-2xl font-bold text-gray-900">8</p>
                  <p className="mt-1 text-xs text-green-600">months on time</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500">Maintenance</span>
                    <Wrench className="h-4 w-4 text-blue-500" />
                  </div>
                  <p className="text-2xl font-bold text-gray-900">2</p>
                  <p className="mt-1 text-xs text-blue-600">open requests</p>
                </div>
              </div>

              {/* Payment History Table */}
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                  <h4 className="text-sm font-semibold text-gray-900">Recent Payments</h4>
                  <span className="cursor-pointer text-xs font-medium text-blue-600">View all</span>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">
                        Month
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">
                        Amount
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paymentHistory.map((row, i) => (
                      <tr key={i} className="transition-colors hover:bg-gray-50">
                        <td className="px-5 py-3 font-medium text-gray-900">{row.month}</td>
                        <td className="px-5 py-3 text-gray-700">{row.amount}</td>
                        <td className="px-5 py-3">
                          <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-4xl font-bold text-gray-900">Everything a Tenant Needs</h2>
            <p className="text-xl text-gray-600">
              Six tools that make renting better from search to move-out
            </p>
          </div>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div
                  key={index}
                  className="rounded-xl border border-gray-200 bg-white p-6 transition-shadow hover:shadow-lg"
                >
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-green-100">
                    <Icon className="h-6 w-6 text-green-600" />
                  </div>
                  <h3 className="mb-2 text-xl font-semibold text-gray-900">{feature.title}</h3>
                  <p className="text-gray-600">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-gray-50 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-4xl font-bold text-gray-900">From Browsing to Moving In</h2>
            <p className="text-xl text-gray-600">Three simple steps to your next home</p>
          </div>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {steps.map((item, index) => (
              <div key={index} className="relative">
                <div className="rounded-xl border border-gray-200 bg-white p-8 transition-shadow hover:shadow-lg">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-600 text-xl font-bold text-white">
                    {item.step}
                  </div>
                  <h3 className="mb-3 text-xl font-semibold text-gray-900">{item.title}</h3>
                  <p className="text-gray-600">{item.desc}</p>
                </div>
                {index < 2 && (
                  <div className="absolute top-1/2 -right-4 hidden -translate-y-1/2 transform md:block">
                    <ArrowRight className="h-8 w-8 text-green-300" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-green-600 py-20 text-white">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <Home className="mx-auto mb-6 h-16 w-16 text-green-200" />
          <h2 className="mb-4 text-4xl font-bold">Register as a Tenant — Free Forever</h2>
          <p className="mb-8 text-xl text-green-100">
            Join thousands of Nigerians who found their homes on Proplity.
          </p>
          <button
            onClick={onGetStarted}
            className="inline-flex items-center gap-2 rounded-lg bg-white px-8 py-4 text-lg font-semibold text-green-600 hover:bg-gray-100"
          >
            Create Your Tenant Account
            <ArrowRight className="h-5 w-5" />
          </button>
          <p className="mt-4 text-sm text-green-200">
            Free forever · No credit card · No agent fees
          </p>
        </div>
      </section>
    </div>
  );
}
