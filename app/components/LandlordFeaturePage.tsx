import {
  Building2,
  TrendingUp,
  FileText,
  Shield,
  BarChart3,
  Users,
  DollarSign,
  CheckCircle,
  ArrowRight,
  Home,
  Eye,
  Bell,
} from 'lucide-react';
import { Logo } from './Logo';
import { mockLandlordFeatureProperties as properties } from '../store/mockData';

interface LandlordFeaturePageProps {
  onGetStarted: () => void;
  onGoHome?: () => void;
  onViewPricing?: () => void;
  onViewContact?: () => void;
  onViewAbout?: () => void;
  onViewLandlordPage?: () => void;
  onViewTenantPage?: () => void;
  onViewVendorPage?: () => void;
}

export function LandlordFeaturePage({
  onGetStarted,
  onGoHome,
  onViewPricing,
  onViewContact,
  onViewAbout,
  onViewLandlordPage,
  onViewTenantPage,
  onViewVendorPage,
}: LandlordFeaturePageProps) {
  const features = [
    {
      icon: BarChart3,
      title: 'Portfolio Overview',
      description:
        'See all your properties, units, and performance metrics in one unified dashboard. Real-time occupancy and revenue data at a glance.',
    },
    {
      icon: DollarSign,
      title: 'Rent Income Tracking',
      description:
        'Track every payment across all properties. Get monthly income summaries, outstanding rent alerts, and automated tenant reminders.',
    },
    {
      icon: Eye,
      title: 'Manager Performance Reports',
      description:
        'Monitor how your property managers are performing. View collection rates, maintenance resolution times, and tenant satisfaction.',
    },
    {
      icon: FileText,
      title: 'Lease Document Access',
      description:
        'Store, access, and manage all lease agreements digitally. Get notified on upcoming renewals and flag anomalies automatically.',
    },
    {
      icon: Shield,
      title: 'AI Fraud Detection',
      description:
        'Our AI flags suspicious payment patterns, unauthorized subletting, and counterfeit documents before they become costly problems.',
    },
    {
      icon: TrendingUp,
      title: 'Multi-Property Analytics',
      description:
        'Compare performance across properties, neighborhoods, and managers. Make data-driven decisions on acquisitions and disposals.',
    },
  ];

  const steps = [
    {
      step: '1',
      title: 'Register & Add Properties',
      desc: 'Sign up as a Landlord, add your properties and assign managers. Import your existing portfolio in minutes via CSV.',
    },
    {
      step: '2',
      title: 'Get Visibility Instantly',
      desc: 'Your landlord dashboard populates automatically with rent status, tenant details, and property health scores.',
    },
    {
      step: '3',
      title: 'Earn Passively, Oversee Smartly',
      desc: 'Receive monthly income reports, fraud alerts, and performance summaries—without micromanaging.',
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
            {/* Features dropdown */}
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
                    className="w-full px-4 py-2.5 text-left text-sm font-semibold text-gray-700 transition-colors hover:bg-blue-50 hover:text-blue-600"
                  >
                    For Landlords
                  </button>
                  <button
                    onClick={onViewTenantPage}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 transition-colors hover:bg-blue-50 hover:text-blue-600"
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
      <section className="bg-gradient-to-br from-purple-50 via-white to-blue-50 pt-20 pb-24">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-purple-100 px-4 py-2 text-sm font-medium text-purple-700">
            <Building2 className="h-4 w-4" />
            Designed for Nigerian Landlords
          </div>
          <h1 className="mb-6 text-5xl leading-tight font-bold text-gray-900 md:text-6xl">
            Built for Landlords Who <span className="text-purple-600">Own, Not Manage</span>
          </h1>
          <p className="mx-auto mb-10 max-w-3xl text-xl leading-relaxed text-gray-600">
            Enjoy passive income without the headaches. Proplity gives you full oversight of your
            portfolio — rent collection, manager accountability, and AI fraud protection — without
            lifting a finger.
          </p>
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={onGetStarted}
              className="flex items-center gap-2 rounded-lg bg-purple-600 px-8 py-4 text-lg font-semibold text-white hover:bg-purple-700"
            >
              Join as a Landlord
              <ArrowRight className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Free forever for landlords
            </div>
          </div>
        </div>
      </section>

      {/* Dashboard Preview */}
      <section className="bg-gray-50 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-4xl font-bold text-gray-900">Your Landlord Dashboard</h2>
            <p className="text-xl text-gray-600">
              Real-time visibility across your entire portfolio
            </p>
          </div>

          {/* Browser Chrome Mockup */}
          <div className="mx-auto max-w-5xl overflow-hidden rounded-2xl bg-gray-800 shadow-2xl">
            {/* Browser top bar */}
            <div className="flex items-center gap-3 bg-gray-700 px-4 py-3">
              <div className="flex gap-2">
                <div className="h-3 w-3 rounded-full bg-red-400"></div>
                <div className="h-3 w-3 rounded-full bg-yellow-400"></div>
                <div className="h-3 w-3 rounded-full bg-green-400"></div>
              </div>
              <div className="flex-1 rounded-md bg-gray-600 px-3 py-1 text-center text-xs text-gray-300">
                app.proplity.ng/landlord/dashboard
              </div>
              <Bell className="h-4 w-4 text-gray-400" />
            </div>

            {/* Dashboard Content */}
            <div className="bg-gray-50 p-6">
              {/* Dashboard header */}
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Good morning, Chief Adewale</h3>
                  <p className="text-sm text-gray-500">Portfolio summary · Updated just now</p>
                </div>
                <div className="flex items-center gap-2 rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
                  <div className="h-2 w-2 rounded-full bg-green-500"></div>
                  All Systems Normal
                </div>
              </div>

              {/* Stat Cards */}
              <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500">Total Properties</span>
                    <Building2 className="h-4 w-4 text-purple-500" />
                  </div>
                  <p className="text-3xl font-bold text-gray-900">8</p>
                  <p className="mt-1 text-xs text-green-600">+1 this quarter</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500">Monthly Revenue</span>
                    <DollarSign className="h-4 w-4 text-green-500" />
                  </div>
                  <p className="text-3xl font-bold text-gray-900">₦4.2M</p>
                  <p className="mt-1 text-xs text-green-600">+8% from last month</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500">Occupancy Rate</span>
                    <TrendingUp className="h-4 w-4 text-blue-500" />
                  </div>
                  <p className="text-3xl font-bold text-gray-900">96%</p>
                  <p className="mt-1 text-xs text-blue-600">1 unit vacant</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500">Active Tenants</span>
                    <Users className="h-4 w-4 text-orange-500" />
                  </div>
                  <p className="text-3xl font-bold text-gray-900">31</p>
                  <p className="mt-1 text-xs text-orange-600">3 renewals due</p>
                </div>
              </div>

              {/* Properties Table */}
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                  <h4 className="text-sm font-semibold text-gray-900">My Properties</h4>
                  <span className="cursor-pointer text-xs font-medium text-blue-600">View all</span>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">
                        Property
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">
                        Location
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">
                        Units
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">
                        Revenue
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {properties.map((p, i) => (
                      <tr key={i} className="transition-colors hover:bg-gray-50">
                        <td className="px-5 py-3 font-medium text-gray-900">{p.name}</td>
                        <td className="px-5 py-3 text-gray-500">{p.location}</td>
                        <td className="px-5 py-3 text-gray-700">{p.units}</td>
                        <td className="px-5 py-3 font-semibold text-green-600">{p.revenue}</td>
                        <td className="px-5 py-3">
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-medium ${p.status === 'Fully Occupied' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}
                          >
                            {p.status}
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
            <h2 className="mb-4 text-4xl font-bold text-gray-900">Everything a Landlord Needs</h2>
            <p className="text-xl text-gray-600">
              Six powerful tools built specifically for property owners
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
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100">
                    <Icon className="h-6 w-6 text-purple-600" />
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
            <h2 className="mb-4 text-4xl font-bold text-gray-900">How It Works for Landlords</h2>
            <p className="text-xl text-gray-600">Three steps to total portfolio clarity</p>
          </div>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {steps.map((item, index) => (
              <div key={index} className="relative">
                <div className="rounded-xl border border-gray-200 bg-white p-8 transition-shadow hover:shadow-lg">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-purple-600 text-xl font-bold text-white">
                    {item.step}
                  </div>
                  <h3 className="mb-3 text-xl font-semibold text-gray-900">{item.title}</h3>
                  <p className="text-gray-600">{item.desc}</p>
                </div>
                {index < 2 && (
                  <div className="absolute top-1/2 -right-4 hidden -translate-y-1/2 transform md:block">
                    <ArrowRight className="h-8 w-8 text-purple-300" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-purple-600 py-20 text-white">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <Home className="mx-auto mb-6 h-16 w-16 text-purple-200" />
          <h2 className="mb-4 text-4xl font-bold">Join as a Landlord — It's Free</h2>
          <p className="mb-8 text-xl text-purple-100">
            Get full visibility on your properties. No management fees, no subscriptions.
          </p>
          <button
            onClick={onGetStarted}
            className="inline-flex items-center gap-2 rounded-lg bg-white px-8 py-4 text-lg font-semibold text-purple-600 hover:bg-gray-100"
          >
            Create Your Landlord Account
            <ArrowRight className="h-5 w-5" />
          </button>
          <p className="mt-4 text-sm text-purple-200">Free forever · No credit card required</p>
        </div>
      </section>
    </div>
  );
}
