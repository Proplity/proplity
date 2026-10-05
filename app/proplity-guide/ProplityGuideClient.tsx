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
      item.setAttribute(
        'aria-label',
        `View screenshot ${index + 1} of ${items.length} in fullscreen`,
      );
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
    setLightboxIndex((prev) =>
      prev !== null ? (prev - 1 + guideScreenshots.length) % guideScreenshots.length : null,
    );
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
    <div className="min-h-screen bg-[#0a0f1e] font-sans text-[#e2e8f0] antialiased selection:bg-blue-600 selection:text-white">
      {/* INJECT ORIGINAL GUIDE STYLES */}
      <style dangerouslySetInnerHTML={{ __html: guideStyles }} />

      {/* TOP NAVIGATION BAR */}
      <header className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-3 border-b border-[#1e2d45] bg-[#0f172a]/95 px-4 py-3 shadow-lg backdrop-blur-md sm:px-6">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 text-lg font-bold text-white transition hover:opacity-90"
          >
            <span className="text-xl">🏠</span>
            <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
              Proplity
            </span>
          </Link>
          <span className="hidden rounded border border-blue-500/30 bg-blue-500/20 px-2 py-0.5 text-xs font-semibold tracking-wider text-blue-400 uppercase sm:inline-block">
            Interactive Role Guide
          </span>
        </div>

        {/* ROLE JUMP PILLS */}
        <nav className="hidden items-center gap-1 overflow-x-auto text-xs font-medium lg:flex">
          <a
            href="#setup"
            className="rounded-md px-2.5 py-1 text-slate-300 transition hover:bg-slate-800 hover:text-white"
          >
            ⚙️ Setup
          </a>
          <a
            href="#visitor"
            className="rounded-md px-2.5 py-1 text-slate-300 transition hover:bg-slate-800 hover:text-white"
          >
            🌍 Public
          </a>
          <a
            href="#tenant"
            className="rounded-md px-2.5 py-1 text-slate-300 transition hover:bg-slate-800 hover:text-white"
          >
            🏠 Tenant
          </a>
          <a
            href="#landlord"
            className="rounded-md px-2.5 py-1 text-slate-300 transition hover:bg-slate-800 hover:text-white"
          >
            🏗 Landlord
          </a>
          <a
            href="#manager"
            className="rounded-md px-2.5 py-1 text-slate-300 transition hover:bg-slate-800 hover:text-white"
          >
            👔 Manager
          </a>
          <a
            href="#vendor"
            className="rounded-md px-2.5 py-1 text-slate-300 transition hover:bg-slate-800 hover:text-white"
          >
            🔧 Vendor
          </a>
          <a
            href="#admin"
            className="rounded-md px-2.5 py-1 text-slate-300 transition hover:bg-slate-800 hover:text-white"
          >
            🛡 Admin
          </a>
          <a
            href="#lifecycle"
            className="rounded-md px-2.5 py-1 text-slate-300 transition hover:bg-slate-800 hover:text-white"
          >
            🔀 Lifecycle
          </a>
        </nav>

        {/* RIGHT ACTIONS */}
        <div className="flex items-center gap-2">
          <a
            href="/docs/proplity-step-by-step-role-guide.pdf"
            download="proplity-step-by-step-role-guide.pdf"
            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-500/40 bg-indigo-600/30 px-3 py-1.5 text-xs font-semibold text-indigo-300 shadow-sm transition hover:bg-indigo-600/50"
            title="Download complete high-res 88-page PDF guide"
          >
            <span>📥</span>
            <span>Download PDF</span>
          </a>

          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow transition hover:bg-blue-500"
          >
            <span>Sign In →</span>
          </Link>
        </div>
      </header>

      {/* GUIDE BODY CONTAINER */}
      <div ref={containerRef} dangerouslySetInnerHTML={{ __html: guideBodyHtml }} />

      {/* FULLSCREEN LIGHTBOX CAROUSEL MODAL */}
      {lightboxIndex !== null && currentScreenshot && (
        <div
          className="animate-in fade-in fixed inset-0 z-[99999] flex flex-col bg-[#050810]/95 backdrop-blur-xl duration-200 select-none"
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
          <div className="relative z-20 flex items-center justify-between border-b border-white/10 bg-gradient-to-b from-[#0a0f1e]/90 to-transparent px-4 py-3.5 sm:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <span className="rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-1 text-xs font-bold tracking-wide text-white shadow-md">
                {lightboxIndex + 1} / {guideScreenshots.length}
              </span>
              <h2 className="max-w-[55vw] truncate text-sm font-semibold text-slate-100 sm:max-w-xl sm:text-base">
                {currentScreenshot.title}
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={currentScreenshot.src}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-white/20 sm:inline-flex"
                title="Open high-resolution raw image in new tab"
              >
                <span>↗</span>
                <span>Open Raw</span>
              </a>
              <button
                onClick={handleClose}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-500/40 bg-red-500/20 text-sm font-bold text-red-300 transition hover:bg-red-500/35 hover:text-white sm:h-9 sm:w-9"
                title="Close fullscreen view (Esc)"
              >
                ✕
              </button>
            </div>
          </div>

          {/* LIGHTBOX STAGE (LEFT ARROW + IMAGE + RIGHT ARROW) */}
          <div className="relative z-10 flex flex-1 items-center justify-between overflow-hidden px-3 sm:px-8">
            {/* PREV ARROW */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePrev();
              }}
              className="z-20 flex h-12 w-12 flex-shrink-0 transform cursor-pointer items-center justify-center rounded-full border border-white/20 bg-slate-900/80 text-white shadow-2xl backdrop-blur-md transition-all duration-200 hover:scale-110 hover:border-blue-500 hover:bg-blue-600 active:scale-95 sm:h-14 sm:w-14"
              aria-label="Previous screenshot (Left arrow key)"
              title="Previous Screenshot (←)"
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>

            {/* EXPANDED IMAGE CONTAINER */}
            <div
              className="flex h-full flex-1 cursor-zoom-out items-center justify-center p-2 sm:p-6"
              onClick={handleClose}
            >
              <div
                className="relative flex max-h-full max-w-full cursor-default items-center justify-center"
                onClick={(e) => e.stopPropagation()}
              >
                <img
                  src={currentScreenshot.src}
                  alt={currentScreenshot.alt || currentScreenshot.title}
                  className="max-h-[78vh] max-w-[92vw] rounded-xl border border-white/15 bg-[#070b14] object-contain shadow-[0_24px_70px_rgba(0,0,0,0.85)] transition-all duration-200 sm:max-w-[85vw]"
                />
              </div>
            </div>

            {/* NEXT ARROW */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleNext();
              }}
              className="z-20 flex h-12 w-12 flex-shrink-0 transform cursor-pointer items-center justify-center rounded-full border border-white/20 bg-slate-900/80 text-white shadow-2xl backdrop-blur-md transition-all duration-200 hover:scale-110 hover:border-blue-500 hover:bg-blue-600 active:scale-95 sm:h-14 sm:w-14"
              aria-label="Next screenshot (Right arrow key)"
              title="Next Screenshot (→)"
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          </div>

          {/* LIGHTBOX FOOTER */}
          <div className="relative z-20 border-t border-white/10 bg-gradient-to-t from-[#0a0f1e]/90 to-transparent px-4 py-3 text-center">
            <p className="text-xs text-slate-400">
              Use{' '}
              <kbd className="rounded border border-white/20 bg-white/10 px-1.5 py-0.5 font-mono text-[11px] text-white">
                ←
              </kbd>{' '}
              and{' '}
              <kbd className="rounded border border-white/20 bg-white/10 px-1.5 py-0.5 font-mono text-[11px] text-white">
                →
              </kbd>{' '}
              to navigate &bull;{' '}
              <kbd className="rounded border border-white/20 bg-white/10 px-1.5 py-0.5 font-mono text-[11px] text-white">
                Esc
              </kbd>{' '}
              to close &bull; Click anywhere outside to dismiss
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
