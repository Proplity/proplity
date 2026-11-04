'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ResponsiveTables } from '@/app/components/ResponsiveTables';
import { usePathname, useRouter } from 'next/navigation';
import { Logo } from '../components/Logo';
import { RoleSwitcher } from '../components/RoleSwitcher';
import { LogoutConfirmDialog } from '../components/LogoutConfirmDialog';
import { NotificationBell } from '../components/notifications/NotificationBell';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import {
  BarChart3,
  Users,
  Building2,
  FileText,
  Receipt,
  Settings,
  SlidersHorizontal,
  Layers,
  FileSignature,
  Stamp,
  Shield,
  User,
  LogOut,
  Menu,
  X,
  ChevronUp,
} from 'lucide-react';

const TABS = [
  { href: '/admin', label: 'System Overview', icon: BarChart3 },
  { href: '/admin/properties', label: 'Properties', icon: Building2 },
  { href: '/admin/users', label: 'User Management', icon: Users },
  { href: '/admin/reports', label: 'Reports', icon: FileText },
  { href: '/admin/payments', label: 'Bank Transfers', icon: Receipt },
  { href: '/admin/plans', label: 'Plans & billing', icon: Layers },
  { href: '/admin/agreements', label: 'Rent agreements', icon: FileSignature },
  { href: '/admin/stamp-duty', label: 'Stamp duty', icon: Stamp },
  { href: '/admin/security', label: 'Security', icon: Shield },
  { href: '/admin/settings', label: 'Platform Settings', icon: SlidersHorizontal },
];

export function AdminChrome({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [showLogout, setShowLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarMenuOpen, setSidebarMenuOpen] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await auth.logout();
    toast.info('You have been signed out.');
    router.push('/login');
  }

  return (
    <div className="flex size-full flex-col bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-3 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
              className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Link href="/" className="focus:outline-none">
              <Logo compactOnMobile />
            </Link>
          </div>

          <div className="flex items-center gap-1 sm:gap-4">
            {process.env.NODE_ENV !== 'production' && (
              <div className="hidden sm:block">
                <RoleSwitcher
                  currentRole="admin"
                  onRoleChange={(newRole) =>
                    router.push(newRole === 'admin' ? '/admin' : '/dashboard')
                  }
                />
              </div>
            )}
            <NotificationBell />
            <Link href="/admin/settings" className="block rounded-lg p-2 hover:bg-gray-100">
              <Settings className="h-5 w-5 text-gray-600" />
            </Link>
            <button className="hidden items-center gap-2.5 rounded-lg p-2 text-left hover:bg-gray-100 sm:flex">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-600">
                <User className="h-4 w-4 text-white" />
              </div>
              <div className="hidden flex-col text-left sm:flex">
                <span className="text-sm leading-tight font-medium text-gray-900">
                  {auth.user?.name}
                </span>
                <span className="text-xs leading-tight text-gray-500 capitalize">
                  Administrator
                </span>
              </div>
            </button>
            <button
              onClick={() => setShowLogout(true)}
              title="Sign Out"
              className="flex items-center gap-1 rounded-lg p-2 text-red-600 hover:bg-red-50"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="relative flex flex-1 overflow-hidden">
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <aside
          className={`absolute inset-y-0 left-0 z-40 flex w-64 transform flex-col justify-between border-r border-gray-200 bg-white p-4 transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex-1 overflow-y-auto pr-1">
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close menu"
              className="mb-2 ml-auto flex items-center gap-1 rounded-lg p-2 text-gray-500 hover:bg-gray-100 lg:hidden"
            >
              <X className="h-5 w-5" />
            </button>

            <nav className="space-y-2">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const active =
                  tab.href === '/admin' ? pathname === '/admin' : pathname.startsWith(tab.href);
                return (
                  <Link
                    key={tab.label}
                    href={tab.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 transition-colors ${
                      active ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="font-medium">{tab.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Fixed bottom avatar & logout menu */}
          <div className="relative mt-auto shrink-0 border-t border-gray-200 pt-3">
            {sidebarMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setSidebarMenuOpen(false)}
                  aria-hidden="true"
                />
                <div
                  role="menu"
                  aria-label="Admin account options"
                  className="absolute right-0 bottom-full left-0 z-50 mb-2 rounded-xl border border-gray-200 bg-white p-2 shadow-xl ring-1 ring-black/5"
                >
                  <div className="border-b border-gray-100 px-3 py-2">
                    <p className="truncate text-sm font-semibold text-gray-900">
                      {auth.user?.name || 'Admin'}
                    </p>
                    <p className="truncate text-xs text-gray-500 capitalize">
                      {auth.user?.email || 'Administrator'}
                    </p>
                  </div>

                  <div className="mt-1 space-y-0.5">
                    <Link
                      href="/admin/settings"
                      onClick={() => setSidebarMenuOpen(false)}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900"
                    >
                      <Settings className="h-4 w-4 text-gray-500" />
                      <span>Settings</span>
                    </Link>

                    <button
                      type="button"
                      onClick={() => {
                        setSidebarMenuOpen(false);
                        setShowLogout(true);
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                    >
                      <LogOut className="h-4 w-4 text-red-500" />
                      <span>Log Out</span>
                    </button>
                  </div>
                </div>
              </>
            )}

            <div className="flex items-center justify-between gap-2 rounded-xl p-2 transition-colors hover:bg-gray-100/80">
              <button
                type="button"
                onClick={() => setSidebarMenuOpen((prev) => !prev)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left focus:outline-none"
                aria-label="Account options"
                aria-expanded={sidebarMenuOpen}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-600 text-white shadow-xs">
                  <User className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm leading-tight font-medium text-gray-900">
                    {auth.user?.name || 'Admin'}
                  </p>
                  <p className="truncate text-xs leading-tight text-gray-500 capitalize">
                    Administrator
                  </p>
                </div>
                <ChevronUp
                  className={`h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200 ${
                    sidebarMenuOpen ? 'rotate-180 text-blue-600' : ''
                  }`}
                />
              </button>

              <button
                type="button"
                onClick={() => setShowLogout(true)}
                title="Log Out"
                aria-label="Log Out"
                className="shrink-0 rounded-lg p-2.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 sm:p-1.5"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </aside>

        <main className="flex-1 overflow-auto">
          <ResponsiveTables />
          {children}
        </main>
      </div>

      {showLogout && (
        <LogoutConfirmDialog
          onConfirm={handleLogout}
          onCancel={() => setShowLogout(false)}
          isLoading={loggingOut}
        />
      )}
    </div>
  );
}
