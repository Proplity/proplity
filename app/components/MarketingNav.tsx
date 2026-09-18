'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X, ChevronDown } from 'lucide-react';
import { Logo } from './Logo';

const FEATURE_LINKS = [
  { label: 'For Landlords', href: '/for-landlords' },
  { label: 'For Tenants', href: '/for-tenants' },
  { label: 'For Service Providers', href: '/for-vendors' },
];

const NAV_LINKS = [
  { label: 'How it Works', href: '/#how-it-works' },
  { label: 'Contact Us', href: '/contact' },
  { label: 'About Us', href: '/about' },
  { label: 'Pricing', href: '/pricing' },
];

interface MarketingNavProps {
  ctaHref: string;
  ctaLabel: string;
}

// Shared header for every public marketing page (home, about, contact,
// pricing, for-landlords/tenants/vendors). Previously each page hard-coded
// its own copy of this nav with the link list hidden behind `md:flex` and
// no mobile fallback, so on a phone every link except the logo and CTA was
// unreachable. This version adds a real hamburger menu below md.
export function MarketingNav({ ctaHref, ctaLabel }: MarketingNavProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b border-gray-100 bg-white shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        <Link href="/" className="focus:outline-none">
          <Logo />
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          <div className="group relative">
            <button className="flex items-center gap-1 py-1 text-sm font-medium text-gray-700 hover:text-gray-900">
              Features
              <ChevronDown className="h-4 w-4 text-gray-400 transition-transform group-hover:rotate-180 group-hover:text-gray-600" />
            </button>
            <div className="absolute top-full left-0 hidden pt-2 group-hover:block">
              <div className="w-52 rounded-xl border border-gray-100 bg-white py-2 shadow-lg">
                {FEATURE_LINKS.map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="block w-full px-4 py-2.5 text-left text-sm text-gray-700 transition-colors hover:bg-blue-50 hover:text-blue-600"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {NAV_LINKS.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              {item.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={ctaHref}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            {ctaLabel}
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen((open) => !open)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            className="rounded-lg p-2 text-gray-700 hover:bg-gray-100 md:hidden"
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div
          id="mobile-menu"
          aria-label="Mobile"
          className="border-t border-gray-100 bg-white px-6 py-4 md:hidden"
        >
          <p className="mb-2 text-xs font-semibold tracking-wide text-gray-400 uppercase">
            Features
          </p>
          <div className="mb-4 flex flex-col gap-3">
            {FEATURE_LINKS.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="flex flex-col gap-3 border-t border-gray-100 pt-4">
            {NAV_LINKS.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
