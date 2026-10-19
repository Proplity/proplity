'use client';

import { useState } from 'react';
import { ShieldCheck, ShieldX } from 'lucide-react';
import { useAccessCodes, useVerifyAccessCode } from '@/hooks/useAccessCodes';
import { AccessCodeCard } from './AccessCodeCard';
import type { AccessVerifyResult } from '@/lib/api/types';

const REFUSAL: Record<string, string> = {
  NOT_FOUND: 'No such code for this unit.',
  DENIED: 'Refused: the code was already used or is not valid yet.',
  EXPIRED_ATTEMPT: 'Refused: the code has expired.',
  REVOKED: 'Refused: the resident cancelled this code.',
};

// For the person at the gate or reception: pick the unit being visited, type the code the guest
// gives, and see at once whether to let them in. Each check is written to the code's activity log
// (a one-time code is used up when it lets someone in). Below it are the unit's codes, with
// Revoke and their activity.
export function GateCheckCard({ units }: { units: { id: string; unitNumber: string }[] }) {
  const [unitId, setUnitId] = useState(units[0]?.id ?? '');
  const [code, setCode] = useState('');
  const [result, setResult] = useState<AccessVerifyResult | null>(null);
  const { submit: verify, submitting, error } = useVerifyAccessCode();
  const { data: codes, refetch } = useAccessCodes(unitId || null);

  const handleVerify = async () => {
    setResult(null);
    try {
      setResult(await verify({ unitId, code: code.trim() }));
      setCode('');
      refetch();
    } catch {
      // shown through `error`
    }
  };

  if (units.length === 0) return null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="mb-1 font-semibold">Gate Check</h2>
      <p className="mb-4 text-sm text-gray-500">
        Check a guest&apos;s access code before letting them in.
      </p>
      <div className="space-y-2">
        <select
          value={unitId}
          onChange={(e) => {
            setUnitId(e.target.value);
            setResult(null);
          }}
          aria-label="Unit being visited"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
        >
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              Unit {u.unitNumber}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && code.trim().length >= 4 && handleVerify()}
            placeholder="Code from the guest"
            className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          <button
            onClick={handleVerify}
            disabled={submitting || code.trim().length < 4}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'Checking…' : 'Check'}
          </button>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        {result && (
          <div
            role="status"
            className={`flex items-start gap-2 rounded-lg p-3 text-sm ${
              result.granted ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
            }`}
          >
            {result.granted ? (
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <ShieldX className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span>
              {result.granted
                ? `Let in${result.guestName ? `: ${result.guestName}` : ''}.`
                : (REFUSAL[result.action ?? result.reason ?? 'NOT_FOUND'] ?? 'Refused.')}
            </span>
          </div>
        )}
      </div>

      {codes.length > 0 && (
        <div className="mt-5 space-y-3 border-t border-gray-100 pt-4">
          <p className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
            Codes for this unit
          </p>
          {codes.map((c) => (
            <AccessCodeCard key={c.id} code={c} onChanged={refetch} />
          ))}
        </div>
      )}
    </div>
  );
}
