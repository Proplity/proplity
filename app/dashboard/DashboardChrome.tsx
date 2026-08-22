'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Logo } from '../components/Logo';
import { RoleSwitcher } from '../components/RoleSwitcher';
import { AIAssistant } from '../components/AIAssistant';
import { useAuth } from '@/context/AuthContext';
import {
  Home,
  Search,
  Users,
  Wrench,
  MessageSquare,
  Settings,
  Bell,
  User,
  Building2,
  DollarSign,
  Receipt,
  Plus,
  LogOut,
} from 'lucide-react';

type Role = 'manager' | 'tenant' | 'landlord' | 'vendor';

function getTabsForRole(role: Role) {
  switch (role) {
    case 'manager':
      return [
        { href: '/dashboard', label: 'Dashboard', icon: Home },
        { href: '/dashboard/discover', label: 'Discover Properties', icon: Search },
        { href: '/dashboard/tenants', label: 'Tenants', icon: Users },
        { href: '/dashboard/maintenance', label: 'Maintenance', icon: Wrench },
        { href: '/dashboard/messages', label: 'Messages', icon: MessageSquare },
      ];
    case 'tenant':
      return [
        { href: '/dashboard', label: 'My Dashboard', icon: Home },
        { href: '/dashboard/discover', label: 'Browse Properties', icon: Search },
        { href: '/dashboard/payment-history', label: 'Payment History', icon: Receipt },
        { href: '/dashboard/messages', label: 'Messages', icon: MessageSquare },
      ];
    case 'landlord':
      return [
        { href: '/dashboard', label: 'Portfolio', icon: Building2 },
        { href: '/dashboard/messages', label: 'Messages', icon: MessageSquare },
      ];
    case 'vendor':
      return [
        { href: '/dashboard', label: 'My Jobs', icon: Wrench },
        { href: '/dashboard', label: 'Invoices', icon: DollarSign },
        { href: '/dashboard/messages', label: 'Messages', icon: MessageSquare },
      ];
  }
}

const AVATAR_COLOR: Record<Role, string> = {
  manager: 'bg-blue-600',
  tenant: 'bg-green-600',
  landlord: 'bg-purple-600',
  vendor: 'bg-orange-600',
};

export function DashboardChrome({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [showAIAssistant, setShowAIAssistant] = useState(false);

  const role = (auth.user?.role as Role) || 'manager';
  const tabs = getTabsForRole(role);

  return (
    <div className="flex size-full flex-col bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <button onClick={() => router.push('/')} className="focus:outline-none">
            <Logo />
          </button>

          <div className="flex items-center gap-4">
            {process.env.NODE_ENV !== 'production' && (
              <RoleSwitcher
                currentRole={role}
                onRoleChange={(newRole) => router.push(newRole === 'admin' ? '/admin' : '/dashboard')}
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
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full ${AVATAR_COLOR[role]}`}
              >
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
          {(role === 'manager' || role === 'landlord') && (
            <button
              onClick={() => router.push('/dashboard/properties/new')}
              className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-green-600 px-4 py-3 font-medium text-white hover:from-blue-700 hover:to-green-700"
            >
              <Plus className="h-5 w-5" />
              List Property
            </button>
          )}

          <nav className="space-y-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = tab.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(tab.href);
              return (
                <button
                  key={tab.label}
                  onClick={() => router.push(tab.href)}
                  className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 transition-colors ${
                    active ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {role !== 'vendor' && (
            <div className="mt-8 rounded-lg bg-gradient-to-br from-blue-50 to-green-50 p-4">
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
        </aside>

        <main className="flex-1 overflow-auto">{children}</main>

        {showAIAssistant && <AIAssistant onClose={() => setShowAIAssistant(false)} />}
      </div>
    </div>
  );
}
