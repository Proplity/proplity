'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MoreHorizontal, LogOut, Plus, MessageSquare, X, type LucideIcon } from 'lucide-react';
import { cn } from '../components/ui/utils';

export interface MobileTab {
  href: string;
  label: string;
  /** Compact label for the bottom tab bar's narrow cells. Falls back to `label`. */
  shortLabel?: string;
  icon: LucideIcon;
}

interface MobileTabBarProps {
  tabs: MobileTab[];
  isActive: (href: string) => boolean;
  listPropertyHref?: string;
  onOpenAIAssistant?: () => void;
  onLogout: () => void;
}

// Replaces the sidebar entirely below `lg` -- reuses the same tabs array
// the desktop sidebar renders (first 3 direct, the rest behind "More")
// rather than maintaining a second, separately-curated nav list.
export function MobileTabBar({
  tabs,
  isActive,
  listPropertyHref,
  onOpenAIAssistant,
  onLogout,
}: MobileTabBarProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const primaryTabs = tabs.slice(0, 3);
  const moreTabs = tabs.slice(3);
  const moreIsActive = moreTabs.some((tab) => isActive(tab.href));

  return (
    <>
      <nav
        aria-label="Dashboard navigation"
        className="fixed inset-x-3 bottom-3 z-40 flex h-16 items-center justify-around gap-1 rounded-[26px] border border-gray-200 bg-white/95 px-2 shadow-[0_20px_50px_rgba(0,0,0,0.16)] backdrop-blur-lg lg:hidden"
      >
        {primaryTabs.map((tab) => {
          const Icon = tab.icon;
          const active = isActive(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-2xl py-1.5 text-[11px] font-medium transition-colors',
                active ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-100',
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="max-w-full truncate px-1">{tab.shortLabel ?? tab.label}</span>
            </Link>
          );
        })}

        {(moreTabs.length > 0 || listPropertyHref || onOpenAIAssistant) && (
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cn(
              'flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-2xl py-1.5 text-[11px] font-medium transition-colors',
              moreIsActive ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-100',
            )}
          >
            <MoreHorizontal className="h-5 w-5" />
            <span>More</span>
          </button>
        )}
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMoreOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-x-3 bottom-3 max-h-[calc(100vh-100px)] overflow-y-auto rounded-[26px] bg-white shadow-[0_24px_70px_rgba(0,0,0,0.2)]">
            <div className="flex items-center justify-between border-b border-gray-100 p-4">
              <strong className="text-sm font-semibold">More</strong>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                aria-label="Close"
                className="grid size-9 shrink-0 place-items-center rounded-xl border border-gray-200 bg-white"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 p-3">
              {moreTabs.map((tab) => {
                const Icon = tab.icon;
                const active = isActive(tab.href);
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      'flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-2xl border text-[13px] font-medium transition-colors',
                      active
                        ? 'border-blue-200 bg-blue-50 text-blue-600'
                        : 'border-gray-200 text-gray-700 hover:bg-gray-50',
                    )}
                  >
                    <Icon className="size-5" />
                    {tab.label}
                  </Link>
                );
              })}

              {listPropertyHref && (
                <Link
                  href={listPropertyHref}
                  onClick={() => setMoreOpen(false)}
                  className="col-span-2 flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-green-600 text-sm font-semibold text-white"
                >
                  <Plus className="size-4" />
                  List Property
                </Link>
              )}

              {onOpenAIAssistant && (
                <button
                  type="button"
                  onClick={() => {
                    setMoreOpen(false);
                    onOpenAIAssistant();
                  }}
                  className="col-span-2 flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 text-sm font-semibold text-blue-600"
                >
                  <MessageSquare className="size-4" />
                  Open AI Chat
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setMoreOpen(false);
                  onLogout();
                }}
                className="col-span-2 flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border border-red-200 text-sm font-semibold text-red-600 hover:bg-red-50"
              >
                <LogOut className="size-4" />
                Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
