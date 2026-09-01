'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Search, Shield, Building2, ArrowLeft, UserCheck, UserX, Clock } from 'lucide-react';
import { useAdminUsers } from '@/hooks/useAdminUsers';
import type { AdminUser } from '@/lib/api/types';

const ROLE_BADGE: Record<string, { label: string; className: string }> = {
  ADMIN: { label: 'Admin', className: 'bg-gray-100 text-gray-800' },
  MANAGER: { label: 'Manager', className: 'bg-blue-100 text-blue-800' },
  LANDLORD: { label: 'Landlord', className: 'bg-purple-100 text-purple-800' },
  TENANT: { label: 'Tenant', className: 'bg-green-100 text-green-800' },
  VENDOR: { label: 'Vendor', className: 'bg-orange-100 text-orange-800' },
};

const STATUS_BADGE: Record<string, { icon: typeof UserCheck; className: string }> = {
  ACTIVE: { icon: UserCheck, className: 'text-green-600' },
  SUSPENDED: { icon: UserX, className: 'text-red-600' },
  PENDING_VERIFICATION: { icon: Clock, className: 'text-yellow-600' },
};

const ALL_ROLES = ['ALL', 'ADMIN', 'MANAGER', 'LANDLORD', 'TENANT', 'VENDOR'] as const;

export default function AdminUsersPage() {
  const router = useRouter();
  const { data: users, loading, error } = useAdminUsers();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  const filtered = users.filter((u) => {
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    const term = search.toLowerCase();
    const matchesSearch =
      !term ||
      u.name.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term) ||
      (u.phoneNumber ?? '').includes(term);
    return matchesRole && matchesSearch;
  });

  const roleCounts = ALL_ROLES.slice(1).reduce<Record<string, number>>((acc, role) => {
    acc[role] = users.filter((u) => u.role === role).length;
    return acc;
  }, {});

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push('/admin')}
          className="flex items-center gap-1 rounded-lg p-2 text-gray-500 hover:bg-gray-100"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-2xl font-semibold">User Management</h1>
          <p className="text-sm text-gray-500">
            {loading ? 'Loading…' : `${users.length} registered accounts`}
          </p>
        </div>
      </div>

      {/* Role summary chips */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setRoleFilter('ALL')}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            roleFilter === 'ALL'
              ? 'bg-blue-600 text-white'
              : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          All ({users.length})
        </button>
        {ALL_ROLES.slice(1).map((role) => {
          const badge = ROLE_BADGE[role];
          return (
            <button
              key={role}
              onClick={() => setRoleFilter(role)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                roleFilter === role
                  ? 'bg-blue-600 text-white'
                  : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {badge.label} ({roleCounts[role] ?? 0})
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name, email or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-gray-200 py-2 pr-4 pl-9 text-sm focus:border-blue-400 focus:ring-1 focus:ring-blue-400 focus:outline-none"
        />
      </div>

      {/* Error */}
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-xs font-medium tracking-wide text-gray-500 uppercase">
            <tr>
              <th className="px-6 py-3 text-left">User</th>
              <th className="px-6 py-3 text-left">Role</th>
              <th className="px-6 py-3 text-left">Status</th>
              <th className="px-6 py-3 text-left">Phone</th>
              <th className="px-6 py-3 text-left">Properties</th>
              <th className="px-6 py-3 text-left">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading &&
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {Array.from({ length: 6 }).map((__, j) => (
                    <td key={j} className="px-6 py-4">
                      <div className="h-4 rounded bg-gray-100" />
                    </td>
                  ))}
                </tr>
              ))}

            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                  No users match your filters.
                </td>
              </tr>
            )}

            {!loading &&
              filtered.map((user: AdminUser) => {
                const roleBadge = ROLE_BADGE[user.role] ?? {
                  label: user.role,
                  className: 'bg-gray-100 text-gray-700',
                };
                const statusMeta =
                  STATUS_BADGE[user.status] ?? STATUS_BADGE['PENDING_VERIFICATION'];
                const StatusIcon = statusMeta.icon;

                return (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{user.name}</p>
                          <p className="text-xs text-gray-500">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${roleBadge.className}`}
                      >
                        {roleBadge.label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`flex items-center gap-1 ${statusMeta.className}`}>
                        <StatusIcon className="h-3.5 w-3.5" />
                        <span className="text-xs font-medium capitalize">
                          {user.status.toLowerCase().replace(/_/g, ' ')}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {user.phoneNumber ?? <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-6 py-4">
                      {(user as any).propertiesCount > 0 ? (
                        <div className="flex items-center gap-1 text-gray-600">
                          <Building2 className="h-3.5 w-3.5" />
                          <span>{(user as any).propertiesCount}</span>
                        </div>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {new Date(user.createdAt).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>

        {/* Footer count */}
        {!loading && filtered.length > 0 && (
          <div className="border-t border-gray-100 px-6 py-3 text-xs text-gray-400">
            Showing {filtered.length} of {users.length} users
          </div>
        )}
      </div>
    </div>
  );
}
