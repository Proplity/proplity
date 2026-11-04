'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/apiClient';
import { useRentAgreement } from '@/hooks/useRentAgreement';
import { BuyCreditsButton } from './BuyCreditsButton';
import type {
  AgreementChoices,
  AgreementOptions,
  AgreementPreview,
  AgreementWitnesses,
  GeneratedAgreementInput,
  RentAgreementView,
} from '@/lib/api/types';

const inputClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none';

type ApiError = {
  response?: { data?: { error?: string; findings?: AgreementPreview['findings'] } };
};
const messageOf = (err: unknown, fallback: string) =>
  (err as ApiError).response?.data?.error ?? fallback;

const money = (v: string) => (v.trim() === '' ? null : Number(v));

function Findings({ items }: { items: AgreementPreview['findings'] }) {
  if (items.length === 0) return null;
  return (
    <ul className="space-y-2" role="status">
      {items.map((f) => (
        <li
          key={f.message}
          className={`flex gap-2 rounded-lg border p-3 text-sm ${
            f.mode === 'BLOCK'
              ? 'border-red-200 bg-red-50 text-red-800'
              : 'border-amber-200 bg-amber-50 text-amber-900'
          }`}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {f.message}
        </li>
      ))}
    </ul>
  );
}

/**
 * The form that makes a rent agreement from a template: who the landlord is, the fees on offer,
 * which optional clauses to keep, the wording of the editable ones, special conditions under the
 * landlord's own heading and a witness on each side, with a live preview of the finished text.
 * Saving makes a draft the tenant cannot see; sending it is a separate step.
 */
export function AgreementBuilder({ rentId }: { rentId: string }) {
  const { data: existing, loading: existingLoading } = useRentAgreement(rentId);
  const [options, setOptions] = useState<AgreementOptions | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.rents.agreement
      .options(rentId)
      .then((res) => {
        if (!cancelled) setOptions(res.data.data);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(messageOf(err, 'Could not load the agreement options.'));
      });
    return () => {
      cancelled = true;
    };
  }, [rentId]);

  if (loadError) return <p className="p-6 text-sm text-red-600">{loadError}</p>;
  if (!options || existingLoading) {
    return (
      <p className="flex items-center gap-2 p-6 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </p>
    );
  }
  if (existing && existing.status !== 'DRAFT') {
    return (
      <div className="max-w-xl space-y-3 p-6">
        <h1 className="text-xl font-semibold">This rent already has an agreement</h1>
        <p className="text-sm text-gray-600">
          It has been sent, so its wording can no longer change. Withdraw it from the rent page if
          nobody has signed and you want to start again.
        </p>
        <Link href={`/dashboard/tenants/${rentId}`} className="text-sm text-blue-600 underline">
          Back to the rent
        </Link>
      </div>
    );
  }
  return <BuilderForm rentId={rentId} options={options} existing={existing} />;
}

function BuilderForm({
  rentId,
  options,
  existing,
}: {
  rentId: string;
  options: AgreementOptions;
  /** The draft being edited, if there is one. */
  existing: RentAgreementView | null;
}) {
  const router = useRouter();
  const draft =
    existing && existing.status === 'DRAFT' && existing.source === 'GENERATED' ? existing : null;
  const draftTemplate = draft
    ? options.templates.find((x) => x.key === draft.templateKey)
    : undefined;

  const [templateId, setTemplateId] = useState(
    draftTemplate?.id ?? (options.templates.length === 1 ? options.templates[0].id : ''),
  );
  const [landlordName, setLandlordName] = useState(
    draft && !options.landlord.hasAccount ? (draft.landlordName ?? '') : '',
  );
  const [agencyFee, setAgencyFee] = useState(draft?.agencyFee ? String(draft.agencyFee) : '');
  const [legalFee, setLegalFee] = useState(draft?.legalFee ? String(draft.legalFee) : '');
  const [omit, setOmit] = useState<Set<string>>(new Set(draft?.choices?.omit ?? []));
  const [include, setInclude] = useState<Set<string>>(new Set(draft?.choices?.include ?? []));
  const [edits, setEdits] = useState<Record<string, string>>(draft?.choices?.edits ?? {});
  const [rewording, setRewording] = useState<string | null>(null);
  const [specialConditions, setSpecialConditions] = useState(draft?.specialConditions ?? '');
  const [witnesses, setWitnesses] = useState<AgreementWitnesses>(draft?.witnesses ?? {});
  const [preview, setPreview] = useState<AgreementPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const template = options.templates.find((t) => t.id === templateId) ?? null;

  const choices: AgreementChoices = useMemo(
    () => ({
      ...(omit.size ? { omit: [...omit] } : {}),
      ...(include.size ? { include: [...include] } : {}),
      ...(Object.keys(edits).length ? { edits } : {}),
    }),
    [omit, include, edits],
  );

  const body: GeneratedAgreementInput | null = useMemo(
    () =>
      templateId
        ? {
            templateId,
            ...(landlordName.trim() ? { landlordName: landlordName.trim() } : {}),
            agencyFee: options.offers.agency ? money(agencyFee) : null,
            legalFee: options.offers.legal ? money(legalFee) : null,
            choices,
            specialConditions: specialConditions.trim() || null,
            witnesses: template?.witnessRequired ? witnesses : undefined,
          }
        : null,
    [
      templateId,
      landlordName,
      agencyFee,
      legalFee,
      choices,
      specialConditions,
      witnesses,
      template,
      options,
    ],
  );

  // A live preview, a moment after the last change. A slower answer to an older edit is dropped.
  const latest = useRef(0);
  useEffect(() => {
    if (!body) return;
    const ticket = ++latest.current;
    const timer = setTimeout(async () => {
      try {
        const res = await api.rents.agreement.preview(rentId, body);
        if (ticket !== latest.current) return;
        setPreview(res.data.data);
        setPreviewError(null);
      } catch (err) {
        if (ticket !== latest.current) return;
        setPreview(null);
        setPreviewError(messageOf(err, 'Could not preview the agreement.'));
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [body, rentId]);

  const toggleOptional = (id: string, defaultOn: boolean, on: boolean) => {
    const nextOmit = new Set(omit);
    const nextInclude = new Set(include);
    nextOmit.delete(id);
    nextInclude.delete(id);
    if (on && !defaultOn) nextInclude.add(id);
    if (!on && defaultOn) nextOmit.add(id);
    setOmit(nextOmit);
    setInclude(nextInclude);
  };

  const save = async (send: boolean) => {
    if (!body) return;
    setSaving(true);
    try {
      if (draft) {
        const { templateId: _t, ...changes } = body;
        await api.rents.agreement.update(rentId, changes);
      } else {
        await api.rents.agreement.create(rentId, { source: 'GENERATED', ...body });
      }
      if (send) {
        await api.rents.agreement.issue(rentId);
        toast.success('The agreement was sent to the tenant to sign.');
      } else {
        toast.success('Draft saved. The tenant cannot see it until you send it.');
      }
      router.push(`/dashboard/tenants/${rentId}`);
    } catch (err) {
      toast.error(messageOf(err, 'Could not save the agreement.'));
    } finally {
      setSaving(false);
    }
  };

  const optional = template?.clauses.filter((c) => c.mode === 'OPTIONAL') ?? [];
  const editable = template?.clauses.filter((c) => c.mode === 'EDITABLE') ?? [];
  const needsName = !options.landlord.hasAccount;
  const cost = options.credits.generateCost;
  const blocked = (preview?.findings ?? []).some((f) => f.mode === 'BLOCK');
  const canSave = !!body && !saving && !previewError && (!needsName || !!landlordName.trim());

  return (
    <div className="space-y-6 p-6">
      <div>
        <Link
          href={`/dashboard/tenants/${rentId}`}
          className="text-sm text-gray-600 hover:text-gray-900"
        >
          ← Back to the rent
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-900">Rent agreement</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-600">
          {options.jurisdiction ? `Made under the rules of ${options.jurisdiction.name}. ` : ''}
          {options.jurisdiction && !options.jurisdiction.lawyerReviewed && (
            <strong className="text-amber-800">
              The rules and wording for this place have not been reviewed by a lawyer; have one look
              at the finished agreement before it is signed.{' '}
            </strong>
          )}
          The tenant cannot see it until you send it.
        </p>
      </div>

      <Findings items={options.findings} />

      {options.templates.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-700">
          No agreement template is available for this place yet. An admin needs to approve one.
          Meanwhile you can upload an agreement you already have, from the rent page.
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
          <div className="space-y-5">
            {options.templates.length > 1 && (
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-700">Template</span>
                <select
                  className={inputClass}
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                >
                  <option value="">Choose a template</option>
                  {options.templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} (version {t.version})
                    </option>
                  ))}
                </select>
              </label>
            )}

            <fieldset className="space-y-2 rounded-lg border border-gray-200 bg-white p-4">
              <legend className="px-1 text-sm font-medium text-gray-900">Landlord</legend>
              {options.landlord.hasAccount ? (
                <p className="text-sm text-gray-700">
                  {options.landlord.name}{' '}
                  <span className="text-xs text-gray-500">(from the owner’s account)</span>
                </p>
              ) : options.landlord.canTypeName ? (
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-gray-700">
                    Owner’s full name
                  </span>
                  <input
                    className={inputClass}
                    value={landlordName}
                    onChange={(e) => setLandlordName(e.target.value)}
                    placeholder="As it should appear on the agreement"
                  />
                  <span className="mt-1 block text-xs text-gray-500">
                    This property has no landlord account, so you act for the owner and are named as
                    their agent.
                  </span>
                </label>
              ) : (
                <p className="text-sm text-red-700">
                  This property has no landlord account. Add the owner to the property before making
                  an agreement.
                </p>
              )}
            </fieldset>

            <fieldset className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
              <legend className="px-1 text-sm font-medium text-gray-900">Payments</legend>
              <p className="text-sm text-gray-700">
                Rent ₦{options.rent.rentAmount.toLocaleString()}
                {options.offers.caution &&
                  ` · caution deposit ₦${options.rent.deposit.toLocaleString()}`}{' '}
                <span className="text-xs text-gray-500">(taken from the rent)</span>
              </p>
              {options.offers.agency && (
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-gray-700">
                    Agency fee (₦, optional)
                  </span>
                  <input
                    type="number"
                    min={0}
                    className={inputClass}
                    value={agencyFee}
                    onChange={(e) => setAgencyFee(e.target.value)}
                  />
                </label>
              )}
              {options.offers.legal && (
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-gray-700">
                    Legal fee (₦, optional)
                  </span>
                  <input
                    type="number"
                    min={0}
                    className={inputClass}
                    value={legalFee}
                    onChange={(e) => setLegalFee(e.target.value)}
                  />
                </label>
              )}
            </fieldset>

            {optional.length > 0 && (
              <fieldset className="space-y-2 rounded-lg border border-gray-200 bg-white p-4">
                <legend className="px-1 text-sm font-medium text-gray-900">Optional clauses</legend>
                {optional.map((c) => {
                  const on = omit.has(c.id)
                    ? false
                    : include.has(c.id)
                      ? true
                      : (c.defaultOn ?? true);
                  return (
                    <label key={c.id} className="flex items-start gap-2 text-sm text-gray-800">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={on}
                        onChange={(e) =>
                          toggleOptional(c.id, c.defaultOn ?? true, e.target.checked)
                        }
                      />
                      <span>{c.title}</span>
                    </label>
                  );
                })}
              </fieldset>
            )}

            {editable.length > 0 && (
              <fieldset className="space-y-2 rounded-lg border border-gray-200 bg-white p-4">
                <legend className="px-1 text-sm font-medium text-gray-900">Reword a clause</legend>
                <p className="text-xs text-gray-500">
                  Locked clauses cannot be changed. Words like {'{{tenantName}}'} are filled in for
                  you.
                </p>
                {editable.map((c) => (
                  <div key={c.id} className="rounded-lg border border-gray-100 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-gray-800">{c.title}</span>
                      <button
                        type="button"
                        onClick={() => setRewording(rewording === c.id ? null : c.id)}
                        className="text-xs font-medium text-blue-600 hover:underline"
                      >
                        {edits[c.id] ? 'Edited' : 'Reword'}
                      </button>
                    </div>
                    {rewording === c.id && (
                      <div className="mt-2 space-y-2">
                        <textarea
                          rows={5}
                          className={inputClass}
                          value={edits[c.id] ?? c.body}
                          onChange={(e) => setEdits({ ...edits, [c.id]: e.target.value })}
                        />
                        {edits[c.id] && (
                          <button
                            type="button"
                            onClick={() => {
                              const next = { ...edits };
                              delete next[c.id];
                              setEdits(next);
                            }}
                            className="text-xs text-gray-600 underline"
                          >
                            Back to the template’s wording
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </fieldset>
            )}

            <label className="block rounded-lg border border-gray-200 bg-white p-4">
              <span className="mb-1 block text-sm font-medium text-gray-900">
                Special conditions
              </span>
              <textarea
                rows={4}
                className={inputClass}
                value={specialConditions}
                onChange={(e) => setSpecialConditions(e.target.value)}
                placeholder="Anything extra you and the tenant have agreed"
              />
              <span className="mt-1 block text-xs text-gray-500">
                Added at the end under your own heading, so it is clear it is not part of the
                standard wording.
              </span>
            </label>

            {template?.witnessRequired && (
              <fieldset className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
                <legend className="px-1 text-sm font-medium text-gray-900">Witnesses</legend>
                {(['landlord', 'tenant'] as const).map((side) => (
                  <div key={side} className="space-y-2">
                    <p className="text-xs font-medium text-gray-700">
                      {side === 'landlord' ? "Landlord's" : "Tenant's"} witness
                    </p>
                    <input
                      className={inputClass}
                      placeholder="Full name"
                      value={witnesses[side]?.name ?? ''}
                      onChange={(e) =>
                        setWitnesses({
                          ...witnesses,
                          [side]: { name: e.target.value, address: witnesses[side]?.address ?? '' },
                        })
                      }
                    />
                    <input
                      className={inputClass}
                      placeholder="Address"
                      value={witnesses[side]?.address ?? ''}
                      onChange={(e) =>
                        setWitnesses({
                          ...witnesses,
                          [side]: { name: witnesses[side]?.name ?? '', address: e.target.value },
                        })
                      }
                    />
                  </div>
                ))}
                <p className="text-xs text-gray-500">
                  Optional now: the names are printed on the agreement and the witness signs the
                  printed copy.
                </p>
              </fieldset>
            )}
          </div>

          <div className="space-y-4">
            {cost > 0 && (
              <p className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                Saving this agreement takes {cost} credit{cost === 1 ? '' : 's'}
                {options.credits.balance !== null && ` (you have ${options.credits.balance})`}.
                Changing the draft afterwards is free, and withdrawing it before you send it gives
                the credits back.{' '}
                {options.credits.balance !== null && options.credits.balance < cost && (
                  <BuyCreditsButton className="font-semibold text-blue-700 underline" />
                )}
              </p>
            )}
            <Findings items={preview?.findings ?? []} />
            {previewError && (
              <p
                className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
                role="alert"
              >
                {previewError}
              </p>
            )}
            <article
              aria-label="Preview of the agreement"
              className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
            >
              <p className="mb-4 text-xs font-medium tracking-wide text-gray-500 uppercase">
                Preview
              </p>
              {!body ? (
                <p className="text-sm text-gray-500">Choose a template to see the agreement.</p>
              ) : !preview ? (
                <p className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> Preparing the preview…
                </p>
              ) : (
                <ol className="space-y-4">
                  {preview.clauses.map((c, i) => (
                    <li key={c.id}>
                      <h2 className="text-sm font-semibold">
                        {i + 1}. {c.title}
                      </h2>
                      <p className="mt-1 text-sm leading-relaxed whitespace-pre-line text-gray-800">
                        {c.body}
                      </p>
                    </li>
                  ))}
                  {preview.specialConditions && (
                    <li>
                      <h2 className="text-sm font-semibold">
                        {preview.clauses.length + 1}. Special conditions added by the Landlord
                      </h2>
                      <p className="mt-1 text-sm leading-relaxed whitespace-pre-line text-gray-800">
                        {preview.specialConditions}
                      </p>
                    </li>
                  )}
                </ol>
              )}
            </article>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={!canSave || blocked}
                onClick={() => save(false)}
                className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50"
              >
                Save draft
              </button>
              <button
                type="button"
                disabled={!canSave || blocked}
                onClick={() => save(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save and send to the tenant
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
