'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSignRent } from '@/hooks/useRents';
import type { Rent } from '@/lib/api/types';

// Click-wrap e-signature: typed full legal name + timestamp + IP, not a
// drawn/uploaded image (no file-storage endpoint exists anywhere in this
// codebase). Fully executed once both a tenant-side and a landlord-side
// signature exist -- rent.agreementSignedAt tracks that, computed
// server-side in the sign route.
export function RentSignatureCard({ rent, onSigned }: { rent: Rent; onSigned: () => void }) {
  const auth = useAuth();
  const { submit: sign, submitting, error } = useSignRent(rent.id);
  const [fullName, setFullName] = useState('');

  const signatures = rent.signatures ?? [];
  const myUserId = auth.user?.id;
  const alreadySigned = signatures.some((s) => s.signerId === myUserId);
  const tenantSignature = signatures.find((s) => s.signerRole === 'TENANT');
  const landlordSideSignature = signatures.find((s) =>
    ['MANAGER', 'LANDLORD', 'ADMIN'].includes(s.signerRole),
  );

  const handleSign = async () => {
    if (!fullName.trim()) return;
    try {
      await sign(fullName.trim());
      setFullName('');
      onSigned();
    } catch {
      // error surfaced below
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold">Rent Agreement Signature</h2>
        {rent.agreementSignedAt && (
          <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
            Fully Executed
          </span>
        )}
      </div>

      <div className="mb-4 space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Tenant</span>
          <span className={tenantSignature ? 'font-medium text-green-700' : 'text-gray-400'}>
            {tenantSignature
              ? `Signed by ${tenantSignature.fullNameTyped} on ${new Date(tenantSignature.signedAt).toLocaleDateString()}`
              : 'Not yet signed'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Landlord/Manager</span>
          <span className={landlordSideSignature ? 'font-medium text-green-700' : 'text-gray-400'}>
            {landlordSideSignature
              ? `Signed by ${landlordSideSignature.fullNameTyped} on ${new Date(landlordSideSignature.signedAt).toLocaleDateString()}`
              : 'Not yet signed'}
          </span>
        </div>
      </div>

      {!alreadySigned && (
        <div className="space-y-2 border-t border-gray-100 pt-4">
          <label className="block text-sm text-gray-600">
            Type your full legal name to sign this agreement
          </label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Full name"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            onClick={handleSign}
            disabled={submitting || !fullName.trim()}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'Signing…' : 'Sign Agreement'}
          </button>
        </div>
      )}
    </div>
  );
}
