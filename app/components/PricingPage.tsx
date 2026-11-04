'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Logo } from './Logo';
import { MarketingNav } from './MarketingNav';
import { CheckCircle, Star } from 'lucide-react';
import { subscriptionsEnabled } from '@/lib/subscriptions';
import { usePlans } from '@/hooks/usePlans';
import { bestYearlySavingPct, naira, planBullets, planPriceLabel } from '@/lib/planDisplay';

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

function Stars({ n }: { n: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: n }).map((_, i) => (
        <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
      ))}
    </div>
  );
}

export function PricingPage() {
  const router = useRouter();
  const [annual, setAnnual] = useState(false);
  const { data: plans, loading: plansLoading, error: plansError } = usePlans();
  const savingPct = bestYearlySavingPct(plans);
  const hasYearly = plans.some((p) => p.yearlyPrice !== null);

  useEffect(() => {
    if (!subscriptionsEnabled()) {
      router.replace('/');
    }
  }, [router]);

  if (!subscriptionsEnabled()) return null;

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <MarketingNav />

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
      <div className={`mt-10 mb-8 flex justify-center ${hasYearly ? '' : 'hidden'}`}>
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
            Yearly
          </span>
          {savingPct > 0 && (
            <span className="ml-0.5 rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700">
              Save up to {savingPct}%
            </span>
          )}
        </div>
      </div>

      {/* ── Pricing cards ── */}
      <section className="mx-auto max-w-5xl px-6 pb-16">
        {plansError && (
          <p className="py-10 text-center text-sm text-red-600">
            We could not load the plans. Please try again in a moment.
          </p>
        )}
        {plansLoading && !plansError && (
          <p className="py-10 text-center text-sm text-gray-500">Loading plans…</p>
        )}
        <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-3">
          {plans.map((plan) => {
            const price = planPriceLabel(plan, annual);
            const free = plan.monthlyPrice === 0;
            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-2xl border p-7 ${
                  plan.isPopular
                    ? 'border-blue-500 bg-white shadow-xl ring-2 shadow-blue-100 ring-blue-500'
                    : 'border-gray-200 bg-white'
                }`}
              >
                {plan.isPopular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-blue-600 px-4 py-1.5 text-xs font-bold tracking-wide text-white shadow">
                      MOST POPULAR
                    </span>
                  </div>
                )}

                <p className="mt-2 mb-1 text-xs text-gray-400">{plan.tagline}</p>
                <h3 className="mb-4 text-xl font-bold text-gray-900">{plan.name}</h3>

                <div className="mb-6">
                  <span className="text-4xl font-extrabold text-gray-900">{price.amount}</span>
                  {price.per && <span className="ml-1 text-sm text-gray-500">{price.per}</span>}
                  {annual && plan.yearlyPrice !== null && plan.monthlyPrice > 0 && (
                    <p className="mt-1 text-xs font-medium text-green-600">
                      {naira(plan.yearlyPrice)} a year; saves{' '}
                      {naira(plan.monthlyPrice * 12 - plan.yearlyPrice)} against paying monthly
                    </p>
                  )}
                </div>

                <ul className="mb-8 flex-1 space-y-3">
                  {planBullets(plan).map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-gray-700">
                      <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => {
                    if (!subscriptionsEnabled()) return;
                    router.push(`/register?plan=${plan.key}${annual ? '&cycle=yearly' : ''}`);
                  }}
                  disabled={!subscriptionsEnabled()}
                  className={`w-full rounded-xl py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                    plan.isPopular
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'border-2 border-gray-300 text-gray-700 hover:border-blue-400 hover:text-blue-600'
                  }`}
                >
                  {!subscriptionsEnabled()
                    ? 'Coming Soon'
                    : free
                      ? 'Get started free'
                      : 'Get started'}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── What each plan includes ── */}
      {plans.length > 0 && (
        <section className="bg-gray-50 px-6 py-16">
          <div className="mx-auto max-w-4xl">
            <h2 className="mb-10 text-center text-2xl font-bold text-gray-900">
              What each plan includes
            </h2>

            <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
              <table className="w-full min-w-[34rem] text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="p-4 text-left font-semibold text-gray-600">&nbsp;</th>
                    {plans.map((p) => (
                      <th
                        key={p.id}
                        className={`p-4 text-center font-semibold ${p.isPopular ? 'text-blue-600' : 'text-gray-700'}`}
                      >
                        {p.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    {
                      label: 'Units included',
                      value: (p: (typeof plans)[number]) => String(p.unitsIncluded),
                    },
                    {
                      label: 'Users',
                      value: (p: (typeof plans)[number]) => String(p.usersIncluded),
                    },
                    {
                      label: 'Each extra unit',
                      value: (p: (typeof plans)[number]) =>
                        p.overagePerUnit === null
                          ? 'Not available'
                          : `${naira(p.overagePerUnit)}/month`,
                    },
                    {
                      label: 'Credits every month',
                      value: (p: (typeof plans)[number]) => String(p.monthlyCredits),
                    },
                    {
                      label: 'Price per month',
                      value: (p: (typeof plans)[number]) =>
                        p.monthlyPrice === 0 ? 'Free' : naira(p.monthlyPrice),
                    },
                    {
                      label: 'Price per year',
                      value: (p: (typeof plans)[number]) =>
                        p.yearlyPrice === null
                          ? '—'
                          : p.monthlyPrice === 0
                            ? 'Free'
                            : naira(p.yearlyPrice),
                    },
                  ].map((row, i) => (
                    <tr
                      key={row.label}
                      className={`border-b border-gray-100 last:border-0 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
                    >
                      <th scope="row" className="p-4 text-left font-medium text-gray-700">
                        {row.label}
                      </th>
                      {plans.map((p) => (
                        <td
                          key={p.id}
                          className="p-4 text-center font-medium text-gray-700 tabular-nums"
                        >
                          {row.value(p)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

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
                    className={`h-9 w-9 rounded-full ${t.color} flex shrink-0 items-center justify-center`}
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
          <Link
            href="/login"
            className="rounded-xl border-2 border-white px-7 py-3 text-sm font-semibold text-white transition-colors hover:bg-white hover:text-blue-700"
          >
            Start Free Trial
          </Link>
          <Link
            href="/login"
            className="rounded-xl border border-white/30 bg-white/10 px-7 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/20"
          >
            Schedule Demo
          </Link>
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
              Nigeria&apos;s first AI-native property management platform. Built for the realities
              of the modern rental market.
            </p>
          </div>
          {[
            {
              heading: 'Product',
              links: subscriptionsEnabled()
                ? ['Features', 'Pricing', 'Blog', 'Demo']
                : ['Features', 'Blog', 'Demo'],
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
