import { useState } from 'react';
import { Logo } from './Logo';
import {
  ChevronDown,
  Users,
  TrendingUp,
  Shield,
  Star,
  Zap,
  MessageSquare,
  BarChart3,
  CheckCircle,
  ArrowRight,
} from 'lucide-react';

interface AboutPageProps {
  onGoHome: () => void;
  onGetStarted: () => void;
  onViewPricing: () => void;
  onViewContact: () => void;
  onViewLandlordPage: () => void;
  onViewTenantPage: () => void;
  onViewVendorPage: () => void;
}

const STATS = [
  { value: '10,000+', label: 'Properties managed' },
  { value: '70%', label: 'Reduction in manual work' },
  { value: '94%', label: 'Landlord satisfaction rate' },
];

const WHAT_WE_DO = [
  {
    icon: Users,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    title: 'Effortless Tenant Onboarding',
    desc: 'Digital applications, NIN verification, and instant credit checks reduce your screening time from days to minutes.',
  },
  {
    icon: TrendingUp,
    color: 'text-green-600',
    bg: 'bg-green-50',
    title: 'Smart Rent Tracking',
    desc: 'Automated reminders, AI payment predictions, and direct bank integrations mean rent arrives on time, every time.',
  },
  {
    icon: MessageSquare,
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    title: 'Unified Communication',
    desc: 'WhatsApp-first messaging keeps landlords, managers, tenants, and vendors in one organised thread — no more scattered texts.',
  },
  {
    icon: BarChart3,
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    title: 'Data-Driven Insights',
    desc: 'Occupancy rates, rental yield, maintenance cost trends — all in real-time dashboards built for the Nigerian market.',
  },
];

const AI_FEATURES = [
  'AI-verified property listings that block fraudulent ads before they go live',
  'WhatsApp assistant that answers tenant queries 24/7 without staff overhead',
  'Predictive rent collection that flags likely late payers 14 days in advance',
  '360° virtual tour generation directly from your phone camera',
  'Smart vendor matching that assigns maintenance jobs by proximity and rating',
];

const VALUES = [
  {
    icon: Star,
    color: 'text-yellow-500',
    bg: 'bg-yellow-50',
    title: 'Authenticity',
    desc: 'We build for Nigeria as it is — not as a copy of foreign markets. Every feature is designed around local realities.',
  },
  {
    icon: Zap,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    title: 'Excellence',
    desc: 'We hold ourselves to the highest standard in product, support, and every interaction with our community.',
  },
  {
    icon: Shield,
    color: 'text-green-600',
    bg: 'bg-green-50',
    title: 'Safety',
    desc: 'Landlord funds, tenant data, and property records are protected with bank-grade encryption and fraud detection.',
  },
];

// Reusable nav — same structure as other public pages
function PublicNav({
  onGoHome,
  onViewContact,
  onViewPricing,
  onViewLandlordPage,
  onViewTenantPage,
  onViewVendorPage,
  activePage,
}: {
  onGoHome: () => void;
  onViewContact: () => void;
  onViewPricing: () => void;
  onViewLandlordPage: () => void;
  onViewTenantPage: () => void;
  onViewVendorPage: () => void;
  activePage?: string;
  onGetStarted?: () => void;
}) {
  const link = (label: string, action: () => void) => {
    const active = activePage === label;
    return (
      <button
        onClick={action}
        className={`text-sm font-medium transition-colors ${active ? 'border-b-2 border-blue-600 pb-0.5 text-blue-600' : 'text-gray-700 hover:text-gray-900'}`}
      >
        {label}
      </button>
    );
  };
  return (
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
                  { label: 'For Service Providers', action: onViewVendorPage },
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
          {link('How it Works', onGoHome)}
          {link('Contact Us', onViewContact)}
          {link('About Us', onGoHome)}
          {link('Pricing', onViewPricing)}
        </div>
        <button
          onClick={onGoHome}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          Get Started
        </button>
      </div>
    </nav>
  );
}

export function AboutPage({
  onGoHome,
  onGetStarted,
  onViewPricing,
  onViewContact,
  onViewLandlordPage,
  onViewTenantPage,
  onViewVendorPage,
}: AboutPageProps) {
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
            <button
              onClick={onViewContact}
              className="text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              Contact Us
            </button>
            <span className="border-b-2 border-blue-600 pb-0.5 text-sm font-semibold text-blue-600">
              About Us
            </span>
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
      <section className="relative overflow-hidden bg-gray-950 pt-16 pb-24 text-white">
        {/* decorative rings */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-48 -left-48 h-[560px] w-[560px] rounded-full border border-white/5" />
          <div className="absolute -top-24 -left-24 h-[360px] w-[360px] rounded-full border border-white/5" />
          <div className="absolute right-0 -bottom-32 h-[480px] w-[480px] rounded-full border border-white/5" />
          <div className="absolute top-1/3 right-1/4 h-64 w-64 rounded-full bg-blue-700/10" />
        </div>
        <div className="relative mx-auto max-w-4xl px-6 text-center">
          <span className="mb-6 inline-block rounded-full border border-white/10 bg-white/10 px-4 py-1.5 text-xs font-semibold tracking-widest text-blue-300 uppercase">
            Proplity · Nigeria's Platform
          </span>
          <h1 className="mb-6 text-4xl leading-tight font-bold md:text-6xl">
            Where Property
            <br />
            Meets Simplicity
          </h1>
          <p className="mx-auto mb-12 max-w-xl text-base leading-relaxed text-gray-400">
            Proplity transforms management with AI — built for local scale and simplicity, in
            Nigeria's rental market.
          </p>

          {/* Stats row */}
          <div className="mx-auto grid max-w-2xl grid-cols-3 gap-6">
            {STATS.map((s) => (
              <div
                key={s.label}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-5"
              >
                <p className="mb-1 text-3xl font-bold text-white">{s.value}</p>
                <p className="text-xs text-gray-400">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Our Story ── */}
      <section className="bg-white px-6 py-20">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 lg:grid-cols-2">
          <div>
            <span className="mb-3 block text-xs font-bold tracking-widest text-blue-600 uppercase">
              Our Story
            </span>
            <h2 className="mb-5 text-3xl leading-snug font-bold text-gray-900">
              Born out of the
              <br />
              Spreadsheet Chaos
            </h2>
            <div className="space-y-4 text-sm leading-relaxed text-gray-600">
              <p>
                Proplity was founded in 2022 by a team of Lagos-based engineers and landlords who
                were tired of watching property management drown in WhatsApp groups, spreadsheets,
                and missed rent deadlines. The Nigerian rental market had the volume — but none of
                the infrastructure.
              </p>
              <p>
                We built Proplity to change that. Starting with a single apartment block in Lekki,
                we designed every feature around the actual pain points landlords and tenants face
                in Nigeria: cash-dominant rent payments, high-risk tenant verification, fragmented
                communication, and zero data visibility.
              </p>
              <p>
                Today, Proplity powers thousands of properties across Lagos, Abuja, and Port
                Harcourt — and we're just getting started. Our mission is simple: make property
                management as easy as sending a WhatsApp message.
              </p>
            </div>
            <button
              onClick={onGetStarted}
              className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 transition-all hover:gap-3"
            >
              Get started today <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          {/* City image placeholder — rich gradient + city silhouette */}
          <div className="relative h-80 overflow-hidden rounded-2xl shadow-2xl lg:h-[420px]">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-300 via-amber-400 to-blue-900" />
            {/* stylised skyline silhouette */}
            <svg
              className="absolute bottom-0 w-full"
              viewBox="0 0 800 200"
              preserveAspectRatio="none"
            >
              <path
                d="M0,200 L0,140 L40,140 L40,100 L60,100 L60,80 L80,80 L80,60 L100,60 L100,80 L120,80 L120,40 L140,40 L140,80 L160,80 L160,100 L200,100 L200,120 L220,120 L220,90 L240,90 L240,70 L260,70 L260,50 L280,50 L280,70 L300,70 L300,90 L320,90 L320,110 L360,110 L360,80 L380,80 L380,60 L400,60 L400,40 L420,40 L420,60 L440,60 L440,80 L460,80 L460,110 L500,110 L500,90 L520,90 L520,70 L550,70 L550,90 L580,90 L580,110 L600,110 L600,130 L640,130 L640,100 L660,100 L660,80 L680,80 L680,100 L720,100 L720,130 L760,130 L760,150 L800,150 L800,200 Z"
                fill="rgba(0,0,0,0.55)"
              />
              <path
                d="M0,200 L0,160 L60,160 L60,145 L100,145 L100,130 L140,130 L140,150 L200,150 L200,140 L260,140 L260,125 L320,125 L320,145 L400,145 L400,135 L460,135 L460,150 L520,150 L520,138 L580,138 L580,155 L640,155 L640,145 L720,145 L720,160 L800,160 L800,200 Z"
                fill="rgba(0,0,0,0.35)"
              />
            </svg>
            {/* warm glow at horizon */}
            <div className="absolute right-0 bottom-0 left-0 h-32 bg-gradient-to-t from-orange-900/60 to-transparent" />
            {/* city label */}
            <div className="absolute top-4 left-4 rounded-lg bg-black/30 px-3 py-1.5 backdrop-blur-sm">
              <p className="text-xs font-medium text-white">Lagos, Nigeria</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pull Quote ── */}
      <section className="bg-gray-900 px-6 py-20 text-white">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-4 font-serif text-7xl leading-none text-blue-400 opacity-60">"</div>
          <blockquote className="mb-10 text-2xl leading-snug font-semibold text-white md:text-3xl">
            Make property management smart, seamless, and human.
          </blockquote>
          <div className="mx-auto grid max-w-lg grid-cols-3 gap-8 border-t border-white/10 pt-8">
            {[
              { value: '3', label: 'Co-Founders' },
              { value: '₦2B+', label: 'Rent Processed' },
              { value: '12+', label: 'Partners' },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-2xl font-bold text-white">{s.value}</p>
                <p className="mt-1 text-xs text-gray-400">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── What We Do ── */}
      <section className="bg-white px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <h2 className="mb-3 text-2xl font-bold text-gray-900">What We Do</h2>
            <p className="mx-auto max-w-xl text-sm text-gray-500">
              Proplity is not just our business — it's the technology platform that helps property
              businesses thrive.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            {WHAT_WE_DO.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="flex gap-4">
                  <div
                    className={`h-10 w-10 rounded-xl ${item.bg} mt-0.5 flex flex-shrink-0 items-center justify-center`}
                  >
                    <Icon className={`h-5 w-5 ${item.color}`} />
                  </div>
                  <div>
                    <h3 className="mb-1.5 font-semibold text-gray-900">{item.title}</h3>
                    <p className="text-sm leading-relaxed text-gray-500">{item.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── AI Features ── */}
      <section className="bg-gray-950 px-6 py-20">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 lg:grid-cols-2">
          <div>
            <span className="mb-3 block text-xs font-bold tracking-widest text-blue-400 uppercase">
              Powered by AI
            </span>
            <h2 className="mb-6 text-3xl leading-snug font-bold text-white">
              Smarter Tenant
              <br />
              Management with AI
            </h2>
            <ul className="mb-8 space-y-4">
              {AI_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-3">
                  <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-400" />
                  <span className="text-sm leading-relaxed text-gray-300">{f}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={onGetStarted}
              className="inline-flex items-center gap-2 text-sm font-semibold text-blue-400 transition-all hover:gap-3"
            >
              Learn more <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          {/* Dark screen mockup */}
          <div className="relative">
            <div className="rounded-2xl border border-gray-700 bg-gray-800 p-4 shadow-2xl">
              {/* mock top bar */}
              <div className="mb-4 flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-red-500" />
                <div className="h-3 w-3 rounded-full bg-yellow-500" />
                <div className="h-3 w-3 rounded-full bg-green-500" />
                <div className="ml-2 h-5 flex-1 rounded bg-gray-700" />
              </div>
              {/* mock dashboard grid */}
              <div className="mb-3 grid grid-cols-3 gap-2">
                {['bg-blue-600', 'bg-green-600', 'bg-purple-600'].map((c, i) => (
                  <div key={i} className={`${c} rounded-xl p-3`}>
                    <div className="mb-2 h-6 w-6 rounded bg-white/20" />
                    <div className="mb-1 h-2 w-3/4 rounded bg-white/40" />
                    <div className="h-4 w-1/2 rounded bg-white/60" />
                  </div>
                ))}
              </div>
              <div className="mb-3 rounded-xl bg-gray-700 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
                  <div className="h-2 w-24 rounded bg-gray-500" />
                </div>
                {[70, 45, 88, 60].map((w, i) => (
                  <div key={i} className="mb-1.5 flex items-center gap-2">
                    <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${w}%` }} />
                    <div className="h-1.5 flex-1 rounded-full bg-gray-600" />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[1, 2].map((i) => (
                  <div key={i} className="rounded-xl bg-gray-700 p-3">
                    <div className="mb-2 h-2 w-3/4 rounded bg-gray-500" />
                    <div className="h-8 rounded bg-gray-600" />
                  </div>
                ))}
              </div>
            </div>
            {/* glow */}
            <div className="absolute -inset-4 -z-10 rounded-3xl bg-blue-600/10 blur-2xl" />
          </div>
        </div>
      </section>

      {/* ── Core Values ── */}
      <section className="bg-white px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <h2 className="mb-3 text-2xl font-bold text-gray-900">Our Core Values</h2>
            <p className="mx-auto max-w-md text-sm text-gray-500">
              These values guide the goals, culture, and every decision at Proplity TMS.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {VALUES.map((v) => {
              const Icon = v.icon;
              return (
                <div
                  key={v.title}
                  className="rounded-2xl border border-gray-200 bg-white p-7 text-center shadow-sm transition-shadow hover:shadow-md"
                >
                  <div
                    className={`h-12 w-12 ${v.bg} mx-auto mb-4 flex items-center justify-center rounded-xl`}
                  >
                    <Icon className={`h-6 w-6 ${v.color}`} />
                  </div>
                  <h3 className="mb-2 font-bold text-gray-900">{v.title}</h3>
                  <p className="text-sm leading-relaxed text-gray-500">{v.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Founder Quote ── */}
      <section className="bg-gray-50 px-6 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mb-3 font-serif text-6xl leading-none text-blue-300 opacity-70">"</div>
          <blockquote className="mb-5 text-xl leading-snug font-semibold text-gray-900 md:text-2xl">
            Property management shouldn't be a hassle. It should be clear, efficient, and scalable.
          </blockquote>
          <button
            onClick={onGetStarted}
            className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 transition-all hover:gap-3"
          >
            Start with Proplity <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="bg-blue-700 px-6 py-16 text-center text-white">
        <h2 className="mb-3 text-3xl font-bold">Ready to Transform Your Property Management?</h2>
        <p className="mx-auto mb-8 max-w-md text-sm text-blue-200">
          Join thousands of landlords and property managers already using Proplity to simplify their
          operations.
        </p>
        <button
          onClick={onGetStarted}
          className="rounded-xl bg-white px-8 py-3 text-sm font-bold text-blue-700 shadow-lg transition-colors hover:bg-blue-50"
        >
          Get Free Trial
        </button>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-gray-900 px-6 py-12 text-gray-400">
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
