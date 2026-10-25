'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { FileSignature, FileText, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/apiClient';
import { useAuth } from '@/context/AuthContext';
import { useFileViewer } from '@/context/FileViewerContext';
import { useRentAgreement } from '@/hooks/useRentAgreement';
import { uploadFile, uploadsEnabled } from '@/lib/uploadClient';
import { ConfirmDialog } from './ConfirmDialog';
import { RentSignatureCard } from './RentSignatureCard';
import { WitnessLinks } from './WitnessLinks';
import { StampDutyPay } from './StampDutyPay';
import type { Rent, RentAgreementView, StampDutyStatus } from '@/lib/api/types';

const inputClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none';

const messageOf = (err: unknown, fallback: string) =>
  (err as { response?: { data?: { error?: string } } }).response?.data?.error ?? fallback;

const STATUS_BADGE: Record<RentAgreementView['status'], { label: string; cls: string }> = {
  DRAFT: { label: 'Draft', cls: 'bg-amber-100 text-amber-800' },
  ISSUED: { label: 'Sent', cls: 'bg-blue-100 text-blue-700' },
  EXECUTED: { label: 'Signed', cls: 'bg-green-100 text-green-700' },
  VOID: { label: 'Withdrawn', cls: 'bg-gray-100 text-gray-600' },
};

const STAMP_LABEL: Record<StampDutyStatus, string> = {
  NOT_STARTED: 'Not started',
  IN_PROGRESS: 'In progress',
  STAMPED: 'Stamped',
};

function Header({ agreement }: { agreement?: RentAgreementView | null }) {
  const badge = agreement ? STATUS_BADGE[agreement.status] : null;
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 font-semibold">
        <FileSignature className="h-4.5 w-4.5 text-blue-600" />
        Rent Agreement
      </h2>
      {badge && (
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${badge.cls}`}>
          {badge.label}
          {agreement?.source === 'UPLOADED' ? ' · uploaded' : ''}
        </span>
      )}
    </div>
  );
}

const button =
  'rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50';
const primary =
  'rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50';

function StampDuty({
  rentId,
  agreement,
  onChanged,
}: {
  rentId: string;
  agreement: RentAgreementView;
  onChanged: () => void;
}) {
  const { openFile } = useFileViewer();
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<StampDutyStatus>(agreement.stampDutyStatus);
  const [reference, setReference] = useState(agreement.stampDutyReference ?? '');
  const [amount, setAmount] = useState(
    agreement.stampDutyAmount == null ? '' : String(agreement.stampDutyAmount),
  );
  const [saving, setSaving] = useState(false);

  const save = async (receiptUrl?: string) => {
    setSaving(true);
    try {
      await api.rents.agreement.stampDuty(rentId, {
        status,
        reference: reference.trim() || null,
        amount: amount.trim() === '' ? null : Number(amount),
        ...(receiptUrl ? { receiptUrl } : {}),
      });
      toast.success('Stamp duty saved.');
      onChanged();
    } catch (err) {
      toast.error(messageOf(err, 'Could not save stamp duty.'));
    } finally {
      setSaving(false);
    }
  };

  const attachReceipt = async (file: File) => {
    setSaving(true);
    try {
      const uploaded = await uploadFile(file, 'rents');
      await api.rents.agreement.stampDuty(rentId, { receiptUrl: uploaded.url });
      toast.success('Receipt added.');
      onChanged();
    } catch (err) {
      toast.error(messageOf(err, 'Could not upload the receipt.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 border-t border-gray-100 pt-4">
      <h3 className="text-sm font-medium text-gray-900">Stamp duty</h3>
      <p className="mt-1 text-xs text-gray-500">
        Paid to the tax authority after signing, either by you or through Proplity above. Record
        where it stands and keep the receipt here.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-700">Status</span>
          <select
            className={inputClass}
            value={status}
            onChange={(e) => setStatus(e.target.value as StampDutyStatus)}
          >
            {(Object.keys(STAMP_LABEL) as StampDutyStatus[]).map((s) => (
              <option key={s} value={s}>
                {STAMP_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-700">Reference</span>
          <input
            className={inputClass}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-700">Amount (₦)</span>
          <input
            type="number"
            min={0}
            className={inputClass}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => save()} disabled={saving} className={primary}>
          Save
        </button>
        {uploadsEnabled() && (
          <>
            <button
              type="button"
              onClick={() => input.current?.click()}
              disabled={saving}
              className={button}
            >
              {agreement.stampDutyReceiptUrl ? 'Replace receipt' : 'Add receipt'}
            </button>
            <input
              ref={input}
              type="file"
              accept="application/pdf,image/*"
              className="sr-only"
              aria-label="Stamp duty receipt"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void attachReceipt(file);
                e.target.value = '';
              }}
            />
          </>
        )}
        {agreement.stampDutyReceiptUrl && (
          <button
            type="button"
            className="text-sm text-blue-600 underline"
            onClick={() =>
              openFile({
                url: agreement.stampDutyReceiptUrl!,
                name: 'Stamp duty receipt',
                type: 'application/pdf',
              })
            }
          >
            View receipt
          </button>
        )}
      </div>
    </div>
  );
}

function Witnesses({
  rentId,
  agreement,
  onChanged,
}: {
  rentId: string;
  agreement: RentAgreementView;
  onChanged: () => void;
}) {
  const [w, setW] = useState(agreement.witnesses ?? {});
  const [saving, setSaving] = useState(false);
  const set = (side: 'landlord' | 'tenant', key: 'name' | 'address', value: string) =>
    setW({
      ...w,
      [side]: { name: w[side]?.name ?? '', address: w[side]?.address ?? '', [key]: value },
    });

  const save = async () => {
    setSaving(true);
    try {
      await api.rents.agreement.update(rentId, { witnesses: w });
      toast.success('Witness details saved.');
      onChanged();
    } catch (err) {
      toast.error(messageOf(err, 'Could not save the witnesses.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <details className="mt-4 border-t border-gray-100 pt-4">
      <summary className="cursor-pointer text-sm font-medium text-gray-900">
        Witness details
      </summary>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {(['landlord', 'tenant'] as const).map((side) => (
          <div key={side} className="space-y-2">
            <p className="text-xs font-medium text-gray-700">
              {side === 'landlord' ? "Landlord's" : "Tenant's"} witness
            </p>
            <input
              className={inputClass}
              placeholder="Full name"
              value={w[side]?.name ?? ''}
              onChange={(e) => set(side, 'name', e.target.value)}
            />
            <input
              className={inputClass}
              placeholder="Address"
              value={w[side]?.address ?? ''}
              onChange={(e) => set(side, 'address', e.target.value)}
            />
          </div>
        ))}
      </div>
      <button type="button" onClick={save} disabled={saving} className={`${primary} mt-3`}>
        Save witnesses
      </button>
    </details>
  );
}

function TeamView({ rent, onChanged }: { rent: Rent; onChanged: () => void }) {
  const { data: agreement, findings, loading, refetch } = useRentAgreement(rent.id);
  const { openFile } = useFileViewer();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [confirmVoid, setConfirmVoid] = useState(false);

  const changed = () => {
    void refetch();
    onChanged();
  };

  const run = async (action: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await action();
      toast.success(done);
      changed();
    } catch (err) {
      toast.error(messageOf(err, 'That did not work. Please try again.'));
    } finally {
      setBusy(false);
      setConfirmVoid(false);
    }
  };

  const upload = (file: File) =>
    run(async () => {
      const uploaded = await uploadFile(file, 'rents');
      await api.rents.agreement.create(rent.id, { source: 'UPLOADED', fileUrl: uploaded.url });
    }, 'Uploaded. The tenant has been asked to confirm it.');

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <Header />
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  const noSignatures = (rent.signatures ?? []).length === 0;

  if (!agreement) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <Header />
          <p className="text-sm text-gray-600">
            Make the rent agreement here: from a template, or upload one you already have. The
            tenant is asked to sign or confirm it on Proplity.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href={`/dashboard/tenants/${rent.id}/agreement`} className={primary}>
              Create from a template
            </Link>
            {uploadsEnabled() ? (
              <>
                <button
                  type="button"
                  onClick={() => input.current?.click()}
                  disabled={busy}
                  className={`${button} inline-flex items-center gap-2`}
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  Upload one I already have
                </button>
                <input
                  ref={input}
                  type="file"
                  accept="application/pdf,image/*"
                  className="sr-only"
                  aria-label="Existing rent agreement file"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void upload(file);
                    e.target.value = '';
                  }}
                />
              </>
            ) : (
              <span className="self-center text-xs text-gray-500">
                Uploading files is not available yet.
              </span>
            )}
          </div>
        </div>
        <RentSignatureCard rent={rent} onSigned={changed} />
      </div>
    );
  }

  const uploaded = agreement.source === 'UPLOADED';
  const tenantName = rent.tenant?.name ?? 'the tenant';

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <Header agreement={agreement} />

        {findings.length > 0 && agreement.status !== 'EXECUTED' && (
          <ul className="mb-4 space-y-2">
            {findings.map((f) => (
              <li
                key={f.message}
                className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
              >
                {f.message}
              </li>
            ))}
          </ul>
        )}

        <p className="text-sm text-gray-700">
          {agreement.status === 'DRAFT' && 'A draft. The tenant cannot see it until you send it.'}
          {agreement.status === 'ISSUED' &&
            (uploaded
              ? `Waiting for ${tenantName} to confirm it with their name.`
              : `Sent to ${tenantName}. It is signed when both sides have added their name.`)}
          {agreement.status === 'EXECUTED' &&
            (uploaded && agreement.confirmedAt
              ? `${agreement.confirmedName} confirmed it on ${new Date(agreement.confirmedAt).toLocaleDateString('en-GB')}.`
              : 'Signed by both sides.')}
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          {!uploaded && (
            <>
              <Link href={`/agreements/${rent.id}`} className={button}>
                View and print
              </Link>
              <a href={`/api/v1/rents/${rent.id}/agreement/pdf`} download className={button}>
                Download PDF
              </a>
            </>
          )}
          {uploaded && agreement.fileUrl && (
            <button
              type="button"
              className={`${button} inline-flex items-center gap-2`}
              onClick={() =>
                openFile({
                  url: agreement.fileUrl!,
                  name: 'Rent Agreement',
                  type: 'application/pdf',
                })
              }
            >
              <FileText className="h-4 w-4" />
              Open the agreement
            </button>
          )}
          {agreement.status === 'DRAFT' && !uploaded && (
            <>
              <Link href={`/dashboard/tenants/${rent.id}/agreement`} className={button}>
                Edit the draft
              </Link>
              <button
                type="button"
                disabled={busy}
                className={primary}
                onClick={() => run(() => api.rents.agreement.issue(rent.id), 'Sent to the tenant.')}
              >
                Send to the tenant
              </button>
            </>
          )}
          {(agreement.status === 'DRAFT' ||
            (agreement.status === 'ISSUED' && (uploaded || noSignatures))) && (
            <button
              type="button"
              disabled={busy}
              className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
              onClick={() => setConfirmVoid(true)}
            >
              Withdraw
            </button>
          )}
        </div>

        {agreement.status !== 'EXECUTED' && !uploaded && (
          <Witnesses rentId={rent.id} agreement={agreement} onChanged={changed} />
        )}
        <WitnessLinks
          rentId={rent.id}
          agreement={agreement}
          sides={['LANDLORD', 'TENANT']}
          onChanged={changed}
        />
        {agreement.status === 'EXECUTED' && <StampDutyPay rentId={rent.id} />}
        {agreement.status !== 'DRAFT' && (
          <StampDuty rentId={rent.id} agreement={agreement} onChanged={changed} />
        )}
      </div>

      {agreement.status === 'ISSUED' && !uploaded && (
        <RentSignatureCard rent={rent} onSigned={changed} />
      )}

      <ConfirmDialog
        open={confirmVoid}
        title="Withdraw this agreement?"
        description={
          agreement.status === 'DRAFT'
            ? 'The draft is discarded and any credits it took are given back.'
            : `${tenantName} is told not to sign it. Credits it took are not given back once it has been sent.`
        }
        confirmLabel="Withdraw"
        cancelLabel="Keep it"
        variant="warning"
        isLoading={busy}
        onCancel={() => setConfirmVoid(false)}
        onConfirm={() => run(() => api.rents.agreement.void(rent.id), 'Withdrawn.')}
      />
    </div>
  );
}

function TenantView({ rent, onChanged }: { rent: Rent; onChanged: () => void }) {
  const { data: agreement, loading, refetch } = useRentAgreement(rent.id);
  const { openFile } = useFileViewer();
  const [fullName, setFullName] = useState('');
  const [busy, setBusy] = useState(false);

  const changed = () => {
    void refetch();
    onChanged();
  };

  if (loading) return null;
  // No agreement (or none sent yet): the rent is signed the way it always was.
  if (!agreement) return <RentSignatureCard rent={rent} onSigned={changed} />;

  const uploaded = agreement.source === 'UPLOADED';
  const confirm = async () => {
    setBusy(true);
    try {
      await api.rents.agreement.confirm(rent.id, fullName.trim());
      toast.success('Thank you. The agreement is confirmed.');
      setFullName('');
      changed();
    } catch (err) {
      toast.error(messageOf(err, 'Could not confirm the agreement.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <Header agreement={agreement} />
        <p className="text-sm text-gray-700">
          {agreement.status === 'EXECUTED'
            ? 'This agreement is signed. You can read or print it any time.'
            : uploaded
              ? 'Your landlord uploaded your rent agreement. Read it, then confirm it below with your full name.'
              : 'Your landlord sent your rent agreement. Read it, then add your signature below.'}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {uploaded && agreement.fileUrl ? (
            <button
              type="button"
              className={`${button} inline-flex items-center gap-2`}
              onClick={() =>
                openFile({
                  url: agreement.fileUrl!,
                  name: 'Rent Agreement',
                  type: 'application/pdf',
                })
              }
            >
              <FileText className="h-4 w-4" />
              Read the agreement
            </button>
          ) : (
            <>
              <Link href={`/agreements/${rent.id}`} className={button}>
                Read and print the agreement
              </Link>
              <a href={`/api/v1/rents/${rent.id}/agreement/pdf`} download className={button}>
                Download PDF
              </a>
            </>
          )}
        </div>

        <WitnessLinks
          rentId={rent.id}
          agreement={agreement}
          sides={['TENANT']}
          onChanged={changed}
        />
        {agreement.status === 'EXECUTED' && <StampDutyPay rentId={rent.id} />}

        {uploaded && agreement.status === 'ISSUED' && (
          <div className="mt-5 space-y-2 border-t border-gray-100 pt-4">
            <label className="block text-sm text-gray-600" htmlFor="confirm-name">
              Type your full legal name to confirm this agreement
            </label>
            <input
              id="confirm-name"
              className={inputClass}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Full name"
            />
            <button
              type="button"
              onClick={confirm}
              disabled={busy || !fullName.trim()}
              className={`${primary} w-full`}
            >
              {busy ? 'Confirming…' : 'Confirm Agreement'}
            </button>
          </div>
        )}
      </div>

      {!uploaded && <RentSignatureCard rent={rent} onSigned={changed} />}
    </div>
  );
}

/**
 * The rent agreement on a rent's page. The property team makes it (from a template, or by
 * uploading one they already have), sends it, tracks witnesses and stamp duty; the tenant reads it
 * and signs or confirms it. A rent with no agreement keeps the plain signature card it always had.
 */
export function RentAgreementCard({ rent, onChanged }: { rent: Rent; onChanged: () => void }) {
  const auth = useAuth();
  if (auth.user?.role === 'tenant') return <TenantView rent={rent} onChanged={onChanged} />;
  return <TeamView rent={rent} onChanged={onChanged} />;
}
