'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { LogoIcon } from './components/Logo';
import { Home, RefreshCcw, AlertTriangle } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to an error reporting service here if needed
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 font-sans">
          {/* Background gradient blobs */}
          <div className="pointer-events-none fixed inset-0 overflow-hidden">
            <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-red-100 opacity-30 blur-3xl" />
            <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-orange-100 opacity-30 blur-3xl" />
          </div>

          <div className="relative w-full max-w-md text-center">
            {/* Logo */}
            <div className="mb-10 flex justify-center">
              <Link href="/" className="inline-flex items-center gap-3 focus:outline-none">
                <LogoIcon size={44} />
                <span className="text-2xl font-bold tracking-tight">Proplity</span>
              </Link>
            </div>

            {/* Error icon */}
            <div className="mb-6">
              <div className="relative mx-auto mb-4 flex h-32 w-32 items-center justify-center rounded-2xl bg-linear-to-br from-red-500 to-orange-500 shadow-lg shadow-red-200">
                <AlertTriangle className="h-14 w-14 text-white/90" strokeWidth={1.5} />
              </div>
              <h1 className="mb-2 text-2xl font-bold text-gray-900">Something went wrong</h1>
              <p className="text-gray-500">
                An unexpected error occurred. Our team has been notified.
              </p>
              {error.digest && (
                <p className="mt-2 text-xs text-gray-400">
                  Error ID:{' '}
                  <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-gray-600">
                    {error.digest}
                  </code>
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                onClick={reset}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-green-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:from-blue-700 hover:to-green-700 hover:shadow-md"
              >
                <RefreshCcw className="h-4 w-4" />
                Try again
              </button>
              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-6 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition-all hover:bg-gray-50 hover:shadow-md"
              >
                <Home className="h-4 w-4" />
                Back to Home
              </Link>
            </div>

            {/* Support note */}
            <p className="text-xs text-gray-400">
              If this keeps happening, contact{' '}
              <a
                href="mailto:support@proplity.com"
                className="text-blue-500 underline-offset-2 hover:underline"
              >
                support@proplity.com
              </a>
            </p>
          </div>
        </div>
      </body>
    </html>
  );
}
