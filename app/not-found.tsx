import Link from 'next/link';
import { LogoIcon } from './components/Logo';
import { Home, Search, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      {/* Background gradient blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-blue-100 opacity-40 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-green-100 opacity-40 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md text-center">
        {/* Logo */}
        <div className="mb-10 flex justify-center">
          <Link href="/" className="inline-flex items-center gap-3 focus:outline-none">
            <LogoIcon size={44} />
            <span className="text-2xl font-bold tracking-tight">Proplity</span>
          </Link>
        </div>

        {/* 404 display */}
        <div className="mb-6">
          <div className="relative mx-auto mb-4 flex h-32 w-32 items-center justify-center rounded-2xl bg-linear-to-br from-blue-600 to-green-500 shadow-lg shadow-blue-200">
            <span className="text-5xl font-black text-white/90 select-none">404</span>
          </div>
          <h1 className="mb-2 text-2xl font-bold text-gray-900">Page not found</h1>
          <p className="text-gray-500">
            The page you're looking for doesn't exist or may have been moved.
          </p>
        </div>

        {/* Quick links */}
        <div className="mb-8 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="mb-3 text-left text-xs font-semibold tracking-wide text-gray-400 uppercase">
            Where would you like to go?
          </p>
          <div className="space-y-1">
            {[
              { href: '/', icon: Home, label: 'Home' },
              { href: '/dashboard', icon: Search, label: 'My Dashboard' },
            ].map(({ href, icon: Icon, label }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-blue-50 hover:text-blue-600"
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </div>
        </div>

        {/* Back button */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-green-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:from-blue-700 hover:to-green-700 hover:shadow-md"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>
      </div>
    </div>
  );
}
