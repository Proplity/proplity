import Link from 'next/link';
import { CheckCircle, ChevronRight } from 'lucide-react';
import { useAttention } from '@/hooks/useDashboardSummary';
import type { AttentionSeverity } from '@/lib/dashboardAttention';

const SEVERITY_STYLE: Record<AttentionSeverity, { dot: string; pill: string }> = {
  high: { dot: 'bg-red-500', pill: 'bg-red-100 text-red-700' },
  medium: { dot: 'bg-amber-500', pill: 'bg-amber-100 text-amber-700' },
  low: { dot: 'bg-gray-300', pill: 'bg-gray-100 text-gray-600' },
};

/**
 * Everything waiting on the signed-in person, in one list, each row linking to where it is
 * handled. The server decides what belongs to the role (lib/dashboardAttention.ts).
 */
export function AttentionCard() {
  const { data, loading, error } = useAttention();
  const items = data ?? [];

  return (
    <section
      aria-labelledby="attention-heading"
      className="rounded-lg border border-gray-200 bg-white"
    >
      <div className="flex items-center justify-between border-b border-gray-200 p-6">
        <h2 id="attention-heading" className="font-semibold">
          Needs your attention
        </h2>
        {items.length > 0 && (
          <span className="text-xs text-gray-500">
            {items.reduce((sum, i) => sum + i.count, 0)} waiting
          </span>
        )}
      </div>
      {loading && !data ? (
        <p className="p-6 text-sm text-gray-400">Checking what is waiting for you…</p>
      ) : error ? (
        <p className="p-6 text-sm text-gray-500">Could not load this list. Refresh to try again.</p>
      ) : items.length === 0 ? (
        <p className="flex items-center gap-2 p-6 text-sm text-gray-600">
          <CheckCircle className="h-4 w-4 text-green-600" />
          You are all caught up. Nothing is waiting on you.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="flex items-center gap-3 px-6 py-3 hover:bg-gray-50 focus-visible:bg-gray-50 focus-visible:outline-none"
              >
                <span
                  aria-hidden="true"
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${SEVERITY_STYLE[item.severity].dot}`}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{item.label}</span>
                  {item.detail && (
                    <span className="block truncate text-xs text-gray-500">{item.detail}</span>
                  )}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${SEVERITY_STYLE[item.severity].pill}`}
                >
                  {item.count}
                </span>
                <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-gray-400" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
