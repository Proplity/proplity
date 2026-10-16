'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ChevronDown, ChevronRight, Shield } from 'lucide-react';
import { api } from '@/lib/apiClient';
import type { AuditLog } from '@/lib/api/types';

const PAGE_SIZE = 25;

// "PAYMENT_RECORDED_MANUALLY" -> "Payment recorded manually"
function readable(action: string) {
  const text = action.toLowerCase().replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export default function AdminSecurityPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [actions, setActions] = useState<string[]>([]);
  const [entityTypes, setEntityTypes] = useState<string[]>([]);
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [actorInput, setActorInput] = useState('');
  const [actor, setActor] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  // The actor box waits for a pause in typing, then goes back to page 1.
  useEffect(() => {
    const t = setTimeout(() => {
      setActor(actorInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [actorInput]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.admin.auditLogs.list({
        page,
        limit: PAGE_SIZE,
        facets: 1,
        ...(action ? { action } : {}),
        ...(entityType ? { entityType } : {}),
        ...(actor ? { actor } : {}),
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
      });
      setLogs(res.data.data);
      setTotal(res.data.meta.total);
      if (res.data.facets) {
        setActions(res.data.facets.actions);
        setEntityTypes(res.data.facets.entityTypes);
      }
    } catch {
      setError('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [page, action, entityType, actor, from, to]);

  useEffect(() => {
    const timer = setTimeout(() => {
      load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const change = (apply: () => void) => {
    apply();
    setPage(1);
  };
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = Boolean(action || entityType || actor || from || to);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push('/admin')}
          className="flex items-center gap-1 rounded-lg p-2 text-gray-500 hover:bg-gray-100"
          aria-label="Back to admin"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Shield className="h-5 w-5" />
            Security
          </h1>
          <p className="text-sm text-gray-500">
            {loading ? 'Loading…' : `${total} audit log ${total === 1 ? 'entry' : 'entries'}`}
            {filtered && !loading ? ' match your filters' : ''}
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-4">
        <label className="text-xs text-gray-600">
          What happened
          <select
            value={action}
            onChange={(e) => change(() => setAction(e.target.value))}
            className="mt-1 block w-52 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Anything</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {readable(a)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-gray-600">
          About
          <select
            value={entityType}
            onChange={(e) => change(() => setEntityType(e.target.value))}
            className="mt-1 block w-44 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Anything</option>
            {entityTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-gray-600">
          Done by (name or email)
          <input
            value={actorInput}
            onChange={(e) => setActorInput(e.target.value)}
            className="mt-1 block w-52 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="text-xs text-gray-600">
          From
          <input
            type="date"
            value={from}
            onChange={(e) => change(() => setFrom(e.target.value))}
            className="mt-1 block rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="text-xs text-gray-600">
          To
          <input
            type="date"
            value={to}
            onChange={(e) => change(() => setTo(e.target.value))}
            className="mt-1 block rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        {filtered && (
          <button
            onClick={() => {
              setAction('');
              setEntityType('');
              setActorInput('');
              setActor('');
              setFrom('');
              setTo('');
              setPage(1);
            }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 p-6">
          <h2 className="font-semibold">Audit Log</h2>
          <p className="mt-1 text-sm text-gray-600">
            Sensitive actions: account suspensions and role changes, manual payments and invoice
            edits, vendor decisions, file reads and retention deletions. Open an entry to see its
            details.
          </p>
        </div>
        <div className="divide-y divide-gray-200">
          {logs.map((log) => {
            const expanded = open === log.id;
            return (
              <div key={log.id} className="p-4">
                <button
                  onClick={() => setOpen(expanded ? null : log.id)}
                  className="flex w-full items-start justify-between gap-4 text-left"
                  aria-expanded={expanded}
                >
                  <div className="flex items-start gap-2">
                    {expanded ? (
                      <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                    ) : (
                      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                    )}
                    <div>
                      <p className="text-sm font-medium">{readable(log.action)}</p>
                      <p className="mt-1 text-xs text-gray-600">
                        {log.entityType}
                        {' · '}
                        {log.entityLabel ?? <span className="font-mono">{log.entityId}</span>}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {log.actor ? `${log.actor.name} (${log.actor.email})` : 'System'}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 text-xs text-gray-500">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </button>
                {expanded && (
                  <pre className="mt-3 max-h-72 overflow-auto rounded-lg bg-gray-50 p-3 text-xs text-gray-700">
                    {JSON.stringify(
                      { id: log.id, entityId: log.entityId, details: log.metadata },
                      null,
                      2,
                    )}
                  </pre>
                )}
              </div>
            );
          })}
          {logs.length === 0 && !loading && (
            <p className="p-4 text-sm text-gray-400">
              {filtered ? 'No entries match these filters.' : 'No audit log entries yet.'}
            </p>
          )}
        </div>
        {total > 0 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-6 py-3 text-xs text-gray-500">
            <span>
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded border border-gray-200 px-2.5 py-1 disabled:opacity-40"
              >
                Previous
              </button>
              <span>
                Page {page} of {pageCount}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={page >= pageCount}
                className="rounded border border-gray-200 px-2.5 py-1 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
