'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/apiClient';
import { Switch } from '@/app/components/ui/switch';
import { RULE_MODES } from '@/lib/agreementOptions';
import type { Jurisdiction, RuleMode } from '@/lib/api/types';
import { Field, inputClass, message } from './ui';

type Draft = {
  key: string;
  name: string;
  states: string;
  isDefault: boolean;
  isActive: boolean;
  advanceRentMaxMonths: string;
  advanceRentMode: RuleMode;
  noticeMonthly: string;
  noticeQuarterly: string;
  noticeBiAnnual: string;
  noticeAnnual: string;
  excludedAreas: string;
  excludedAreasMode: RuleMode;
  registrationThresholdYears: string;
  stampDutyNote: string;
  stampTiers: { upTo: string; rate: string }[];
  stampBasis: 'ANNUAL_RENT' | 'TERM_RENT';
  sourceNote: string;
  rulesCheckedAt: string;
  lawyerReviewed: boolean;
  sortOrder: string;
};

const list = (v: string) =>
  v
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
const optionalInt = (v: string) => (v.trim() === '' ? null : Number(v));

const draftOf = (j?: Jurisdiction): Draft => ({
  key: j?.key ?? '',
  name: j?.name ?? '',
  states: (j?.states ?? []).join(', '),
  isDefault: j?.isDefault ?? false,
  isActive: j?.isActive ?? true,
  advanceRentMaxMonths: j?.advanceRentMaxMonths == null ? '' : String(j.advanceRentMaxMonths),
  advanceRentMode: j?.advanceRentMode ?? 'WARN',
  noticeMonthly: String(j?.noticeDays.MONTHLY ?? ''),
  noticeQuarterly: String(j?.noticeDays.QUARTERLY ?? ''),
  noticeBiAnnual: String(j?.noticeDays.BI_ANNUAL ?? ''),
  noticeAnnual: String(j?.noticeDays.ANNUAL ?? ''),
  excludedAreas: (j?.excludedAreas ?? []).join(', '),
  excludedAreasMode: j?.excludedAreasMode ?? 'WARN',
  registrationThresholdYears:
    j?.registrationThresholdYears == null ? '' : String(j.registrationThresholdYears),
  stampDutyNote: j?.stampDutyNote ?? '',
  stampTiers: (j?.stampDutyTiers ?? []).map((t) => ({
    upTo: t.upToYears == null ? '' : String(t.upToYears),
    rate: String(t.ratePercent),
  })),
  stampBasis: j?.stampDutyBasis ?? 'TERM_RENT',
  sourceNote: j?.sourceNote ?? '',
  rulesCheckedAt: j?.rulesCheckedAt ? j.rulesCheckedAt.slice(0, 10) : '',
  lawyerReviewed: j?.lawyerReviewed ?? false,
  sortOrder: String(j?.sortOrder ?? 0),
});

function bodyOf(d: Draft) {
  const days = (v: string) => (v.trim() === '' ? undefined : Number(v));
  return {
    name: d.name.trim(),
    states: list(d.states),
    isDefault: d.isDefault,
    isActive: d.isActive,
    advanceRentMaxMonths: optionalInt(d.advanceRentMaxMonths),
    advanceRentMode: d.advanceRentMode,
    noticeDays: Object.fromEntries(
      Object.entries({
        MONTHLY: days(d.noticeMonthly),
        QUARTERLY: days(d.noticeQuarterly),
        BI_ANNUAL: days(d.noticeBiAnnual),
        ANNUAL: days(d.noticeAnnual),
      }).filter(([, v]) => v !== undefined),
    ),
    excludedAreas: list(d.excludedAreas),
    excludedAreasMode: d.excludedAreasMode,
    registrationThresholdYears: optionalInt(d.registrationThresholdYears),
    stampDutyNote: d.stampDutyNote.trim() || null,
    stampDutyTiers: d.stampTiers.map((t, i, all) => ({
      upToYears: i === all.length - 1 || t.upTo.trim() === '' ? null : Number(t.upTo),
      ratePercent: Number(t.rate),
    })),
    stampDutyBasis: d.stampBasis,
    sourceNote: d.sourceNote.trim() || null,
    rulesCheckedAt: d.rulesCheckedAt ? new Date(d.rulesCheckedAt).toISOString() : null,
    lawyerReviewed: d.lawyerReviewed,
    sortOrder: Number(d.sortOrder) || 0,
  };
}

function ModeSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: RuleMode;
  onChange: (v: RuleMode) => void;
}) {
  return (
    <Field label={label}>
      <select
        className={inputClass}
        value={value}
        onChange={(e) => onChange(e.target.value as RuleMode)}
      >
        {RULE_MODES.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

function Editor({
  jurisdiction,
  onDone,
  onCancel,
}: {
  jurisdiction?: Jurisdiction;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [d, setD] = useState<Draft>(() => draftOf(jurisdiction));
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      if (jurisdiction) await api.admin.jurisdictions.update(jurisdiction.id, bodyOf(d));
      else await api.admin.jurisdictions.create({ key: d.key.trim(), ...bodyOf(d) });
      toast.success('Jurisdiction saved.');
      onDone();
    } catch (err) {
      toast.error(message(err, 'Could not save the jurisdiction.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 rounded-lg border border-blue-200 bg-blue-50/30 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          <input
            className={inputClass}
            value={d.name}
            onChange={(e) => set('name', e.target.value)}
          />
        </Field>
        <Field
          label="Key"
          hint={jurisdiction ? 'Fixed once created.' : 'Lower-case letters, numbers and dashes.'}
        >
          <input
            className={inputClass}
            value={d.key}
            disabled={!!jurisdiction}
            onChange={(e) => set('key', e.target.value)}
          />
        </Field>
        <Field
          label="States it covers"
          hint="Comma-separated, as they appear on properties (Lagos, FCT, Abuja)."
        >
          <input
            className={inputClass}
            value={d.states}
            onChange={(e) => set('states', e.target.value)}
          />
        </Field>
        <Field label="Order in lists">
          <input
            type="number"
            className={inputClass}
            value={d.sortOrder}
            onChange={(e) => set('sortOrder', e.target.value)}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Most months of rent collected at once" hint="Blank means no limit.">
          <input
            type="number"
            min={1}
            className={inputClass}
            value={d.advanceRentMaxMonths}
            onChange={(e) => set('advanceRentMaxMonths', e.target.value)}
          />
        </Field>
        <ModeSelect
          label="When a tenancy collects more"
          value={d.advanceRentMode}
          onChange={(v) => set('advanceRentMode', v)}
        />
        <Field
          label="Tenancy of this many years may need a registered deed"
          hint="Blank means no threshold."
        >
          <input
            type="number"
            min={1}
            className={inputClass}
            value={d.registrationThresholdYears}
            onChange={(e) => set('registrationThresholdYears', e.target.value)}
          />
        </Field>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-gray-700">Notice to end a tenancy (days)</p>
        <div className="grid gap-4 sm:grid-cols-4">
          {(
            [
              ['noticeMonthly', 'Paid monthly'],
              ['noticeQuarterly', 'Paid quarterly'],
              ['noticeBiAnnual', 'Paid every 6 months'],
              ['noticeAnnual', 'Paid yearly'],
            ] as const
          ).map(([k, label]) => (
            <Field key={k} label={label}>
              <input
                type="number"
                min={1}
                className={inputClass}
                value={d[k]}
                onChange={(e) => set(k, e.target.value)}
              />
            </Field>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <Field
            label="Areas the law does not cover"
            hint="Comma-separated; matched against a property's address and city."
          >
            <input
              className={inputClass}
              value={d.excludedAreas}
              onChange={(e) => set('excludedAreas', e.target.value)}
            />
          </Field>
        </div>
        <ModeSelect
          label="For a property in those areas"
          value={d.excludedAreasMode}
          onChange={(v) => set('excludedAreasMode', v)}
        />
      </div>

      <Field label="Stamp duty note">
        <textarea
          rows={2}
          className={inputClass}
          value={d.stampDutyNote}
          onChange={(e) => set('stampDutyNote', e.target.value)}
        />
      </Field>
      <fieldset className="space-y-2 rounded-lg border border-gray-200 p-3">
        <legend className="px-1 text-xs font-medium text-gray-700">
          Stamp duty rates (used to quote stamp duty paid through Proplity)
        </legend>
        {d.stampTiers.map((t, i) => {
          const last = i === d.stampTiers.length - 1;
          return (
            <div key={i} className="flex flex-wrap items-end gap-2">
              <div className="w-40">
                <Field label={last ? 'Longer than that' : 'Tenancy shorter than (years)'}>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    disabled={last}
                    className={inputClass}
                    value={last ? '' : t.upTo}
                    onChange={(e) =>
                      set(
                        'stampTiers',
                        d.stampTiers.map((x, k) => (k === i ? { ...x, upTo: e.target.value } : x)),
                      )
                    }
                  />
                </Field>
              </div>
              <div className="w-32">
                <Field label="Rate (%)">
                  <input
                    type="number"
                    min={0}
                    step="any"
                    className={inputClass}
                    value={t.rate}
                    onChange={(e) =>
                      set(
                        'stampTiers',
                        d.stampTiers.map((x, k) => (k === i ? { ...x, rate: e.target.value } : x)),
                      )
                    }
                  />
                </Field>
              </div>
              <button
                type="button"
                className="mb-2 text-sm text-red-700 underline"
                onClick={() =>
                  set(
                    'stampTiers',
                    d.stampTiers.filter((_, k) => k !== i),
                  )
                }
              >
                Remove
              </button>
            </div>
          );
        })}
        <button
          type="button"
          className="text-sm font-medium text-blue-700 underline"
          onClick={() => set('stampTiers', [...d.stampTiers, { upTo: '', rate: '' }])}
        >
          Add a rate
        </button>
        <Field label="The rate is charged on">
          <select
            className={inputClass}
            value={d.stampBasis}
            onChange={(e) => set('stampBasis', e.target.value as Draft['stampBasis'])}
          >
            <option value="TERM_RENT">All the rent for the whole tenancy</option>
            <option value="ANNUAL_RENT">One year&apos;s rent</option>
          </select>
        </Field>
        <p className="text-xs text-gray-500">
          No rates: stamp duty cannot be quoted for this place. Put the tiers in order, shortest
          tenancy first; the last has no limit.
        </p>
      </fieldset>
      <Field label="Where these rules came from, and what is unconfirmed">
        <textarea
          rows={3}
          className={inputClass}
          value={d.sourceNote}
          onChange={(e) => set('sourceNote', e.target.value)}
        />
      </Field>

      <div className="flex flex-wrap items-end gap-6">
        <div className="w-48">
          <Field label="Rules last checked">
            <input
              type="date"
              className={inputClass}
              value={d.rulesCheckedAt}
              onChange={(e) => set('rulesCheckedAt', e.target.value)}
            />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-800">
          <Switch
            checked={d.lawyerReviewed}
            onCheckedChange={(v) => set('lawyerReviewed', v)}
            aria-label="Reviewed by a lawyer"
          />
          Reviewed by a lawyer
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-800">
          <Switch
            checked={d.isActive}
            onCheckedChange={(v) => set('isActive', v)}
            aria-label="In use"
          />
          In use
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-800">
          <Switch
            checked={d.isDefault}
            onCheckedChange={(v) => set('isDefault', v)}
            aria-label="Default for other states"
          />
          Default for states with no entry
        </label>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving || !d.name.trim() || (!jurisdiction && !d.key.trim())}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save jurisdiction'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function JurisdictionsPanel() {
  const [items, setItems] = useState<Jurisdiction[] | null>(null);
  const [editing, setEditing] = useState<string | 'new' | null>(null);

  const load = useCallback(async () => {
    try {
      setItems((await api.admin.jurisdictions.list()).data.data);
    } catch {
      toast.error('Failed to load the jurisdictions.');
    }
  }, []);

  useEffect(() => {
    // Load once on mount; the list is replaced after every save.
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  const remove = async (j: Jurisdiction) => {
    if (!window.confirm(`Delete ${j.name}? This cannot be undone.`)) return;
    try {
      await api.admin.jurisdictions.remove(j.id);
      toast.success('Deleted.');
      await load();
    } catch (err) {
      toast.error(message(err, 'Could not delete it.'));
    }
  };

  if (!items) return <Loader2 className="h-5 w-5 animate-spin text-gray-400" />;

  return (
    <div className="space-y-4">
      <p className="max-w-2xl text-sm text-gray-600">
        Each place has its own rules for rent paid in advance, notice and registration. A property
        uses the jurisdiction whose states include its state, or the default one.
      </p>

      {items.map((j) =>
        editing === j.id ? (
          <Editor
            key={j.id}
            jurisdiction={j}
            onCancel={() => setEditing(null)}
            onDone={() => {
              setEditing(null);
              void load();
            }}
          />
        ) : (
          <div key={j.id} className="rounded-lg border border-gray-200 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium text-gray-900">
                  {j.name}{' '}
                  {j.isDefault && (
                    <span className="ml-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                      Default
                    </span>
                  )}
                  {!j.isActive && (
                    <span className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                      Not in use
                    </span>
                  )}
                  <span
                    className={`ml-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                      j.lawyerReviewed
                        ? 'bg-green-100 text-green-700'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {j.lawyerReviewed ? 'Reviewed by a lawyer' : 'Not reviewed by a lawyer'}
                  </span>
                </p>
                <p className="mt-1 text-xs text-gray-600">
                  Covers: {j.states.length > 0 ? j.states.join(', ') : 'states with no entry'} ·
                  Advance rent:{' '}
                  {j.advanceRentMaxMonths === null
                    ? 'no limit'
                    : `up to ${j.advanceRentMaxMonths} months (${j.advanceRentMode.toLowerCase()})`}
                  {j.rulesCheckedAt &&
                    ` · Checked ${new Date(j.rulesCheckedAt).toLocaleDateString('en-GB')}`}
                </p>
                {j.sourceNote && (
                  <p className="mt-2 max-w-3xl text-xs text-gray-500">{j.sourceNote}</p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(j.id)}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Edit
                </button>
                {!j.isDefault && (
                  <button
                    type="button"
                    onClick={() => remove(j)}
                    aria-label={`Delete ${j.name}`}
                    className="rounded-lg border border-red-200 p-1.5 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ),
      )}

      {editing === 'new' ? (
        <Editor
          onCancel={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            void load();
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
        >
          <Plus className="h-4 w-4" />
          Add a jurisdiction
        </button>
      )}
    </div>
  );
}
