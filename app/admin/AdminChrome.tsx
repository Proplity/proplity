'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Logo } from '../components/Logo';
import { RoleSwitcher } from '../components/RoleSwitcher';
import { useAuth } from '@/context/AuthContext';
import { BarChart3, Users, FileText, Settings, Bell, User, LogOut } from 'lucide-react';

const TABS = [
  { href: '/admin', label: 'System Overview', icon: BarChart3 },
  { href: '/admin/users', label: 'User Management', icon: Users },
  { href: '/admin/reports', label: 'Reports', icon: FileText },
];

export function AdminChrome({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="flex size-full flex-col bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="focus:outline-none">
            <Logo />
          </Link>

          <div className="flex items-center gap-4">
            {process.env.NODE_ENV !== 'production' && (
              <RoleSwitcher
                currentRole="admin"
                onRoleChange={(newRole) =>
                  router.push(newRole === 'admin' ? '/admin' : '/dashboard')
                }
              />
            )}
            <button className="relative rounded-lg p-2 hover:bg-gray-100">
              <Bell className="h-5 w-5 text-gray-600" />
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500"></span>
            </button>
            <button className="rounded-lg p-2 hover:bg-gray-100">
              <Settings className="h-5 w-5 text-gray-600" />
            </button>
            <button className="flex items-center gap-2 rounded-lg p-2 hover:bg-gray-100">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-600">
                <User className="h-4 w-4 text-white" />
              </div>
              <span className="text-sm font-medium">{auth.user?.name}</span>
            </button>
            <button
              onClick={async () => {
                await auth.logout();
                router.push('/');
              }}
              title="Sign Out"
              className="flex items-center gap-1 rounded-lg p-2 text-red-600 hover:bg-red-50"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-64 border-r border-gray-200 bg-white p-4">
          <nav className="space-y-2">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const active =
                tab.href === '/admin' ? pathname === '/admin' : pathname.startsWith(tab.href);
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
        </aside>

        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
