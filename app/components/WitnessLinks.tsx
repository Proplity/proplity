'use client';

import { useState } from 'react';
import { CheckCircle2, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/apiClient';
import type { AgreementWitnessView, RentAgreementView, WitnessSideKey } from '@/lib/api/types';

const inputClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none';
const messageOf = (err: unknown, fallback: string) =>
  (err as { response?: { data?: { error?: string } } }).response?.data?.error ?? fallback;
const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { dateStyle: 'medium' });

const SIDE_LABEL: Record<WitnessSideKey, string> = {
  LANDLORD: "Landlord's witness",
  TENANT: "Tenant's witness",
};

function SideRow({
  rentId,
  side,
  witness,
  linkDays,
  onChanged,
}: {
  rentId: string;
  side: WitnessSideKey;
  witness?: AgreementWitnessView;
  linkDays: number;
  onChanged: () => void;
}) {
  const [name, setName] = useState(witness?.name ?? '');
  const [email, setEmail] = useState(witness?.email ?? '');
  const [busy, setBusy] = useState(false);
  const signed = witness?.status === 'SIGNED';

  const send = async () => {
    setBusy(true);
    try {
      const res = await api.rents.agreement.witnesses.invite(rentId, {
        side,
        name: name.trim(),
        email: email.trim(),
      });
      toast.success(
        res.data.data.emailed
          ? `Link sent to ${email.trim()}.`
          : 'Link made. Email is not set up here, so it was not delivered.',
      );
      onChanged();
    } catch (err) {
      toast.error(messageOf(err, 'Could not send the link.'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.rents.agreement.witnesses.remove(rentId, side);
      setName('');
      setEmail('');
      onChanged();
    } catch (err) {
      toast.error(messageOf(err, 'Could not take the witness back.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2" data-testid={`witness-${side.toLowerCase()}`}>
      <p className="text-xs font-medium text-gray-700">{SIDE_LABEL[side]}</p>
      {signed && witness ? (
        <p className="flex items-start gap-1.5 text-sm text-green-700">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            {witness.signedName ?? witness.name} signed on{' '}
            {witness.signedAt ? day(witness.signedAt) : ''}
          </span>
        </p>
      ) : (
        <>
          {/* The landlord's witness address is hidden from the tenant, so there is nothing to prefill. */}
          <input
            className={inputClass}
            placeholder="Full name"
            aria-label={`${SIDE_LABEL[side]} full name`}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            type="email"
            className={inputClass}
            placeholder="Email address"
            aria-label={`${SIDE_LABEL[side]} email`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={send}
              disabled={busy || !name.trim() || !email.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Mail className="h-4 w-4" aria-hidden="true" />
              {witness ? 'Send the link again' : 'Email the link'}
            </button>
            {witness && (
              <button
                type="button"
                onClick={remove}
                disabled={busy}
                className="text-sm text-red-700 underline disabled:opacity-50"
              >
                Take back
              </button>
            )}
          </div>
          <p className="text-xs text-gray-500">
            {witness
              ? `Link sent ${day(witness.lastSentAt)}, good until ${day(witness.expiresAt)}.`
              : `The link works for ${linkDays} days and only for them.`}
          </p>
        </>
      )}
    </div>
  );
}

/**
 * Asks a witness on each side to sign through an emailed link, and shows who has. The property team
 * sees both sides; the tenant sees only their own witness. Renders nothing when the admin has this
 * switched off, or the agreement is not one that can be witnessed this way.
 */
export function WitnessLinks({
  rentId,
  agreement,
  sides,
  onChanged,
}: {
  rentId: string;
  agreement: RentAgreementView;
  sides: WitnessSideKey[];
  onChanged: () => void;
}) {
  const esign = agreement.witnessEsign;
  if (
    !esign?.enabled ||
    agreement.source !== 'GENERATED' ||
    !agreement.witnessRequired ||
    (agreement.status !== 'ISSUED' && agreement.status !== 'EXECUTED')
  ) {
    return null;
  }
  const rows = agreement.witnessSignatures ?? [];
  return (
    <div className="mt-4 border-t border-gray-100 pt-4">
      <h3 className="text-sm font-medium text-gray-900">Witnesses sign by email</h3>
      <p className="mt-1 text-xs text-gray-500">
        {esign.mustSign
          ? 'The agreement is not complete until a witness on each side has signed.'
          : 'Optional: a witness can sign through an emailed link instead of on paper.'}
      </p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {sides.map((side) => {
          const witness = rows.find((w) => w.side === side);
          return (
            <SideRow
              key={`${side}-${witness?.id ?? 'none'}-${witness?.status ?? ''}-${witness?.sendCount ?? 0}`}
              rentId={rentId}
              side={side}
              witness={witness}
              linkDays={esign.linkDays}
              onChanged={onChanged}
            />
          );
        })}
      </div>
    </div>
  );
}
