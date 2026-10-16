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
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 text-slate-100">
      <div className="max-w-md w-full bg-slate-900/80 border border-slate-800 rounded-3xl p-8 text-center shadow-2xl backdrop-blur-xl">
        <div className="w-20 h-20 mx-auto rounded-3xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-6 shadow-lg shadow-blue-500/10">
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.75}
              d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 4.243a9 9 0 01-12.728 0m0 0l2.829-2.829m-2.829 2.829L3 21m2.828-15.364a9 9 0 0112.728 0M8.464 15.536a5 5 0 010-7.072"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-white mb-2">You are currently offline</h1>
        <p className="text-sm text-slate-400 leading-relaxed mb-8">
          Proplity requires an active internet connection to synchronize properties, maintenance requests, and payments. Check your Wi-Fi or mobile data connection and try again.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={handleRetry}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm shadow-lg shadow-blue-600/30 transition-all transform active:scale-95"
          >
            Retry Connection
          </button>
          <Link
            href="/"
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm border border-slate-700 transition-all"
          >
            Return Home
          </Link>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-800/80 flex items-center justify-center space-x-2 text-xs text-slate-500">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
          <span>Proplity Offline Mode Active</span>
        </div>
      </div>
    </div>
  );
}
