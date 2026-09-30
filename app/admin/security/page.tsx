'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, Shield } from 'lucide-react';
import { useAuditLogs } from '@/hooks/useAuditLogs';

export default function AdminSecurityPage() {
  const router = useRouter();
  const { data: logs, loading, error } = useAuditLogs();

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push('/admin')}
          className="flex items-center gap-1 rounded-lg p-2 text-gray-500 hover:bg-gray-100"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Shield className="h-5 w-5" />
            Security
          </h1>
          <p className="text-sm text-gray-500">
            {loading ? 'Loading…' : `${logs.length} audit log entries`}
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 p-6">
          <h2 className="font-semibold">Audit Log</h2>
          <p className="mt-1 text-sm text-gray-600">
            Sensitive application-level actions: role changes, property transfers, invoice edits,
            and admin overrides. This is a thin log today — most of the platform doesn&apos;t write
            to it yet, so an empty or short list here means little has happened, not that nothing
            was recorded.
          </p>
        </div>
        <div className="divide-y divide-gray-200">
          {logs.map((log) => (
            <div key={log.id} className="flex items-start justify-between gap-4 p-4">
              <div>
                <p className="text-sm font-medium">{log.action}</p>
                <p className="mt-1 text-xs text-gray-600">
                  {log.entityType} · {log.entityId}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {log.actor ? `${log.actor.name} (${log.actor.email})` : 'System'}
                </p>
              </div>
              <span className="shrink-0 text-xs text-gray-500">
                {new Date(log.createdAt).toLocaleString()}
              </span>
            </div>
          ))}
          {logs.length === 0 && !loading && (
            <p className="p-4 text-sm text-gray-400">No audit log entries yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
