import {
  Wrench,
  DollarSign,
  Star,
  MessageSquare,
  FileText,
  CheckCircle,
  ArrowRight,
  Bell,
  Shield,
  TrendingUp,
  Users,
  BarChart3,
} from 'lucide-react';
import { Logo } from './Logo';
import { mockServiceProviderFeatureJobs as jobs } from '../store/mockData';

interface ServiceProviderFeaturePageProps {
  onGetStarted: () => void;
  onGoHome?: () => void;
  onViewPricing?: () => void;
  onViewContact?: () => void;
  onViewAbout?: () => void;
  onViewLandlordPage?: () => void;
  onViewTenantPage?: () => void;
  onViewVendorPage?: () => void;
}

export function ServiceProviderFeaturePage({
  onGetStarted,
  onGoHome,
  onViewPricing,
  onViewContact,
  onViewAbout,
  onViewLandlordPage,
  onViewTenantPage,
  onViewVendorPage,
}: ServiceProviderFeaturePageProps) {
  // const features = [
  //   {
  //     icon: Wrench,
  //     title: 'Job Matching',
  //     description:
  //       'Get matched to maintenance and repair jobs in your area based on your skills, availability, and past performance.',
  //   },
  //   {
  //     icon: FileText,
  //     title: 'In-App Invoicing',
  //     description:
  //       'Create and send professional invoices directly in Proplity. Get paid faster with automated payment reminders.',
  //   },
  //   {
  //     icon: DollarSign,
  //     title: 'Payment Tracking',
  //     description:
  //       'Track all pending and completed payments in one place. View your monthly earnings history and generate income reports.',
  //   },
  //   {
  //     icon: Star,
  //     title: 'Rating & Reviews',
  //     description:
  //       'Build a strong reputation with verified reviews from property managers and landlords. Top-rated vendors get priority job matches.',
  //   },
  //   {
  //     icon: BarChart3,
  //     title: 'Job History',
  //     description:
  //       'Access a full record of every completed job — with photos, timelines, and client feedback — to showcase your work.',
  //   },
  //   {
  //     icon: MessageSquare,
  //     title: 'Direct Client Chat',
  //     description:
  //       'Communicate with property managers and tenants via secure in-app messaging. No need to share personal phone numbers.',
  //   },
  // ];

  // const steps = [
  //   {
  //     step: '1',
  //     title: 'Register & Get Verified',
  //     desc: 'Sign up as a service provider, upload your qualifications, and get verified by Proplity. Verification boosts your job match score.',
  //   },
  //   {
  //     step: '2',
  //     title: 'Receive & Accept Jobs',
  //     desc: 'Browse available maintenance jobs near you or get matched automatically. Accept jobs, communicate with clients, and get to work.',
  //   },
  //   {
  //     step: '3',
  //     title: 'Complete, Invoice & Get Paid',
  //     desc: 'Mark jobs as complete, upload proof photos, send your invoice, and receive payment directly into your bank account.',
  //   },
  // ];

  const features = [
    {
      icon: Wrench,
      title: 'Smart Dispatch & Jobs Board',
      description:
        'Get matched with relevant maintenance requests from landlords and managers near you. View descriptions, photos, and estimated budgets.',
    },
    {
      icon: DollarSign,
      title: 'Transparent Pricing & Fast Payouts',
      description:
        'Provide clear estimates and invoices. Payments are deposited directly to your bank account upon client verification of work.',
    },
    {
      icon: Star,
      title: 'Work History & Reputation Signals',
      description:
        'Build your profile with ratings and reviews from completed jobs to attract more premium clients and property managers.',
    },
    {
      icon: MessageSquare,
      title: 'Direct Chat with Tenants & Managers',
      description:
        'Communicate details, ask questions, and update stakeholders on arrival times through the unified messaging portal.',
    },
  ];

  const steps = [
    {
      step: '1',
      title: 'Verify Your Profile',
      desc: 'Sign up, provide your credentials/trade certifications, and setup your bank account details for payouts.',
    },
    {
      step: '2',
      title: 'Find & Bid on Jobs',
      desc: 'Browse matching maintenance requests or receive direct requests from managers. Submit your estimate and timeline.',
    },
    {
      step: '3',
      title: 'Complete, Invoice & Get Paid',
      desc: 'Mark jobs as complete, upload proof photos, send your invoice, and receive payment directly into your bank account.',
    },
  ];

  const priorityColors: Record<string, string> = {
    High: 'bg-orange-100 text-orange-700',
    Urgent: 'bg-red-100 text-red-700',
    Medium: 'bg-blue-100 text-blue-700',
  };

  const statusColors: Record<string, string> = {
    'In Progress': 'bg-yellow-100 text-yellow-700',
    Assigned: 'bg-blue-100 text-blue-700',
    Completed: 'bg-green-100 text-green-700',
  };

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
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 transition-colors hover:bg-blue-50 hover:text-blue-600"
                  >
                    For Tenants
                  </button>
                  <button
                    onClick={onViewVendorPage}
                    className="w-full px-4 py-2.5 text-left text-sm font-semibold text-gray-700 transition-colors hover:bg-blue-50 hover:text-blue-600"
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
      <section className="bg-gradient-to-br from-orange-50 via-white to-yellow-50 pt-20 pb-24">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-orange-100 px-4 py-2 text-sm font-medium text-orange-700">
            <Wrench className="h-4 w-4" />
            For Maintenance Professionals & Vendors
          </div>
          <h1 className="mb-6 text-5xl leading-tight font-bold text-gray-900 md:text-6xl">
            Grow Your Business with{' '}
            <span className="text-orange-600">Verified Maintenance Jobs</span>
          </h1>
          <p className="mx-auto mb-10 max-w-3xl text-xl leading-relaxed text-gray-600">
            Connect with property managers and landlords who need reliable service providers. Get
            matched to jobs, invoice digitally, and build a verified track record that wins you more
            work.
          </p>
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={onGetStarted}
              className="flex items-center gap-2 rounded-lg bg-orange-600 px-8 py-4 text-lg font-semibold text-white hover:bg-orange-700"
            >
              Register as a Service Provider
              <ArrowRight className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Free to join
            </div>
          </div>
        </div>
      </section>

      {/* Dashboard Preview */}
      <section className="bg-gray-50 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-4xl font-bold text-gray-900">Your Vendor Dashboard</h2>
            <p className="text-xl text-gray-600">Track jobs, earnings, and ratings in one place</p>
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
                app.proplity.ng/vendor/dashboard
              </div>
              <Bell className="h-4 w-4 text-gray-400" />
            </div>

            <div className="bg-gray-50 p-6">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    Good afternoon, Emeka Cooling Services
                  </h3>
                  <p className="text-sm text-gray-500">
                    AC Technician · Verified Provider · Lagos, Nigeria
                  </p>
                </div>
                <div className="flex items-center gap-2 rounded-full bg-orange-100 px-3 py-1 text-sm font-medium text-orange-700">
                  <Shield className="h-4 w-4" />
                  Verified Vendor
                </div>
              </div>

              {/* Stat Cards */}
              <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500">Active Jobs</span>
                    <Wrench className="h-4 w-4 text-orange-500" />
                  </div>
                  <p className="text-3xl font-bold text-gray-900">5</p>
                  <p className="mt-1 text-xs text-orange-600">2 due this week</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500">Jobs Completed</span>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  </div>
                  <p className="text-3xl font-bold text-gray-900">47</p>
                  <p className="mt-1 text-xs text-green-600">all time</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500">Total Earned</span>
                    <DollarSign className="h-4 w-4 text-blue-500" />
                  </div>
                  <p className="text-3xl font-bold text-gray-900">₦1.84M</p>
                  <p className="mt-1 text-xs text-blue-600">since joining</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500">Rating</span>
                    <Star className="h-4 w-4 text-yellow-500" />
                  </div>
                  <p className="text-3xl font-bold text-gray-900">4.8</p>
                  <p className="mt-1 text-xs text-yellow-600">★ from 39 reviews</p>
                </div>
              </div>

              {/* Jobs Table */}
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                  <h4 className="text-sm font-semibold text-gray-900">Current Jobs</h4>
                  <span className="cursor-pointer text-xs font-medium text-blue-600">View all</span>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">
                        Job
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">
                        Property
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">
                        Priority
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {jobs.map((job, i) => (
                      <tr key={i} className="transition-colors hover:bg-gray-50">
                        <td className="px-5 py-3 font-medium text-gray-900">{job.title}</td>
                        <td className="px-5 py-3 text-gray-500">{job.property}</td>
                        <td className="px-5 py-3">
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-medium ${priorityColors[job.priority]}`}
                          >
                            {job.priority}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-medium ${statusColors[job.status]}`}
                          >
                            {job.status}
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
            <h2 className="mb-4 text-4xl font-bold text-gray-900">Tools to Grow Your Business</h2>
            <p className="text-xl text-gray-600">
              Six features designed to help service providers thrive
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
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-orange-100">
                    <Icon className="h-6 w-6 text-orange-600" />
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
            <h2 className="mb-4 text-4xl font-bold text-gray-900">
              How It Works for Service Providers
            </h2>
            <p className="text-xl text-gray-600">
              From registration to payment in three simple steps
            </p>
          </div>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {steps.map((item, index) => (
              <div key={index} className="relative">
                <div className="rounded-xl border border-gray-200 bg-white p-8 transition-shadow hover:shadow-lg">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-orange-600 text-xl font-bold text-white">
                    {item.step}
                  </div>
                  <h3 className="mb-3 text-xl font-semibold text-gray-900">{item.title}</h3>
                  <p className="text-gray-600">{item.desc}</p>
                </div>
                {index < 2 && (
                  <div className="absolute top-1/2 -right-4 hidden -translate-y-1/2 transform md:block">
                    <ArrowRight className="h-8 w-8 text-orange-300" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-orange-600 py-20 text-white">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <Wrench className="mx-auto mb-6 h-16 w-16 text-orange-200" />
          <h2 className="mb-4 text-4xl font-bold">Register as a Service Provider — Free</h2>
          <p className="mb-8 text-xl text-orange-100">
            Join Nigeria's largest network of verified maintenance professionals.
          </p>
          <button
            onClick={onGetStarted}
            className="inline-flex items-center gap-2 rounded-lg bg-white px-8 py-4 text-lg font-semibold text-orange-600 hover:bg-gray-100"
          >
            Create Your Vendor Account
            <ArrowRight className="h-5 w-5" />
          </button>
          <p className="mt-4 text-sm text-orange-200">
            Free to join · Get paid on completion · Build your reputation
          </p>
        </div>
      </section>
    </div>
  );
}
