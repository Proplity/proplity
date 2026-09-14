'use client';

import { useRouter } from 'next/navigation';
import { formatDistanceToNowStrict } from 'date-fns';
import { Bell, Megaphone, Wrench, Info, Check, Trash2, CheckCheck } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import type { Notification } from '@/lib/api/types';

const TYPE_ICON: Record<Notification['type'], typeof Bell> = {
  ANNOUNCEMENT: Megaphone,
  MAINTENANCE_STATUS: Wrench,
  SYSTEM: Info,
};

const TYPE_COLOR: Record<Notification['type'], string> = {
  ANNOUNCEMENT: 'bg-purple-100 text-purple-600',
  MAINTENANCE_STATUS: 'bg-orange-100 text-orange-600',
  SYSTEM: 'bg-blue-100 text-blue-600',
};

export function NotificationsPage() {
  const router = useRouter();
  const { data, unreadCount, loading, error, hasMore, loadMore, markRead, markAllRead, remove } =
    useNotifications();

  function handleOpen(n: Notification) {
    if (!n.isRead) markRead(n.id);
    if (n.link) router.push(n.link);
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="mb-1 text-2xl font-semibold">Notifications</h1>
          <p className="text-sm text-gray-500">
            {unreadCount > 0 ? `${unreadCount} unread` : 'You are all caught up'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllRead()}
            className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <CheckCheck className="h-4 w-4" />
            Mark all as read
          </button>
        )}
      </div>

      {loading && data.length === 0 && (
        <p className="text-sm text-gray-500">Loading notifications…</p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && data.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-10 text-center">
          <Bell className="mx-auto mb-3 h-8 w-8 text-gray-300" />
          <p className="text-sm text-gray-500">No notifications yet</p>
        </div>
      )}

      {data.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          {data.map((n) => {
            const Icon = TYPE_ICON[n.type];
            return (
              <div
                key={n.id}
                className={`group flex items-start gap-3 border-b border-gray-100 px-4 py-4 last:border-b-0 ${
                  n.isRead ? '' : 'bg-blue-50/60'
                }`}
              >
                <button
                  onClick={() => handleOpen(n)}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${TYPE_COLOR[n.type]}`}
                >
                  <Icon className="h-4 w-4" />
                </button>
                <button onClick={() => handleOpen(n)} className="min-w-0 flex-1 text-left">
                  <span className="block text-sm font-medium text-gray-900">{n.title}</span>
                  <span className="mt-0.5 block text-sm text-gray-500">{n.body}</span>
                  <span className="mt-1 block text-xs text-gray-400">
                    {formatDistanceToNowStrict(new Date(n.createdAt), { addSuffix: true })}
                  </span>
                </button>
                <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100">
                  {!n.isRead && (
                    <button
                      onClick={() => markRead(n.id)}
                      title="Mark as read"
                      className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-blue-600"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => remove(n.id)}
                    title="Delete"
                    className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {hasMore && (
        <div className="text-center">
          <button
            onClick={() => loadMore()}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Load more
          </button>
        </div>
      )}
    </div>
  );
}
