'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { guideStyles, guideBodyHtml, guideScreenshots } from './guide-content';

export function ProplityGuideClient() {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<number>(0);

  // Attach click listeners to all screenshot cards rendered in the guide
  useEffect(() => {
    if (!containerRef.current) return;
    const items = containerRef.current.querySelectorAll<HTMLElement>('.screenshot-item');
    items.forEach((item, index) => {
      const handler = () => {
        setLightboxIndex(index);
      };
      item.addEventListener('click', handler);
      // Accessibility attributes
      item.setAttribute('role', 'button');
      item.setAttribute('tabindex', '0');
      item.setAttribute('aria-label', `View screenshot ${index + 1} of ${items.length} in fullscreen`);
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setLightboxIndex(index);
        }
      });
    });
  }, []);

  // Keyboard navigation & body scroll locking for Lightbox
  const handleNext = useCallback(() => {
    setLightboxIndex((prev) => (prev !== null ? (prev + 1) % guideScreenshots.length : null));
  }, []);

  const handlePrev = useCallback(() => {
    setLightboxIndex((prev) => (prev !== null ? (prev - 1 + guideScreenshots.length) % guideScreenshots.length : null));
  }, []);

  const handleClose = useCallback(() => {
    setLightboxIndex(null);
  }, []);

  useEffect(() => {
    if (lightboxIndex === null) {
      document.body.style.overflow = '';
      return;
    }
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      } else if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [lightboxIndex, handleNext, handlePrev, handleClose]);

  const currentScreenshot = lightboxIndex !== null ? guideScreenshots[lightboxIndex] : null;

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-[#e2e8f0] font-sans antialiased selection:bg-blue-600 selection:text-white">
      {/* INJECT ORIGINAL GUIDE STYLES */}
      <style dangerouslySetInnerHTML={{ __html: guideStyles }} />

      {/* TOP NAVIGATION BAR */}
      <header className="sticky top-0 z-40 bg-[#0f172a]/95 backdrop-blur-md border-b border-[#1e2d45] px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg text-white hover:opacity-90 transition">
            <span className="text-xl">🏠</span>
            <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Proplity</span>
          </Link>
          <span className="hidden sm:inline-block text-xs uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
            Interactive Role Guide
          </span>
        </div>

        {/* ROLE JUMP PILLS */}
        <nav className="hidden lg:flex items-center gap-1 overflow-x-auto text-xs font-medium">
          <a href="#setup" className="px-2.5 py-1 rounded-md text-slate-300 hover:text-white hover:bg-slate-800 transition">⚙️ Setup</a>
          <a href="#visitor" className="px-2.5 py-1 rounded-md text-slate-300 hover:text-white hover:bg-slate-800 transition">🌍 Public</a>
          <a href="#tenant" className="px-2.5 py-1 rounded-md text-slate-300 hover:text-white hover:bg-slate-800 transition">🏠 Tenant</a>
          <a href="#landlord" className="px-2.5 py-1 rounded-md text-slate-300 hover:text-white hover:bg-slate-800 transition">🏗 Landlord</a>
          <a href="#manager" className="px-2.5 py-1 rounded-md text-slate-300 hover:text-white hover:bg-slate-800 transition">👔 Manager</a>
          <a href="#vendor" className="px-2.5 py-1 rounded-md text-slate-300 hover:text-white hover:bg-slate-800 transition">🔧 Vendor</a>
          <a href="#admin" className="px-2.5 py-1 rounded-md text-slate-300 hover:text-white hover:bg-slate-800 transition">🛡 Admin</a>
          <a href="#lifecycle" className="px-2.5 py-1 rounded-md text-slate-300 hover:text-white hover:bg-slate-800 transition">🔀 Lifecycle</a>
        </nav>

        {/* RIGHT ACTIONS */}
        <div className="flex items-center gap-2">
          <a
            href="/docs/proplity-step-by-step-role-guide.pdf"
            download="proplity-step-by-step-role-guide.pdf"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 text-xs font-semibold shadow-sm transition"
            title="Download complete high-res 88-page PDF guide"
          >
            <span>📥</span>
            <span>Download PDF</span>
          </a>

          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow transition"
          >
            <span>Sign In →</span>
          </Link>
        </div>
      </header>

      {/* GUIDE BODY CONTAINER */}
      <div
        ref={containerRef}
        dangerouslySetInnerHTML={{ __html: guideBodyHtml }}
      />

      {/* FULLSCREEN LIGHTBOX CAROUSEL MODAL */}
      {lightboxIndex !== null && currentScreenshot && (
        <div
          className="fixed inset-0 z-[99999] flex flex-col bg-[#050810]/95 backdrop-blur-xl select-none animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-label="Screenshot Carousel Modal"
          onTouchStart={(e) => {
            touchStartRef.current = e.changedTouches[0].screenX;
          }}
          onTouchEnd={(e) => {
            const touchEndX = e.changedTouches[0].screenX;
            if (touchEndX < touchStartRef.current - 50) handleNext();
            if (touchEndX > touchStartRef.current + 50) handlePrev();
          }}
        >
          {/* LIGHTBOX TOP HEADER */}
          <div className="relative z-20 flex items-center justify-between px-4 sm:px-8 py-3.5 bg-gradient-to-b from-[#0a0f1e]/90 to-transparent border-b border-white/10">
            <div className="flex items-center gap-3 min-w-0">
              <span className="px-3 py-1 rounded-full text-xs font-bold tracking-wide text-white bg-gradient-to-r from-blue-600 to-indigo-600 shadow-md">
                {lightboxIndex + 1} / {guideScreenshots.length}
              </span>
              <h2 className="text-sm sm:text-base font-semibold text-slate-100 truncate max-w-[55vw] sm:max-w-xl">
                {currentScreenshot.title}
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={currentScreenshot.src}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-semibold border border-white/15 transition"
                title="Open high-resolution raw image in new tab"
              >
                <span>↗</span>
                <span>Open Raw</span>
              </a>
              <button
                onClick={handleClose}
                className="inline-flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-red-500/20 hover:bg-red-500/35 text-red-300 hover:text-white border border-red-500/40 text-sm font-bold transition"
                title="Close fullscreen view (Esc)"
              >
                ✕
              </button>
            </div>
          </div>

          {/* LIGHTBOX STAGE (LEFT ARROW + IMAGE + RIGHT ARROW) */}
          <div className="relative z-10 flex-1 flex items-center justify-between px-3 sm:px-8 overflow-hidden">
            {/* PREV ARROW */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePrev();
              }}
              className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-slate-900/80 hover:bg-blue-600 text-white border border-white/20 hover:border-blue-500 shadow-2xl backdrop-blur-md transition-all duration-200 transform hover:scale-110 active:scale-95 z-20 flex-shrink-0 cursor-pointer"
              aria-label="Previous screenshot (Left arrow key)"
              title="Previous Screenshot (←)"
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>

            {/* EXPANDED IMAGE CONTAINER */}
            <div
              className="flex-1 h-full flex items-center justify-center p-2 sm:p-6 cursor-zoom-out"
              onClick={handleClose}
            >
              <div
                className="relative max-w-full max-h-full flex items-center justify-center cursor-default"
                onClick={(e) => e.stopPropagation()}
              >
                <img
                  src={currentScreenshot.src}
                  alt={currentScreenshot.alt || currentScreenshot.title}
                  className="max-w-[92vw] sm:max-w-[85vw] max-h-[78vh] object-contain rounded-xl border border-white/15 shadow-[0_24px_70px_rgba(0,0,0,0.85)] bg-[#070b14] transition-all duration-200"
                />
              </div>
            </div>

            {/* NEXT ARROW */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleNext();
              }}
              className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-slate-900/80 hover:bg-blue-600 text-white border border-white/20 hover:border-blue-500 shadow-2xl backdrop-blur-md transition-all duration-200 transform hover:scale-110 active:scale-95 z-20 flex-shrink-0 cursor-pointer"
              aria-label="Next screenshot (Right arrow key)"
              title="Next Screenshot (→)"
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          </div>

          {/* LIGHTBOX FOOTER */}
          <div className="relative z-20 py-3 px-4 text-center bg-gradient-to-t from-[#0a0f1e]/90 to-transparent border-t border-white/10">
            <p className="text-xs text-slate-400">
              Use <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white font-mono text-[11px] border border-white/20">←</kbd> and{' '}
              <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white font-mono text-[11px] border border-white/20">→</kbd> to navigate &bull;{' '}
              <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white font-mono text-[11px] border border-white/20">Esc</kbd> to close &bull; Click anywhere outside to dismiss
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
