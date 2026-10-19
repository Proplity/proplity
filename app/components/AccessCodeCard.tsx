'use client';

import { useState } from 'react';
import { Key } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/apiClient';
import { useRevokeAccessCode } from '@/hooks/useAccessCodes';
import type { AccessCode, AccessCodeDetail, AccessLogEntry } from '@/lib/api/types';

const STATUS_STYLE: Record<AccessCode['status'], string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  USED: 'bg-gray-100 text-gray-600',
  EXPIRED: 'bg-amber-100 text-amber-700',
  REVOKED: 'bg-red-100 text-red-700',
};

const ACTION_LABEL: Record<AccessLogEntry['action'], string> = {
  GRANTED: 'Let in',
  DENIED: 'Refused (already used or not valid yet)',
  EXPIRED_ATTEMPT: 'Refused (expired)',
  REVOKED: 'Refused (cancelled)',
};

// One gate code: who it is for, when it ends, its state, a Revoke button while it still works,
// and the log of every time the gate checked it. Used on the tenant dashboard and the
// manager's property page.
export function AccessCodeCard({ code, onChanged }: { code: AccessCode; onChanged: () => void }) {
  const { submit: revoke, submitting: revoking } = useRevokeAccessCode();
  const [logs, setLogs] = useState<AccessCodeDetail['logs'] | null>(null);
  const [showLog, setShowLog] = useState(false);

  const toggleLog = async () => {
    if (showLog) {
      setShowLog(false);
      return;
    }
    setShowLog(true);
    try {
      const res = await api.accessCodes.get(code.id);
      setLogs(res.data.data.logs);
    } catch {
      toast.error('Could not load the activity for this code.');
      setShowLog(false);
    }
  };

  const handleRevoke = async () => {
    try {
      await revoke(code.id);
      toast.success('Code revoked. The gate will refuse it from now on.');
      onChanged();
    } catch {
      toast.error('Could not revoke the code. Please try again.');
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Key className="h-4 w-4 shrink-0 text-blue-600" />
          <p className="truncate text-sm font-medium">{code.guestName ?? 'Access Code'}</p>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[code.status]}`}
        >
          {code.status === 'USED'
            ? 'Used'
            : code.status.charAt(0) + code.status.slice(1).toLowerCase()}
        </span>
      </div>
      <p className="mb-1 text-2xl font-bold text-blue-600">{code.code}</p>
      <p className="text-xs text-gray-500">
        {code.validUntil
          ? `Expires ${new Date(code.validUntil).toLocaleDateString()}`
          : 'No expiry'}
        {code.singleUse ? ' · one-time' : ' · reusable'}
      </p>
      <div className="mt-3 flex items-center gap-3 text-xs font-medium">
        <button onClick={toggleLog} className="text-blue-600 hover:text-blue-700">
          {showLog ? 'Hide activity' : 'Activity'}
        </button>
        {code.status === 'ACTIVE' && (
          <button
            onClick={handleRevoke}
            disabled={revoking}
            className="text-red-600 hover:text-red-700 disabled:opacity-50"
          >
            {revoking ? 'Revoking…' : 'Revoke'}
          </button>
        )}
      </div>
      {showLog && (
        <div className="mt-3 space-y-1 border-t border-gray-100 pt-3 text-xs text-gray-600">
          {logs === null && <p className="text-gray-400">Loading…</p>}
          {logs?.length === 0 && <p className="text-gray-400">Not used at the gate yet.</p>}
          {logs?.map((entry) => (
            <p key={entry.id} className="flex justify-between gap-2">
              <span>{ACTION_LABEL[entry.action]}</span>
              <span className="shrink-0 text-gray-400">
                {new Date(entry.occurredAt).toLocaleString()}
              </span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
