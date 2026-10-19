'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Building2,
  ArrowLeft,
  UserCheck,
  UserX,
  Clock,
  LayoutGrid,
  List,
  Phone,
  Mail,
  Calendar,
  Shield,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/apiClient';
import type { AdminUser } from '@/lib/api/types';
import { isAxiosError } from 'axios';

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

const PAGE_SIZE = 20;
const STATUS_FILTERS = [
  { value: 'ALL', label: 'Any status' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'PENDING_VERIFICATION', label: 'Awaiting email check' },
] as const;
const CHANGEABLE_ROLES = ['TENANT', 'LANDLORD', 'MANAGER', 'VENDOR'] as const;

export default function AdminUsersPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [page, setPage] = useState(1);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingVendors, setPendingVendors] = useState<AdminUser[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  // Suspend / reactivate / change role asks for a reason first.
  const [action, setAction] = useState<{
    user: AdminUser;
    kind: 'SUSPENDED' | 'ACTIVE' | 'ROLE';
  } | null>(null);
  const [reason, setReason] = useState('');
  const [newRole, setNewRole] = useState<string>('TENANT');
  const [actionError, setActionError] = useState<string | null>(null);

  // The search box waits for a pause in typing, then goes back to page 1.
  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.admin.users.list({
        page,
        limit: PAGE_SIZE,
        ...(roleFilter !== 'ALL' ? { role: roleFilter } : {}),
        ...(statusFilter !== 'ALL' ? { status: statusFilter } : {}),
        ...(query ? { q: query } : {}),
      });
      setUsers(res.data.data);
      setTotal(res.data.meta.total);
    } catch {
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [page, roleFilter, statusFilter, query]);

  const loadPendingVendors = useCallback(async () => {
    try {
      const res = await api.admin.users.list({ vendorStatus: 'PENDING', limit: 50 });
      setPendingVendors(res.data.data);
    } catch {
      setPendingVendors([]);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);
  useEffect(() => {
    const timer = setTimeout(() => {
      loadPendingVendors();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadPendingVendors]);

  const decide = async (id: string, status: 'VERIFIED' | 'REJECTED') => {
    setBusyId(id);
    try {
      await api.admin.vendors.verify(id, { status, note: notes[id]?.trim() || undefined });
      toast.success(status === 'VERIFIED' ? 'Vendor verified.' : 'Vendor rejected.');
      await Promise.all([load(), loadPendingVendors()]);
    } catch {
      toast.error('Could not save the decision. Try again.');
    } finally {
      setBusyId(null);
    }
  };

  const openAction = (user: AdminUser, kind: 'SUSPENDED' | 'ACTIVE' | 'ROLE') => {
    setAction({ user, kind });
    setReason('');
    setActionError(null);
    setNewRole(CHANGEABLE_ROLES.find((r) => r !== user.role) ?? 'TENANT');
  };

  const confirmAction = async () => {
    if (!action) return;
    setBusyId(action.user.id);
    setActionError(null);
    try {
      await api.admin.updateUser(action.user.id, {
        reason: reason.trim(),
        ...(action.kind === 'ROLE' ? { role: newRole } : { status: action.kind }),
      });
      toast.success(
        action.kind === 'SUSPENDED'
          ? 'Account suspended. They are signed out.'
          : action.kind === 'ACTIVE'
            ? 'Account reactivated.'
            : 'Role changed. They must sign in again.',
      );
      setAction(null);
      await load();
    } catch (e) {
      setActionError(
        (isAxiosError(e) && e.response?.data?.error) || 'Could not save the change. Try again.',
      );
    } finally {
      setBusyId(null);
    }
  };

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

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
            {loading ? 'Loading…' : `${total} matching accounts`}
          </p>
        </div>
      </div>

      {pendingVendors.length > 0 && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <p className="mb-3 text-sm font-semibold text-yellow-900">
            Vendors awaiting verification ({pendingVendors.length})
          </p>
          <div className="space-y-3">
            {pendingVendors.map((v) => (
              <div key={v.id} className="flex flex-wrap items-center gap-3">
                <div className="min-w-48 flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {v.vendorProfile?.businessName}
                  </p>
                  <p className="text-xs text-gray-600">
                    {v.name} · {v.email}
                  </p>
                </div>
                <input
                  value={notes[v.id] ?? ''}
                  onChange={(e) => setNotes({ ...notes, [v.id]: e.target.value })}
                  placeholder="Reason (shown if rejected)"
                  className="w-56 rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                />
                <button
                  onClick={() => decide(v.id, 'VERIFIED')}
                  disabled={busyId === v.id}
                  className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  Verify
                </button>
                <button
                  onClick={() => decide(v.id, 'REJECTED')}
                  disabled={busyId === v.id}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-white disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sticky Compact Filter Toolbar */}
      <div className="sticky top-0 z-30 -mx-6 border-b border-gray-200 bg-white/95 px-6 py-2 shadow-xs backdrop-blur-md transition-all">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Role Filter Pills & Status Dropdown */}
          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto py-0.5">
            {ALL_ROLES.map((role) => {
              const label = role === 'ALL' ? 'All Roles' : ROLE_BADGE[role].label;
              return (
                <button
                  key={role}
                  onClick={() => {
                    setRoleFilter(role);
                    setPage(1);
                  }}
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition-colors ${
                    roleFilter === role
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {label}
                </button>
              );
            })}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-700 focus:border-blue-500 focus:outline-none"
              aria-label="Filter by status"
            >
              {STATUS_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          {/* Search Input & Desktop/Mobile View Switcher */}
          <div className="flex items-center gap-2">
            <div className="relative w-48 sm:w-56 md:w-64">
              <Search className="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search users…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white py-1 pr-3 pl-8 text-xs shadow-2xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center rounded-lg border border-gray-200 bg-white p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                title="Switch to Card view"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Cards</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  viewMode === 'table'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                title="Switch to Table view"
              >
                <List className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Table</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}

      {/* =================================================================== */}
      {/* 1. CARDS / GRID VIEW (Default)                                      */}
      {/* =================================================================== */}
      {viewMode === 'grid' && (
        <div className="space-y-6">
          {loading && (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse space-y-4 rounded-2xl border border-gray-200 bg-white p-5"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-gray-200" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-4 w-3/4 rounded bg-gray-200" />
                      <div className="h-3 w-1/2 rounded bg-gray-100" />
                    </div>
                  </div>
                  <div className="h-16 rounded-xl bg-gray-50" />
                  <div className="h-8 rounded-lg bg-gray-100" />
                </div>
              ))}
            </div>
          )}

          {!loading && users.length === 0 && (
            <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center text-gray-400">
              No users match your filters.
            </div>
          )}

          {!loading && users.length > 0 && (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {users.map((user: AdminUser) => {
                const roleBadge = ROLE_BADGE[user.role] ?? {
                  label: user.role,
                  className: 'bg-gray-100 text-gray-700',
                };
                const statusMeta =
                  STATUS_BADGE[user.status] ?? STATUS_BADGE['PENDING_VERIFICATION'];
                const StatusIcon = statusMeta.icon;

                return (
                  <div
                    key={user.id}
                    className="flex flex-col justify-between rounded-2xl border border-gray-200 bg-white p-5 shadow-xs transition-shadow hover:shadow-md"
                  >
                    <div>
                      {/* Top Header: Avatar, Name, Email, Role, Status */}
                      <div className="mb-3.5 flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-sm font-bold text-white shadow-xs">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <h3 className="truncate text-sm leading-tight font-bold text-gray-900">
                              {user.name}
                            </h3>
                            <p className="mt-0.5 truncate text-xs text-gray-500">{user.email}</p>
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${roleBadge.className}`}
                          >
                            {roleBadge.label}
                          </span>
                          <div className={`flex items-center gap-1 ${statusMeta.className}`}>
                            <StatusIcon className="h-3 w-3" />
                            <span className="text-[11px] font-medium capitalize">
                              {user.status.toLowerCase().replace(/_/g, ' ')}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Vendor Banner if vendor */}
                      {user.vendorProfile && (
                        <div className="mb-3 rounded-lg border border-orange-200/60 bg-orange-50/80 px-3 py-1.5 text-xs">
                          <p className="truncate font-semibold text-orange-950">
                            {user.vendorProfile.businessName}
                          </p>
                          <p className="text-[11px] text-orange-700 capitalize">
                            Status: {user.vendorProfile.verificationStatus.toLowerCase()}
                          </p>
                        </div>
                      )}

                      {/* Metrics Box: Properties, Phone, Joined */}
                      <div className="mb-4 space-y-2 rounded-xl border border-gray-100 bg-gray-50/80 p-3 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-gray-500">
                            <Building2 className="h-3.5 w-3.5 text-blue-600" />
                            Properties
                          </span>
                          <span
                            className={`font-bold ${
                              user.propertiesCount > 0 ? 'text-blue-700' : 'text-gray-400'
                            }`}
                          >
                            {user.propertiesCount > 0
                              ? `${user.propertiesCount} ${
                                  user.propertiesCount === 1 ? 'Property' : 'Properties'
                                }`
                              : '0 Properties'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-gray-500">
                            <Phone className="h-3.5 w-3.5 text-gray-400" />
                            Phone
                          </span>
                          <span className="max-w-[150px] truncate font-medium text-gray-700">
                            {user.phoneNumber ?? '—'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-gray-500">
                            <Calendar className="h-3.5 w-3.5 text-gray-400" />
                            Joined
                          </span>
                          <span className="text-gray-600">
                            {new Date(user.createdAt).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions Footer */}
                    <div className="border-t border-gray-100 pt-3">
                      {user.role === 'ADMIN' ? (
                        <p className="py-1 text-center text-xs text-gray-400 italic">
                          System Administrator
                        </p>
                      ) : (
                        <div className="flex items-center gap-2">
                          {user.status === 'ACTIVE' && (
                            <button
                              onClick={() => openAction(user, 'SUSPENDED')}
                              className="flex-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50"
                            >
                              Suspend
                            </button>
                          )}
                          {user.status === 'SUSPENDED' && (
                            <button
                              onClick={() => openAction(user, 'ACTIVE')}
                              className="flex-1 rounded-lg border border-green-200 px-2.5 py-1.5 text-xs font-semibold text-green-700 transition-colors hover:bg-green-50"
                            >
                              Reactivate
                            </button>
                          )}
                          <button
                            onClick={() => openAction(user, 'ROLE')}
                            className="flex-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
                          >
                            Change Role
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* 2. TABLE VIEW (Traditional)                                         */}
      {/* =================================================================== */}
      {viewMode === 'table' && (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-xs font-medium tracking-wide text-gray-500 uppercase">
              <tr>
                <th className="px-6 py-3 text-left">User</th>
                <th className="px-6 py-3 text-left">Role</th>
                <th className="px-6 py-3 text-left">Status</th>
                <th className="px-6 py-3 text-left">Phone</th>
                <th className="px-6 py-3 text-left">Properties</th>
                <th className="px-6 py-3 text-left">Joined</th>
                <th className="px-6 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j} className="px-6 py-4">
                        <div className="h-4 rounded bg-gray-100" />
                      </td>
                    ))}
                  </tr>
                ))}

              {!loading && users.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                    No users match your filters.
                  </td>
                </tr>
              )}

              {!loading &&
                users.map((user: AdminUser) => {
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
                        {user.vendorProfile && (
                          <p className="mt-1 text-xs text-gray-500">
                            {user.vendorProfile.verificationStatus === 'VERIFIED'
                              ? 'Verified'
                              : user.vendorProfile.verificationStatus === 'REJECTED'
                                ? 'Rejected'
                                : 'Awaiting verification'}
                          </p>
                        )}
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
                        {user.propertiesCount > 0 ? (
                          <div className="flex items-center gap-1 text-gray-600">
                            <Building2 className="h-3.5 w-3.5" />
                            <span>{user.propertiesCount}</span>
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
                      <td className="px-6 py-4">
                        {user.role === 'ADMIN' ? (
                          <span className="text-xs text-gray-300">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {user.status === 'ACTIVE' && (
                              <button
                                onClick={() => openAction(user, 'SUSPENDED')}
                                className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                              >
                                Suspend
                              </button>
                            )}
                            {user.status === 'SUSPENDED' && (
                              <button
                                onClick={() => openAction(user, 'ACTIVE')}
                                className="rounded-lg border border-green-200 px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-50"
                              >
                                Reactivate
                              </button>
                            )}
                            <button
                              onClick={() => openAction(user, 'ROLE')}
                              className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                            >
                              Change role
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}

      {/* Paging */}
      {!loading && total > 0 && (
        <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 text-xs text-gray-500">
          <span>
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded border border-gray-200 bg-white px-2.5 py-1 hover:bg-gray-50 disabled:opacity-40"
            >
              Previous
            </button>
            <span>
              Page {page} of {pageCount}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={page >= pageCount}
              className="rounded border border-gray-200 bg-white px-2.5 py-1 hover:bg-gray-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {action && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setAction(null)}
        >
          <div
            className="w-full max-w-md space-y-4 rounded-xl bg-white p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold">
              {action.kind === 'SUSPENDED'
                ? `Suspend ${action.user.name}?`
                : action.kind === 'ACTIVE'
                  ? `Reactivate ${action.user.name}?`
                  : `Change ${action.user.name}'s role`}
            </h2>
            <p className="text-sm text-gray-600">
              {action.kind === 'SUSPENDED'
                ? 'They are signed out straight away and cannot sign in until you reactivate them. They get an email with your reason.'
                : action.kind === 'ACTIVE'
                  ? 'They can sign in again.'
                  : 'They are signed out and must sign in again. This only works for people with no properties, tenancy or jobs yet.'}
            </p>
            {action.kind === 'ROLE' && (
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                {CHANGEABLE_ROLES.filter((r) => r !== action.user.role).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_BADGE[r].label}
                  </option>
                ))}
              </select>
            )}
            <div>
              <label className="mb-1 block text-sm text-gray-600">
                Reason (saved in the audit log)
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            {actionError && <p className="text-sm text-red-600">{actionError}</p>}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setAction(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmAction}
                disabled={reason.trim().length < 3 || busyId === action.user.id}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {busyId === action.user.id ? 'Saving…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
