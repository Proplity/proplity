'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { formatDistanceToNowStrict } from 'date-fns';
import { Bell, Megaphone, Wrench, Info } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from '@/app/components/ui/dropdown-menu';
import { useNotificationBell } from '@/hooks/useNotificationBell';
import { playNotificationSound } from '@/lib/notificationSound';
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

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { items, unreadCount, newlyArrived, clearNewlyArrived, markRead, markAllRead } =
    useNotificationBell();

  // Toast + chime for whatever arrived since the last poll tick -- never for
  // what was already there on mount (useNotificationBell only populates
  // newlyArrived from the second poll onward).
  useEffect(() => {
    if (newlyArrived.length === 0) return;
    playNotificationSound();
    newlyArrived.forEach((n) => {
      toast(n.title, {
        description: n.body,
        duration: 6000,
        action: n.link
          ? {
              label: 'View',
              onClick: () => {
                markRead(n.id);
                router.push(n.link!);
              },
            }
          : undefined,
      });
    });
    clearNewlyArrived();
  }, [newlyArrived, clearNewlyArrived, markRead, router]);

  function handleOpenItem(n: Notification) {
    if (!n.isRead) markRead(n.id);
    setOpen(false);
    if (n.link) router.push(n.link);
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button className="relative rounded-lg p-2 hover:bg-gray-100" aria-label="Notifications">
          <Bell className="h-5 w-5 text-gray-600" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-80 border-gray-200 bg-white p-0 text-gray-900 shadow-lg"
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <span className="text-sm font-semibold">Notifications</span>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllRead()}
              className="text-xs font-medium text-blue-600 hover:underline"
            >
              Mark all read
            </button>
          )}
        </div>

        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-gray-400">
              You&apos;re all caught up
            </div>
          )}
          {items.map((n) => {
            const Icon = TYPE_ICON[n.type];
            return (
              <button
                key={n.id}
                onClick={() => handleOpenItem(n)}
                className={`flex w-full items-start gap-3 border-b border-gray-50 px-4 py-3 text-left last:border-b-0 hover:bg-gray-50 ${
                  n.isRead ? '' : 'bg-blue-50/60'
                }`}
              >
                <span
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${TYPE_COLOR[n.type]}`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-gray-900">
                    {n.title}
                  </span>
                  <span className="block truncate text-xs text-gray-500">{n.body}</span>
                  <span className="mt-0.5 block text-[11px] text-gray-400">
                    {formatDistanceToNowStrict(new Date(n.createdAt), { addSuffix: true })}
                  </span>
                </span>
                {!n.isRead && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-600" />}
              </button>
            );
          })}
        </div>

        <div className="border-t border-gray-100 px-4 py-2 text-center">
          <button
            onClick={() => {
              setOpen(false);
              router.push('/dashboard/notifications');
            }}
            className="text-xs font-medium text-blue-600 hover:underline"
          >
            View all notifications
          </button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
