'use client';

import { useState } from 'react';
import Link from 'next/link';
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
  FileText,
  Settings,
  SlidersHorizontal,
  User,
  LogOut,
  Menu,
  X,
} from 'lucide-react';

const TABS = [
  { href: '/admin', label: 'System Overview', icon: BarChart3 },
  { href: '/admin/users', label: 'User Management', icon: Users },
  { href: '/admin/reports', label: 'Reports', icon: FileText },
  { href: '/admin/settings', label: 'Platform Settings', icon: SlidersHorizontal },
];

export function AdminChrome({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [showLogout, setShowLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await auth.logout();
    toast.info('You have been signed out.');
    router.push('/login');
  }

  return (
    <div className="flex size-full flex-col bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-6 py-4">
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
              <Logo />
            </Link>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {process.env.NODE_ENV !== 'production' && (
              <RoleSwitcher
                currentRole="admin"
                onRoleChange={(newRole) =>
                  router.push(newRole === 'admin' ? '/admin' : '/dashboard')
                }
              />
            )}
            <NotificationBell />
            <Link href="/dashboard/settings" className="block rounded-lg p-2 hover:bg-gray-100">
              <Settings className="h-5 w-5 text-gray-600" />
            </Link>
            <button className="flex items-center gap-2 rounded-lg p-2 hover:bg-gray-100">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-600">
                <User className="h-4 w-4 text-white" />
              </div>
              <span className="hidden text-sm font-medium sm:inline">{auth.user?.name}</span>
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
          className={`absolute inset-y-0 left-0 z-40 w-64 transform overflow-y-auto border-r border-gray-200 bg-white p-4 transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
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
        </aside>

        <main className="flex-1 overflow-auto">{children}</main>
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
