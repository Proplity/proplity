'use client';

import React, { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function PwaRegister() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  useEffect(() => {
    // Register Service Worker
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      // Avoid service worker caching in testing or unsupported protocols
      if (window.location.protocol === 'https:' || window.location.hostname === 'localhost') {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            registration.addEventListener('updatefound', () => {
              const installingWorker = registration.installing;
              if (installingWorker) {
                installingWorker.addEventListener('statechange', () => {
                  if (
                    installingWorker.state === 'installed' &&
                    navigator.serviceWorker.controller
                  ) {
                    console.info('[PWA] New content is available; please refresh.');
                  }
                });
              }
            });
          })
          .catch((err) => {
            console.warn('[PWA] Service worker registration failed:', err);
          });
      }
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      if (
        typeof window !== 'undefined' &&
        sessionStorage.getItem('pwa_install_dismissed') !== 'true'
      ) {
        setShowInstallBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstallBanner(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowInstallBanner(false);
    sessionStorage.setItem('pwa_install_dismissed', 'true');
  };

  if (!showInstallBanner || !deferredPrompt) return null;

  return (
    <div
      role="region"
      aria-label="PWA Installation Prompt"
      className="animate-in slide-in-from-bottom fixed right-4 bottom-4 left-4 z-40 rounded-2xl border border-blue-500/30 bg-slate-900/95 p-4 text-white shadow-2xl backdrop-blur-xl duration-300 sm:right-6 sm:left-auto sm:w-96"
    >
      <div className="flex items-start space-x-3.5">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-blue-500/40 bg-blue-600/30 text-blue-400">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold text-white">Install Proplity App</h4>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-300">
            Install on your home screen for full offline caching, faster loads, and a native
            experience.
          </p>
          <div className="mt-3 flex items-center space-x-2.5">
            <button
              type="button"
              onClick={handleInstallClick}
              className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-md shadow-blue-600/30 transition-colors hover:bg-blue-500"
            >
              Install App
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
            >
              Not now
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="p-1 text-slate-400 hover:text-slate-200"
          title="Dismiss banner"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
