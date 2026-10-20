'use client';

import React from 'react';
import Link from 'next/link';

export default function OfflinePage() {
  const handleRetry = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4 text-slate-100">
      <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/80 p-8 text-center shadow-2xl backdrop-blur-xl">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl border border-blue-500/30 bg-blue-600/20 text-blue-400 shadow-lg shadow-blue-500/10">
          <svg className="h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.75}
              d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 4.243a9 9 0 01-12.728 0m0 0l2.829-2.829m-2.829 2.829L3 21m2.828-15.364a9 9 0 0112.728 0M8.464 15.536a5 5 0 010-7.072"
            />
          </svg>
        </div>

        <h1 className="mb-2 text-2xl font-bold tracking-tight text-white">
          You are currently offline
        </h1>
        <p className="mb-8 text-sm leading-relaxed text-slate-400">
          Proplity requires an active internet connection to synchronize properties, maintenance
          requests, and payments. Check your Wi-Fi or mobile data connection and try again.
        </p>

        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={handleRetry}
            className="w-full transform rounded-xl bg-blue-600 px-6 py-3 text-sm font-medium text-white shadow-lg shadow-blue-600/30 transition-all hover:bg-blue-500 active:scale-95 sm:w-auto"
          >
            Retry Connection
          </button>
          <Link
            href="/"
            className="w-full rounded-xl border border-slate-700 bg-slate-800 px-6 py-3 text-sm font-medium text-slate-200 transition-all hover:bg-slate-700 sm:w-auto"
          >
            Return Home
          </Link>
        </div>

        <div className="mt-8 flex items-center justify-center space-x-2 border-t border-slate-800/80 pt-6 text-xs text-slate-500">
          <span className="h-2 w-2 animate-ping rounded-full bg-amber-500" />
          <span>Proplity Offline Mode Active</span>
        </div>
      </div>
    </div>
  );
}
