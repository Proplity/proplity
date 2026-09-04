import { Logo } from './Logo';
import {
  ArrowRight,
  Shield,
  Zap,
  Bot,
  TrendingUp,
  CheckCircle,
  Star,
  Users,
  Home,
  MessageSquare,
  Search,
  MapPin,
  Play,
  DollarSign,
  Wrench,
  Bell,
} from 'lucide-react';

interface PricingPlan {
  name: string;
  price: string;
  units: string;
  features: string[];
}

export function LandingPage({
  onGetStarted,
  onSelectPlan,
  onViewProperty,
  onViewPricing,
  onViewContact,
  onViewAbout,
  onViewLandlordPage,
  onViewTenantPage,
  onViewVendorPage,
}: {
  onGetStarted: () => void;
  onSelectPlan: (plan: PricingPlan) => void;
  onViewProperty?: (propertyId: number) => void;
  onViewPricing?: () => void;
  onViewContact?: () => void;
  onViewAbout?: () => void;
  onViewLandlordPage: () => void;
  onViewTenantPage: () => void;
  onViewVendorPage: () => void;
}) {
  const features = [
    {
      icon: Bot,
      title: 'AI-Powered Intelligence',
      description:
        'WhatsApp-first AI assistant handles tenant queries, predicts late payments, and automates renewals',
    },
    {
      icon: Shield,
      title: 'Trust & Verification',
      description:
        'AI-verified listings with 360° walkthroughs eliminate fraud and fake properties',
    },
    {
      icon: Zap,
      title: 'Automated Operations',
      description:
        'Auto-invoicing, payment tracking, and smart reminders reduce admin work by 60-70%',
    },
    {
      icon: TrendingUp,
      title: 'Smart Analytics',
      description:
        'Real-time insights on rent collection, occupancy rates, and property performance',
    },
    {
      icon: Home,
      title: 'Property Discovery',
      description:
        'Neighborhood intelligence with power, water, security, and accessibility ratings',
    },
    {
      icon: MessageSquare,
      title: 'Unified Communication',
      description: 'Centralized messaging between tenants, landlords, managers, and vendors',
    },
  ];

  const stats = [
    { value: '10,000+', label: 'Properties Managed' },
    { value: '94%', label: 'Rent Collection Rate' },
    { value: '60%', label: 'Admin Time Saved' },
    { value: '99.5%', label: 'Uptime SLA' },
  ];

  const testimonials = [
    {
      name: 'Adewale Johnson',
      role: 'Property Manager, Lagos',
      image: 'bg-blue-500',
      text: 'Proplity reduced our rent collection time from weeks to days. The AI assistant handles 70% of tenant queries automatically!',
    },
    {
      name: 'Chioma Okafor',
      role: 'Landlord, Abuja',
      image: 'bg-green-500',
      text: 'Finally, a platform built for Nigeria! The trust verification and fraud detection saved me from 3 fake agents already.',
    },
    {
      name: 'Ibrahim Musa',
      role: 'Estate Manager, PH',
      image: 'bg-purple-500',
      text: 'Managing 500+ units used to be overwhelming. Now everything is automated - payments, maintenance, renewals. Game changer!',
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-gray-100 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          {/* Logo — always returns to landing page */}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo(0, 0);
            }}
            className="focus:outline-none"
          >
            <Logo />
          </a>

          {/* Centre links */}
          <div className="hidden items-center gap-8 md:flex">
            {/* Features dropdown */}
            <div className="group relative">
              <button className="flex items-center gap-1 py-1 text-sm font-medium text-gray-700 hover:text-gray-900">
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

            <a
              href="#how-it-works"
              className="text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              How it Works
            </a>
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

          {/* CTA */}
          <button
            onClick={onGetStarted}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            Get Started
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="bg-linear-to-br from-blue-50 via-white to-green-50 pt-20 pb-32">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-blue-100 px-4 py-2 text-sm font-medium text-blue-700">
              <Zap className="h-4 w-4" />
              Nigeria's First AI-Native Property Management Platform
            </div>
            <h1 className="mb-6 text-5xl leading-tight font-bold md:text-6xl">
              Transform Rental Operations with{' '}
              <span className="text-blue-600">AI Intelligence</span>
            </h1>
            <p className="mb-8 text-xl leading-relaxed text-gray-600">
              From fragmented spreadsheets to unified automation. Manage properties, track rent,
              handle maintenance, and verify listings—all powered by AI built for Nigeria's rental
              market.
            </p>

            {/* Property Search Bar */}
            <div className="mx-auto mb-8 max-w-3xl">
              <div className="flex items-center gap-2 rounded-2xl bg-white p-2 shadow-2xl">
                <div className="flex flex-1 items-center gap-2 px-4">
                  <Search className="h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by location (e.g., Lekki, Victoria Island, Maitama...)"
                    className="flex-1 py-3 text-gray-700 focus:outline-none"
                  />
                </div>
                <button
                  onClick={() => {
                    // Scroll to properties section
                    document.getElementById('properties')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="rounded-xl bg-blue-600 px-8 py-3 font-semibold whitespace-nowrap text-white transition-colors hover:bg-blue-700"
                >
                  Find Property
                </button>
              </div>
              <p className="mt-3 text-sm text-gray-500">
                🏠 Browse 6 available properties • 🔍 AI-powered search • ✅ Verified listings
              </p>
            </div>

            <div className="flex items-center justify-center gap-4">
              <button
                onClick={onGetStarted}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-8 py-4 text-lg font-semibold text-white hover:bg-blue-700"
              >
                Start Free Trial
                <ArrowRight className="h-5 w-5" />
              </button>
              <button className="rounded-lg border-2 border-gray-300 px-8 py-4 text-lg font-semibold text-gray-700 hover:bg-gray-50">
                Watch Demo
              </button>
            </div>
            <p className="mt-4 text-sm text-gray-500">
              No credit card required • 14-day free trial • Cancel anytime
            </p>
          </div>

          {/* Stats */}
          <div className="mx-auto mt-20 grid max-w-5xl grid-cols-2 gap-8 md:grid-cols-4">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <p className="mb-2 text-4xl font-bold text-blue-600">{stat.value}</p>
                <p className="text-gray-600">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Dashboard Preview Section */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-4xl font-bold">See Proplity in Action</h2>
            <p className="text-xl text-gray-600">
              A real-time property manager dashboard built for scale
            </p>
          </div>

          {/* Browser Chrome Mockup */}
          <div className="mx-auto max-w-5xl overflow-hidden rounded-2xl bg-gray-800 shadow-2xl">
            {/* Top bar with dots */}
            <div className="flex items-center gap-3 bg-gray-700 px-4 py-3">
              <div className="flex gap-2">
                <div className="h-3 w-3 rounded-full bg-red-400"></div>
                <div className="h-3 w-3 rounded-full bg-yellow-400"></div>
                <div className="h-3 w-3 rounded-full bg-green-400"></div>
              </div>
              <div className="flex-1 rounded-md bg-gray-600 px-3 py-1 text-center text-xs text-gray-300">
                app.proplity.ng/dashboard
              </div>
              <Bell className="h-4 w-4 text-gray-400" />
            </div>

            {/* Mock app nav */}
            <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
              <span className="text-lg font-bold text-blue-600">Proplity</span>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span className="font-medium text-blue-600">Dashboard</span>
                <span>Properties</span>
                <span>Tenants</span>
                <span>Maintenance</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                  PM
                </div>
                <span className="text-sm font-medium text-gray-700">Property Manager</span>
              </div>
            </div>

            {/* Dashboard content */}
            <div className="bg-gray-50 p-6">
              {/* Stat cards */}
              <div className="mb-6 grid grid-cols-4 gap-4">
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500">Total Properties</span>
                    <Home className="h-4 w-4 text-blue-500" />
                  </div>
                  <p className="text-3xl font-bold text-gray-900">24</p>
                  <p className="mt-1 text-xs text-green-600">+3 this month</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500">Active Tenants</span>
                    <Users className="h-4 w-4 text-green-500" />
                  </div>
                  <p className="text-3xl font-bold text-gray-900">187</p>
                  <p className="mt-1 text-xs text-green-600">96% occupancy</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500">Rent Collected</span>
                    <DollarSign className="h-4 w-4 text-purple-500" />
                  </div>
                  <p className="text-3xl font-bold text-gray-900">₦12.4M</p>
                  <p className="mt-1 text-xs text-green-600">94% collection rate</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500">Pending Maintenance</span>
                    <Wrench className="h-4 w-4 text-orange-500" />
                  </div>
                  <p className="text-3xl font-bold text-gray-900">7</p>
                  <p className="mt-1 text-xs text-orange-600">2 urgent</p>
                </div>
              </div>

              {/* Two-column lower section */}
              <div className="grid grid-cols-2 gap-4">
                {/* Recent Payments */}
                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                  <div className="border-b border-gray-100 px-4 py-3">
                    <h4 className="text-sm font-semibold text-gray-900">Recent Payments</h4>
                  </div>
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-gray-500">Tenant</th>
                        <th className="px-4 py-2 text-left text-gray-500">Amount</th>
                        <th className="px-4 py-2 text-left text-gray-500">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {[
                        {
                          name: 'Chidi Okonkwo',
                          amount: '₦120,000',
                          status: 'Paid',
                          color: 'bg-green-100 text-green-700',
                        },
                        {
                          name: 'Funmi Adeyemi',
                          amount: '₦85,000',
                          status: 'Paid',
                          color: 'bg-green-100 text-green-700',
                        },
                        {
                          name: 'Tunde Bakare',
                          amount: '₦95,000',
                          status: 'Overdue',
                          color: 'bg-red-100 text-red-700',
                        },
                        {
                          name: 'Ngozi Eze',
                          amount: '₦75,000',
                          status: 'Pending',
                          color: 'bg-yellow-100 text-yellow-700',
                        },
                      ].map((row, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-4 py-2 font-medium text-gray-800">{row.name}</td>
                          <td className="px-4 py-2 text-gray-700">{row.amount}</td>
                          <td className="px-4 py-2">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${row.color}`}
                            >
                              {row.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Upcoming Renewals */}
                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                  <div className="border-b border-gray-100 px-4 py-3">
                    <h4 className="text-sm font-semibold text-gray-900">Upcoming Renewals</h4>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {[
                      {
                        name: 'Emeka Nwosu',
                        property: 'Lekki Flat 2A',
                        due: 'Jun 30, 2026',
                        daysLeft: 28,
                      },
                      {
                        name: 'Aisha Bello',
                        property: 'Maitama Suite 4',
                        due: 'Jul 15, 2026',
                        daysLeft: 43,
                      },
                      {
                        name: 'Seun Oladele',
                        property: 'GRA Duplex B',
                        due: 'Jul 31, 2026',
                        daysLeft: 59,
                      },
                      {
                        name: 'Kemi Fashola',
                        property: 'VI Studio 1C',
                        due: 'Aug 1, 2026',
                        daysLeft: 60,
                      },
                    ].map((item, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50"
                      >
                        <div>
                          <p className="text-xs font-medium text-gray-900">{item.name}</p>
                          <p className="text-xs text-gray-500">{item.property}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-700">{item.due}</p>
                          <p
                            className={`text-xs font-medium ${item.daysLeft <= 30 ? 'text-orange-600' : 'text-blue-600'}`}
                          >
                            {item.daysLeft} days
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-4xl font-bold">Everything You Need to Manage Properties</h2>
            <p className="text-xl text-gray-600">
              Built for Nigeria's scale, behaviors, and infrastructure realities
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
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
                    <Icon className="h-6 w-6 text-blue-600" />
                  </div>
                  <h3 className="mb-2 text-xl font-semibold">{feature.title}</h3>
                  <p className="text-gray-600">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="bg-gray-50 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-4xl font-bold">How Proplity Works</h2>
            <p className="text-xl text-gray-600">Get started in minutes, not weeks</p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {[
              {
                step: '1',
                title: 'Add Your Properties',
                desc: 'Import properties and units via CSV or add them manually. Set rent terms, upload documents, and invite tenants.',
              },
              {
                step: '2',
                title: 'Automate Operations',
                desc: 'AI handles invoicing, reminders, maintenance triage, and renewals. WhatsApp assistant answers tenant queries 24/7.',
              },
              {
                step: '3',
                title: 'Get Insights & Scale',
                desc: 'Track payments, predict late payers, analyze performance, and scale from 1 to 5,000+ units effortlessly.',
              },
            ].map((item, index) => (
              <div key={index} className="relative">
                <div className="rounded-xl border border-gray-200 bg-white p-8 transition-shadow hover:shadow-lg">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-xl font-bold text-white">
                    {item.step}
                  </div>
                  <h3 className="mb-3 text-xl font-semibold">{item.title}</h3>
                  <p className="text-gray-600">{item.desc}</p>
                </div>
                {index < 2 && (
                  <div className="absolute top-1/2 -right-4 hidden -translate-y-1/2 transform md:block">
                    <ArrowRight className="h-8 w-8 text-blue-300" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Video Section */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-4xl font-bold">Watch Proplity in Action</h2>
            <p className="text-xl text-gray-600">See how easy property management can be</p>
          </div>

          {/* Video Player Mockup */}
          <div className="mx-auto max-w-4xl">
            <div className="overflow-hidden rounded-2xl bg-gray-900 shadow-2xl">
              {/* Video chrome top bar */}
              <div className="flex items-center gap-3 bg-gray-800 px-4 py-2">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-red-400"></div>
                  <div className="h-3 w-3 rounded-full bg-yellow-400"></div>
                  <div className="h-3 w-3 rounded-full bg-green-400"></div>
                </div>
                <div className="flex-1 text-center text-xs text-gray-400">
                  Proplity Platform Walkthrough
                </div>
              </div>

              {/* Video area */}
              <div
                className="relative bg-linear-to-br from-gray-900 via-blue-950 to-gray-900"
                style={{ aspectRatio: '16/9' }}
              >
                {/* Background pattern suggestion */}
                <div className="absolute inset-0 opacity-10">
                  <div className="grid h-full w-full grid-cols-12 grid-rows-8 gap-px">
                    {Array.from({ length: 96 }).map((_, i) => (
                      <div key={i} className="rounded-sm bg-blue-400"></div>
                    ))}
                  </div>
                </div>

                {/* Center play button */}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                  <button className="group flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-2xl transition-transform hover:scale-105">
                    <Play className="ml-1 h-8 w-8 text-blue-600 group-hover:text-blue-700" />
                  </button>
                  <div className="text-center">
                    <p className="text-lg font-semibold text-white">
                      Proplity Platform Walkthrough — 2 min
                    </p>
                    <p className="mt-1 text-sm text-blue-300">
                      Click to play · No sign-up required
                    </p>
                  </div>
                </div>

                {/* Progress bar at bottom */}
                <div className="absolute right-0 bottom-0 left-0 bg-black/60 px-4 py-3">
                  <div className="mb-1 flex items-center gap-3">
                    <Play className="h-4 w-4 text-white" />
                    <div className="h-1 flex-1 rounded-full bg-gray-600">
                      <div className="h-1 w-0 rounded-full bg-red-500"></div>
                    </div>
                    <span className="text-xs text-white">0:00 / 2:03</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Chapter chips */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
              {[
                { time: '00:00', label: 'Property Setup' },
                { time: '00:45', label: 'Tenant Management' },
                { time: '01:20', label: 'AI Features' },
              ].map((chapter, i) => (
                <button
                  key={i}
                  className="flex items-center gap-2 rounded-full border border-gray-200 bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                >
                  <span className="font-mono text-xs text-blue-500">{chapter.time}</span>
                  {chapter.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-4xl font-bold">Trusted by Property Professionals</h2>
            <p className="text-xl text-gray-600">See what our customers are saying</p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="rounded-xl border border-gray-200 bg-gray-50 p-6">
                <div className="mb-4 flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="mb-6 text-gray-700 italic">"{testimonial.text}"</p>
                <div className="flex items-center gap-3">
                  <div
                    className={`h-12 w-12 ${testimonial.image} flex items-center justify-center rounded-full font-semibold text-white`}
                  >
                    {testimonial.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold">{testimonial.name}</p>
                    <p className="text-sm text-gray-600">{testimonial.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Properties - Available for Rent */}
      <section id="properties" className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-4xl font-bold">Featured Properties Available for Rent</h2>
            <p className="text-xl text-gray-600">
              Browse verified properties and apply online in minutes
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                id: 1,
                title: '3 Bedroom Luxury Apartment',
                location: 'Lekki Phase 1, Lagos',
                price: '₦1,200,000/year',
                bedrooms: 3,
                bathrooms: 2,
                sqft: '1,200 sq ft',
                image: 'bg-linear-to-br from-blue-400 to-blue-600',
                trustScore: 95,
                features: ['24/7 Power', 'Borehole', 'Security', 'Parking'],
              },
              {
                id: 2,
                title: '2 Bedroom Modern Flat',
                location: 'Maitama, Abuja',
                price: '₦900,000/year',
                bedrooms: 2,
                bathrooms: 2,
                sqft: '950 sq ft',
                image: 'bg-linear-to-br from-green-400 to-green-600',
                trustScore: 92,
                features: ['Generator', 'Water Tank', 'Gated Estate'],
              },
              {
                id: 3,
                title: '4 Bedroom Duplex',
                location: 'Ikeja GRA, Lagos',
                price: '₦1,800,000/year',
                bedrooms: 4,
                bathrooms: 3,
                sqft: '1,800 sq ft',
                image: 'bg-linear-to-br from-purple-400 to-purple-600',
                trustScore: 97,
                features: ['Swimming Pool', 'Gym', 'Garden', '24/7 Power'],
              },
              {
                id: 4,
                title: 'Studio Apartment',
                location: 'Victoria Island, Lagos',
                price: '₦650,000/year',
                bedrooms: 1,
                bathrooms: 1,
                sqft: '600 sq ft',
                image: 'bg-linear-to-br from-orange-400 to-orange-600',
                trustScore: 88,
                features: ['Furnished', 'WiFi', 'Security'],
              },
              {
                id: 5,
                title: '3 Bedroom Penthouse',
                location: 'Banana Island, Lagos',
                price: '₦3,500,000/year',
                bedrooms: 3,
                bathrooms: 3,
                sqft: '2,200 sq ft',
                image: 'bg-linear-to-br from-pink-400 to-pink-600',
                trustScore: 99,
                features: ['Sea View', 'Private Lift', 'Balcony', 'Luxury'],
              },
              {
                id: 6,
                title: '2 Bedroom Bungalow',
                location: 'Ajah, Lagos',
                price: '₦750,000/year',
                bedrooms: 2,
                bathrooms: 2,
                sqft: '1,000 sq ft',
                image: 'bg-linear-to-br from-teal-400 to-teal-600',
                trustScore: 90,
                features: ['Garden', 'Parking', 'Quiet Area'],
              },
            ].map((property) => (
              <div
                key={property.id}
                className="group cursor-pointer overflow-hidden rounded-xl border border-gray-200 bg-white transition-shadow hover:shadow-2xl"
              >
                {/* Property Image */}
                <div className={`h-48 ${property.image} relative flex items-center justify-center`}>
                  <div className="absolute top-3 left-3 flex items-center gap-1 rounded-full bg-green-500 px-3 py-1 text-xs font-semibold text-white">
                    <Shield className="h-3 w-3" />
                    AI Verified
                  </div>
                  <div className="absolute top-3 right-3 rounded-full bg-white/90 px-3 py-1 backdrop-blur-sm">
                    <div className="flex items-center gap-1">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
                        <span className="text-xs font-bold text-green-600">
                          {property.trustScore}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-lg bg-black/30 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm">
                    360° View Available
                  </div>
                </div>

                {/* Property Details */}
                <div className="p-5">
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="mb-1 text-lg font-bold transition-colors group-hover:text-blue-600">
                        {property.title}
                      </h3>
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <MapPin className="h-4 w-4" />
                        {property.location}
                      </div>
                    </div>
                  </div>

                  <div className="mb-4 flex items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Home className="h-4 w-4" />
                      {property.bedrooms} Bed
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      {property.bathrooms} Bath
                    </div>
                    <div className="text-xs">{property.sqft}</div>
                  </div>

                  <div className="mb-4 flex flex-wrap gap-2">
                    {property.features.slice(0, 3).map((feature, idx) => (
                      <span
                        key={idx}
                        className="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700"
                      >
                        {feature}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center justify-between border-t border-gray-200 pt-4">
                    <div>
                      <p className="text-2xl font-bold text-blue-600">{property.price}</p>
                    </div>
                    <button
                      onClick={() => {
                        if (onViewProperty) {
                          onViewProperty(property.id);
                        } else {
                          onGetStarted();
                        }
                      }}
                      className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700"
                    >
                      View Details
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <button
              onClick={onGetStarted}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-green-600 px-8 py-4 text-lg font-semibold text-white hover:from-blue-700 hover:to-green-700"
            >
              Browse All Properties
              <ArrowRight className="h-5 w-5" />
            </button>
            <p className="mt-3 text-sm text-gray-600">
              Join free to view all available properties and apply online
            </p>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-linear-to-br from-blue-50 to-green-50 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-4xl font-bold">Simple, Transparent Pricing</h2>
            <p className="text-xl text-gray-600">Choose the plan that fits your portfolio size</p>
          </div>

          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 md:grid-cols-3">
            {[
              {
                name: 'Starter',
                price: '₦9,999',
                units: 'Up to 10 units',
                features: [
                  'Property & Tenant Management',
                  'Rent Collection',
                  'Basic Maintenance',
                  'Email Support',
                ],
              },
              {
                name: 'Professional',
                price: '₦29,999',
                units: 'Up to 50 units',
                features: [
                  'Everything in Starter',
                  'AI Assistant',
                  'WhatsApp Integration',
                  'Advanced Analytics',
                  'Priority Support',
                ],
                popular: true,
              },
              {
                name: 'Enterprise',
                price: 'Custom',
                units: '100+ units',
                features: [
                  'Everything in Professional',
                  'Custom Integration',
                  'Dedicated Account Manager',
                  'SLA Guarantee',
                  '24/7 Phone Support',
                ],
              },
            ].map((plan, index) => (
              <div
                key={index}
                className={`rounded-xl border-2 bg-white p-8 ${plan.popular ? 'scale-105 border-blue-600 shadow-xl' : 'border-gray-200'} relative`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 transform rounded-full bg-blue-600 px-4 py-1 text-sm font-medium text-white">
                    Most Popular
                  </div>
                )}
                <h3 className="mb-2 text-2xl font-bold">{plan.name}</h3>
                <p className="mb-4 text-gray-600">{plan.units}</p>
                <p className="mb-6 text-4xl font-bold">
                  {plan.price}
                  <span className="text-lg text-gray-600">/month</span>
                </p>
                <ul className="mb-8 space-y-3">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => onSelectPlan(plan)}
                  className={`w-full rounded-lg py-3 font-semibold ${
                    plan.popular
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'border-2 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Get Started
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-blue-600 py-20 text-white">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="mb-4 text-4xl font-bold">Ready to Transform Your Property Management?</h2>
          <p className="mb-8 text-xl text-blue-100">
            Join thousands of property managers already using Proplity
          </p>
          <button
            onClick={onGetStarted}
            className="inline-flex items-center gap-2 rounded-lg bg-white px-8 py-4 text-lg font-semibold text-blue-600 hover:bg-gray-100"
          >
            Start Your Free Trial
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 py-12 text-gray-400">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-8 grid grid-cols-1 gap-8 md:grid-cols-4">
            <div>
              <div className="mb-4">
                <Logo className="text-white" />
              </div>
              <p className="text-sm">
                Nigeria's most trusted AI-native property management platform
              </p>
            </div>
            <div>
              <h4 className="mb-4 font-semibold text-white">Product</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="#" className="hover:text-white">
                    Features
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white">
                    Pricing
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white">
                    Demo
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white">
                    FAQ
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 font-semibold text-white">Company</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="#" className="hover:text-white">
                    About Us
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white">
                    Blog
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white">
                    Careers
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white">
                    Contact
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 font-semibold text-white">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="#" className="hover:text-white">
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white">
                    Terms of Service
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white">
                    NDPR Compliance
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-sm">
            <p>&copy; 2026 Proplity. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
