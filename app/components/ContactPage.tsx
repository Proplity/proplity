import { useState } from 'react';
import { Logo } from './Logo';
import {
  Mail,
  Phone,
  MapPin,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  ExternalLink,
  Send,
} from 'lucide-react';

interface ContactPageProps {
  onGoHome: () => void;
  onGetStarted: () => void;
  onViewPricing: () => void;
  onViewLandlordPage: () => void;
  onViewTenantPage: () => void;
  onViewVendorPage: () => void;
}

const FAQS = [
  {
    q: 'How quickly can I set up my first property?',
    a: 'Most landlords complete their first property listing in under 10 minutes. Our AI-assisted form pre-fills common details and our verification team reviews listings within 2 hours during business hours.',
  },
  {
    q: 'Does Proplity work with local Nigerian bank accounts?',
    a: 'Yes. We support all major Nigerian banks including GTBank, Access Bank, Zenith, UBA, First Bank and more. Rent payments are transferred directly to your registered account within 24 hours of collection.',
  },
  {
    q: 'Can I manage mixed-use properties (commercial & residential)?',
    a: 'Absolutely. Proplity supports residential apartments, commercial spaces, mixed-use buildings, and entire estates. You can tag each unit by type and apply different billing cycles accordingly.',
  },
  {
    q: 'What kind of verification do you perform on listings?',
    a: 'Our AI cross-references listing details against property registry data, satellite imagery, and historical rental pricing. Landlords also undergo NIN verification before listings go live.',
  },
  {
    q: 'Is there a dedicated account manager for enterprise users?',
    a: 'Yes. Enterprise plan subscribers get a dedicated account manager available via direct phone, email, and WhatsApp. They handle onboarding, bulk imports, and ongoing support for large portfolios.',
  },
];

const OFFICES = [
  {
    city: 'Lagos',
    address: '15 Lekki Phase 1, Lagos State, Nigeria',
    phone: '+234 1 234 5678',
    email: 'lagos@proplity.com',
  },
  {
    city: 'Abuja',
    address: 'Plot 43 Maitama District, Abuja, FCT',
    phone: '+234 9 678 5432',
    email: 'abuja@proplity.com',
  },
  {
    city: 'Port Harcourt',
    address: 'GRA Phase 2, Port Harcourt, Rivers State',
    phone: '+234 8 123 4567',
    email: 'ph@proplity.com',
  },
];

const PORTFOLIO_SIZES = ['1–2 units', '3–10 units', '11–30 units', '31–100 units', '100+ units'];

const HELP_TOPICS = [
  'General Inquiry',
  'Sales & Pricing',
  'Technical Support',
  'Partnership Opportunity',
  'Press & Media',
  'Other',
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-200 last:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 py-4 text-left"
      >
        <span className="text-sm font-medium text-gray-900">{q}</span>
        {open ? (
          <ChevronUp className="h-4 w-4 flex-shrink-0 text-gray-400" />
        ) : (
          <ChevronDown className="h-4 w-4 flex-shrink-0 text-gray-400" />
        )}
      </button>
      {open && <p className="pb-4 text-sm leading-relaxed text-gray-600">{a}</p>}
    </div>
  );
}

export function ContactPage({
  onGoHome,
  onGetStarted,
  onViewPricing,
  onViewLandlordPage,
  onViewTenantPage,
  onViewVendorPage,
}: ContactPageProps) {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    company: '',
    portfolioSize: '',
    helpTopic: '',
    message: '',
  });
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSent(true);
  };

  const inputCls =
    'w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white placeholder-gray-400';

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 border-b border-gray-100 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <button onClick={onGoHome} className="focus:outline-none">
            <Logo />
          </button>

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
            <button
              onClick={onGoHome}
              className="text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              How it Works
            </button>
            <span className="border-b-2 border-blue-600 pb-0.5 text-sm font-semibold text-blue-600">
              Contact Us
            </span>
            <button
              onClick={onGoHome}
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

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-blue-700 pt-14 pb-20 text-white">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-40 -left-40 h-[480px] w-[480px] rounded-full bg-blue-500/20" />
          <div className="absolute -right-32 -bottom-32 h-96 w-96 rounded-full bg-blue-900/40" />
          <div className="absolute top-10 right-1/3 h-64 w-64 rounded-full bg-blue-600/20" />
        </div>
        <div className="relative mx-auto max-w-3xl px-6 text-center">
          <span className="mb-5 inline-block rounded-full border border-white/20 bg-white/15 px-4 py-1.5 text-xs font-semibold tracking-widest text-blue-100 uppercase">
            Support · Sales · Partnerships
          </span>
          <h1 className="mb-4 text-4xl font-bold md:text-5xl">Get in Touch</h1>
          <p className="mx-auto max-w-xl text-base leading-relaxed text-blue-100">
            We're here to help you transform your property operations with AI intelligence. Reach
            out to our team of experts today.
          </p>
        </div>
      </section>

      {/* ── Form + Sidebar ── */}
      <section className="mx-auto w-full max-w-6xl px-6 py-16">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-3">
          {/* Left — form */}
          <div className="lg:col-span-2">
            <h2 className="mb-1 text-xl font-bold text-gray-900">Send us a message</h2>
            <p className="mb-7 text-sm text-gray-500">
              Fill out the form below and we'll get back to you within 24 hours.
            </p>

            {sent ? (
              <div className="rounded-2xl border border-green-200 bg-green-50 p-10 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
                  <Send className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="mb-2 text-lg font-bold text-green-800">Message sent!</h3>
                <p className="text-sm text-green-700">
                  Thanks for reaching out. Our team will get back to you within 24 hours.
                </p>
                <button
                  onClick={() => setSent(false)}
                  className="mt-5 text-sm text-green-700 underline hover:text-green-900"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-gray-600">
                      First Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="First Name"
                      value={form.firstName}
                      onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-gray-600">
                      Last Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Last Name"
                      value={form.lastName}
                      onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-600">
                    Work Email
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="you@company.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-600">
                    Company Name
                  </label>
                  <input
                    type="text"
                    placeholder="Company Name"
                    value={form.company}
                    onChange={(e) => setForm({ ...form, company: e.target.value })}
                    className={inputCls}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-gray-600">
                      Property Portfolio Size
                    </label>
                    <div className="relative">
                      <select
                        value={form.portfolioSize}
                        onChange={(e) => setForm({ ...form, portfolioSize: e.target.value })}
                        className={`${inputCls} appearance-none pr-8`}
                      >
                        <option value="">Select size</option>
                        {PORTFOLIO_SIZES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-gray-600">
                      How can we help?
                    </label>
                    <div className="relative">
                      <select
                        value={form.helpTopic}
                        onChange={(e) => setForm({ ...form, helpTopic: e.target.value })}
                        className={`${inputCls} appearance-none pr-8`}
                      >
                        <option value="">Select topic</option>
                        {HELP_TOPICS.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-600">Message</label>
                  <textarea
                    required
                    rows={5}
                    placeholder="Tell us about your portfolio..."
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    className={`${inputCls} resize-none`}
                  />
                </div>

                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
                >
                  <Send className="h-4 w-4" />
                  Send Message
                </button>
              </form>
            )}
          </div>

          {/* Right — contact info sidebar */}
          <div className="space-y-6">
            {/* Direct Contact */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-sm font-bold text-gray-900">Direct Contact</h3>
              <div className="space-y-3">
                <a
                  href="mailto:hello@proplity.com"
                  className="group flex items-center gap-3 text-sm text-gray-700 transition-colors hover:text-blue-600"
                >
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50 transition-colors group-hover:bg-blue-100">
                    <Mail className="h-4 w-4 text-blue-600" />
                  </div>
                  hello@proplity.com
                </a>
                <a
                  href="tel:+2341008007765489"
                  className="group flex items-center gap-3 text-sm text-gray-700 transition-colors hover:text-blue-600"
                >
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50 transition-colors group-hover:bg-blue-100">
                    <Phone className="h-4 w-4 text-blue-600" />
                  </div>
                  +234 130 800 PROPLITY
                </a>
              </div>
            </div>

            {/* Help Center */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="mb-2 text-sm font-bold text-gray-900">Help Center</h3>
              <p className="mb-4 text-xs leading-relaxed text-gray-500">
                Looking for quick answers? Browse our detailed guides and help documentation.
              </p>
              <a
                href="#"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                Visit Help Center
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>

            {/* Live Chat */}
            <div className="rounded-2xl bg-gray-900 p-6 text-white">
              <div className="mb-2 flex items-center gap-2">
                <div className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
                <h3 className="text-sm font-bold">Live Chat</h3>
              </div>
              <p className="mb-5 text-xs leading-relaxed text-gray-400">
                Our support team is also on WhatsApp 24/7. Get instant answers from a real person.
              </p>
              <a
                href="https://wa.me/2341008007765489"
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-500 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-600"
              >
                <MessageCircle className="h-4 w-4" />
                Chat on WhatsApp
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Our Offices ── */}
      <section className="bg-gray-50 px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 text-center">
            <h2 className="mb-2 text-2xl font-bold text-gray-900">Our Offices</h2>
            <p className="text-sm text-gray-500">Drop by and say hello at any of our hubs</p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {OFFICES.map((office) => (
              <div
                key={office.city}
                className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="mb-4 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
                    <MapPin className="h-4 w-4 text-blue-600" />
                  </div>
                  <h3 className="font-bold text-gray-900">{office.city}</h3>
                </div>

                <div className="mb-5 space-y-2">
                  <p className="text-sm leading-relaxed text-gray-600">{office.address}</p>
                  <a
                    href={`tel:${office.phone}`}
                    className="flex items-center gap-2 text-sm text-gray-600 transition-colors hover:text-blue-600"
                  >
                    <Phone className="h-3.5 w-3.5 text-gray-400" />
                    {office.phone}
                  </a>
                  <a
                    href={`mailto:${office.email}`}
                    className="flex items-center gap-2 text-sm text-gray-600 transition-colors hover:text-blue-600"
                  >
                    <Mail className="h-3.5 w-3.5 text-gray-400" />
                    {office.email}
                  </a>
                </div>

                <a
                  href="#"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  View on Map
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="bg-white px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <div className="mb-10 text-center">
            <h2 className="mb-2 text-2xl font-bold text-gray-900">Contact FAQ</h2>
            <p className="text-sm text-gray-500">Quick answers to common inquiries</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white px-6 shadow-sm">
            {FAQS.map((faq) => (
              <FaqItem key={faq.q} q={faq.q} a={faq.a} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="mt-auto bg-gray-900 px-6 py-12 text-gray-400">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-10 md:grid-cols-4">
          <div>
            <Logo className="opacity-90 brightness-0 invert" />
            <p className="mt-3 text-xs leading-relaxed text-gray-500">
              Nigeria's first AI-native property management platform. Built for the realities of the
              modern rental market.
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
    </div>
  );
}
