'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  X,
  Play,
  CheckCircle2,
  Building,
  CreditCard,
  Wrench,
  Users,
  BarChart3,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Zap,
} from 'lucide-react';

interface WatchDemoModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl?: string;
}

const DEMO_CHAPTERS = [
  {
    id: 'rent-collection',
    title: 'Automated Rent Collection',
    icon: CreditCard,
    badge: 'Zero Manual Reconciliation',
    description:
      'Seamless automated billing, instant Paystack integration, and real-time bank alerts with automated receipts.',
    stats: [
      { label: 'Collection Rate', value: '98.5%' },
      { label: 'Reconciliation', value: 'Instant' },
      { label: 'Late Payment Drop', value: '-65%' },
    ],
    features: [
      'Automated tenant invoices via SMS & Email',
      'Paystack debit card, bank transfer, and USSD support',
      'Configurable late fee rules & automated grace periods',
      'Instant landlord ledger reconciliation',
    ],
  },
  {
    id: 'maintenance-dispatch',
    title: 'Smart Maintenance & Vendor Dispatch',
    icon: Wrench,
    badge: '3x Faster Resolution',
    description:
      'End-to-end work order pipeline from tenant photo uploads to verified vendor dispatch and invoice sign-off.',
    stats: [
      { label: 'Avg Dispatch', value: '< 2 Hours' },
      { label: 'Tenant Satisfaction', value: '4.9 / 5' },
      { label: 'Cost Savings', value: '22%' },
    ],
    features: [
      'Photo and video issue reporting by tenants',
      'Instant contractor quotation and dispatch pipeline',
      'Before & after photo proof verification',
      'Digital invoice creation and approval flow',
    ],
  },
  {
    id: 'leases-tenants',
    title: 'Digital Leases & Tenant Portal',
    icon: Users,
    badge: '100% Paperless',
    description:
      'Self-service tenant onboarding, digital click-wrap e-signatures, and real-time tenant notifications.',
    stats: [
      { label: 'Turnaround Time', value: 'Same Day' },
      { label: 'E-Sign Compliance', value: 'Legally Binding' },
      { label: 'Paper Reduction', value: '100%' },
    ],
    features: [
      'Click-wrap digital lease signing with audit trail',
      'Automated tenant screening and KYC check',
      'Built-in broadcast announcements and alerts',
      'Resident self-service portal for payments and requests',
    ],
  },
  {
    id: 'analytics-financials',
    title: 'Portfolio Analytics & Valuation',
    icon: BarChart3,
    badge: 'Real-Time Insights',
    description:
      'Comprehensive NOI calculations, occupancy rates, and automated monthly owner statements.',
    stats: [
      { label: 'Financial Reporting', value: '1-Click' },
      { label: 'Portfolio Health', value: 'Live' },
      { label: 'Data Accuracy', value: '100%' },
    ],
    features: [
      'Real-time NOI (Net Operating Income) rollups',
      'Portfolio breakdown across units, properties, and regions',
      'Downloadable CSV & Excel accounting export',
      'Automated monthly statements sent to landlords',
    ],
  },
];

export function WatchDemoModal({ isOpen, onClose, videoUrl }: WatchDemoModalProps) {
  const [activeChapter, setActiveChapter] = useState(0);
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const current = DEMO_CHAPTERS[activeChapter];
  const Icon = current.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 lg:p-8">
      {/* Backdrop */}
      <div
        className="animate-in fade-in fixed inset-0 bg-gray-950/80 backdrop-blur-md transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div className="animate-in zoom-in-95 relative z-10 flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-gray-800 bg-gray-900 text-white shadow-2xl duration-200">
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-gray-800 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600/20 text-blue-400 ring-1 ring-blue-500/30">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-white">Proplity Interactive Platform Tour</h2>
              <p className="text-xs text-gray-400">
                Explore how AI-powered automation streamlines Nigerian property management
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
            aria-label="Close demo modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {/* Main Media Showcase Box */}
          <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-gray-800 bg-gray-950 shadow-inner">
            {videoUrl && isPlayingVideo ? (
              <iframe
                src={videoUrl}
                title="Proplity Demo Video"
                className="size-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <div className="group relative size-full">
                <Image
                  src="/demo-preview.jpg"
                  alt="Proplity Platform Walkthrough Preview"
                  fill
                  priority
                  className="object-cover opacity-80 transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/40 to-transparent" />

                {/* Overlaid Controls & Chapter Highlight */}
                <div className="absolute inset-0 flex flex-col justify-between p-6">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/20 px-3 py-1 text-xs font-semibold text-blue-300 ring-1 ring-blue-500/40 backdrop-blur-md">
                      <Zap className="h-3.5 w-3.5" />
                      Live Interactive Walkthrough
                    </span>
                    <span className="rounded-md bg-gray-900/80 px-2.5 py-1 text-xs font-medium text-gray-300 backdrop-blur-md">
                      Chapter {activeChapter + 1} of {DEMO_CHAPTERS.length}
                    </span>
                  </div>

                  <div className="flex flex-col items-center justify-center text-center">
                    <button
                      onClick={() => setIsPlayingVideo(true)}
                      className="group/btn mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/40 transition-all duration-300 hover:scale-110 hover:bg-blue-500 active:scale-95"
                      aria-label="Play demo overview"
                    >
                      <Play className="ml-1 h-7 w-7 transition-transform group-hover/btn:scale-110" />
                    </button>
                    <p className="text-sm font-semibold text-white drop-shadow">
                      {videoUrl ? 'Play Full Video Tour' : 'Explore Feature Highlights Below'}
                    </p>
                    <p className="text-xs text-gray-300 drop-shadow">
                      Click any chapter below to review automated workflows
                    </p>
                  </div>

                  {/* Chapter Quick Stats Bar */}
                  <div className="grid grid-cols-3 gap-3 rounded-lg border border-white/10 bg-gray-900/80 p-3 backdrop-blur-md">
                    {current.stats.map((stat, i) => (
                      <div key={i} className="text-center">
                        <p className="text-xs text-gray-400">{stat.label}</p>
                        <p className="text-base font-bold text-blue-400">{stat.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Chapter Selector Tabs */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {DEMO_CHAPTERS.map((chapter, idx) => {
              const ChapIcon = chapter.icon;
              const isActive = activeChapter === idx;
              return (
                <button
                  key={chapter.id}
                  onClick={() => {
                    setActiveChapter(idx);
                    setIsPlayingVideo(false);
                  }}
                  className={`flex flex-col items-start rounded-xl border p-3 text-left transition-all ${
                    isActive
                      ? 'border-blue-500 bg-blue-950/40 shadow-sm shadow-blue-500/20'
                      : 'border-gray-800 bg-gray-800/40 hover:border-gray-700 hover:bg-gray-800/80'
                  }`}
                >
                  <div className="mb-2 flex w-full items-center justify-between">
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                        isActive ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'
                      }`}
                    >
                      <ChapIcon className="h-4 w-4" />
                    </span>
                    <span className="text-[10px] font-medium text-gray-400">0{idx + 1}</span>
                  </div>
                  <span
                    className={`line-clamp-1 text-xs font-semibold ${
                      isActive ? 'text-blue-300' : 'text-gray-300'
                    }`}
                  >
                    {chapter.title}
                  </span>
                  <span className="mt-1 line-clamp-1 text-[10px] text-gray-400">
                    {chapter.badge}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Chapter Deep Dive Details */}
          <div className="rounded-xl border border-gray-800 bg-gray-800/30 p-5">
            <div className="flex flex-col gap-4 border-b border-gray-800 pb-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/20 text-blue-400">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-white">{current.title}</h3>
                    <span className="rounded-full border border-blue-700/50 bg-blue-900/60 px-2 py-0.5 text-[10px] font-medium text-blue-300">
                      {current.badge}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-400">{current.description}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 pt-4 sm:grid-cols-2">
              {current.features.map((feat, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  <span className="text-xs text-gray-300">{feat}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Bar */}
        <div className="flex flex-col gap-3 border-t border-gray-800 bg-gray-950/60 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span>Ready for property managers, landlords, and tenants in Nigeria</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="rounded-lg border border-gray-700 px-4 py-2 text-xs font-medium text-gray-300 hover:bg-gray-800"
            >
              Close
            </button>
            <Link
              href="/register"
              onClick={onClose}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-500"
            >
              Start Free Trial
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
