'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Logo } from '../components/Logo';
import { RoleSwitcher } from '../components/RoleSwitcher';
import { AIAssistant, aiAssistantDemoEnabled } from '../components/AIAssistant';
import { LogoutConfirmDialog } from '../components/LogoutConfirmDialog';
import { NotificationBell } from '../components/notifications/NotificationBell';
import { MobileTabBar } from './MobileTabBar';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import {
  Home,
  Search,
  Users,
  Wrench,
  MessageSquare,
  Settings,
  User,
  Building2,
  DollarSign,
  Receipt,
  Plus,
  LogOut,
  ChevronUp,
} from 'lucide-react';

type Role = 'manager' | 'tenant' | 'landlord' | 'vendor' | 'admin';

function getTabsForRole(role: Role) {
  switch (role) {
    case 'admin':
      return [
        { href: '/admin', label: 'Admin Dashboard', icon: Home },
        { href: '/admin/properties', label: 'Moderation Queue', icon: Building2 },
        { href: '/admin/users', label: 'User Directory', icon: Users },
        { href: '/admin/security', label: 'Security & Audit', icon: Settings },
      ];
    case 'manager':
      return [
        { href: '/dashboard', label: 'Dashboard', icon: Home },
        {
          href: '/dashboard/properties',
          label: 'My Properties',
          shortLabel: 'Properties',
          icon: Building2,
        },
        {
          href: '/dashboard/discover',
          label: 'Discover Properties',
          shortLabel: 'Discover',
          icon: Search,
        },
        { href: '/dashboard/tenants', label: 'Tenants', icon: Users },
        { href: '/dashboard/maintenance', label: 'Maintenance', icon: Wrench },
        { href: '/dashboard/messages', label: 'Messages', icon: MessageSquare },
      ];
    case 'tenant':
      return [
        { href: '/dashboard', label: 'My Dashboard', shortLabel: 'Dashboard', icon: Home },
        {
          href: '/dashboard/discover',
          label: 'Browse Properties',
          shortLabel: 'Browse',
          icon: Search,
        },
        {
          href: '/dashboard/payment-history',
          label: 'Payment History',
          shortLabel: 'Payments',
          icon: Receipt,
        },
        { href: '/dashboard/rentals', label: 'My Rentals', icon: Building2 },
        { href: '/dashboard/messages', label: 'Messages', icon: MessageSquare },
      ];
    case 'landlord':
      return [
        { href: '/dashboard', label: 'Portfolio', icon: Building2 },
        { href: '/dashboard/tenants', label: 'Tenants', icon: Users },
        { href: '/dashboard/maintenance', label: 'Maintenance', icon: Wrench },
        { href: '/dashboard/messages', label: 'Messages', icon: MessageSquare },
      ];
    case 'vendor':
      return [
        { href: '/dashboard', label: 'My Jobs', icon: Wrench },
        { href: '/dashboard/vendor/invoices', label: 'Invoices', icon: DollarSign },
        { href: '/dashboard/messages', label: 'Messages', icon: MessageSquare },
      ];
  }
}

const AVATAR_COLOR: Record<Role, string> = {
  manager: 'bg-blue-600',
  tenant: 'bg-green-600',
  landlord: 'bg-purple-600',
  vendor: 'bg-orange-600',
  admin: 'bg-purple-700',
};

export function DashboardChrome({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [showLogout, setShowLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [sidebarMenuOpen, setSidebarMenuOpen] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await auth.logout();
    toast.info('You have been signed out.');
    router.push('/login');
  }

  // Falling back to 'manager' here while the async /me fetch is still in
  // flight (auth.loading) made every other role's sidebar flash manager's
  // tabs on every reload. Only resolve a role -- and therefore tabs -- once
  // the real one is known.
  const role = auth.user?.role as Role | undefined;
  const tabs = role ? getTabsForRole(role) : [];

  return (
    <div className="flex size-full flex-col bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="focus:outline-none">
            <Logo compactOnMobile />
          </Link>

          <div className="flex items-center gap-2 sm:gap-4">
            {process.env.NODE_ENV !== 'production' && role && (
              <RoleSwitcher
                currentRole={role}
                onRoleChange={(newRole) =>
                  router.push(newRole === 'admin' ? '/admin' : '/dashboard')
                }
              />
            )}
            <NotificationBell />

            {/* Desktop: Settings, name + avatar, and Sign Out stay as three
                separate controls. */}
            <div className="hidden items-center gap-4 lg:flex">
              <Link href="/dashboard/settings" className="block rounded-lg p-2 hover:bg-gray-100">
                <Settings className="h-5 w-5 text-gray-600" />
              </Link>
              <button className="flex items-center gap-2.5 rounded-lg p-2 text-left hover:bg-gray-100">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${role ? AVATAR_COLOR[role] : 'bg-gray-300'}`}
                >
                  <User className="h-4 w-4 text-white" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-sm font-medium leading-tight text-gray-900">{auth.user?.name}</span>
                  <span className="text-xs text-gray-500 capitalize leading-tight">{role || 'User'}</span>
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

            {/* Small screens: Settings and Sign Out fold into a menu off
                the avatar instead of taking three separate slots in an
                already-tight header. */}
            <div className="relative lg:hidden">
              <button
                onClick={() => setAvatarMenuOpen((open) => !open)}
                aria-label="Account menu"
                aria-expanded={avatarMenuOpen}
                className="flex items-center gap-2 rounded-lg p-1 hover:bg-gray-100"
              >
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full ${role ? AVATAR_COLOR[role] : 'bg-gray-300'}`}
                >
                  <User className="h-4 w-4 text-white" />
                </div>
              </button>

              {avatarMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setAvatarMenuOpen(false)}
                    aria-hidden="true"
                  />
                  <div className="absolute top-full right-0 z-50 mt-2 w-56 rounded-xl border border-gray-200 bg-white py-2 shadow-lg">
                    <div className="px-4 py-1.5 border-b border-gray-100">
                      <p className="truncate text-sm font-medium text-gray-900 leading-tight">
                        {auth.user?.name}
                      </p>
                      <p className="truncate text-xs text-gray-500 capitalize leading-tight">
                        {role || 'User'}
                      </p>
                    </div>
                    <Link
                      href="/dashboard/settings"
                      onClick={() => setAvatarMenuOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <Settings className="h-4 w-4" />
                      Settings
                    </Link>
                    <button
                      onClick={() => {
                        setAvatarMenuOpen(false);
                        setShowLogout(true);
                      }}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden w-64 flex-col justify-between border-r border-gray-200 bg-white p-4 lg:flex">
          <div className="flex-1 overflow-y-auto pr-1">
            {(role === 'manager' || role === 'landlord') && (
              <Link
                href="/dashboard/properties/new"
                className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-green-600 px-4 py-3 font-medium text-white hover:from-blue-700 hover:to-green-700"
              >
                <Plus className="h-5 w-5" />
                List Property
              </Link>
            )}

            <nav className="space-y-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const active =
                  tab.href === '/dashboard'
                    ? pathname === '/dashboard'
                    : pathname.startsWith(tab.href);
                return (
                  <Link
                    key={tab.label}
                    href={tab.href}
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

            {role !== 'vendor' && aiAssistantDemoEnabled && (
              <div className="mt-8 rounded-lg bg-linear-to-br from-blue-50 to-green-50 p-4">
                <h3 className="mb-2 text-sm font-semibold">AI Assistant</h3>
                <p className="mb-3 text-xs text-gray-600">
                  {role === 'tenant'
                    ? 'Get instant help with payments, maintenance, and lease questions'
                    : 'Get instant help with tenant queries, rent tracking, and more'}
                </p>
                <button
                  onClick={() => setShowAIAssistant(!showAIAssistant)}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  <MessageSquare className="h-4 w-4" />
                  Open AI Chat
                </button>
              </div>
            )}
          </div>

          {/* Fixed bottom avatar & logout menu */}
          <div className="relative mt-auto pt-3 border-t border-gray-200 shrink-0">
            {sidebarMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setSidebarMenuOpen(false)}
                  aria-hidden="true"
                />
                <div
                  role="menu"
                  aria-label="User account options"
                  className="absolute bottom-full left-0 right-0 z-50 mb-2 rounded-xl border border-gray-200 bg-white p-2 shadow-xl ring-1 ring-black/5"
                >
                  <div className="px-3 py-2 border-b border-gray-100">
                    <p className="truncate text-sm font-semibold text-gray-900">
                      {auth.user?.name || 'My Account'}
                    </p>
                    <p className="truncate text-xs text-gray-500 capitalize">
                      {auth.user?.email || (role ? `${role} account` : 'Logged in')}
                    </p>
                  </div>

                  <div className="mt-1 space-y-0.5">
                    <Link
                      href="/dashboard/settings"
                      onClick={() => setSidebarMenuOpen(false)}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors"
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
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="h-4 w-4 text-red-500" />
                      <span>Log Out</span>
                    </button>
                  </div>
                </div>
              </>
            )}

            <div className="flex items-center justify-between gap-2 rounded-xl p-2 hover:bg-gray-100/80 transition-colors">
              <button
                type="button"
                onClick={() => setSidebarMenuOpen((prev) => !prev)}
                className="flex flex-1 items-center gap-3 min-w-0 text-left focus:outline-none"
                aria-label="Account options"
                aria-expanded={sidebarMenuOpen}
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white shadow-xs ${
                    role ? AVATAR_COLOR[role] : 'bg-gray-400'
                  }`}
                >
                  <User className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900 leading-tight">
                    {auth.user?.name || 'Account'}
                  </p>
                  <p className="truncate text-xs text-gray-500 capitalize leading-tight">
                    {role || 'User'}
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
                className="rounded-lg p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </aside>

        <main className="flex-1 overflow-auto pb-24 lg:pb-0">{children}</main>

        {showAIAssistant && aiAssistantDemoEnabled && (
          <AIAssistant onClose={() => setShowAIAssistant(false)} />
        )}
      </div>

      {role && (
        <MobileTabBar
          tabs={tabs}
          isActive={(href) =>
            href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href)
          }
          listPropertyHref={
            role === 'manager' || role === 'landlord' ? '/dashboard/properties/new' : undefined
          }
          onOpenAIAssistant={
            role !== 'vendor' && aiAssistantDemoEnabled ? () => setShowAIAssistant(true) : undefined
          }
          onLogout={() => setShowLogout(true)}
        />
      )}

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
